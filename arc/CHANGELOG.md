# arc/ 适配层改动记录（工作流 A，分支 `wf-adapter`）

度量口径：本机 `.arc/octos-events.jsonl` 的 `turn/completed`（tokens_in / tokens_out 之和，不含缓存命中）与 `token_cost_update`（每个 session 的累计 `session_cost`，多 session 求和）；耗时取 `.arc/runner-events.jsonl` 的 running → completed；通过数由 `arc/grade-local.py` 用平台公开 Playwright 测试打分（`arc/metrics.py <输出目录>` 可一次打印整行）。所有运行都是本机、同一二进制（`octos 2.0.3-rc.11 (82e3bef3)`，`target/release/octos`，SHA-256 `b0b670ba…cd8c5`）、同一模型（`deepseek-v4-flash` 经 `api.arc-bench.com`）。「未评测」表示没有云端运行。

## 运行矩阵

| 运行 | 适配层 | 开关 | 说明 |
|---|---|---|---|
| R0 | 改前（`82e3bef3` 的 `arc/`） | — | 对照，worktree `octos-arc-A-baseline` |
| R1 | 新编排器 | 设计轮关、修复轮 0、性能规则关、单 session、守护关 | 只含 A1（逐节点真实测试判定 + id 映射）与 A2（依赖序） |
| R2 | 新编排器 | +设计轮、修复轮 K=5 | A3 |
| R3 | 新编排器 | +性能规则 | A4 |
| R4 | 新编排器 | +每轮新 session | A5（提示词压缩在 R1 已生效） |
| R5 | 新编排器 | +守护规则 | A7，即默认配置 |
| E1/E2 | 新编排器 | 默认 | A6：smoke--counter → 以产物为模板跑 smoke-evolution--counter |

（数据表在各条目下逐步填写。）

## A1 · 功能实现率归零的原因

**证据**（本机可见的部分）：

- 本机 TB 运行 `ticket-arc-opt-final` 的 `.arc/traceability/node_states.json` 两个节点都是 `PASSED`，`runner-events.jsonl` 有完整的 design/implement/test 事件；Counter 运行 `cmp-arc-opt-final2` 同样完整。也就是说本机版适配层写出的文件格式和 Smoke 云端 1/1 的运行完全一致。
- 旧编排器的测试判定逻辑是：终检轮 `ok` 为假或任一节点实现失败时，**所有**节点一律 `mark_test_failed`；只有终检轮成功才全部 `mark_test_passed`。TB 云端运行 a74a5ac5afbd 总时长 1259 s、终检轮默认 1200 s 上限，一旦终检超时/失败，两节点都被标成 FAILED；而 Smoke 终检成功所以 1/1。
- 另一个本机可验证的差异：TB 公开测试文件名是 `REQ-1.1-user-registration.spec.ts`、`REQ-1.2-user-login.spec.ts`，而需求树节点是 `REQ-1`、`REQ-2`；Smoke 的测试文件 `REQ-1.spec.ts` 与节点 id 一致。若平台按测试侧 id 归集功能实现率，TB 的节点状态永远对不上。
- 云端 a74a5ac5afbd 的 traceability 接口「返回空」而不是「全 FAILED」，更符合第二种解释；但云端原始数据本工作流拿不到（不发起/不读取云端），**需要工作流 C 从运行详情导出 `.arc/traceability/` 与 runner-events 核对**。

**改法**（两种原因都覆盖）：

1. 每个 ATOMIC 节点在自己的周期内发出 `design_started/done`、`implementation_started/done|failed`，然后用属于该节点的公开 spec 在本机真实跑一遍 Playwright（10 s 单测试超时，与平台一致），据结果发 `test_passed` 或 `test_failed`；终检失败不再覆盖已有的节点判定。没有本地 Playwright 时才退回「终检 + 启动演练」判定。
2. spec 文件名里的 id 与节点 id 不一致时，按（精确匹配 → 数量相同按序配对 → 父前缀）映射，并把节点状态**同时**镜像到 spec 侧 id（`REQ-1.1`、`REQ-1.2`），`OCTOS_ARC_ALIAS_SPEC_IDS=0` 可关。
3. 设计 JSON 写入 `node_contracts`、接口写入 `interfaces`、每条测试结果写入 `tests` 表，平台无论读哪张表都有数据。
4. 运行异常中断时，`finally` 段为所有还没有判定的节点补 `test_failed`，保证每个节点都有终态。

**验证**：见下表（本机 `.arc/traceability/node_states.json`）。云端 `feature_implementation_rate` 未评测，需 C 用本分支打包后跑一次 TB。
