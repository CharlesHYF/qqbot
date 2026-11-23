# QQ 群 Wiki 问答单元测试用例
> 对应自动化测试 `tests/`，执行命令 `pnpm test`。执行日期：2026-11-23。

| 测试编号 | 优先级 | 测试用例 | 前置条件 | 输入内容 | 预计结果 | 实际结果 | 是否通过 | 备注 |
| -------- | ------ | -------- | -------- | -------- | -------- | -------- | -------- | ---- |
| UT-001 | P0 | 种子派生 | - | AppSecret `abc`、40 字节、空串 | 循环重复到 32 字节；超长截取；空串报错 | 符合 | Pass | tests/qq/signature.test.ts |
| UT-002 | P0 | 回调地址验证签名 | - | 官方文档 op 13 示例 | 签名与文档一致 | 一致 | Pass | 同上 |
| UT-003 | P0 | 回调验签 | - | botgo 官方测试向量 | 验签通过 | 通过 | Pass | 同上 |
| UT-004 | P0 | 验签失败场景 | - | 篡改内容、其他密钥、非法 hex | 验签失败 | 失败 | Pass | 同上 |
| UT-005 | P0 | 回调无签名或错误签名 | - | 缺签名头、错误密钥签名 | 401 | 401 | Pass | tests/qq/webhook.test.ts |
| UT-006 | P0 | 地址验证响应 | - | 合法 op 13 | 返回 plain_token 与可验签的签名 | 符合 | Pass | 同上 |
| UT-007 | P1 | 地址验证参数缺失 | - | 缺 plain_token | 400 | 400 | Pass | 同上 |
| UT-008 | P0 | 群 @ 消息分发 | - | 合法 GROUP_AT_MESSAGE_CREATE | 返回 op 12，分发问题 | 符合 | Pass | 同上 |
| UT-009 | P1 | 无效事件 | - | 缺 group_openid、其他事件、非 JSON | 只 ACK 不分发；非 JSON 返回 400 | 符合 | Pass | 同上 |
| UT-010 | P0 | QQ API 请求格式 | - | 发送文字、上传媒体、发送富媒体 | token 只获取一次，字段与 msg_seq 正确 | 符合 | Pass | tests/qq/qq-api.test.ts |
| UT-011 | P1 | QQ API 异常 | - | 缺 file_info、HTTP 500 | 抛出 QqApiError | 符合 | Pass | 同上 |
| UT-012 | P0 | 模型请求格式 | - | 一条用户消息 | OpenAI 兼容请求，返回第一条回复 | 符合 | Pass | tests/llm/llm-client.test.ts |
| UT-013 | P1 | 模型异常 | - | HTTP 429、空 choices | 抛出 LlmRequestError | 符合 | Pass | 同上 |
| UT-014 | P1 | 配置校验 | - | 缺 QQ_APP_SECRET 与 LLM_API_KEY | 抛出 ConfigError 并列出变量名 | 符合 | Pass | tests/config.test.ts |
| UT-015 | P0 | Wiki 页面与媒体 | - | 含 index、log、媒体引用的页面 | index/log 不作为内容页；只列出存在的媒体并去重 | 符合 | Pass | tests/wiki/wiki-store.test.ts |
| UT-016 | P0 | 选页解析 | - | 含不存在页、index、重复页的回复 | 只保留真实内容页，最多 3 个 | 符合 | Pass | tests/services/answer-service.test.ts |
| UT-017 | P1 | 资料长度上限 | - | 两页各 5000 字 | 资料不超过 6000 字 | 符合 | Pass | 同上 |
| UT-018 | P0 | 作答解析 | - | NONE、带非法媒体标记、5 个媒体 | NONE 拒答；过滤非法媒体；最多 4 个 | 符合 | Pass | 同上 |
| UT-019 | P0 | 空问题 | - | 只有空白 | 回复使用说明，不调用模型 | 符合 | Pass | 同上 |
| UT-020 | P0 | 范围外问题 | - | 选页 NONE；作答 NONE | 回复拒答文案 | 符合 | Pass | 同上 |
| UT-021 | P0 | 模型失败 | - | 模型抛错 | 回复失败提示 | 符合 | Pass | 同上 |
| UT-022 | P0 | 正常回答带媒体 | - | 选中 basics.md，回答带图片和视频标记 | 先发文字，再按 msg_seq 2、3 发媒体；提示词只含选中页面 | 符合 | Pass | 同上 |
| UT-023 | P1 | 媒体失败降级 | - | 不支持的 gif、上传失败的 png | 跳过失败项，其余媒体正常发送 | 符合 | Pass | 同上 |
