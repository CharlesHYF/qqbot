/**
 * 校验 QQ 回调 Ed25519 签名与验签
 * 创建日期：2026-11-23
 * 修改日期：2026-11-23
 */
import { describe, expect, it } from "vitest";

import { buildSeed, signText, verifyText } from "../../src/qq/signature";

const APP_SECRET = "naOC0ocQE3shWLAfffVLB1rhYPG7";

describe("buildSeed", () => {
	it("AppSecret 循环重复到 32 字节", () => {
		const seed = buildSeed("abc");

		expect(seed.length).toBe(32);
		expect(new TextDecoder().decode(seed)).toBe("abcabcabcabcabcabcabcabcabcabcab");
	});

	it("超过 32 字节时截取前 32 字节", () => {
		const seed = buildSeed("x".repeat(40));

		expect(new TextDecoder().decode(seed)).toBe("x".repeat(32));
	});

	it("空 AppSecret 抛出错误", () => {
		expect(() => buildSeed("")).toThrow();
	});
});

describe("signText 与 verifyText", () => {
	// 向量来自 QQ 开放平台文档事件订阅与通知页的回调地址验证示例
	it("回调地址验证签名与官方文档示例一致", async () => {
		const signature = await signText("DG5g3B4j9X2KOErG", "1725442341Arq0D5A61EgUu4OxUvOp");

		expect(signature).toBe(
			"87befc99c42c651b3aac0278e71ada338433ae26fcb24307bdc5ad38c1adc2d01bcfcadc0842edac85e85205028a1132afe09280305f13aa6909ffc2d652c706",
		);
	});

	// 向量来自官方 Go SDK botgo 的 interaction/signature/interaction_test.go
	it("官方 SDK 测试中的回调签名可以验签通过", async () => {
		const body =
			'{"id":"ROBOT1.0_veoihSEXDc8Q.g-6eLpNIa11bH8MisOjn-m-LKxCPntMk6exUXgcWCGpVO7L2QKTNZzjZzFFDSbiOFcqAPWyVA!!","content":"哦一下","timestamp":"2024-10-15T16:33:15+08:00","author":{"id":"675860273","user_openid":"675860273"}}';
		const signature =
			"e949b5b94ef4103df903fb031d1d16e358db3db83e79e117edd404c8508be3ce8a76d7bad1bed353194c126a1a5915b4ad8b5288c1191cc53a12acffccd82004";

		await expect(verifyText("123456abcdef", signature, `1728981195${body}`)).resolves.toBe(true);
	});

	it("自签名的内容可以验签通过", async () => {
		const signature = await signText(APP_SECRET, "hello");

		await expect(verifyText(APP_SECRET, signature, "hello")).resolves.toBe(true);
	});

	it("内容被篡改时验签失败", async () => {
		const signature = await signText(APP_SECRET, "hello");

		await expect(verifyText(APP_SECRET, signature, "hello!")).resolves.toBe(false);
	});

	it("其他 AppSecret 的签名验签失败", async () => {
		const signature = await signText("another-secret", "hello");

		await expect(verifyText(APP_SECRET, signature, "hello")).resolves.toBe(false);
	});

	it("签名不是合法 hex 时验签失败", async () => {
		await expect(verifyText(APP_SECRET, "not-hex", "hello")).resolves.toBe(false);
		await expect(verifyText(APP_SECRET, "abc", "hello")).resolves.toBe(false);
	});
});
