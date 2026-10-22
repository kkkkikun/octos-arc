<div align="center">

<pre>
 ██████╗  ██████╗████████╗ ██████╗ ███████╗       ▄▄▄       ██▀███   ▄████▄
██╔═══██╗██╔════╝╚══██╔══╝██╔═══██╗██╔════╝      ▀▀▀▀▀      ▓██ ▒ ██▒▒██▀ ▀█
██║   ██║██║        ██║   ██║   ██║███████╗      ████▄      ▓██ ░▄█ ▒▒▓█    ▄
██║   ██║██║        ██║   ██║   ██║╚════██║      ██  █      ▒██▀▀█▄  ▒▓▓▄ ▄██▒
╚██████╔╝╚██████╗   ██║   ╚██████╔╝███████║      █████      ░██▓ ▒██▒▒ ▓███▀ ░
 ╚═════╝  ╚═════╝   ╚═╝    ╚═════╝ ╚══════╝      ▀▀▀        ░ ▒▓ ░▒▓░░ ░▒ ▒  ░
</pre>

</div>

# Octos ARC — 一份完整的参赛档案

**GOSIM Factory26 · Agentic Software Factory Hackathon 参赛仓库。**
一个 Rust 写的 Agent 内核，加上一套让它「读需求文档 → 写出能跑的 Web 应用 → 用浏览器测试自己验收」的机制栈。
这里保存从 0 到 1 的全部过程：**机制、尸检、实验台账、失败、以及为什么失败。**

> **English summary** — This is the competition entry of [Octos](https://github.com/octos-org/octos)
> for [ARC-Bench](https://arc-bench.com), the Agentic Software Factory Hackathon at GOSIM Factory26.
> The harness drives a pinned Octos kernel through a requirement tree, builds a web app node by node,
> verifies each node with Playwright, and repairs failures in a bounded loop. **Final platform score:
> Sheet 42/100, GitHub 16/100** — no prize. This repository keeps the whole trail: a 39-row
> experiment ledger, postmortems that produced every mechanism, the platform-semantics reconciliation
> that explains why local 97/103 and platform 41/100 are both true, and an honest retrospective.
> Start with [**the retrospective**](docs/arc-journey/00-赛后复盘.md) if you want the lesson;
> start with [**the archive index**](docs/arc-journey/README.md) if you want the data.

[结果](#结果) · [这个仓库是什么](#这个仓库是什么) · [机制栈](#机制栈) · [时间线](#时间线) ·
[档案怎么读](#档案怎么读) · [复现](#复现) · [内核与许可](#内核与许可)

---

## 结果

| | Sheet（在线表格） | GitHub（协作平台） | 合计 |
| --- | ---: | ---: | ---: |
| **平台最终入账** | **42 / 100** | **16 / 100** | **58 / 200** |
| 中途历史最高 | 41 | 4 | 45 |
| 本地隔离评分尺 | 62 | 51 | — |
| 本地代理自检（同产物） | 97–102 / 103 | 51 / 100 | — |

**没有进前 20，没有奖项。**

最后一票把两个任务都抬了（sheet 41 → 42，github 4 → 16），但 github 的 16 分全部来自
stage-1 的 30 个场景，**stage-2 和 stage-3 一分未得**——而它们在本地是 29/29 和 41/41 全绿。
这个落差本身就是这次参赛最值得留下的东西。

### 和头部队伍的差距

同一届比赛的三支头部队伍，仓库公开、读数公开、模型和我们一样：

| 队伍 | 仓库 | 成绩 |
| --- | --- | --- |
| RISE-X-Lab | [OpenCollab](https://github.com/RISE-X-Lab/OpenCollab) | 决赛 **第 1** |
| VOLO-AI | [volo-factory-finals](https://github.com/thunderstone-group/volo-factory-finals) | 初赛 **166/200 · ¥6.35**；决赛 **58/60 · ¥2.56 · 第 2/20** |
| Limitless | [arc_pi_r6](https://github.com/Simonghj/arc_pi_r6) | 决赛队伍 |

| 指标 | 我们 | VOLO | 差距 |
| --- | ---: | ---: | ---: |
| 初赛通过数 | 58 / 200 | **166 / 200** | 2.9× |
| **每通过 1 分的成本** | **≈ ¥1.20** | **≈ ¥0.038** | **约 31×** |

决赛前四名用的是同一个模型 `deepseek-v4-flash-vision-exp`。VOLO 把它写在展台海报上：
**"差距在 harness。"**

一句话总结：**我们造了一台能自我诊断的机器，却没来得及让它一次就把事情做对。**
完整的复盘——七条分岔、逐项读数对照、十条可执行清单——在
[**`00-赛后复盘.md`**](docs/arc-journey/00-赛后复盘.md)。

---

## 这个仓库是什么

这是 [Octos](https://github.com/octos-org/octos) 的**参赛版**，不是一个日常用的编码 Agent。
它包含三部分：

| 部分 | 内容 | 入口 |
| --- | --- | --- |
| **内核** | 从上游 `8558a3bf` pin 下来的 Octos 源码（`crates/`），含 `octos-pipeline` DAG 引擎 | [`ARC_BASELINE.md`](ARC_BASELINE.md) |
| **适配层** | 平台入口、验收器、策略旋钮、公开/代理测试、本地做题打分打包脚本（`arc/`） | [`arc/README.md`](arc/README.md) |
| **参赛档案** | 15 天的过程文档、实验台账、平台日志、产物原件、赛后复盘（`docs/arc-journey/`） | [`docs/arc-journey/README.md`](docs/arc-journey/README.md) |

> **只想看这次比赛怎么打的？** 直接跳到 [档案索引](docs/arc-journey/README.md)。
> **想跑起来？** 看下面的 [复现](#复现)。
> **想了解内核本身？** 看 [`CLAUDE.md`](CLAUDE.md) 与 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

---

## 机制栈

12 条机制，每一条都对应一次具体的失败。**没有一条是"觉得应该有用"加上去的。**

| 机制 | 解决什么 | 证据 |
| --- | --- | --- |
| **链式 DAG + 修复回边** | 验收失败的具体输出回喂实现节点，而非盲目重写 | `crates/octos-pipeline` |
| **逐场景隔离 + 种子快照恢复** | 官方 spec 是有状态对，共享启动会互杀 | 代理审计 `08` |
| **ARIA 可访问名契约（D3）** | 需求里反引号名字就是测试定位器，弱模型全丢 | keep 1/32 → **32/32** |
| **aria_lint 契约提取** | 无官方测试时唯一的环内反馈 | bookstack 真捕获 3 处、零误报 |
| **多世界工作簿（A20）** | 各族 GIVEN 钉死互斥种子，单一静态种子构造性恒红 | REQ-3 全族解锁，62 → 77 |
| **语法刀** | 修理编辑的不平衡括号让整个脚本死，Playwright 只报远端症状 | `app.js:1242` 缺右括号 = 11 场景全灭 |
| **资产洞探针** | 路由白名单漏一个 `.js` → 全站 JS 死 → 评分全灭 | github 成品 0/100 根因 |
| **种子金丝雀** | 中段节点重写全局 `seed()` → 毒化 `.arc-good` | arch-13 6/100 尸检 |
| **停摆刀** | 连续 2 轮场景签名不动 → 节点弃修 | 砍掉"无望节点修复马拉松" |
| **燃料表（双轴）** | 平台计费 ≈ 内核 meter 的 827 倍，单阈值永不触发 | T1 尸检后重标定 |
| **渐进交付 + 回退链** | 任何时刻被杀都有分，`.arc-good` 保最后过检态 | arch-6 惨案 → arch-7 修复 |
| **自举打包** | 从已验证的高分状态起跑，而非每次冷启 | 62 分地板多次复现 |

### 提交物长什么样

```
octos-arc-bundle.zip
├── main.py              # 平台入口：读需求树 → 生成 DAG → 起内核 → 收集产物
├── verify_node.py       # 验收节点：构建 → 起服 → 跑该节点 spec → 判决
├── octos_stdio.py       # 通过 octos serve --stdio 驱动 Rust 内核
├── arc-policy.toml      # 全部策略旋钮（每个都附动机注释）
├── aria_lint.py         # 从需求文档提取「role + 可访问名」契约
├── template/            # 通用脚手架（规则明确允许）
└── prompts/             # 实现 / 回归 / 端口契约提示词
```

zip 里**不含二进制**：评测机运行时按 `main.py` 顶部的 `OCTOS_RELEASE_URL`
现场下载内核，再用 zip 里的 Python 编排器驱动做题。

---

## 时间线

```
09-19  fork 建立，修掉官方 grade-local.py 首跑 NameError
09-20  方法论立起来：三原则 + 测试分级 T0/T1/T2/T3 + 实验台账格式
09-21  🔴 官方测试是严格版：keep 32/32 → 1/32、bookstack 34/34 → 18/34
       D3 刀（ARIA 契约）→ keep/bookstack 双满分
09-23  C1a：内联源码 40000→15000，token −35%，满分保持
09-24  正式赛开始（题目两次延期、一次发错题）
09-25  🔴 本地代理自检 1/28 —— harness 验收 19/24 全是幻觉
09-26  上游合并图执行架构；R1/R2 刀：本地 1/28 → 14/28
09-28  arch-7/arch-8 三级跳 24 → 42 → 62/100（隔离评分尺）
09-29  平台首跑 sheet 25/100；免费路径全链路 ¥0 跑通
09-30  冷启动天花板钉死 25-26；自举是唯一梯子
10-01  花费双闸：停摆刀 + 燃料表；多世界互斥破解
10-02  🎯 平台 T1：sheet 41/100（历史最好，+64%）
       发现代理自检 97 与隐藏评分 41 的 56 分缺口
10-03  🔚 最终：sheet 42/100、github 16/100
```

逐日决策与读数见 [实验台账](docs/arc-journey/04-优化循环与实验台账.md)（39 行）。

---

## 档案怎么读

[`docs/arc-journey/`](docs/arc-journey/README.md) 是完整档案。推荐顺序：

| 想了解 | 读这个 |
| --- | --- |
| **为什么输、赢在哪、下次怎么做** | [`00-赛后复盘.md`](docs/arc-journey/00-赛后复盘.md) ← **先读这篇**（含与 OpenCollab / volo-factory / arc_pi 的逐项对照） |
| 平台每一次提交与分数 | [`13-平台提交记录.md`](docs/arc-journey/13-平台提交记录.md) |
| 完整的 39 行优化台账 | [`04-优化循环与实验台账.md`](docs/arc-journey/04-优化循环与实验台账.md) |
| 平台语义对账（本地 97 vs 平台 41） | [`14-世界对账与平台语义.md`](docs/arc-journey/14-世界对账与平台语义.md) |
| 代理测试审计（7 处硬伤） | [`08-代理测试审计与修复.md`](docs/arc-journey/08-代理测试审计与修复.md) |
| 官方 runner 语义 19 条实证 | [`12-外聘Agent建产物提示词.md`](docs/arc-journey/12-外聘Agent建产物提示词.md) |
| 成本机制设计 | [`07-成本机制设计.md`](docs/arc-journey/07-成本机制设计.md) |
| 内核代码评审（P0/P1/P2） | [`10-Agent代码评审与改进建议.md`](docs/arc-journey/10-Agent代码评审与改进建议.md) |

---

## 复现

```sh
# 0. 准备（一次）
pip install -r arc/requirements.txt          # pyyaml、arcbench-runtime
export ARCBENCH_API_KEY=ak_...               # arc-bench.com 个人页的 API key

# 拿一个 octos 二进制：官方版，或自己编
export OCTOS_BIN=~/.cache/octos-arc/bin/octos
cargo build --release -p octos-cli --no-default-features --features api

# 1. 本机做题（smoke 约 5 分钟，不到一分钱）
python3 arc/run-task-local.py arc/tasks/smoke--counter --name try1

# 2. 用平台原版 Playwright 打分 + 看指标
python3 arc/grade-local.py arc/arc-output/try1 smoke--counter
python3 arc/metrics.py arc/arc-output/try1

# 3. 打包上传
sh arc/pack.sh                               # → octos-arc-bundle.zip
```

完整流程（每个编排器开关、evolution 模式、模型路由、逐项改前改后数据）在
[`arc/README.md`](arc/README.md)。环境坑与可复现的重建步骤在
[`02-环境与坑.md`](docs/arc-journey/02-环境与坑.md)。

> **改了 `crates/` 的话，这段必须看。** 平台运行时会按 `arc/main.py` 里的
> `OCTOS_RELEASE_URL` 现场下载 Octos。改了内核之后，必须编译 Linux x86-64 版、
> 在本仓库发一个 Release、把 `OCTOS_RELEASE_URL` 指向那个不可变地址、再重新
> `pack.sh`，改动才会真正生效。否则平台跑的仍然是原版二进制，改了等于没改。

---

## 仓库结构

| 路径 | 是什么 |
| --- | --- |
| [`arc/`](arc/README.md) | **适配层。** 平台入口、验收器、公开/代理测试、本地做题打分打包脚本 |
| [`docs/arc-journey/`](docs/arc-journey/README.md) | **参赛档案。** 15 天过程文档、实验台账、平台日志、产物原件、赛后复盘 |
| `crates/` | Octos 内核源码（pin 在 `8558a3bf`） |
| `book/`、`docs/` | 内核文档，按固定基底随仓库带入 |
| `evidence/` | 早期云端跑的事件流与评分记录（`run.json` / `*.jsonl`） |
| `arc-runtime-lock.json` | 发布与提交的版本约束：源码提交、目标平台、必须记录的 SHA-256 |
| [`ARC_BASELINE.md`](ARC_BASELINE.md) | 固定了什么，以及改动固定值的规则 |

---

## 内核与许可

内核固定在上游 [`octos-org/octos`](https://github.com/octos-org/octos) 的
`8558a3bf`（标签 `arc-base-20260910`），不跟随上游 `main`。为什么、以及改动 pin
的规则见 [`ARC_BASELINE.md`](ARC_BASELINE.md)。

- [架构](docs/ARCHITECTURE.md) · [CLI 参考](book/src/cli-reference.md) ·
  [配置](book/src/configuration.md) · [模型提供者](book/src/providers.md)
- [`CLAUDE.md`](CLAUDE.md) —— 给在这个仓库里干活的 Agent 看的内核架构说明

Apache-2.0，见 [LICENSE](LICENSE)。官方赛题材料（需求文档、参考图）版权归赛事方
所有，此处仅作过程留存。

---

<div align="center">
<sub>Octos ARC · GOSIM Factory26 Agentic Software Factory Hackathon · 2026-09</sub>
</div>
