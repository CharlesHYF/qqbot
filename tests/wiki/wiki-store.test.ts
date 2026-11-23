/**
 * 校验 Wiki 页面查询与媒体引用解析
 * 创建日期：2026-11-23
 * 修改日期：2026-11-23
 */
import { describe, expect, it } from "vitest";

import { WIKI_PAGES } from "../../src/wiki/generated-pages";
import { createWikiStore } from "../../src/wiki/wiki-store";

const PAGES = {
	"index.md": "- [A](a.md) -- 页面 A",
	"log.md": "## [2026-11-23] ingest | A",
	"a.md":
		"![图](../media/a.png)\n[视频](../media/a.mp4)\n![缺失](../media/missing.png)\n![重复](../media/a.png)",
};

describe("createWikiStore", () => {
	const store = createWikiStore(PAGES, ["a.png", "a.mp4"]);

	it("返回 index.md 内容", () => {
		expect(store.getIndex()).toBe(PAGES["index.md"]);
	});

	it("index.md、log.md 和不存在的页面不是内容页", () => {
		expect(store.isContentPage("a.md")).toBe(true);
		expect(store.isContentPage("index.md")).toBe(false);
		expect(store.isContentPage("log.md")).toBe(false);
		expect(store.isContentPage("none.md")).toBe(false);
		expect(store.isContentPage("toString")).toBe(false);
	});

	it("只列出页面引用且真实存在的媒体，去重", () => {
		expect(store.listPageMedia("a.md")).toEqual(["a.png", "a.mp4"]);
		expect(store.listPageMedia("none.md")).toEqual([]);
	});

	it("构建生成的数据包含 index.md", () => {
		expect(Object.hasOwn(WIKI_PAGES, "index.md")).toBe(true);
	});
});
