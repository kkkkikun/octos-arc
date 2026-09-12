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

## 数据总表（本机，同二进制同模型；每行一次运行）

Counter（`smoke--counter`，1 个节点，公开测试 1 条）：

| 运行 | 配置 | 轮数 | tokens_in | tokens_out | 费用 ¥ | 耗时 s | 公开测试 | 节点状态 | 事件流 |
|---|---|---:|---:|---:|---:|---:|---|---|---|
| R0 base-counter | 改前 | 3 | 48,958 | 16,118 | 0.0756 | 422 | 1/1 | REQ-1 PASSED | `octos-arc-A-baseline/arc/arc-output/base-counter/.arc/` |
| R5 r5-counter | 默认（首版，测试后未还原数据） | 3 | 39,785 | 20,070 | 0.0834 | 354 | **0/1**（db.json 被验收测试改成 -1 后随 commit 提交） | REQ-1 PASSED | `arc/arc-output/r5-counter/.arc/` |
| R5 r5-counter-2 | 默认 + 测试后还原工作区 | 3 | 74,906 | 28,700 | 0.1436 | 597 | 1/1 | REQ-1 PASSED | `arc/arc-output/r5-counter-2/.arc/` |

Ticket Booking（`ticket-booking--ticket-booking`，2 个节点，公开测试 10 条）：

| 运行 | 配置 | 轮数 | tokens_in | tokens_out | 费用 ¥ | 耗时 s | 公开测试 | 节点状态 | 事件流 |
|---|---|---:|---:|---:|---:|---:|---|---|---|
| R0 base-tb | 改前 | 5 | 241,076 | 90,562 | 0.7645 | 2,508（骨架轮超时 1200 s 后整轮重跑，共 1,991 s） | 10/10 | REQ-1/2 PASSED | `octos-arc-A-baseline/arc/arc-output/base-tb/.arc/` |

（其余行在运行结束后补充。）

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

## A2 · 按依赖序遍历需求树

`requirement_order.topo_order`：ATOMIC 节点按 Kahn 拓扑排序，依赖在前，同层保持文档顺序；依赖指向 FOLDER 时展开为其全部 ATOMIC 后代；未知 id、自依赖忽略；出现环时非环节点先出、环内按文档顺序打破（`arc/tests/test_requirement_order.py` 6 个用例）。`ancestors_of` 给出传递依赖，节点提示词里附上祖先节点已完成的设计 JSON 摘要（routes / pages / data_model，每个 ≤1500 字符），没有设计 JSON 的祖先只写「已实现，见代码」。

Counter（1 节点）与 Ticket Booking（REQ-2 依赖 REQ-1，文档顺序本来就是依赖顺序）上遍历顺序与改前相同，因此这两题上 A2 没有可测的分数差异；它的价值在 ARC-Bench Web 六题（32–138 个节点、非线性依赖），由工作流 C 在 `arc-bench-web--keep` 上验证。

## A3 · 每节点「设计 → 本地验收 → 实现 → 通过即 commit」

- 设计轮：提示词 `DESIGN_PROMPT`（826 字符）要求读本节点 spec 和现有代码后写 `.arc/design/<节点>.json`（routes / pages / data_model / files / notes）并在回复里重复；harness 解析回复中的 JSON，取不到就读文件；设计写入 traceability 的 `node_contracts` 与 `interfaces`。树只有 1 个 ATOMIC 节点时跳过（`OCTOS_DESIGN_MIN_NODES=2`）：单节点应用没有跨节点接口要协调，设计轮只是纯开销（Counter 上一次设计轮 25–35 s、约 1 万 Token）。
- 实现轮：节点 spec + 设计 JSON + 祖先摘要 + 本节点 spec 文件清单 + UI/性能契约。实现轮最长占节点预算的 60%，超时不重放（改前把 `octos turn timed out` 当瞬时错误整轮重跑，r1-tb-aborted 因此白烧 15 分钟），已写出的代码直接进入验收。
- 验收循环：`acceptance.py` 用平台同款 Playwright、10 s 单测试超时，只跑属于本节点的 spec；失败只回传四字段摘要（Feature / Failed at / Observation / Steps，Steps 取 test.step 或 Playwright Call log）；K ≤ 5（`OCTOS_REPAIR_ROUNDS`）。通过数上升就 `git commit`，连续两次下降就 `git checkout <最优 commit> -- frontend backend` 并告知模型；节点结束若不在最优点也回到最优点。每次跑测试前 `git add -A`、跑完 `git checkout -- . && git clean`，把测试对持久化数据的改动还原（r5-counter 的 0/1 就是被测试改成 -1 的 db.json 被提交造成的）。
- 内核 B 的验收 hook（`OCTOS_ARC_SPEC_DIR` / `OCTOS_ARC_BASE_URL`）位于 `octos arc` 子命令的 `run_acceptance_hook`，只在那条 `octos chat` 流程末尾触发，无法从 `serve --stdio` 会话里按节点调用，所以适配层自己实现了同样的逻辑（也是纯 Playwright 子进程）。
- 平台容器里若找不到 Playwright（查 `OCTOS_ARC_PLAYWRIGHT_ROOT`、bundle 的 local-grader、`/workspace/tests` 的祖先、`/workspace`），会用 npmmirror 装 `@playwright/test` + chromium（上限 540 s）；装不上就退回「终检轮 + 启动演练」判定并记录 skipped。**容器内是否装得上未验证**，需要 C 的第一次云端运行日志（`[acceptance]` 行）。

## A4 · Ticket Booking 的两条超时

**本机复现**：用本机 arc-opt 产物 `ticket-arc-opt-final` 跑公开 10 条测试，把 Playwright `timeout` 设成平台的 10 000 ms：10/10 通过，单测试 549–1553 ms，注册接口 `crypto.scryptSync(password, salt, 64)`（默认成本 N=16384）。因此哈希成本、首屏加载在本机都不是瓶颈；云端失败的两条（`REQ-1.1 注册后刷新仍保持登录`、`REQ-1.2 用户名密码登录`）恰好是唯一两条在登录态下执行 `page.reload()` 的测试（邮箱大小写登录那条不刷新，通过了）。`reload()` 默认等 `load` 事件，最贴合的两个解释：登录后页面引用了外部资源（字体 / CDN / 头像）在无外网的容器里挂住 `load`；或 cookie 属性（`Secure`、`Domain=localhost`、`SameSite=None`）让 127.0.0.1 上的刷新丢会话，`expectSignedIn` 轮询 5 s 后连同前面的步骤超过 10 s。两者都无法从本机复现，需要 C 提供云端失败用例的错误文本。

**改法**：`PERFORMANCE_CONTRACT`（909 字符）加入节点、修复与终检提示：零外部请求、`load` 200 ms 内、scrypt 默认成本或 pbkdf2 ≤ 100k、单请求 < 100 ms、cookie `HttpOnly; Path=/; SameSite=Lax; Max-Age` 且**不带** `Secure`/`Domain`、刷新恢复登录态只允许一次同源请求、禁止 setTimeout/轮询/service worker/debounce 写盘。本地验收用 10 s 超时，任一测试超过 3 s（`OCTOS_ARC_SLOW_MS`）即把用例名连同性能规则喂回修复轮。`OCTOS_PERF_CONTRACT=0` 可关。

## A5 · 上下文成本

- 提示词长度（字符）：骨架 7,702 → 1,558；节点 6,370 → 3,557（含 UI 契约 1,945 + 性能契约 909）；终检 6,747 → 2,795（不含契约时）/ 3,703；新增设计轮 826、修复轮 727。所有提示词都是常量拼接，没有时间戳，段落顺序固定；工具定义与 system 由内核决定。
- 会话粒度 `OCTOS_SESSION_SCOPE`：默认 `node`（骨架单独一个 session；每个节点的设计 → 实现 → 修复共用一个 session，节点间新开），`turn` 每轮新开，`run` 全程一个。选 `node` 而不是 `turn` 的原因：设计轮已把 spec 和现有代码读进上下文，实现轮若新开 session 会再读一遍（r5-tb 首版观察到设计轮 24 次工具调用后实现轮又从 `list_dir` 开始）。
- 终检轮只在有节点没拿到本地验收判定时才跑；Counter 默认配置从改前 3 轮（骨架/节点/终检）变成 2 轮（骨架/节点）+ 本地 Playwright。

## A6 · Evolution 模式

启动时若输出目录已有 `frontend/package.json` 与 `backend/package.json` 即进入 evolution：跳过骨架轮；在 `store_requirement_tree` 覆盖之前读取上一轮提交在模板里的 `.arc/traceability/requirements.json`，按 `node_fingerprint`（id / name / description / scenarios / dependencies）比对，指纹相同的节点走 `regression_cycle`（design/impl 事件标「carried over」，只跑它的 spec；失败则进入修复循环），其余节点正常实现，节点提示词前置现有源码清单（`EVOLUTION_NOTE`）。本机验证：`run-task-local.py --template <smoke--counter 产物> arc/tasks/smoke-evolution--counter`。

## A7 · 守护规则

`guard.TurnMonitor` 订阅每轮的 `tool/started` / `tool/completed` 事件：写了文件、结束语宣称完成却没有执行过 build/start/curl/node 类命令（设计轮不适用）；同一错误（数字归一化后）连续 ≥3 次；写入保护路径（spec 目录、需求目录、`.arc/`，但允许 `.arc/design/`）。命中的纠正句附在同一节点下一轮提示词开头（`OCTOS_GUARD=0` 只记日志不注入）。预算：整体 `OCTOS_TIME_BUDGET`，节点预算 = min(1500, 剩余时间 / 剩余节点)，实现轮 ≤ 60%，修复轮剩余不足 90 s 即停止并保留最优 commit；整体预算耗尽的节点直接标 `implementation_failed`；任何异常都在 `finally` 段给未判定节点补 `test_failed`。
