/**
 * 校验模型客户端的请求格式与错误处理
 * 创建日期：2026-11-23
 * 修改日期：2026-11-23
 */
import { describe, expect, it } from "vitest";

import { LlmRequestError } from "../../src/errors";
import { LlmClient } from "../../src/llm/llm-client";

describe("LlmClient", () => {
	it("按 OpenAI 兼容格式请求并返回第一条回复", async () => {
		let requestUrl = "";
		let requestInit: RequestInit | undefined;
		// 客户端只会传入字符串 URL 和 JSON 字符串请求体
		const fakeFetch: typeof fetch = async (input, init) => {
			requestUrl = input as string;
			requestInit = init;

			return Promise.resolve(Response.json({ choices: [{ message: { content: "回答" } }] }));
		};
		const client = new LlmClient("https://llm.example.com/v4/", "glm-test", "key-1", fakeFetch);

		const reply = await client.chat([{ role: "user", content: "问题" }]);

		expect(reply).toBe("回答");
		expect(requestUrl).toBe("https://llm.example.com/v4/chat/completions");
		expect(new Headers(requestInit?.headers).get("Authorization")).toBe("Bearer key-1");
		expect(JSON.parse(requestInit?.body as string)).toMatchObject({
			model: "glm-test",
			messages: [{ role: "user", content: "问题" }],
		});
	});

	it("接口返回错误状态时抛出 LlmRequestError", async () => {
		const fakeFetch = (async () =>
			Promise.resolve(new Response("limit", { status: 429 }))) as typeof fetch;
		const client = new LlmClient("https://llm.example.com", "glm-test", "key-1", fakeFetch);

		await expect(client.chat([])).rejects.toBeInstanceOf(LlmRequestError);
	});

	it("响应缺少回复内容时抛出 LlmRequestError", async () => {
		const fakeFetch = (async () => Promise.resolve(Response.json({ choices: [] }))) as typeof fetch;
		const client = new LlmClient("https://llm.example.com", "glm-test", "key-1", fakeFetch);

		await expect(client.chat([])).rejects.toBeInstanceOf(LlmRequestError);
	});
});
