# QQ 群问答机器人方案(零硬件 / 零成本 / 可长期运行)

整理日期:2026-11-23

## 1. 结论
- 方案:QQ 官方机器人(个人主体)+ Webhook 回调 + Cloudflare Workers 免费版 + 智谱免费 Flash 模型。
- 费用:0 CNY。不需要自己的服务器或电脑。
- 限制:个人主体只能加入自己是群主/管理员的群,不能公开上架;公开使用需企业主体。

## 2. 架构
1. 群成员 @机器人 → QQ 开放平台推送 `GROUP_AT_MESSAGE_CREATE` 事件到你的 HTTPS 回调地址(端口仅限 80/443/8080/8443)。
2. Cloudflare Workers 校验签名 → 立即返回 ACK → 用 `ctx.waitUntil` 异步处理。
3. 从知识库(LLM Wiki 的 md,存 Workers KV 或打包进 Worker)检索少量相关片段。
4. 调用智谱免费模型(OpenAI 兼容接口)生成回答。
5. 调用 `POST /v2/groups/{group_openid}/messages`,带上原 `msg_id` 回复。

## 3. 关键限制(含来源与日期)
| 项目 | 限制 | 来源(更新日期) |
|---|---|---|
| 个人主体 | 不支持公开使用,只能加自己是群主/管理员的群 | https://bot.qq.com/wiki/bot_FAQ/ (2026-11-11) |
| 群被动回复 | 有效期 60 分钟,每条消息最多回复 5 次;开发者为群主/管理员时 50 次 | https://bot.q.qq.com/wiki/develop/api-v2/autogen/api/v2_groups_group_openid_messages.post.html (2026-11-17) |
| 额度计算 | 按「每条用户消息」计算,每次 @ 都有新一轮额度 | 同上 |
| 主动消息 | 个人开发者额度极少(第三方称群聊每月 4 条),官方群聊数值:未知 | https://docs.cowagent.ai/zh/channels/qq (2026-10-14,第三方) |
| 回调地址 | 必须 HTTPS,端口 80/443/8080/8443 | https://bot.q.qq.com/wiki/develop/api-v2/dev-prepare/event-emit/webhook.html |
| 内容合规 | AI 输出违规会被封禁 | https://bot.qq.com/wiki/bot_FAQ/ (2026-11-11) |
| 群内收不到消息 | 需群主在手机 QQ 开启接收全量消息等权限 | 同上 |

## 4. 模型选择
- 首选:GLM-4-Flash-250414(智谱官方免费 API,128K 上下文)。https://docs.bigmodel.cn/cn/guide/models/free/glm-4-flash-250414 (2026-11-11)
- 备选:GLM-4.7-Flash(第三方称永久免费、1 并发)。https://ofox.io/zh/blog/glm-4-7-flash-free-api-china-guide-2026/ (2026-05-18,第三方)
- 兜底:硅基流动指定免费模型(清单会变,使用前核对)。https://docs.siliconflow.com/quickstart/models (2026-09-24)
- 注意:
  - 模型名放环境变量,GLM-4.5-Flash 已于 2026-01-30 下线,会被路由到 GLM-4.7-Flash。
  - 提示词控制在 8K 以内(第三方 2025-04 称超过 8K 并发降至 1%,可能已变)。
  - 免费档具体并发数:未知(官方控制台需登录)。
  - 「永久免费」是第三方说法,官方未承诺。

## 5. 托管:Cloudflare Workers 免费版
- Workers 请求 10 万次/天,KV 读 10 万次/天、写 1000 次/天、存储 1GB(第三方整理,2026-02-01:https://github.com/1837620622/cloudflare-free-services-guide)。
- 风险:QQ 服务器访问 workers.dev 是否稳定:未知。备选是其他免费 HTTPS 托管,或 LangBot 等中转方案(限制未知)。

## 6. 实施步骤
1. QQ 开放平台完成个人开发者认证,创建机器人,记录 AppID / AppSecret。
2. 管理端 → 开发设置 → 配置回调地址,勾选群 @ 消息事件。
3. 部署 Worker:Ed25519 签名校验、地址验证(opcode 13)、ACK(opcode 12)、获取 access_token 并缓存。
4. 接入智谱 API,系统提示词限定「只依据提供的资料回答,不知道就说不知道」。
5. 按 `msg_id` + `msg_seq` 去重,防止重复推送导致重复回答。
6. 把机器人加入自己管理的群,在群设置里开启权限,@ 机器人测试。

## 7. 不选的路线
- NapCat / OneBot(第三方协议):无被动回复限制,但需要常驻服务器,有封号和风控风险,2025-09 后腾讯加严反机器人策略。https://linux.do/t/topic/934328 (2025-09-06,第三方)
- WebSocket 接入:需要常驻进程,不满足零硬件。

## 8. 未解决问题
- QQ → Cloudflare 的可达性:未知,需实测。
- 回调超时秒数:未知,故采用先 ACK 再异步回复。
- 智谱免费并发的具体数值:未知。
- 群聊主动消息的官方额度:未知。
