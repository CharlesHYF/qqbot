/**
 * 校验 QQ 回调签名并分发回调地址验证与群 @ 消息事件
 * 创建日期：2026-11-23
 * 修改日期：2026-11-23
 */
import { signText, verifyText } from "./signature";

import type { GroupQuestion } from "../services/answer-service";

const OP_DISPATCH = 0;

const OP_HTTP_CALLBACK_ACK = 12;

const OP_CALLBACK_VALIDATION = 13;

const EVENT_GROUP_AT_MESSAGE = "GROUP_AT_MESSAGE_CREATE";

const HTTP_STATUS_BAD_REQUEST = 400;

const HTTP_STATUS_UNAUTHORIZED = 401;

const SIGNATURE_HEADER = "X-Signature-Ed25519";

const TIMESTAMP_HEADER = "X-Signature-Timestamp";

interface CallbackPayload {
	op?: number;
	t?: string;
	d?: Record<string, unknown>;
}

export interface WebhookOptions {
	appSecret: string;
	onGroupQuestion(question: GroupQuestion): void;
}

function jsonResponse(body: Record<string, unknown>): Response {
	return new Response(JSON.stringify(body), {
		headers: {
			"Content-Type": "application/json",
		},
	});
}

function parsePayload(rawBody: string): CallbackPayload | null {
	try {
		const payload: unknown = JSON.parse(rawBody);

		if (typeof payload !== "object" || payload === null) {
			return null;
		}

		return payload;
	} catch {
		return null;
	}
}

function readText(data: Record<string, unknown>, key: string): string {
	const value = data[key];

	return typeof value === "string" ? value : "";
}

async function buildValidationResponse(
	appSecret: string,
	data: Record<string, unknown>,
): Promise<Response> {
	const plainToken = readText(data, "plain_token");
	const eventTs = readText(data, "event_ts");

	if (plainToken === "" || eventTs === "") {
		return new Response(null, { status: HTTP_STATUS_BAD_REQUEST });
	}

	const signature = await signText(appSecret, `${eventTs}${plainToken}`);

	return jsonResponse({
		plain_token: plainToken,
		signature,
	});
}

function readGroupQuestion(data: Record<string, unknown>): GroupQuestion | null {
	const messageId = readText(data, "id");
	const groupOpenid = readText(data, "group_openid");

	if (messageId === "" || groupOpenid === "") {
		return null;
	}

	return {
		messageId,
		groupOpenid,
		content: readText(data, "content"),
	};
}

export async function handleWebhookRequest(
	request: Request,
	options: WebhookOptions,
): Promise<Response> {
	const rawBody = await request.text();
	const signatureHex = request.headers.get(SIGNATURE_HEADER) ?? "";
	const timestamp = request.headers.get(TIMESTAMP_HEADER) ?? "";
	const isSignatureValid =
		signatureHex !== "" &&
		timestamp !== "" &&
		(await verifyText(options.appSecret, signatureHex, `${timestamp}${rawBody}`));

	if (!isSignatureValid) {
		return new Response(null, { status: HTTP_STATUS_UNAUTHORIZED });
	}

	const payload = parsePayload(rawBody);

	if (payload === null || typeof payload.d !== "object" || payload.d === null) {
		return new Response(null, { status: HTTP_STATUS_BAD_REQUEST });
	}

	if (payload.op === OP_CALLBACK_VALIDATION) {
		return buildValidationResponse(options.appSecret, payload.d);
	}

	if (payload.op === OP_DISPATCH && payload.t === EVENT_GROUP_AT_MESSAGE) {
		const question = readGroupQuestion(payload.d);

		if (question !== null) {
			options.onGroupQuestion(question);
		}
	}

	return jsonResponse({ op: OP_HTTP_CALLBACK_ACK });
}
