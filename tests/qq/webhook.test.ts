/**
 * 校验 QQ 回调请求的验签、地址验证与事件分发
 * 创建日期：2026-11-23
 * 修改日期：2026-11-23
 */
import { describe, expect, it } from "vitest";

import { signText, verifyText } from "../../src/qq/signature";
import { handleWebhookRequest } from "../../src/qq/webhook";

import type { GroupQuestion } from "../../src/services/answer-service";

const APP_SECRET = "test-app-secret";

const TIMESTAMP = "1725442341";

async function buildSignedRequest(body: string, appSecret = APP_SECRET): Promise<Request> {
	const signature = await signText(appSecret, `${TIMESTAMP}${body}`);

	return new Request("https://bot.example.com/webhook", {
		method: "POST",
		headers: {
			"X-Signature-Ed25519": signature,
			"X-Signature-Timestamp": TIMESTAMP,
		},
		body,
	});
}

function createOptions(questions: GroupQuestion[]) {
	return {
		appSecret: APP_SECRET,
		onGroupQuestion(question: GroupQuestion) {
			questions.push(question);
		},
	};
}

describe("handleWebhookRequest", () => {
	it("缺少签名头时返回 401", async () => {
		const request = new Request("https://bot.example.com/webhook", {
			method: "POST",
			body: "{}",
		});

		const response = await handleWebhookRequest(request, createOptions([]));

		expect(response.status).toBe(401);
	});

	it("用其他密钥签名时返回 401", async () => {
		const request = await buildSignedRequest(JSON.stringify({ op: 0, d: {} }), "wrong-secret");

		const response = await handleWebhookRequest(request, createOptions([]));

		expect(response.status).toBe(401);
	});

	it("地址验证请求返回 plain_token 与可验签的签名", async () => {
		const body = JSON.stringify({
			op: 13,
			d: {
				plain_token: "Arq0D5A61EgUu4OxUvOp",
				event_ts: "1725442341",
			},
		});

		const response = await handleWebhookRequest(await buildSignedRequest(body), createOptions([]));
		const result: { plain_token: string; signature: string } = await response.json();

		expect(response.status).toBe(200);
		expect(result.plain_token).toBe("Arq0D5A61EgUu4OxUvOp");
		await expect(
			verifyText(APP_SECRET, result.signature, "1725442341Arq0D5A61EgUu4OxUvOp"),
		).resolves.toBe(true);
	});

	it("地址验证缺少 plain_token 时返回 400", async () => {
		const body = JSON.stringify({ op: 13, d: { event_ts: "1" } });

		const response = await handleWebhookRequest(await buildSignedRequest(body), createOptions([]));

		expect(response.status).toBe(400);
	});

	it("群 @ 消息返回 ACK 并分发问题", async () => {
		const questions: GroupQuestion[] = [];
		const body = JSON.stringify({
			op: 0,
			t: "GROUP_AT_MESSAGE_CREATE",
			d: {
				id: "msg-1",
				group_openid: "group-1",
				content: " 怎么手冲",
			},
		});

		const response = await handleWebhookRequest(
			await buildSignedRequest(body),
			createOptions(questions),
		);

		expect(await response.json()).toEqual({ op: 12 });
		expect(questions).toEqual([
			{
				messageId: "msg-1",
				groupOpenid: "group-1",
				content: " 怎么手冲",
			},
		]);
	});

	it("群消息缺少 group_openid 时只返回 ACK", async () => {
		const questions: GroupQuestion[] = [];
		const body = JSON.stringify({ op: 0, t: "GROUP_AT_MESSAGE_CREATE", d: { id: "msg-1" } });

		const response = await handleWebhookRequest(
			await buildSignedRequest(body),
			createOptions(questions),
		);

		expect(await response.json()).toEqual({ op: 12 });
		expect(questions).toHaveLength(0);
	});

	it("其他事件只返回 ACK", async () => {
		const questions: GroupQuestion[] = [];
		const body = JSON.stringify({ op: 0, t: "C2C_MESSAGE_CREATE", d: { id: "msg-1" } });

		const response = await handleWebhookRequest(
			await buildSignedRequest(body),
			createOptions(questions),
		);

		expect(await response.json()).toEqual({ op: 12 });
		expect(questions).toHaveLength(0);
	});

	it("请求体不是 JSON 时返回 400", async () => {
		const response = await handleWebhookRequest(
			await buildSignedRequest("not-json"),
			createOptions([]),
		);

		expect(response.status).toBe(400);
	});
});
