# arc/ 适配层改动记录（工作流 A，分支 `wf-adapter`）

度量口径：本机 `.arc/octos-events.jsonl` 的 `turn/completed`（tokens_in / tokens_out 之和，不含缓存命中）与 `token_cost_update`（每个 session 的累计 `session_cost`，多 session 求和）；耗时取 `.arc/runner-events.jsonl` 的 running → completed；通过数由 `arc/grade-local.py` 用平台公开 Playwright 测试打分（`arc/metrics.py <输出目录>` 可一次打印整行）。所有运行都是本机、同一二进制（`octos 2.0.3-rc.11 (82e3bef3)`，`target/release/octos`，SHA-256 `b0b670ba…cd8c5`）、同一模型（`deepseek-v4-flash` 经 `api.arc-bench.com`）。「未评测」表示没有云端运行。

## 结论表（改前 → 改后，均为本机最终配置一次运行；云端未评测）

| 题 | 指标 | 改前 R0 | 改后 | 运行 |
|---|---|---|---|---|
| Counter | 公开测试 | 1/1 | 1/1 | r6-counter |
| Counter | tokens_in / tokens_out | 48,958 / 16,118 | 14,048 / 5,478 | 同上 |
| Counter | 费用 / 耗时 | ¥0.0756 / 422 s | ¥0.0211 / 63 s | 同上 |
| Counter | 节点状态 | REQ-1 PASSED（终检成功才有） | REQ-1 PASSED（本地 spec 判定） | 同上 |
| Ticket Booking | 公开测试（按评测方式启动） | 10/10 | 10/10 | r7-tb |
| Ticket Booking | tokens_in / tokens_out | 241,076 / 90,562 | 302,042 / 168,548 | 同上 |
| Ticket Booking | 费用 / 耗时 | ¥0.7645 / 2,508 s | ¥0.7166 / 1,988 s | 同上 |
| Ticket Booking | 节点状态 / tests 表 / 设计契约 | REQ-1、REQ-2 PASSED（依赖终检）/ 无 / 无 | REQ-1、REQ-2（+镜像 REQ-1.1、REQ-1.2）PASSED / 10 行全 passed / 2 | 同上 |
| Smoke Evolution | 公开测试（2 文件并行） | 不支持（会重做骨架） | 2/2 | e2-evolution |
| Smoke Evolution | 费用 / 耗时 | — | ¥0.0877 / 428 s | 同上 |

## 运行矩阵

| 运行 | 适配层 | 开关 / 代码状态 | 用途 |
|---|---|---|---|
| R0 | 改前（`82e3bef3` 的 `arc/`） | — | 对照，worktree `octos-arc-A-baseline` |
| R5 | 新编排器首版（`1a60fa8b`…`d5f9dccb`） | 默认开关 | A1–A7 全开；暴露了「测试改写数据被提交」「实现轮超时被当瞬时错误重放」「双端口 listen 两次」三个问题 |
| R6 | `06d3a02e`（单节点并入一轮 + 简短自验） | 默认 | Counter 最终配置 |
| R7 | `5a62ec89`（全套并行验收 + 按评测方式启动 + 只读设计轮） | 默认 | Ticket Booking 最终配置 |
| R8 | 同 R7 | `OCTOS_DESIGN_MODE=inline` | 设计轮并入实现轮的对照 |
| R1 / R3 / R4 | R6 代码 | 分别：修复轮 0 + 性能规则关 + 守护关 + 单 session；性能规则关；每轮新 session | Counter 上的开关消融 |
| E1 / E2 | R5 / R7 代码 | 默认 | A6：以 Counter 产物为模板跑 smoke-evolution--counter |

每完成一条改动就跑一次 Counter 与 Ticket Booking 的要求，实际执行成了「先整体重写、再用开关和连续修正逐项测」：编排器的七条改动共享同一套节点循环，拆成七个独立可运行的中间版本会让每个中间版本都带着后面才发现的缺陷（例如 R5 的三个问题）。下面每条 A 项都标注了它对应的运行。

## 数据总表（本机，同二进制同模型；每行一次运行）

Counter（`smoke--counter`，1 个节点，公开测试 1 条）：

| 运行 | 配置 | 轮数 | tokens_in | tokens_out | 费用 ¥ | 耗时 s | 公开测试 | 节点状态 | 事件流 |
|---|---|---:|---:|---:|---:|---:|---|---|---|
| R0 base-counter | 改前 | 3 | 48,958 | 16,118 | 0.0756 | 422 | 1/1 | REQ-1 PASSED | `octos-arc-A-baseline/arc/arc-output/base-counter/.arc/` |
| R5 r5-counter | 默认（首版，测试后未还原数据） | 3 | 39,785 | 20,070 | 0.0834 | 354 | **0/1**（db.json 被验收测试改成 -1 后随 commit 提交） | REQ-1 PASSED | `arc/arc-output/r5-counter/.arc/` |
| R5 r5-counter-2 | 默认 + 测试后还原工作区 | 3 | 74,906 | 28,700 | 0.1436 | 597 | 1/1 | REQ-1 PASSED | `arc/arc-output/r5-counter-2/.arc/` |
| R5 r5-counter-3 | 默认（单节点已跳过设计轮） | 2 | 83,073 | 50,649 | 0.1605 | 862 | 1/1 | REQ-1 PASSED | `arc/arc-output/r5-counter-3/.arc/` |
| R4 r4-counter-turnscope | 默认 + `OCTOS_SESSION_SCOPE=turn` | 3 | 79,855 | 33,519 | 0.1452 | 548 | 1/1 | REQ-1 PASSED | `arc/arc-output/r4-counter-turnscope/.arc/` |
| **R6 r6-counter** | **默认（单节点：骨架并入节点轮，简短自验）** | **1** | **14,048** | **5,478** | **0.0211** | **63** | **1/1** | REQ-1 PASSED | `arc/arc-output/r6-counter/.arc/` |
| R3 r3-counter-noperf | R6 代码 + `OCTOS_PERF_CONTRACT=0` | 1 | 30,307 | 11,034 | 0.0384 | 351 | 1/1 | REQ-1 PASSED | `arc/arc-output/r3-counter-noperf/.arc/` |
| R1 r1-counter-minimal | R6 代码 + 修复轮 0、性能规则关、守护关、单 session | 1 | 19,563 | 11,256 | 0.0325 | 220 | 1/1 | REQ-1 PASSED | `arc/arc-output/r1-counter-minimal/.arc/` |

Counter 小结：同一代码三次运行（R6、R3、R1）都是 1 轮、1/1，费用 ¥0.021–0.038、耗时 63–351 s，运行间方差（模型自验证的多少）大于开关本身的差异；相对改前（¥0.0756、422 s）费用降到 28%–51%、耗时降到 15%–83%。真正起作用的是 A5 的两条：单节点不再单开骨架轮、提示词告知「harness 随后跑官方测试，自验证从简」。

Ticket Booking（`ticket-booking--ticket-booking`，2 个节点，公开测试 10 条）：

| 运行 | 配置 | 轮数 | tokens_in | tokens_out | 费用 ¥ | 耗时 s | 公开测试 | 节点状态 | 事件流 |
|---|---|---:|---:|---:|---:|---:|---|---|---|
| R0 base-tb | 改前 | 5 | 241,076 | 90,562 | 0.7645 | 2,508（骨架轮超时 1200 s 后整轮重跑，共 1,991 s） | 10/10 | REQ-1/2 PASSED | `octos-arc-A-baseline/arc/arc-output/base-tb/.arc/` |
| R5 r5-tb | 默认（全套并行验收与「按评测方式启动」之前的代码） | 6 | 239,309 | 141,560 | 0.5674 | 1,555 | **0/10：按评测方式（只设 PORT）启动时 `ERR_SERVER_ALREADY_LISTEN` 崩溃**；逐节点验收 6/6 + 4/4 | REQ-1/2（及镜像 REQ-1.1/1.2）PASSED | `arc/arc-output/r5-tb/.arc/` |

Smoke Evolution（`smoke-evolution--counter`，模板 = 上一行 Counter 产物，公开测试 2 条并行）：

| 运行 | 模板 | 轮数 | tokens_in | tokens_out | 费用 ¥ | 耗时 s | 公开测试 | 节点状态 | 事件流 |
|---|---|---:|---:|---:|---:|---:|---|---|---|
| E1 e1-evolution | r5-counter-2（服务端共享计数） | 5 | 98,381 | 39,295 | 0.2226 | 1,198 | **0/2**：两条测试并行改同一个服务端计数（期望 1 实得 3）；逐节点单跑时各自 1/1 | REQ-1/2 PASSED | `arc/arc-output/e1-evolution/.arc/` |
| **E2 e2-evolution** | r6-counter | 3（回归 0 轮 + 设计 + 实现） | 41,745 | 14,489 | 0.0877 | 428 | **2/2** | REQ-1 PASSED（carried over + 回归通过），REQ-2 PASSED | `arc/arc-output/e2-evolution/.arc/` |

| **R7 r7-tb** | **默认（最终代码：全套并行验收 + 按评测方式启动 + 只读设计轮 + 简短自验）** | 7 | 302,042 | 168,548 | 0.7166 | 1,988 | **10/10**（按评测方式启动） | REQ-1/2（及 REQ-1.1/1.2）PASSED；tests 表 10/10；node_contracts 2 | `arc/arc-output/r7-tb/.arc/` |

R7 逐轮：骨架 475 s → REQ-1 设计 155 s（51 次工具调用，模型无视「只读」仍执行了命令）→ 实现 831 s → 验收 4/6 → 修复 62 s（7 次调用）→ 6/6 → REQ-2 设计 147 s → 实现 267 s → 验收启动异常（后端「listening」后以 rc=0 退出）→ 修复轮 21 s 后 octos 进程退出（stderr 尾部为正常 INFO 日志，无 turn/error；转 B 排查）→ 重跑验收 4/4 → 全套并行 10/10 → 演练通过。

| R8 r8-tb-inline | R7 代码 + `OCTOS_DESIGN_MODE=inline` | 4 | 202,001 | 126,386 | 0.5494 | 2,847 | 10/10（按评测方式启动） | 同上 | `arc/arc-output/r8-tb-inline/.arc/` |

R8 逐轮：骨架 182 s → REQ-1 实现（含设计 JSON）900 s 超时 → 验收 0/6 → 修复 565 s 超时 → 3/6 → 节点预算耗尽 → REQ-2 实现 484 s → 验收 0/4 → 修复 609 s → 4/4 → 全套并行 10/10（REQ-1 剩余 3 条在 REQ-2 修复中被顺带修好）→ 演练通过。

Ticket Booking 小结：R7（默认）与 R8（inline 设计）都拿到 10/10；R7 费用 ¥0.717（改前 ¥0.765，−6%）、耗时 1,988 s（改前 2,508 s，−21%）；R8 费用 ¥0.549（−28%）但耗时 2,847 s（+14%），因为把设计并入实现轮后实现轮两次撞到 900 s 上限。默认保留独立的只读设计轮。**费用减半的目标在 TB 上没有达到**：三次 TB 运行输入 Token 202k–302k，与改前 241k 同量级，输出 Token（含推理）126k–169k 反而高于改前的 91k——模型在每轮里做的自验证多、推理长；进一步压缩要靠内核侧的工具输出裁剪/推理预算（B4/B3）和更短的实现轮。

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

**验证**：R7 `arc/arc-output/r7-tb/.arc/traceability/`：`node_states.json` = REQ-1 / REQ-2 / REQ-1.1 / REQ-1.2 全部 PASSED（后两者为镜像），`tests.json` 10 行全部 `passed: true`，`node_contracts.json` 有 REQ-1、REQ-2 的设计；`runner-events.jsonl` 里每个节点都有 design running/completed、implement running/completed、test passed。云端 `feature_implementation_rate` 未评测，需 C 用本分支打包后跑一次 TB。

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

## 第二轮 · 吸收工作流 C 的回流（`bd3c56ca`）

C 用旧 main（`82e3bef3`）适配包在 `arc-bench-web--keep` 本机跑到 26/32、83 分钟，回流三点已吸收：

1. **FOLDER 节点也计入平台需求数**（keep 记「45 requirements and 32 scenarios」）。`mark_folders()` 在收尾时给每个非 ATOMIC 节点按其 ATOMIC 后代推导 design/implement/test 状态：全部子节点通过才 `test_passed`，否则 `test_failed` 并列出未通过的子节点；异常路径同样补齐。
2. **骨架轮不再读全部 spec**。旧 `ACCEPTANCE_TESTS_PROMPT` 在骨架轮列出全部 spec 文件并要求「写代码前全部读完」，模型因此在一轮里把 32 个功能全做完（70 分钟、单会话 40–130 万字符推理）。现在骨架轮只给 spec 目录、共享 helper 和「最多读两个 spec 学约定，不实现功能」，spec 文件在各自节点轮才出现。
3. **整体预算按节点数放大**：未显式设 `OCTOS_TIME_BUDGET` 时取 max(3600, 480 × ATOMIC 节点数)（`OCTOS_SECONDS_PER_NODE`），keep 为 15,360 s；节点预算仍是 min(1500, 剩余/剩余节点)。

第二轮代码的本机验证：

| 运行 | 轮数 | tokens_in | tokens_out | 费用 ¥ | 耗时 s | 公开测试 | 节点状态 |
|---|---:|---:|---:|---:|---:|---|---|
| r9-counter | 1 | 25,242 | 7,757 | 0.0327 | 331 | 1/1 | REQ-1、ROOT PASSED |
| **r9-tb** | 5 | 213,602 | 127,660 | **0.5768** | **1,346** | 10/10（按评测方式启动） | REQ-1、REQ-2、REQ-1.1、REQ-1.2、ROOT PASSED |

r9-tb 逐轮：骨架 211 s（不再读全部 spec）→ REQ-1 设计 167 s → 实现 504 s → 6/6 → REQ-2 设计 213 s → 实现 238 s → 4/4 → 全套并行 10/10 → 演练通过，零修复轮。相对改前：费用 −25%、耗时 −46%。

C 的其余发现与本分支已有改动的对应：轮超时被当瞬时错误重放 → `d5f9dccb` 已修；骨架超时但盘上已有 frontend/backend 则继续 → `skeleton()` 已按盘上状态判定；单会话累积上下文（keep 云端 8,256 万 token、¥17.94）→ 默认按节点新开 session；云端评测阶段 Playwright 用 4 workers 1 秒后被 SIGKILL 是平台侧问题，适配层无法影响；Evolution 在平台上 `ARCBENCH_TEMPLATE_DIR` 未设置而模板在 `/workspace/template`，本分支按输出目录里是否已有 frontend/backend 判定，与 C 观察到的 2/2 一致。

## 紧急修正 · 云端 Smoke Evolution 0/2（C 回流，运行 da9a64b32c09 / 16ea5178359a）

**现象**：main@40a629a8 的适配包在生成阶段 `[acceptance]` 自跑 2/2，但平台评测阶段 `npx playwright test` 报 `browserType.launch: Executable doesn't exist at /ms-playwright/chromium-1200/...`，2 条全失败；同题旧适配包 2/2。日志顺序是 `no Playwright install found; trying to install one` → `playwright installed into /tmp/octos-arc-playwright`。即镜像里其实有预装的 Playwright 但我们没找到，随后未隔离的安装改变了平台自己 `npx playwright` 的解析结果。

**改法**（`acceptance.py` / `main.py`）：
1. 先找预装：候选路径加上 `npm root -g` 的上级、/workspace、/workspace/tests、/app、/runner、/opt/playwright、/usr/local/lib、/usr/lib、$HOME；再做一次 25 s 内的 `find / -maxdepth 6 -path '*/node_modules/@playwright/test'`（排除 /proc /sys /tmp）。
2. 真要自装时完全隔离：版本钉死（tests 目录的 package-lock/package.json 声明的版本，否则 1.63.0；绝不 latest），`npm_config_cache` 与 `PLAYWRIGHT_BROWSERS_PATH` 都指向本次运行的私有临时目录，浏览器用 `node_modules/.bin/playwright install` 而不是 `npx`，所有验收运行带同一 `PLAYWRIGHT_BROWSERS_PATH`，运行结束（含异常路径）删除整个私有目录。
3. 本机验证：私有安装 24 s 完成，chromium-1243 落在私有目录，登录节点 4/4；安装前后 `~/Library/Caches/ms-playwright` 与 `~/.npm` 均未变化，私有目录已删除。
4. 云端 d116ad5e3aa0（wf-adapter-2@71040c6c）15 s 崩溃：`setup_playwright` 的一处文本替换未生效，仍把 `(root, env)` 元组当 Path 用，且缺 `cleanup_playwright`。`e3c1197f` 整段重写并加回归测试 `SetupPlaywrightTests`；本机把 local-grader 藏起来强制走该分支跑 Counter（r10-counter-privatepw）：私有安装 25 s → 验收 1/1 → 演练通过 → 私有目录已删除，公开测试 1/1，¥0.0306，374 s。**云端未评测**，等 C 用 e3c1197f 打包再跑一次 smoke-evolution 后合入。

## 第三轮 · 保护官方测试与空报告（C 回流，云端 a6ccc437539f，`wf-adapter-3`）

**云端现象**：main@40a629a8 的 TB 云端 0/10、¥10.22、3,376 s。日志里 `[guard] You modified protected files … /workspace/tests/*` 之后紧跟 `[acceptance] 0/0 passed (REQ-1.1-…)`：模型改了 `/workspace/tests`，复制过来的 spec 不再能加载，「0/0」被当成判定，之后的修复轮都在盲修；REQ-1 实现轮 900 s 超时；容器里 4 并行全套 2/10（10 s 超时）。

**改法**：
1. **拒绝写入官方测试目录**（`arc/hooks/deny_protected.py`）：内核 `before_tool_call` hook，对 write_file / edit_file 等按 `arguments.path` 判定，落在 tests 或 requirements 目录内即 exit 1（模型看到 `[HOOK DENIED]`）。接线要点：`octos serve --solo` 的 ProfileRuntime 只从 profile 自身 config 取 hooks（`config_from_profile`），host `config.json` 与 `profile-defaults.json` 都不生效——用真实 stdio 轮验证过两次都放行；改为在 `profile/local/create` 之后、`profile/llm/upsert` 之前把 `hooks` 写进 `data/profiles/<id>.json`，第三次验证：写保护目录被拒（spec 内容不变），写普通文件正常。shell 命令的参数被内核脱敏，hook 看不到，所以还有第 2 层。
2. **每轮结束还原受保护目录**：启动时把 tests / requirements 目录快照到私有临时目录并记 sha256，每轮结束比对，改动/删除的文件恢复、新增的删除，并把恢复列表作为纠正句喂给下一轮。平台评测用的正是这些文件，任何改动既破坏本地验收也触碰红线。
3. **空报告不是判定**：Playwright 收集到 0 条测试时返回 error，附顶层 `errors`（编译/加载错误）或 stdout 尾部，进入修复摘要并记日志。
4. **全套修复早停**：失败集合与上一轮相同即停止（默认最多 2 轮，`OCTOS_FINAL_REPAIR_ROUNDS`）。
5. **A4 哈希预算**：明确评测 CPU 慢 5–10 倍且 4 个浏览器并行，scrypt 用 `{N: 4096, r: 8, p: 1}` 或 pbkdf2 ≤ 10,000 次，单请求 CPU ≤ 30 ms。

本机验证：`SetupPlaywright`/hook/tree-restore 共 34 个单元测试；r12-counter 1/1、¥0.0386、91 s（ROOT 状态已写）。

| 运行 | 轮数 | tokens_in | tokens_out | 费用 ¥ | 耗时 s | 公开测试 | 节点状态 |
|---|---:|---:|---:|---:|---:|---|---|
| r11-tb | 7 | 192,910 | 109,919 | 0.6697 | 1,141 | 10/10（按评测方式启动） | REQ-1、REQ-2、REQ-1.1、REQ-1.2、ROOT PASSED |

r11-tb 逐轮：骨架 89 s → REQ-1 设计 139 s → 实现 312 s → 验收 0/6（首页有两个 `a[href="/register"]`，strict mode）→ 修复 174 s → 6/6 → REQ-2 设计 60 s → 实现 196 s → 验收 0/4（`getByLabel(/用户名/)` 命中两个输入框）→ 修复 152 s → 4/4 → 全套并行 10/10 → 演练通过。两处都是四字段摘要直接点名的 strict-mode 错，各一轮修好；改前基线 ¥0.765 / 2,508 s。

**C 对 main@f3f113e6 的云端对比**（0a3cd1d66042 TB 7/10、¥4.45、981 s，生成阶段自跑 10/10）：平台 2 个 worker 并行打同一后端时，「注册后保持登录」超时、「用户名密码登录」登录后看不到用户名、「大小写邮箱登录」超时——两个 spec 各自注册再登录，异步「读文件-改-整写」的持久化在并发下会丢用户。本轮补充：性能契约明确「内存为唯一真源、变更先改内存再同步整写、禁止异步 read-modify-write」；`OCTOS_ARC_FULLY_PARALLEL=1` 可让本地验收在文件内也并行（比平台更严）。功能率 0/2 的原因是平台按测试标题前缀（REQ-1.1）匹配需求 id（REQ-1），与适配层无关，需向平台反馈。

## 云端结果（由工作流 C 运行，证据在 main 的 `evidence/`）

| 题 | 改前（82e3bef3） | main@40a629a8 | main@f3f113e6 | main@9b0d3009 |
|---|---|---|---|---|
| Ticket Booking | b00c4ee7b568：7/10，功能 0/2，¥4.73，674 s | a6ccc437539f：0/10（自装 Playwright 污染评测环境），¥10.22 | 0a3cd1d66042：7/10，0/2，¥4.45，981 s | **ab4c98a6cb17：9/10，功能 1/2，¥1.99，1,051 s** |
| Smoke Evolution counter | 37fb13835049：2/2，¥0.55 | da9a64b32c09：0/2（同因） | b76aadf42e9b：2/2，¥0.60，209 s | — |
| Smoke Evolution dice | a02d29a7064a：2/2，¥0.60，204 s | 16ea5178359a：0/2（同因） | 6c9ea2294ff6：2/2，¥1.48，283 s | — |

ab4c98a6cb17 唯一失败：REQ-1.2「用户名密码登录」在注册辅助步骤等 `getByLabel(/证件号码/)` 可见、可用、可编辑直到 10 s 超时；同一 helper 在另外 5 条注册用例和本机自跑 10/10 中都通过，是并行 worker 下页面尚未就绪（表单由 JS 在请求后渲染或请求期间禁用控件）。本轮把 UI 契约改为「表单控件必须直接存在于服务端 HTML 中，请求期间不得禁用」。功能率 1/2：平台按测试标题/文件前缀匹配需求，REQ-1.1 命中 REQ-1，REQ-2 因有失败用例记 0。
