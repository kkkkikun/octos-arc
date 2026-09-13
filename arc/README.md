# arc/ — 在这一个仓库里完成 ARC-Bench 的改、测、交

这个目录是 Octos 参加 ARC-Bench 的全部外围：平台适配包、公开验收测试、本地做题和打分脚本。
学员只需要这一个仓库。内核源码在上一级（`crates/`），适配包在这里。

## 五步

```sh
# 0. 准备（一次）
pip install -r arc/requirements.txt          # pyyaml、arcbench-runtime
export ARCBENCH_API_KEY=ak_...               # arc-bench.com 个人页的 API key
export NODE_BIN=/opt/homebrew/opt/node@24/bin # 你的 node 目录（Linux 一般不用设）

# 1. 拿一个 Octos 二进制：官方版，或自己编的魔改版
export OCTOS_BIN=/path/to/octos              # 不设则用 ../target/release/octos
cargo build --release -p octos-cli --no-default-features --features api   # 编魔改版时

# 2. 本机做题（约 5 分钟，不到一分钱）
python3 arc/run-task-local.py arc/tasks/smoke--counter --name try1
#    --port 43300 换端口可并行跑多题；--template <已有产物目录> 进入 evolution 模式
#    （先跑 smoke--counter，再以它的产物为模板跑 smoke-evolution--counter）

# 3. 用平台原版 Playwright 测试打分（首次会自动装 Playwright）
python3 arc/grade-local.py arc/arc-output/try1 smoke--counter
python3 arc/metrics.py arc/arc-output/try1        # 轮数 / Token / 费用 / 耗时 / 节点状态 / 打分，一行表格
python3 -m unittest discover -s arc/tests -t arc  # 编排器纯函数的单元测试

# 4. 改一处：main.py 的提示词 / 环境变量，octos_stdio.py 的启动参数，或 crates/ 里的内核
#    改完回到第 2、3 步，改前改后各跑一次，比数字

# 5. 打包上传
sh arc/pack.sh                               # 得到 octos-arc-bundle.zip
# 到 arc-bench.com 对应比赛页 New submission 上传，模型填 deepseek-v4-flash，
# Base URL 填 https://api.arc-bench.com/v1，然后选题、Run
```

## 改了内核怎么让平台用上

平台运行时按 `main.py` 里 `OCTOS_RELEASE_URL` 现场下载 Octos。改了 `crates/` 之后必须：
编译 Linux x86_64 版 → 在本仓库发一个 Release 挂上 tar.gz → 把 `OCTOS_RELEASE_URL` 改成那个地址 → 重新 `pack.sh` 上传。
否则平台跑的仍是官方版，改了等于没改。

## 目录

| 文件 | 作用 |
|---|---|
| `main.py` | 平台入口与编排器：骨架轮 → 按依赖序逐节点「设计 → 实现 → 本地跑该节点的验收 spec → 修复 ≤5 轮 → 通过即 commit」→ 启动演练 |
| `requirement_order.py` | 需求树拓扑排序、祖先查找、节点指纹（evolution 差异） |
| `acceptance.py` | 本地 Playwright 验收：spec↔节点映射、起服务、跑 spec、四字段失败摘要 |
| `guard.py` | 守护规则：未验证就宣称完成、连续同一错误、改保护路径 |
| `octos_stdio.py` | 通过 `octos serve --stdio` 驱动内核（默认每轮新 session） |
| `metrics.py` | 从事件流读 Token / 费用 / 耗时 / 节点状态 |
| `CHANGELOG.md` | 每条改动的改前改后数据 |
| `public-tests/<题目>/` | 平台公开的 Playwright 验收测试（会自动喂给模型） |
| `tasks/<题目>/` | 各题需求文件的离线副本 |
| `run-task-local.py` / `grade-local.py` / `pack.sh` | 本机做题、打分、打包 |

已知平台细节：容器里 `/workspace/tests` 有验收测试；订票题的测试默认连 3301 端口而平台起在 3000，`main.py` 会要求后端两个端口都监听；容器到 npmjs 很慢，提示词要求零依赖并走 npmmirror。

## 编排器开关（环境变量）

| 变量 | 默认 | 作用 |
|---|---|---|
| `OCTOS_TIME_BUDGET` / `OCTOS_NODE_TIME_BUDGET` | max(3600, 480×节点数) / 1500 s | 整体与单节点（含修复轮）的墙钟预算；单节点预算按剩余时间/剩余节点数自适应 |
| `OCTOS_NODE_TIMEOUT` / `OCTOS_DESIGN_TIMEOUT` | 1200 / 420 s | 单轮上限 |
| `OCTOS_REPAIR_ROUNDS` | 5 | 每节点验收修复轮数 K |
| `OCTOS_DESIGN_TURN` / `OCTOS_DESIGN_MODE` | 1 / separate | 0 = 跳过设计轮；`inline` = 设计 JSON 在实现轮开头写出，不单开一轮（TB 上更省钱但更慢，见 CHANGELOG R7/R8） |
| `OCTOS_SESSION_SCOPE` | node | 新 session 的粒度：`node`（设计/实现/修复共用）、`turn`（每轮新）、`run`（全程一个） |
| `OCTOS_DESIGN_MIN_NODES` / `OCTOS_IMPLEMENT_FRACTION` | 2 / 0.6 | 节点数不足时跳过设计轮；实现轮最多占节点预算的比例，留时间给修复轮 |
| `OCTOS_PERF_CONTRACT` / `OCTOS_GUARD` | 1 / 1 | 0 = 关闭性能规则 / 守护注入 |
| `OCTOS_ARC_ALIAS_SPEC_IDS` | 1 | 0 = 不把节点状态镜像到 spec 侧 id |
| `OCTOS_ARC_INSTALL_PLAYWRIGHT` | 1 | 0 = 找不到 Playwright 时不尝试安装 |
| `OCTOS_ARC_PLAYWRIGHT_ROOT` | 自动 | 指定含 `node_modules/@playwright/test` 的目录 |
| `OCTOS_ARC_FULLY_PARALLEL` | 0 | 1 = 本地验收让同一文件内的测试也并行（比平台更严的压力测试） |
| `OCTOS_ARC_TEST_TIMEOUT_MS` / `OCTOS_ARC_SLOW_MS` | 10000 / 3000 | 本地验收单测试超时；超过 SLOW 阈值即提醒模型 |

Web 大题（32–138 节点）的建议参数见 `CHANGELOG.md` 末尾「ARC-Bench Web 六题的建议参数」。
