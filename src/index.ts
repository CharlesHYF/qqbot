/**
 * QQ 群 Wiki 问答机器人的 Worker 入口
 * 创建日期：2026-11-23
 * 修改日期：2026-11-23
 */
import { readConfig } from "./config";
import { LlmClient } from "./llm/llm-client";
import { createLogger, describeError } from "./logger";
import { QqApiClient } from "./qq/qq-api";
import { handleWebhookRequest } from "./qq/webhook";
import { replyGroupQuestion } from "./services/answer-service";
import { createWikiStore } from "./wiki/wiki-store";

import type { AppConfig, Env } from "./config";
import type { GroupQuestion } from "./services/answer-service";

const WEBHOOK_PATH = "/webhook";

const HTTP_STATUS_NOT_FOUND = 404;

const HTTP_STATUS_INTERNAL_ERROR = 500;

// QQ 可能重复推送同一事件，消息 ID 保留 1 小时用于去重
const DEDUP_TTL_SECONDS = 3600;

const DEDUP_KEY_PREFIX = "msg:";

const logger = createLogger("qa-bot");

const wikiStore = createWikiStore();

async function isDuplicateMessage(kv: KVNamespace, messageId: string): Promise<boolean> {
	const key = `${DEDUP_KEY_PREFIX}${messageId}`;

	if ((await kv.get(key)) !== null) {
		return true;
	}

	await kv.put(key, "1", { expirationTtl: DEDUP_TTL_SECONDS });

	return false;
}

async function processGroupQuestion(
	question: GroupQuestion,
	config: AppConfig,
	env: Env,
	mediaBaseUrl: string,
): Promise<void> {
	try {
		if (await isDuplicateMessage(env.DEDUP_KV, question.messageId)) {
			logger.info("跳过重复推送的消息", { messageId: question.messageId });

			return;
		}

		await replyGroupQuestion(question, {
			chatClient: new LlmClient(config.llmBaseUrl, config.llmModel, config.llmApiKey),
			replier: new QqApiClient(config.qqAppId, config.qqAppSecret),
			wikiStore,
			mediaBaseUrl,
			logger,
		});
	} catch (error) {
		logger.error("处理群消息失败", {
			messageId: question.messageId,
			error: describeError(error),
		});
	}
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);

		if (request.method !== "POST" || url.pathname !== WEBHOOK_PATH) {
			return new Response(null, { status: HTTP_STATUS_NOT_FOUND });
		}

		let config: AppConfig;

		try {
			config = readConfig(env);
		} catch (error) {
			logger.error("读取配置失败", { error: describeError(error) });

			return new Response(null, { status: HTTP_STATUS_INTERNAL_ERROR });
		}

		return handleWebhookRequest(request, {
			appSecret: config.qqAppSecret,
			onGroupQuestion(question) {
				ctx.waitUntil(processGroupQuestion(question, config, env, url.origin));
			},
		});
	},
} satisfies ExportedHandler<Env>;
