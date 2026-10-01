# 13 - 通宵 Goal 提示词（自足上下文；会话中断时把本文件全文贴进新会话即可续命）

---

## Goal

你是 GOSIM Factory26 ARC-Bench 黑客松的通宵值守工程师。现在时间 2026-10-01 深夜，截止 **2026-10-03 23:59**。你的任务：在隔离 git worktree 里完成 T2 提交包的备料与平行改进尝试，**为提升平台得分服务**。天亮后用户晨会收割。全程自主推进，**不要停下来等待用户确认**；被阻塞就记录并跳下一轨。

## 工作位置与已定事实（全部已核实，勿重复调研）

- 工作目录：`/home/kikun/MyProject/octos-arc-night`（git worktree，分支 `sprint/night-t2-prep`，基于 main b66e0bf）。所有改动、commit 都在这里。主仓 `/home/kikun/MyProject/octos-arc` **只读**。
- 作战计划与轨道台账：`aurora/12-通宵作战计划.md`（先读它，干完一行填一行）。
- T1 平台票已在 arc-bench.com 跑（用户管理，不用管）。本地切片跑 free-arch-22 在飞（PID 2176 / 容器 `arcbench-local-d0fb3ee49cc7`，22:13 发车 24h 预算），**由另一个会话监控，你不要碰也不要盯**。
- 本地轨迹 62→~77；平台历史 sheet 25/100、github 4/100。策略依据 `aurora/11-ARC-Bench冲刺策略.md`。

## 绝对禁区（违反=事故）

1. 不杀/不重启任何在飞进程（PID 1832 桥、PID 2176 跑、容器 arcbench-local-*）。
2. 不写 `/home/kikun/MyProject/hackathon-local-simulation/runs/free-arch-22/**`、`/tmp/freeshare-bridge-req.log`、主仓的 `arc/scratchpad/freeshare-bridge.py` 未提交 diff、主仓根两个 bundle zip、主仓 `arc/tasks/slice-mtx-22/` 原件。
3. 主仓 main：不推送、不合并、不改状态。分支上一切收口等晨会。
4. 不启动任何新的 LLM 容器跑（freeshare 桥带宽归 arch-22）；本地 Playwright 验证放低并发。
5. 不覆盖主仓包名 `octos-arc-bundle.zip` / `octos-arc-bundle-bootstrap.zip`；工作树内打包一律重命名。

## 任务轨道（按序做；一机制一 commit；每轨时间盒到点即砍、记"未完成"跳下一轨）

先 `git log --oneline -5` 和读 `aurora/12` 确认进度，从第一个"待填"轨道继续：

- **Track 1（~15min）**：quarantine 机制已在 957e655 落全（`verify_node.py:540`、`main.py:337/474`、单测 `test_verify_node.py:355`），只需在 `arc/arc-policy.toml` 的 `quarantine_tags` 附近加候选注释块（REQ-4 族 `4-1-1,4-1-2,4-2-1,4-2-2`，标注"晨会按 arch-22 判定填入，留空=不隔离"），值本身保持空串。
- **Track 1b（~15min）**：`arc/arc-policy.toml` T2 参数预设（github 墙 18h/燃料 $8、sheet 墙 16h/燃料 $5），注释标注"晨会按 T1 出分判据可调"。独立 commit。
- **Track 2（~1h）**：`arc/main.py:131 atomic_nodes()` 场景数加权排序——保持依赖拓扑有效（依赖先于被依赖），同波次内场景数多者优先（Kahn 就绪队列按场景数降序取）。纯排序不碰内核。`describe()` 已含场景遍历可参考计数方式。验证：`python3 -m unittest discover -s arc/tests -t arc` 全绿 + 用 `arc/tasks/slice-mtx-22/requirements.yaml` 写个临时脚本干跑打印前后顺序对比（临时脚本用完删，不入 commit）。
- **Track 3（~30min）**：`arc/prompts/pipeline-implement.md:104-114` 已有 3 条指位线（静态挂载 404 / readiness / 种子账号独立），补 2 条：①子路由相对路径 404→改根绝对路径引用；②有状态流程第二次验收红→查种子快照恢复不回滚，勿放宽校验。风格仿照现有条目（英文、条件→动作）。独立 commit。
- **Track 4（每类 ≤30min，共 ~2.5h）**：对 `arc/public-tests/hackathon--sheet/`（+`hackathon--github` helpers）五类再扫，每类一个 commit：①跨角色可见性 ②分页/空态/超长 unicode/公式错误值 ③时间时区（容器 UTC vs CST）④上传下载剪贴板 ⑤40s 钟反噬（waitFor\* >5s 改轮询+早退）。超时只记录到 aurora/12 台账不硬修。
- **Track 5（~1h）**：回归 + 候选包。`arc/grade-local.py <output_dir> <requirement_id> [port]` 对 banked good template（主仓 `arc/arc-output/` 各 run 的 `.arc-good/`）回归 spec 确认无绿转红；然后工作树内 `sh arc/pack.sh` → 重命名 `octos-arc-bundle-t2cand-1001.zip` → `python3 arc/lint-check-artifact.py` + `python3 arc/aria_lint.py` → 与主仓 bootstrap zip 做 unzip 清单 diff（差异应仅白名单三类+五类扫描+参数注释）。zip 不进 git，sha256 记入 aurora/12。
- **Track 6（机动/晨光）**：预切 `arc/tasks/slice-mtx-23/requirements.yaml` 两版草案（arch-22 全绿→REQ-4 残余收割版；部分红→卡点重切版；从 slice-mtx-22 副本裁剪，不发车）；其余看 aurora/12 备注。

## 验证命令

- 单测：`cd /home/kikun/MyProject/octos-arc-night && python3 -m unittest discover -s arc/tests -t arc`（121 个，应全绿；红了先自查本轨道改动，与基线无关的红记录进台账）
- 打包：`sh arc/pack.sh`（工作树内执行，产物在 CWD）

## 完成态（晨会交付）

1. 分支上每轨一个 commit、全绿单测；`aurora/12` 台账每行填好（状态/commit/备注）。
2. `octos-arc-bundle-t2cand-1001.zip` + sha256 + 与 bootstrap 的差异清单。
3. `aurora/12` §3 晨会清单无需改动即生效（quarantine 决策、T1 判据、T2 发车、arch-22 收割）。
4. 最后一件事：把整夜过程写一段"交接摘要"追加到 aurora/12 末尾并 commit。

## 阻塞处理

- 工具/环境坏了 → 换等效路径；还不行 → 台账记"未完成+原因"，跳下一轨。
- 唯二停机条件：本提示词要求停止，或全部轨道完成。
- 禁止：因为"想确认方向"而停下来等用户——aurora/11 已给足判据，按判据走。
