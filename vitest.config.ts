/**
 * Vitest 测试配置
 * 创建日期：2026-11-23
 * 修改日期：2026-11-23
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["tests/**/*.test.ts"],
	},
});
