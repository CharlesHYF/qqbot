/**
 * 调用 QQ 开放平台 API 获取 token、发送群消息与上传群富媒体
 * 创建日期：2026-11-23
 * 修改日期：2026-11-23
 */
import { QqApiError } from "../errors";
import { globalFetch } from "../types";

import type { FetchFunction } from "../types";

const TOKEN_URL = "https://bots.qq.com/app/getAppAccessToken";

const API_BASE_URL = "https://api.sgroup.qq.com";

const MSG_TYPE_TEXT = 0;

const MSG_TYPE_MEDIA = 7;

const MILLISECONDS_PER_SECOND = 1000;

// token 提前 60 秒视为过期，避免请求途中失效
const TOKEN_REFRESH_MARGIN_MS = 60_000;

export const MEDIA_FILE_TYPE = {
	image: 1,
	video: 2,
} as const;

export type MediaFileType = (typeof MEDIA_FILE_TYPE)[keyof typeof MEDIA_FILE_TYPE];

interface CachedToken {
	accessToken: string;
	expiresAt: number;
}

interface TokenResponse {
	access_token?: string;
	expires_in?: string | number;
}

interface UploadMediaResponse {
	file_info?: string;
}

const tokenCache = new Map<string, CachedToken>();

export function clearTokenCache(): void {
	tokenCache.clear();
}

export class QqApiClient {
	private readonly appId: string;

	private readonly appSecret: string;

	private readonly fetchFunction: FetchFunction;

	constructor(appId: string, appSecret: string, fetchFunction: FetchFunction = globalFetch) {
		this.appId = appId;
		this.appSecret = appSecret;
		this.fetchFunction = fetchFunction;
	}

	async sendGroupText(
		groupOpenid: string,
		replyToMessageId: string,
		msgSeq: number,
		content: string,
	): Promise<void> {
		await this.postApi(`/v2/groups/${groupOpenid}/messages`, {
			content,
			msg_type: MSG_TYPE_TEXT,
			msg_id: replyToMessageId,
			msg_seq: msgSeq,
		});
	}

	async uploadGroupMedia(
		groupOpenid: string,
		fileType: MediaFileType,
		fileUrl: string,
	): Promise<string> {
		const response = (await this.postApi(`/v2/groups/${groupOpenid}/files`, {
			file_type: fileType,
			url: fileUrl,
			srv_send_msg: false,
		})) as UploadMediaResponse;

		if (typeof response.file_info !== "string" || response.file_info === "") {
			throw new QqApiError("上传富媒体的响应缺少 file_info");
		}

		return response.file_info;
	}

	async sendGroupMedia(
		groupOpenid: string,
		replyToMessageId: string,
		msgSeq: number,
		fileInfo: string,
	): Promise<void> {
		await this.postApi(`/v2/groups/${groupOpenid}/messages`, {
			msg_type: MSG_TYPE_MEDIA,
			media: {
				file_info: fileInfo,
			},
			msg_id: replyToMessageId,
			msg_seq: msgSeq,
		});
	}

	private async getAccessToken(): Promise<string> {
		const cachedToken = tokenCache.get(this.appId);

		if (cachedToken !== undefined && cachedToken.expiresAt > Date.now()) {
			return cachedToken.accessToken;
		}

		const response = await this.fetchFunction(TOKEN_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				appId: this.appId,
				clientSecret: this.appSecret,
			}),
		});

		if (!response.ok) {
			throw new QqApiError(`获取 access_token 失败，HTTP ${response.status}`);
		}

		const tokenResponse: TokenResponse = await response.json();
		const expiresInSeconds = Number(tokenResponse.expires_in);

		if (typeof tokenResponse.access_token !== "string" || !Number.isFinite(expiresInSeconds)) {
			throw new QqApiError("access_token 响应缺少 access_token 或 expires_in");
		}

		tokenCache.set(this.appId, {
			accessToken: tokenResponse.access_token,
			expiresAt: Date.now() + expiresInSeconds * MILLISECONDS_PER_SECOND - TOKEN_REFRESH_MARGIN_MS,
		});

		return tokenResponse.access_token;
	}

	private async postApi(path: string, body: Record<string, unknown>): Promise<unknown> {
		const accessToken = await this.getAccessToken();
		const response = await this.fetchFunction(`${API_BASE_URL}${path}`, {
			method: "POST",
			headers: {
				Authorization: `QQBot ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const errorText = await response.text();

			throw new QqApiError(`调用 ${path} 失败，HTTP ${response.status}：${errorText}`);
		}

		return response.json();
	}
}
