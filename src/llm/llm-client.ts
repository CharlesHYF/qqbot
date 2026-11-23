/**
 * 调用 OpenAI 兼容的对话接口获取模型回复
 * 创建日期：2026-11-23
 * 修改日期：2026-11-23
 */
import { LlmRequestError } from "../errors";
import { globalFetch } from "../types";

import type { FetchFunction } from "../types";

// 问答只需要稳定复述资料，温度调低减少发挥
const ANSWER_TEMPERATURE = 0.2;

export interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

interface ChatCompletionResponse {
	choices?: {
		message?: {
			content?: string;
		};
	}[];
}

export interface ChatClient {
	chat(messages: ChatMessage[]): Promise<string>;
}

export class LlmClient implements ChatClient {
	private readonly baseUrl: string;

	private readonly model: string;

	private readonly apiKey: string;

	private readonly fetchFunction: FetchFunction;

	constructor(
		baseUrl: string,
		model: string,
		apiKey: string,
		fetchFunction: FetchFunction = globalFetch,
	) {
		this.baseUrl = baseUrl.replace(/\/+$/, "");
		this.model = model;
		this.apiKey = apiKey;
		this.fetchFunction = fetchFunction;
	}

	async chat(messages: ChatMessage[]): Promise<string> {
		const response = await this.fetchFunction(`${this.baseUrl}/chat/completions`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: this.model,
				messages,
				temperature: ANSWER_TEMPERATURE,
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();

			throw new LlmRequestError(`模型接口返回 HTTP ${response.status}：${errorText}`);
		}

		const completion: ChatCompletionResponse = await response.json();
		const firstChoice = completion.choices?.[0];
		const content = firstChoice?.message?.content;

		if (typeof content !== "string") {
			throw new LlmRequestError("模型响应缺少 choices[0].message.content");
		}

		return content;
	}
}
