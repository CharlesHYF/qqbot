<h1 align="center">qqbot</h1>

<p align="center">只依据 Markdown Wiki 回答的 QQ 群问答机器人：一个 Cloudflare Worker，加上 Karpathy 风格的 LLM Wiki 和免费 GLM 模型，支持文字、图片和 mp4 回复，不需要自己的服务器</p>

<div align="center">

![Version](https://img.shields.io/badge/version-0.1.0-blue?style=flat-square) ![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white) ![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white) [![verify](https://github.com/CharlesHYF/qqbot/actions/workflows/verify.yml/badge.svg)](https://github.com/CharlesHYF/qqbot/actions/workflows/verify.yml) ![License](https://img.shields.io/badge/license-%E7%A7%81%E6%9C%89-lightgrey?style=flat-square)

</div>

<p align="center">
  <a href="README.md">English</a> | 简体中文
</p>

<p align="center">
  <a href="#快速开始">快速开始</a> |
  <a href="#编写-wiki">编写 Wiki</a> |
  <a href="#配置项">配置项</a> |
  <a href="docs/modules/backend/qa-bot.md">模块文档</a>
</p>

## 目录

- [特性](#特性)
- [工作原理](#工作原理)
- [快速开始](#快速开始)
  - [前置条件](#前置条件)
  - [本地运行](#本地运行)
  - [部署](#部署)
- [编写 Wiki](#编写-wiki)
- [配置项](#配置项)
- [开发](#开发)
- [已知限制](#已知限制)
- [许可](#许可)

## 特性

- **只按 Wiki 回答**：模型先读 `wiki/pages/index.md` 选出最多 3 个相关页面，再只依据这些页面作答。可以归纳改写，但不能补充 Wiki 以外的事实。范围外的问题直接回复固定拒答文案，不做第二次模型调用。
- **Karpathy LLM Wiki 结构**：`wiki/raw/` 放只读源资料，`wiki/pages/` 放整理后的页面，`index.md` 是页面目录，`log.md` 是只追加的维护记录。按目录选页，提示词长度不随 Wiki 变大而增长。
- **文字、图片和 mp4 回复**：`wiki/media/` 下的图片（png/jpg）和视频（mp4）作为 Worker 静态资源发布。回复先发文字，再发最多 4 个媒体，正好用满 QQ 每条消息 5 次被动回复。只有选中页面引用过的文件才会被发送。
- **零成本、无服务器**：运行在 Cloudflare Workers 免费版，模型用免费的 GLM-4-Flash。收费的联网搜索不使用。
- **回调验签**：普通事件用 AppSecret 派生的 Ed25519 密钥校验，与官方 botgo SDK 及文档测试向量一致。同一消息重复推送时通过 Workers KV 跳过。
- **失败降级**：模型调用失败时回复"暂时无法回答，请稍后再试"；媒体上传失败只记录日志并跳过，不影响文字回答。

## 工作原理

```
QQ 群                 QQ 开放平台              Cloudflare Worker                     GLM
--------------        -----------------        ---------------------------------     --------------
@机器人 提问    ->    POST /webhook      ->    校验 Ed25519 签名
                                         <-    {"op": 12} ACK
                                               消息 ID 去重（KV）
                                               根据 index.md 选页              ->    页面名 / NONE
                                               依据选中页面作答                ->    回答 / NONE
                      发送文字 (seq 1)   <-
                      上传媒体 URL       <-    wiki/media 下的 /<文件名>
                      发送媒体 (seq 2+)  <-
```

## 快速开始

### 前置条件

- Node.js 24（见 `.nvmrc`）和 pnpm
- Cloudflare 账号
- 在 [QQ 开放平台](https://q.qq.com) 创建的机器人及其 AppID、AppSecret。个人主体机器人只能加入自己是群主或管理员的群。
- [智谱 AI](https://open.bigmodel.cn) API Key

### 本地运行

本地调试时 QQ 平台要能访问到回调地址，`localhost` 公网不可达，需要先用隧道把端口暴露出去。

```bash
pnpm install
cp .dev.vars.example .dev.vars   # 填写 QQ_APP_ID / QQ_APP_SECRET / LLM_API_KEY
pnpm dev                         # 启动 Worker，监听 8787

# 另开一个终端
ngrok http 8787                  # 记下输出的 https 地址
```

然后在 QQ 开放平台把回调地址设为 `https://<隧道地址>/webhook`，并订阅群 @ 消息事件，保存时平台会发起一次校验。

ngrok 首次使用需要先配置 authtoken：

```bash
ngrok config add-authtoken <你的 authtoken>
```

配置文件默认位于 `%LOCALAPPDATA%\ngrok\ngrok.yml`（Windows）或 `~/.config/ngrok/ngrok.yml`。免费版的隧道域名每次重启都会变，换域名后要回平台更新回调地址。

### 部署

```bash
pnpm exec wrangler login
pnpm exec wrangler kv namespace create DEDUP_KV   # 把返回的 id 填进 wrangler.toml
pnpm exec wrangler secret put QQ_APP_SECRET
pnpm exec wrangler secret put LLM_API_KEY
make deploy
```

然后在 `wrangler.toml` 填写 `QQ_APP_ID`，在 QQ 开放平台把回调地址设为 `https://<worker 域名>/webhook` 并订阅群 @ 消息事件，把机器人拉进群里 @ 它即可。

## 编写 Wiki

```
wiki/
  SCHEMA.md            结构与维护约定
  raw/                 源资料，机器人不读取
  pages/
    index.md           每个页面一行：- [标题](文件名.md) -- 摘要
    log.md             只追加的维护记录，不作为回答依据
    *.md               Wiki 页面
  media/               png / jpg / mp4
```

- 页面引用媒体用相对路径：`![步骤](../media/steps.png)` 或 `[演示视频](../media/demo.mp4)`。
- 新增或删除页面时同步更新 `index.md`，机器人只能找到目录里列出的页面。
- 修改 Wiki 后执行 `make deploy`，构建步骤 `scripts/build-wiki.mjs` 会把页面打包进 Worker。

仓库自带的 Wiki 是狼队服务器问答资料，按页面列出可回答的问题范围。

## 配置项

| 名称 | 类型 | 说明 |
| --- | --- | --- |
| `QQ_APP_ID` | var | 机器人 AppID |
| `QQ_APP_SECRET` | secret | 机器人 AppSecret，同时用于派生签名密钥 |
| `LLM_BASE_URL` | var | OpenAI 兼容接口地址，默认 `https://open.bigmodel.cn/api/paas/v4` |
| `LLM_MODEL` | var | 模型名，默认 `glm-4-flash-250414` |
| `LLM_API_KEY` | secret | 模型 API Key |
| `DEDUP_KV` | KV 绑定 | 消息去重，保留 1 小时 |

## 开发

```bash
make help          # 列出全部命令
make verify        # 增量规范校验 + 类型检查 + Lint + 测试
make verify-all    # 全量规范校验 + 测试（推主干前执行）
make dev           # 本地运行 Worker
make deploy        # 部署到 Cloudflare
```

```
src/index.ts                  Worker 入口、路由与消息去重
src/qq/signature.ts           Ed25519 密钥派生、签名与验签
src/qq/webhook.ts             回调验签与事件分发
src/qq/qq-api.ts              access_token 缓存、群消息与富媒体上传
src/llm/llm-client.ts         OpenAI 兼容对话客户端
src/wiki/wiki-store.ts        Wiki 页面、目录与媒体引用
src/services/answer-service.ts 选页、作答与群回复
scripts/build-wiki.mjs        把 wiki/pages 生成为 src/wiki/generated-pages.ts
tests/                        Vitest 单元测试
docs/modules/                 模块文档
test_cases/                   测试用例文档
```

编码规范与提交要求见 [AGENTS.md](AGENTS.md)。

## 已知限制

- `workers.dev` 域名在中国大陆网络下常无法访问，QQ 平台的回调校验会直接失败。需要换成国内可达的域名，或按本地运行一节用隧道调试。
- 以下几点尚未在真实 QQ 群验证：文字和媒体能否放在同一条消息、富媒体是否计入 5 次被动回复、媒体大小上限。
- 回调地址验证（op 13）接收 QQ 文档示例中的无签名请求，并返回签名结果。
- 只按 Wiki 回答靠提示词和选页约束，模型仍可能偶尔超出原文表述。
- 个人主体机器人不能公开上架，只能加入自己是群主或管理员的群。
- 只响应群内 @ 消息；群内全量消息需要平台开启 接收所有消息 功能并额外处理 `GROUP_MESSAGE_CREATE` 事件。

## 许可

私有项目，仅供个人使用。
