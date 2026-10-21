# 产物索引：每个目录是什么

> 这里保存比赛期间平台/本地跑出来的**应用原件**，是档案里的硬证据。
> 不看任何文档，直接起服务就能验证当时的产物长什么样。

## 目录

| 目录 | 是什么 | 关键读数 | 出处 |
| --- | --- | --- | --- |
| `t1-sheet/` | 平台 T1 的 sheet 产物（**历史最好 41/100** 那一份） | 本地 `local-grade.json`：100/103 | [`13-平台提交记录.md`](../13-平台提交记录.md) |
| `t1-github/` | 平台 T1 的 github 产物（跑至 21/47 节点） | 本地代理：51/100 | 同上 |
| `new-github/` | stage 线最终 github app + 自测 zip | stage-1 **30/30** | [`12-外聘Agent建产物提示词.md`](../12-外聘Agent建产物提示词.md) |
| `smoke-plant-template/` | 脚手架植入实验的产物（带 requirements 与参考图） | stage-1 30/30 | 台账 #39 前后 |
| `563ebf460ad2-template/` | 平台某次跑的 template 快照 | — | 台账 |
| `github-s1/`、`github-s2/` | stage-1 / stage-2 阶段产物与自测 zip | 30/30、29/29 | `12` |
| `selftest-gh/`、`selftest-gh2/` | 官方自测通道迭代用的 app 快照 | — | `12` §2B |
| `01b887727b63-template.zip` | 某次平台跑的完整 template 包（含 `.arc/` 运行记录） | — | 台账 |
| `01b887727b63-selftest.zip` | 同次的官方自测包 | — | 同上 |

## 每个产物里有什么

```
<artifact>/
├── backend/          # Node http 服务（零依赖）+ store.json 持久化 + 种子
├── frontend/
│   ├── src/          # 纯 HTML/JS/CSS，多页；资源一律根绝对路径
│   └── dist/         # 构建产物（gitignored，`npm run build` 可重建）
├── requirements/     # 该次运行的需求文档与参考图（平台注入）
└── .arc/             # 运行记录：local-grade.json 等（部分被运行时 .gitignore 挡住）
```

## 有意排除的东西

| 排除项 | 原因 | 怎么重建 |
| --- | --- | --- |
| `frontend/dist/` | 构建产物，可由 `src/` 逐字节重建 | `cd frontend && npm run build` |
| `node_modules/` | 体积，且零依赖 | 不需要 |
| `requirements/prerequisites.md` | 平台生成的空占位文件（0 字节） | 无意义 |
| `.arc/` 下除 `local-grade.json` 外 | 运行期运行时写的事件流，体积大 | 重跑 |

> `local-grade.json` 被**产物自带的 `.gitignore`**（由平台运行时写入，含 `.arc/*`）
> 挡住过，归档时用 `git add -f` 强制入库——它是这两个 headline 产物唯一的本地评分证据。

## 怎么验证一个产物

```sh
cd docs/arc-journey/artifacts/output/t1-sheet/template

# 起服务（零依赖，不需要 npm install）
cd frontend && npm run build && cd ..
cd backend && PORT=43100 node server.js

# 另开一个终端，用平台口径打分
python3 arc/grade-local.py docs/arc-journey/artifacts/output/t1-sheet/template hackathon--sheet

# 按「文档世界」打分（复现 102/103，见 14 章）
python3 arc/grade-docworld.py docs/arc-journey/artifacts/output/t1-sheet/template
```

> ⚠️ 评分会**改写产物自己的 `store.json`**（评分器需要干净种子）。评之前先复制一份，
> 或评完 `git checkout -- <artifact>` 还原。
