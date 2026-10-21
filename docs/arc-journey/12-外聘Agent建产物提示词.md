# 外聘 Agent 提示词：直接构建 GitHub 赛题产物并用自测通道迭代至全绿

> <工作目录> 为  `/home/kikun/MyProject/octos-arc/docs/arc-journey/artifacts/output/new-github`

---

你在仓库 `/home/kikun/MyProject/octos-arc` 中工作。你的任务：**不借助任何智能体框架，直接手写一个满足 GitHub 赛题全部需求的 Web 应用**，并用官方自测通道迭代到所有测试通过。分三个阶段推进，每个阶段全绿后才进入下一阶段。

## 0. 权威材料（只读）

- **赛题文档（唯一真相，已严格化——GIVEN 钉死种子数据、WHEN 钉死步骤、THEN 钉死可见响应，全部字面量在反引号里）**：
  - `arc/tasks/hackathon--github-stage-1/requirements.yaml`（12 节点 / 30 场景：账号注册登录找回 + 组织团队）
  - `arc/tasks/hackathon--github-stage-2/requirements.yaml`（14 节点 / 29 场景：仓库 + 文件分支）
  - `arc/tasks/hackathon--github-stage-3/requirements.yaml`（21 节点 / 41 场景：issues + PR/评审/保护）
  - `arc/tasks/hackathon--github-stage-*/reference/*.png` 为参考截图（辅助，文字为准）
- 注意：`arc/tasks/hackathon--github/`（无 stage 后缀）是**旧版全文档**，只作对照，不作依据。
- 本地免费验证（强烈建议每个迭代先跑这个，省自测额度）：
  - `arc/public-tests/hackathon--github-stage-*/` 是依据 stage 文档写的本地 Playwright 套件
  - 评级命令：`python3 arc/grade-local.py <工作目录>/app hackathon--github-stage-1 43400`（把路径换成你的 app 目录；数字是端口，避开占用）

## 1. 产物形态（自测通道硬性要求）

```
<工作目录>/app/
├── Dockerfile        ← 内容见下，逐字使用
├── backend/
│   ├── package.json  {"name":"b","private":true,"type":"commonjs","scripts":{"start":"node server.js"}}
│   └── server.js     Node 内置 http 模块，零依赖；读 process.env.PORT（默认 3000）；
│                     静态服务 ../frontend/dist；JSON 文件持久化（store.json，原子写）；
│                     首次启动写入全部种子数据
└── frontend/
    ├── package.json  {"name":"f","private":true,"scripts":{"build":"node -e \"const f=require('fs');f.rmSync('dist',{recursive:true,force:true});f.cpSync('src','dist',{recursive:true})\""}}
    └── src/          纯 HTML/JS/CSS，多页（每路由一个 .html）；资源一律根绝对路径（/app.js 而非 app.js）
```

Dockerfile（零依赖所以无需 npm install，构建秒级）：
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY backend ./backend
COPY frontend ./frontend
RUN cd frontend && node -e "const f=require('fs');f.rmSync('dist',{recursive:true,force:true});f.cpSync('src','dist',{recursive:true})"
ENV PORT=3000
EXPOSE 3000
CMD ["sh", "-c", "cd backend && exec node server.js"]
```

自测包 zip：**根目录直接是 Dockerfile/backend/frontend**（不要多套一层文件夹），不含 node_modules/.git/dist，≤50MB：
`cd <工作目录>/app && zip -qr ../app-selftest.zip .`

## 2. 已实锤的官方测试习性（血泪换来的，逐条遵守）

**A. 文档层（WHAT）**

1. **登录后用户名必须直接可见**：header 常驻显示当前用户名（不能藏在需要点击才展开的菜单里），刷新后仍在。注册流程按文档：注册成功 → 打开登录页 → 登录 → workspace 显示用户名。
2. **种子数据逐字预置**：文档 GIVEN 反引号里的每个账号/组织/团队/仓库/分支/issue/PR 都要作为持久化数据存在且首屏可见。Stage-1 已知种子：预置账号 `org-owner`、`org-member`、`team-maintainer`、`repo-admin`、`password-change-success`、`password-change-invalid`、`password-change-required`、`recovery-invalid-code`（各配文档给的邮箱与 `Valid-password-123!` 密码）、组织 `Acme Demo`；注册场景用户 `nora-demo`/`nora.demo@example.test`。
3. **消息文案逐字**：THEN 里引号/反引号里的消息就是断言串——`Username already exists`、`Password updated`、`Current password is required`、`Current password is incorrect`、`Verification code is invalid` 等。一个字都不能差。
4. **控件名逐字**：WHEN 里的按钮/链接/字段名（"Create an account"、"Sign in"、"New blank workbook" 式命名）就是定位器。每页每个命名控件恰好一个；真实 ARIA 角色；不可见元素不算存在。
5. **场景间共享状态**：同一 spec 文件内后面的场景依赖前面场景创建的数据（如注册后重复注册报"已存在"）——持久化必须真实、跨场景成立；同时全新会话的 GIVEN 种子也要在。
6. **导航完整性**：文档点名的入口必须存在于指定页面、可见、指向真实路由；无死链。
7. 权限矩阵：文档说某角色"看不到"某控件时，实现上隐藏或移除皆可，但绝不能只是禁用。

**B. Runner 隐层（HOW——文档不写、八轮官方上传实证）**

8. **严格单匹配覆盖任意 DOM 状态**：runner 在全页做 exact 匹配，与菜单开合无关——header 和展开菜单里各一个同名入口 = strict violation 直接死；关闭的表单残留、`display:flex` 压过 `[hidden]` 的面板同样算数；**关闭的原生 `<select>` 的 `<option>` 文本也会被 getByText 命中**，option 不得复制页面可见文案。
9. **THEN 断言文本全页唯一**：`getByText('Member', {exact:true})` 要求全页恰好一个裸 "Member"——设计周边 UI 时让状态词不在别处逐字重复（如其余成员显示 "Member since 日期" 而非裸 "Member"）。
10. **双通道入口**：文档说"从 account menu 进入 settings"，runner 却直接在页面上找名为 Settings 的可见导航目标——文档路径可达 + 页面直接可见，两个都要。
11. **交互方式矩阵**："selects X" → 必须原生 `<select>`（自定义控件 selectOption 直接 FATAL）；点击式选择器 → DOM 内 listbox/menu（原生 select 的 OS 弹层会让 runner 卡死）；目标值是合法默认值时就预选它（选值失败无害化的唯一途径）。
12. **无导航原则**：动作成功后原地切换内容，绝不 `location.href` 跳转——redirect 与 runner 紧跟的下一步/goBack 竞争（ERR_ABORTED）。文档本身要求导航的流程除外。
13. **成功态终结性**：runner 会重击按钮——二次提交不得摧毁成功态（幂等或守卫）。
14. **并行共享一个应用实例**：场景并行跑在同一个 app 上——删除操作全局复活/消灭另一场景 GIVEN 依赖的记录会打穿它（REQ-2-2-4 删除 vs REQ-2-2-3 "已是成员"GIVEN 全局互斥的教训：会话作用域覆盖层，删除断 cookie 不断存储）。
15. **keepAliveTimeout**：Node 默认 5s 是所有 ERR_ABORTED 类抖动的总根因——server.js 里调到 30s+。
16. **边缘形态就是主路径**：空邮箱重置（服务端记 pending）、组织页空态断言、建仓后 Owner 权限判断——THEN 在非常规路径上等着。
17. **官方是 Playwright spec + 自定义 helper（不是 Agent）**：报错 `Could not find a visible navigation target named "X"` 来自官方 spec 的导航 helper——它在**当前页面**按名字找可见目标并点击，找不到就抛错；spec 的步骤链是硬编码的，helper 不会规划中间跳。stage-1/2 的 "Settings" 与 stage-3 的 "Issues/Pull requests/Compare/种子 issue 与 PR 标题" 同属一类：目标必须从首页（及链路每个中途站页）一步可达。修法（全加法、互不撞名）：非 /repo/* 页面全局导航放 `Issues`/`Pull requests`/`Compare`（服务端别名路由解析到种子主仓库）；首页与仓库页放种子 issue/PR 标题面板（同页 exact 标题去重）；中途站页补仓库 tabs 并省略与 h1 同名的 tab；`/<repo>`、`/<org>/<repo>`、`/issues`、`/pulls`、`/compare` 服务端 302 到规范路由。
18. **strict getByText 连 hidden 元素一起计数**：官方断言是 `getByText(/…/i)` 正则 + strict（实证 REQ-6-1 S1 报错）。`hidden` 属性收起的表单其 label 依然在 DOM 里参与解析（本地实证 count=2）——**"藏起来"不够，必须从 DOM 移除**。保护规则表单因此改为按需构建、保存成功后 remove，reload 后也不存在于 DOM；同理 PR 页 merged 态不能有两个 exact "Merged" 徽章（状态行一枚即够，合并面板只留 "Merge commit … by …" 文本行）。
19. **官方断言的正则形态与"元素级 exact"（stage-3 第二轮 29/41 的教训）**：官方 THEN 大量使用宽正则 + strict，如 `/closed.*issue/i`、`/approved/i`、`/merged/i`、`/review|required|protection/i`、`/changed files/i`、`getByText(body, {exact:true})`。由此四条铁律：(a) **每个断言词必须恰好挂在一个独立元素上**——状态徽章单独成 `<p>`（"Closed #10 opened by issue-author" 这种拼接段落会因 username 里的 "issue" 双匹配），评论/行评论 body 用独立 span（"author: body" 拼接文本让 exact 查找落空），PR 元信息行里 source/target 各自成 span（`draft-feature` exact 查找）；(b) **被断言内容不能藏在未打开的 tab 视图里**——PR 检查行放侧栏常显（官方断言 pending 时根本没点 Checks tab），而 "Changed files" 这类**顺序敏感短语**要作为视图内标题存在（官方找 /changed files/i，"Files changed" 和 "N files changed" 都不匹配）；(c) **同页撞词要主动清理**——Reviews/No reviews yet./Reviewers 副标题全部改名或移除，能 merge 的观看者不渲染 review 工作区与 Reviewers 控件（blocked PR 页 /review|required|protection/i 必须恰好 1 个匹配 = 保护解释行）；时间线文案避开断言词（approved → "reviewed this pull request"，merged → type "merge" + "created merge commit X"），Request changes 的已过时间线文案不动；(d) **GET 响应必须带全 UI 要读的字段**（"Merged by undefined" 即 mergedBy/mergeCommit 未返回的实证）。附带：popover/picker 一律 show-only（二次点击不收起，REQ-6-4 60s 超时的疑凶），Compare 页选择变化即自动重跑（官方选完 main/main 不点按钮就要看到 identical）。

## 3. 工作循环（每阶段）

1. 通读该阶段 requirements.yaml，列出：节点清单、每场景的 GIVEN 种子 / WHEN 步骤 / THEN 断言（做成你自己的检查单）。
2. 实现到 `<工作目录>/app`（后段阶段在上一阶段产物上**增量**实现，绝不能弄坏已绿场景——每轮改动后先本地重跑上一阶段套件）。
3. 本地验证：`python3 arc/grade-local.py <工作目录>/app hackathon--github-stage-N <端口>` → 修到全绿（必要时加 `ARC_GRADE_TIMEOUT_MS=40000` 与 harness 检查钟对齐；重场景恰超 10s 默认钟不是 app 的错）。
4. 官方确认：打自测 zip → 上传 https://arcbench-selftest-web.vercel.app → 读逐条报错 → **必须同时取回失败截图**（原生 select 卡死、表单态类问题只有截图能定位，页面状态 = 缺失的线索）→ 修复 → 重复。
   **额度纪律：每日 10 次、北京时间 8 点重置。** 本地全绿才准上传；一次上传尽量吸收多轮修复。
5. **语义回写**：每次官方失败揭示的新 runner 语义，必须同时回写两处——`arc/public-tests/hackathon--github-stage-N/` 对应 spec（严格计数、跨上下文不变量、exact 匹配）与本文件 §2B。spec 是可校准文件，不是一次性转录。
6. 该阶段官方全绿（Stage-1 = 30/30）→ 停下汇报结果，等确认再进下一阶段。

## 4. 边界

- 仓库其余目录一律只读；你的所有产物（含 zip）放 `<工作目录>` 内。
- 不修改 Dockerfile 模板；不加任何运行时依赖（registry 不可达）。
- 遇到文档内部矛盾：以场景文本（GIVEN/WHEN/THEN）优先于描述段落；仍矛盾的，两种行为都兼容（比如确认对话框可输可不输仓库名）。
- 汇报格式：每轮 = 本地分/官方分/失败清单摘要/下一步。
