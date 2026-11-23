/**
 * 校验 QQ API 客户端的 token 缓存与请求格式
 * 创建日期：2026-11-23
 * 修改日期：2026-11-23
 */
import { beforeEach, describe, expect, it } from "vitest";

import { QqApiError } from "../../src/errors";
import { clearTokenCache, MEDIA_FILE_TYPE, QqApiClient } from "../../src/qq/qq-api";

interface RecordedRequest {
	url: string;
	headers: Headers;
	body: Record<string, unknown>;
}

function createFakeFetch(apiResponses: Response[]) {
	const requests: RecordedRequest[] = [];

	// 客户端只会传入字符串 URL 和 JSON 字符串请求体
	const fakeFetch: typeof fetch = async (input, init) => {
		const url = input as string;
		requests.push({
			url,
			headers: new Headers(init?.headers),
			body: JSON.parse(init?.body as string) as Record<string, unknown>,
		});

		if (url.startsWith("https://bots.qq.com")) {
			return Response.json({ access_token: "token-1", expires_in: "7200" });
		}

		const nextResponse = apiResponses.shift();

		return Promise.resolve(nextResponse ?? Response.json({}));
	};

	return {
		requests,
		fakeFetch,
	};
}

describe("QqApiClient", () => {
	beforeEach(() => {
		clearTokenCache();
	});

	it("发送文字消息时带上 token 与被动回复字段，token 只获取一次", async () => {
		const { requests, fakeFetch } = createFakeFetch([]);
		const client = new QqApiClient("app-1", "secret-1", fakeFetch);

		await client.sendGroupText("group-1", "msg-1", 1, "你好");
		await client.sendGroupText("group-1", "msg-1", 2, "再见");

		expect(requests).toHaveLength(3);
		expect(requests[0].body).toEqual({ appId: "app-1", clientSecret: "secret-1" });
		expect(requests[1].url).toBe("https://api.sgroup.qq.com/v2/groups/group-1/messages");
		expect(requests[1].headers.get("Authorization")).toBe("QQBot token-1");
		expect(requests[1].body).toEqual({
			content: "你好",
			msg_type: 0,
			msg_id: "msg-1",
			msg_seq: 1,
		});
		expect(requests[2].body.msg_seq).toBe(2);
	});

	it("上传媒体返回 file_info，发送富媒体使用 msg_type 7", async () => {
		const { requests, fakeFetch } = createFakeFetch([Response.json({ file_info: "info-1" })]);
		const client = new QqApiClient("app-1", "secret-1", fakeFetch);

		const fileInfo = await client.uploadGroupMedia(
			"group-1",
			MEDIA_FILE_TYPE.video,
			"https://x/a.mp4",
		);
		await client.sendGroupMedia("group-1", "msg-1", 2, fileInfo);

		expect(fileInfo).toBe("info-1");
		expect(requests[1].url).toBe("https://api.sgroup.qq.com/v2/groups/group-1/files");
		expect(requests[1].body).toEqual({ file_type: 2, url: "https://x/a.mp4", srv_send_msg: false });
		expect(requests[2].body).toEqual({
			msg_type: 7,
			media: { file_info: "info-1" },
			msg_id: "msg-1",
			msg_seq: 2,
		});
	});

	it("上传响应缺少 file_info 时抛出 QqApiError", async () => {
		const { fakeFetch } = createFakeFetch([Response.json({})]);
		const client = new QqApiClient("app-1", "secret-1", fakeFetch);

		await expect(
			client.uploadGroupMedia("group-1", MEDIA_FILE_TYPE.image, "https://x/a.png"),
		).rejects.toBeInstanceOf(QqApiError);
	});

	it("接口返回错误状态时抛出 QqApiError", async () => {
		const { fakeFetch } = createFakeFetch([new Response("bad", { status: 500 })]);
		const client = new QqApiClient("app-1", "secret-1", fakeFetch);

		await expect(client.sendGroupText("group-1", "msg-1", 1, "你好")).rejects.toThrow(/HTTP 500/);
	});
});
