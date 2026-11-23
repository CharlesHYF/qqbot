/**
 * 校验环境变量读取与缺失检查
 * 创建日期：2026-11-23
 * 修改日期：2026-11-23
 */
import { describe, expect, it } from "vitest";

import { readConfig } from "../src/config";
import { ConfigError } from "../src/errors";

import type { Env } from "../src/config";

function buildEnv(overrides: Partial<Env> = {}): Env {
	return {
		QQ_APP_ID: " app-1 ",
		QQ_APP_SECRET: "secret-1",
		LLM_BASE_URL: "https://llm.example.com",
		LLM_MODEL: "glm-test",
		LLM_API_KEY: "key-1",
		DEDUP_KV: {} as KVNamespace,
		...overrides,
	};
}

describe("readConfig", () => {
	it("读取并去掉首尾空白", () => {
		const config = readConfig(buildEnv());

		expect(config.qqAppId).toBe("app-1");
		expect(config.llmModel).toBe("glm-test");
	});

	it("缺少变量时抛出 ConfigError 并列出变量名", () => {
		const env = buildEnv({ QQ_APP_SECRET: "", LLM_API_KEY: "  " });

		expect(() => readConfig(env)).toThrow(ConfigError);
		expect(() => readConfig(env)).toThrow("QQ_APP_SECRET, LLM_API_KEY");
	});
});
