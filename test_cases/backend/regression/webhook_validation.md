# Webhook 地址验证回归用例

| 编号 | 场景 | 请求 | 预期结果 | 自动测试 |
| --- | --- | --- | --- | --- |
| REG-001 | 无签名地址验证 | op 13，包含 plain_token 和 event_ts，无签名请求头 | 返回 200、plain_token 和可校验的签名，不分发消息 | tests/qq/webhook.test.ts |
| REG-002 | 无签名群消息 | op 0，群 @ 事件，无签名请求头 | 返回 401，不分发消息 | tests/qq/webhook.test.ts |
| REG-003 | 错误签名事件 | 使用错误密钥签名的 op 0 事件 | 返回 401 | tests/qq/webhook.test.ts |
| REG-004 | 非法地址验证内容 | 签名内容包含 JSON 对象起始符 | 返回 400 | tests/qq/webhook.test.ts |
