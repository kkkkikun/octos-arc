# 05 · 优化点候选：keep 基线成本挖掘

2026-09-20 ｜ 数据源：`arc/arc-output/keep-baseline-0/.arc/llm-usage.jsonl`（161 请求）
+ `scratchpad/keep-baseline.log`。台账 #0（32/32，$0.91，68min）。

## 成本结构（结论）

| phase | 请求数 | prompt tokens | 其中缓存 | completion | 模型时间 |
|---|---|---|---|---|---|
| **repair** | **127（79%）** | **4.96M（92%）** | 4.58M | 190K | 28.5min |
| implement | 34 | 0.45M | 37K | **363K（65%）** | 31.0min |

未缓存 prompt ≈ 790K + completion 554K 是真实费用大头；缓存的 4.6M 虽便宜但拖
耗时与规模上限（T3 题 125 节点时会更糟）。

## 现象定位（三个）

### P1：修复 agent 循环拖着重基底多迭代（最大头）

top3 修复循环：基底 ~90K chars × 20/20/17 迭代，messages 累到 64~164 条，单循环
prompt 72-108 万 tokens；前 3 个循环占全部 repair 请求的 45%。工具模式修复轮
（log 可见 `tools=9 wrote=True`）每步 tool 调用都重发全量会话。基底 = 当前完整
`index.html`（单文件前端到后期 ~50-60K chars）+ spec + 需求文本。

### P2：codegen 全文件重发

implement 阶段 34 请求产出 363K completion —— 每节点整文件重写
（`<<<FILE frontend/src/index.html>>>` 全量），keep 单文件架构放大此成本。
repair 的 codegen 轮同样全文重发（log 中 repair 输出都是整个 index.html 尾部）。

### P3：修复循环收敛慢

20 迭代 × 每迭代 completion 仅 ~400 tokens（7.8K/20）—— 小步试探、基底巨大，
说明反馈信号弱或 agent 在小步挪动；一轮修完 wall-time ~50s 但迭代内部空转多。

## 候选「只改一处」实验（按 ROI 排序）

| # | 改动 | 层 | 针对 | 预期 | 风险 |
|---|---|---|---|---|---|
| C1 | 修复/design 轮上下文瘦身：基底只附 失败 spec 相关段 + 文件 diff/锚点，不附全文 | prompts/repair.md（小） | P1 | 未缓存 prompt 与耗时双降；T3 可扩展性 | 修复质量可能降（信息少了），T1 验证 |
| C2 | codegen 增量输出：未变更文件不重发，或分文件块级 patch 协议 | codegen.py（中-大） | P2 | completion 降 50%+ | 协议改动=大改动，须过 T3 |
| C3 | 修复迭代上限/收敛策略（如连续 2 迭代无 diff 提前终止） | 编排参数（小） | P3 | 砍空转迭代 | 过早终止漏修 |

**首选 C1**（最小改动、直击 92% 的 prompt 结构）。等 stackoverflow T2 基线出数后
确认 T2 上同样是 repair 主导（泛化验证），再动 C1。

## T2 stackoverflow 验证（2026-09-20，台账 #2）—— C1 判断坐实

- 终局 62/66（94%），败 4 个边界功能：编辑评论/自定义过滤器/徽章通知/用户响应评论
- r3 终局账单：**1331 请求 100% 全是 repair 阶段**，prompt 65.4M（93% 缓存），
  $9.30，3.5h —— 是 keep 的 10 倍费用（节点数才 2 倍）
- 上下文继续膨胀：user_chars 中位数 106K（keep 是 90K），最大 187K，
  >100K 的请求 1107/1331
- 修复链行为：spec 会变异应用状态 + 修复改动共享代码 → 前滚式级联失败
  （REQ-3.x/4.x 簇连坐 ~10 次），每次失败 = 快照 + tool-mode 修复轮多迭代
- 结论：**T1→T2，repair 请求占比 79%→100%，上下文 90K→106K+，成本超线性增长**。
  C1（修复上下文瘦身）与 C3（迭代收敛）在 T3（117/125 节点）前是刚需，
  否则单题费用将再翻数倍。
