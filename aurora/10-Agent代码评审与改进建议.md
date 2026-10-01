# 10 · Agent 代码评审与改进建议（2026-10-01）

背景：对 `crates/octos-agent` 全量代码评审（主循环 loop_runner 4287 行、execution 4742 行、工具注册表、compaction_tiered、convergence、verifier、sandbox、worker.txt）。总体评价：**基础设施扎实，策略层偏薄**。沙箱 / SSRF / O_NOFOLLOW / BLOCKED_ENV_VARS / 三级 Compaction / ConcurrencyClass 隔离这些苦活都做了，但决定 Agent 智能上限的三处偏弱：**System Prompt、工具暴露策略、收敛/验证闭环**。按优先级 P0 → P2 排列。

关联前文：08-代理测试审计（工具行为）、04-优化循环台账（机制改动入口）、07-成本机制设计（燃料表/停摆刀）。

---

## 优点（保持住）

- 主循环职责划分清晰：loop_runner 管编排，execution 管并发语义，budget 管预算，convergence 管软收敛，verifier 管验证，llm_call 管重试。分层正确。
- 混合批次确定性语义（Safe 并行 → Exclusive 串行，读看不到同批写）在 execution.rs 头部注释写得非常清楚，比"全并行竞态"高一个档次。
- 三级 Compaction（compaction_tiered.rs）对标 Claude Code 思路正确：Tier-1 剪枝挡掉 20~40% 的 Tier-3 重型总结。
- 安全基座好：5 后端沙箱 + fail_closed、SSRF 集中检查（tools/ssrf.rs）、MCP schema 深度 10 / 64KB 限制。

---

## P0：先堵住 Runaway 和静默失守

### 1. max_iterations = 0 = unlimited + fail_closed = false 是最危险的默认值

- 位置：crates/octos-agent/src/agent/mod.rs（AgentConfig::max_iterations 默认为 0 即无限，注释"交互式 Codex 风格 turn 默认无限"）；配合 DEFAULT_TOOL_TIMEOUT_SECS = 1800、llm_first_token_grace = 180s、llm_call_max = 1200s，一个卡住的 glob / 推理模型就能 hang 住整个 turn。
- 位置：crates/octos-agent/src/sandbox/mod.rs —— SandboxMode::Auto + fail_closed = false 时无后端降级为 NoSandbox（仅 warn 一次）。合法但静默的失守。

建议：

- 交互式也给大但有限的上限（如 100~200 轮），0 改为显式 None/无限并要求显式 opt-in。
- fail_closed 对 shell / spawn / MCP stdio 默认收紧，或至少让 octos doctor + 首条 tool result 显眼提示当前是 Unconfined。
- 超时分级收敛：glob/list_dir/read_file/grep 这类纯读工具 120s 太长，15~30s 足够；180s TTFT grace 只给 reasoning 模型，普通 chat 模型 30~60s 即应重试/切换 lane。

### 2. 工具全量下发（RFC-0）是最大的 token 浪费源

- 现状：所有 enabled 工具每轮全 schema 下发，无 LRU 延迟、无 activate_tools。ToolRegistry 有 live_catalog + tool_search/tool_suggest，但主循环没用上。
- 代价：60+ 工具全量下发，prefix cache 友好但语义不友好——模型在 60 个 schema 里选，注意力稀释，误调率上升。

建议（分阶段，不推翻 RFC-0）：

- 默认只下发 group:fs + group:runtime + ask_user + 检索约 10~15 个核心工具，其余走 tool_search 按需拉取。catalog 基础设施已有，缺的只是一个 specs(core_only) 开关。
- 每个 ToolSpec 加 cost_hint（输入输出 token 量级），让 AdaptiveRouter / 模型选择时有依据。

---

## P1：决定智能上限的三件事

### 3. worker.txt 太薄（1.8KB），是最短的短板

- 位置：crates/octos-agent/src/prompts/worker.txt 只有"执行-汇报-升级"三句话 + 输出结构；researcher.txt 也只有 1.5KB。对比 4000+ 行的 loop_runner，模型侧指导几乎为零。
- 且"Respond in plain text only — no markdown"对代码任务是负优化。

建议：分层 Prompt，现在的 PromptSegmentProvider / prompt_segments 正好能装：

identity（Worker 身份与任务边界）+ tool_strategy（先 glob/grep 定位，再 read_window 读，再 diff_edit 改，最后 check 验证；不要 shell 写文件）+ safety（高危命令先 dry-run / 走 approval）+ output_contract（background 任务的一行总结+细节+caveats 保留，但允许 markdown 代码块）。

- 把 #28b bash_file_writes=warn/deny 的"优先用 edit_file"规则从 policy 注释提升为 prompt 规则，否则模型永远不知道。
- VIDEO_CALL_NOTE / [User sent an image] 拼装逻辑（loop_runner.rs compose_turn_user_content）应移入 prompt 段单元测试，避免散落在 loop 里。

### 4. Verifier 默认关闭，Convergence 阈值太松

- 位置：agent/verifier.rs —— AgentVerifierConfig.enabled 是 opt-in，无配置则热循环走 legacy EndTurn，不写 ledger。绝大多数 turn 没有"是否真在推进"的判断。
- 位置：agent/convergence.rs —— 默认 20 个 LLM calls / 100k tokens / 300s 才做一次软检查。对代码任务 20 轮无收敛检查已能把工作区改得面目全非。FileChurn / PeerPolling 的 force 通道很好，但触发依赖调用方。

建议：

- TurnLedger（无 LLM、纯结构化：intent/tool/args_fingerprint/outcome/error_class）默认常开，64 条内存环足够；LLM Verifier 采样开启（如每 5 轮或连续 2 次 tool error 后）。
- Convergence 收紧为：代码 profile 8~10 calls / 40k tokens / 120s，research profile 保持宽松。latest_reflection 应写入下一轮 context_event 而不仅是内存。
- LoopDetector + TurnLedger.repeating 联动：连续同 args_fingerprint + 同 error_class 直接 Escalate，不要等到 SHELL_SPIRAL_VARIANT。

### 5. Mixed-batch 的"读看不到同批写"必须让模型知道

- 这是 M8.8/#1766 引入的确定性语义，工程正确，但对模型反直觉：如果它在一批里先 edit_file 后 read_file 验证，会读到旧内容，误判"编辑没生效"再改一次，形成自激循环（#2131 同文件读 66 次的 pathology 很可能与此有关）。

建议三选一：

1. Prompt 明示："同批读写不保证顺序，如需验证请分两轮"；
2. 或 admission 层对"同文件读写同批"自动拆成两批执行；
3. 或至少在第二阶段结果里附 observed_pre_batch_state=true 标记。

---

## P2：代码健康与可观测性

### 6. 两个 God File 必须拆：loop_runner.rs 4287 行 / execution.rs 4742 行

- process_message_inner 横跨 budget → compaction → LLM → dispatch → contract，LoopDecision::Continue/CompactAndRetry/RotateAndRetry/Escalate/Exhausted/Grace 的处理在两处重复 match。
- execution.rs 的 7 元组 ToolCallResult + cascades 位是"布尔爆炸"，后续加字段必错。

建议：按 turn 阶段拆 loop_runner/{budget_guard.rs, compaction_gate.rs, llm_step.rs, dispatch_step.rs, end_turn.rs}；ToolCallResult 改为 struct + BatchOutcome 枚举。loop_runner_tests.rs 已 8405 行，正好做拆分安全网。

### 7. 生产路径还有 expect / unwrap

- grep 显示 execution.rs:2932 slot.expect(...)、3187 build_spawn_only...expect 在非 test 路径。结合 #[allow(clippy::too_many_arguments)]，热路径参数对象还没收敛。

建议：生产路径 expect 全部改为 LoopDecision::Grace + 结构化错误；call_llm_with_hooks_mode 的 7 参收敛为 LlmStepRequest struct。

### 8. 可观测性碎片化：TokenTracker / CostLedger / HarnessEvent / BlackBoxRecorder 各记各的

- 现状：AtomicU32 实时 tracker、cost_ledger、append_only_audit（默认仅 warn），但没有"一个 turn 一行 JSON"的统一轨迹。

建议：定义 TurnTrace { prompt_fingerprint, specs_hash, tool_calls[timing/cost], compaction_tier, verifier_verdict }，append_only_audit 从测量模式转准入模式（prompt prefix 改写即告警）。对 arc/ 评测闭环最有价值：没有 TurnTrace，ARC 失败归因只能靠猜。

---

## 落地顺序（最小阻力）

1. 本周：收紧 max_iterations 默认值 + 区分 reasoning/普通模型的 TTFT；worker.txt 加工具策略段（半天见效）。
2. 本迭代：specs(core_only) 开关 + 同文件读写拆批；TurnLedger 常开 + Convergence 按 profile 收紧。
3. 下迭代：拆 God File + TurnTrace 统一可观测 + fail_closed 默认值评审。

方法：TDD（should_<expected>_when_<condition> 规范），先从第 1 项开工：AgentConfig 上限测试 + worker.txt 工具策略段。

-- 主力评审人：Muse Spark（2026-10-01）
