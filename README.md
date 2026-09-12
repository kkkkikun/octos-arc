> **用 Octos 参赛请直接用 [octos-org/octos-arc](https://github.com/octos-org/octos-arc)**：那里一个仓库、一个 `main` 分支包含内核源码和完整的参赛流程（这个适配包的最新版也在它的 `arc/` 目录里）。本仓库保留为**通用参考实现**：想给别的 agent 写 ARC-Bench 适配包，照这里的结构来。

# arc-adapter

[Octos](https://github.com/octos-org/octos) 的 [ARC-Bench](https://arc-bench.com) 适配包,也是标准参考实现。写自己的 agent 适配包时可以照这个仓库的结构来。

教程: https://arc-bench-tutorial.vercel.app

## 适配包契约

提炼自平台 runner 源码 ([code-philia/arc-bench-website](https://github.com/code-philia/arc-bench-website)) 和 38 轮提交。适配包走平台的通用 agent-runner 路径(`backend/runner/agent-runner/`),不依赖任何 Octos 专属的平台支持。

### 调用方式

```
python main.py <requirement_path> [--output-dir DIR] [--type web] [--web-port N]
```

| 输入 | 来源 | 说明 |
|---|---|---|
| `requirement_path` | argv 或 `ARCBENCH_TASK_DIR` | 需求树目录 |
| 交付目录 | `--output-dir` 或 `ARCBENCH_TEMPLATE_DIR` | 生成的代码放这里 |
| 端口 | `--web-port` 或 `ARCBENCH_WEB_PORT`(默认 3000) | 评测时平台访问网站的端口 |
| 模型通道 | 环境变量 `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `MODEL` | 平台注入的 OpenAI 兼容端点 |

### 产出要求

评测器在 agent 退出后检查交付目录:

```
<交付目录>/
├── frontend/    # npm install && npm run build
└── backend/     # npm run start,读 PORT 环境变量
```

缺任何一个报 `template is incomplete`。之后平台启动 backend、跑 Playwright 测试打分。

### 事件协议

平台通过文件观察进度:交付目录 `.arc/` 下的 `runner-events.jsonl`、`traceability/*.json`,加 git commit。`arcbench_agent_runtime/` 已封装,直接调用。

## 目录结构

| 文件 | 职责 | 写自己的 agent 时 |
|---|---|---|
| `main.py` | 总控:解析参数、探活模型端点、逐需求节点驱动 agent、收尾检查 | 保留骨架,替换驱动调用 |
| `octos_stdio.py` | 驱动层:与 Octos 二进制通信 | **换成你的 agent 的驱动代码** |
| `arcbench_agent_runtime/` | 平台协议库(事件 / git / 溯源) | 不动 |
| `requirements.txt` | Python 依赖 | 按需增删 |
| `arc.sh` | 提交脚本:打包、登录、上传、查询 | 通用,不需要改 |

## 写自己的 agent 适配包

1. Fork 本仓库
2. 把 `octos_stdio.py` 替换为你的 agent 驱动代码(CLI、SDK、HTTP 都行)
3. 验证打包: `sh arc.sh pack https://github.com/你的org/你的repo`
4. 提交: `sh arc.sh submit ticketbooking gpt-5.5 https://github.com/你的org/你的repo`

## 修改 Octos core

适配包不包含 Octos 二进制。评测时平台按 `main.py` 中 `OCTOS_RELEASE_URL` 的值现场下载。fork Octos 改了 core 之后,必须把这个 URL 指向自己的 Release,否则平台下载的是官方版——不报错,但改动不生效。

| 改动范围 | 适配包操作 |
|---|---|
| core 内部逻辑,对外接口不变 | 只改 `OCTOS_RELEASE_URL` |
| 新增环境变量 | 胶水层加注入/透传 |
| 改 `serve --stdio` 协议或 CLI 参数 | 同步改 `octos_stdio.py` |
| 平台契约(main.py 骨架、arcbench_agent_runtime/) | 不动 |

完整示例见 [`examples/core-mod/`](examples/core-mod/)(42 行 diff)。

## 工程要点

- **日志双写**: 平台截断长 stdout,关键日志同时写 stderr
- **上传上限约 50MB**: 大二进制运行时下载,GitHub 慢走镜像(ghfast.top / gh-proxy.com)
- **端口 3000 不能碰**: 评测端口,生成期在上面起服务会被 SIGTERM。冒烟测试用独立端口(本包用 3100)
- **UI 契约**: 输入框用 `type="text"`;每个字段配可见 `<label>`;校验用 JS 输出错误文字,不用 HTML5 `required`;按钮用 `<button>` 带纯文本
- **评测机是共享的**: 端口占用、profile 冲突等残留状态必然存在,不要依赖本地状态
