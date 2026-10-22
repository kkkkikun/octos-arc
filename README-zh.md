# Octos ARC · 中文说明

> 本仓库的中文文档已合并到根目录 [**`README.md`**](README.md)（中文为主，顶部附英文摘要）。
> 这里保留一个入口，避免两个文件内容分叉。

## 从这里开始

| 想了解 | 读这个 |
| --- | --- |
| 项目是什么、最终成绩、机制栈、时间线 | [`README.md`](README.md) |
| **赛后复盘：输在哪、赢在哪、下次怎么做** | [`docs/arc-journey/00-赛后复盘.md`](docs/arc-journey/00-赛后复盘.md) |
| 参赛档案总索引 | [`docs/arc-journey/README.md`](docs/arc-journey/README.md) |
| 平台每一次提交与分数 | [`docs/arc-journey/13-平台提交记录.md`](docs/arc-journey/13-平台提交记录.md) |
| 适配层手册（怎么改、怎么跑、怎么打包） | [`arc/README.md`](arc/README.md) |
| 内核架构（给 Agent 看的） | [`CLAUDE.md`](CLAUDE.md) |
| 内核文档（随固定基底带入） | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`book/src/`](book/src/) |

## 一句话

Octos ARC 是 [Octos](https://github.com/octos-org/octos) 参加
GOSIM Factory26 · Agentic Software Factory Hackathon 的参赛仓库：
一个 pin 定的 Rust Agent 内核，加一套「读需求 → 写 Web 应用 → 浏览器验收 → 有界修复」
的机制栈，以及 15 天的完整过程档案。

**平台最终成绩：Sheet 42/100、GitHub 16/100，未获奖。**

同一届的三支头部队伍用的是同一个模型：OpenCollab（
[仓库](https://github.com/RISE-X-Lab/OpenCollab)，决赛第 1，**Weave 工作流 + 单 agent**）、
volo-factory（[仓库](https://github.com/thunderstone-group/volo-factory-finals)，
初赛 166/200 · ¥6.35，决赛第 2，**一次起草**）、
arc_pi（[仓库](https://github.com/Simonghj/arc_pi_r6)，决赛队伍，**确定性契约检查**）。
我们 58/200、单题 ¥49——**每通过 1 分的成本差约 31 倍**。差距在 harness，不在模型。

第一名**不是**靠"多 agent 协作"赢的：OpenCollab 的比赛配置是单 agent 串行、
每个工作单元开新会话（`agent_profile="single2"`）。他们真正研究的多 agent 模式
（Team）恰恰证明了多 agent 更贵——47.2% 的运行里协作根本没发生。

过程与结论全部公开在 [`docs/arc-journey/`](docs/arc-journey/)；
逐项对照见 [`00-赛后复盘.md`](docs/arc-journey/00-赛后复盘.md)。

---

许可证：Apache-2.0，见 [LICENSE](LICENSE)。
