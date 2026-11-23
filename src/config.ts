/**
 * 读取并校验 Worker 环境变量
 * 创建日期：2026-11-23
 * 修改日期：2026-11-23
 */
import { ConfigError } from "./errors";

export interface Env {
	QQ_APP_ID: string;
	QQ_APP_SECRET: string;
	LLM_BASE_URL: string;
	LLM_MODEL: string;
	LLM_API_KEY: string;
	DEDUP_KV: KVNamespace;
}

export interface AppConfig {
	qqAppId: string;
	qqAppSecret: string;
	llmBaseUrl: string;
	llmModel: string;
	llmApiKey: string;
}

const REQUIRED_TEXT_KEYS = [
	"QQ_APP_ID",

	"QQ_APP_SECRET",

	"LLM_BASE_URL",

	"LLM_MODEL",

	"LLM_API_KEY",
] as const;

export function readConfig(env: Env): AppConfig {
	const missingKeys: string[] = [];

	for (const key of REQUIRED_TEXT_KEYS) {
		const value = env[key];

		if (typeof value !== "string" || value.trim() === "") {
			missingKeys.push(key);
		}
	}

	if (missingKeys.length > 0) {
		throw new ConfigError(`缺少环境变量：${missingKeys.join(", ")}`);
	}

	return {
		qqAppId: env.QQ_APP_ID.trim(),
		qqAppSecret: env.QQ_APP_SECRET.trim(),
		llmBaseUrl: env.LLM_BASE_URL.trim(),
		llmModel: env.LLM_MODEL.trim(),
		llmApiKey: env.LLM_API_KEY.trim(),
	};
}
