# 外聘 Agent 提示词：直接构建 GitHub 赛题产物并用自测通道迭代至全绿

> 使用方法：整段复制给编码 Agent。把 `<工作目录>` 替换为你为它建的子目录名（建议 `github-app/`）。
> 它对本仓库其余部分只读；产物全部落在 `<工作目录>` 内。

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

1. **登录后用户名必须直接可见**：header 常驻显示当前用户名（不能藏在需要点击才展开的菜单里），刷新后仍在。注册流程按文档：注册成功 → 打开登录页 → 登录 → workspace 显示用户名。
2. **种子数据逐字预置**：文档 GIVEN 反引号里的每个账号/组织/团队/仓库/分支/issue/PR 都要作为持久化数据存在且首屏可见。Stage-1 已知种子：预置账号 `org-owner`、`org-member`、`team-maintainer`、`repo-admin`、`password-change-success`、`password-change-invalid`、`password-change-required`、`recovery-invalid-code`（各配文档给的邮箱与 `Valid-password-123!` 密码）、组织 `Acme Demo`；注册场景用户 `nora-demo`/`nora.demo@example.test`。
3. **消息文案逐字**：THEN 里引号/反引号里的消息就是断言串——`Username already exists`、`Password updated`、`Current password is required`、`Current password is incorrect`、`Verification code is invalid` 等。一个字都不能差。
4. **控件名逐字**：WHEN 里的按钮/链接/字段名（"Create an account"、"Sign in"、"New blank workbook" 式命名）就是定位器。每页每个命名控件恰好一个；真实 ARIA 角色；不可见元素不算存在。
5. **场景间共享状态**：同一 spec 文件内后面的场景依赖前面场景创建的数据（如注册后重复注册报"已存在"）——持久化必须真实、跨场景成立；同时全新会话的 GIVEN 种子也要在。
6. **导航完整性**：文档点名的入口必须存在于指定页面、可见、指向真实路由；无死链。
7. 权限矩阵：文档说某角色"看不到"某控件时，实现上隐藏或移除皆可，但绝不能只是禁用。

## 3. 工作循环（每阶段）

1. 通读该阶段 requirements.yaml，列出：节点清单、每场景的 GIVEN 种子 / WHEN 步骤 / THEN 断言（做成你自己的检查单）。
2. 实现到 `<工作目录>/app`（后段阶段在上一阶段产物上**增量**实现，绝不能弄坏已绿场景——每轮改动后先本地重跑上一阶段套件）。
3. 本地验证：`python3 arc/grade-local.py <工作目录>/app hackathon--github-stage-N <端口>` → 修到全绿。
4. 官方确认：打自测 zip → 上传 https://arcbench-selftest-web.vercel.app → 读逐条报错 → 修复 → 重复。
   **额度纪律：每日 10 次、北京时间 8 点重置。** 本地全绿才准上传；一次上传尽量吸收多轮修复。
5. 该阶段官方全绿（Stage-1 = 30/30）→ 停下汇报结果，等确认再进下一阶段。

## 4. 边界

- 仓库其余目录一律只读；你的所有产物（含 zip）放 `<工作目录>` 内。
- 不修改 Dockerfile 模板；不加任何运行时依赖（registry 不可达）。
- 遇到文档内部矛盾：以场景文本（GIVEN/WHEN/THEN）优先于描述段落；仍矛盾的，两种行为都兼容（比如确认对话框可输可不输仓库名）。
- 汇报格式：每轮 = 本地分/官方分/失败清单摘要/下一步。
