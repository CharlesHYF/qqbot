/**
 * 校验 Wiki 问答的选页、作答解析与群回复流程
 * 创建日期：2026-11-23
 * 修改日期：2026-11-23
 */
import { describe, expect, it } from "vitest";

import { LlmRequestError } from "../../src/errors";
import {
	buildMaterial,
	cleanQuestion,
	FAILURE_TEXT,
	getMediaFileType,
	parseAnswer,
	parsePageSelection,
	REFUSAL_TEXT,
	replyGroupQuestion,
	USAGE_TEXT,
} from "../../src/services/answer-service";
import { createWikiStore } from "../../src/wiki/wiki-store";

import type { ChatClient, ChatMessage } from "../../src/llm/llm-client";
import type { Logger } from "../../src/logger";
import type { MediaFileType } from "../../src/qq/qq-api";
import type { GroupReplier } from "../../src/services/answer-service";

const PAGES = {
	"index.md": "- [基础](basics.md) -- 冲煮参数\n- [器具](equipment.md) -- 器具清单",
	"log.md": "## [2026-11-23] ingest | 示例",
	"basics.md":
		"粉水比 1:15。\n![步骤](../media/steps.png)\n[视频](../media/demo.mp4)\n![文件](../media/notes.gif)",
	"equipment.md": "滤杯、滤纸。",
	"extra.md": "额外页面。",
};

const MEDIA_FILES = ["steps.png", "demo.mp4", "notes.gif", "unused.png"];

type ReplierCall =
	| { kind: "text"; msgSeq: number; content: string }
	| { kind: "upload"; fileType: MediaFileType; fileUrl: string }
	| { kind: "media"; msgSeq: number; fileInfo: string };

class FakeReplier implements GroupReplier {
	readonly calls: ReplierCall[] = [];

	failingUploadUrls = new Set<string>();

	sendGroupText(
		_groupOpenid: string,
		_replyToMessageId: string,
		msgSeq: number,
		content: string,
	): Promise<void> {
		this.calls.push({ kind: "text", msgSeq, content });

		return Promise.resolve();
	}

	uploadGroupMedia(
		_groupOpenid: string,
		fileType: MediaFileType,
		fileUrl: string,
	): Promise<string> {
		this.calls.push({ kind: "upload", fileType, fileUrl });

		if (this.failingUploadUrls.has(fileUrl)) {
			return Promise.reject(new Error("上传失败"));
		}

		return Promise.resolve(`info:${fileUrl}`);
	}

	sendGroupMedia(
		_groupOpenid: string,
		_replyToMessageId: string,
		msgSeq: number,
		fileInfo: string,
	): Promise<void> {
		this.calls.push({ kind: "media", msgSeq, fileInfo });

		return Promise.resolve();
	}
}

class FakeChatClient implements ChatClient {
	readonly requests: ChatMessage[][] = [];

	private readonly replies: (string | Error)[];

	constructor(replies: (string | Error)[]) {
		this.replies = replies;
	}

	chat(messages: ChatMessage[]): Promise<string> {
		this.requests.push(messages);
		const reply = this.replies.shift();

		if (reply instanceof Error) {
			return Promise.reject(reply);
		}

		return Promise.resolve(reply ?? "");
	}
}

const silentLogger: Logger = {
	info() {},
	warn() {},
	error() {},
};

const wikiStore = createWikiStore(PAGES, MEDIA_FILES);

const QUESTION = {
	messageId: "msg-1",
	groupOpenid: "group-1",
	content: " 粉水比是多少",
};

function buildDeps(chatClient: ChatClient, replier: GroupReplier) {
	return {
		chatClient,
		replier,
		wikiStore,
		mediaBaseUrl: "https://bot.example.com",
		logger: silentLogger,
	};
}

describe("cleanQuestion", () => {
	it("去掉 @ 标记与首尾空白", () => {
		expect(cleanQuestion(" <@!123> 怎么冲 ")).toBe("怎么冲");
	});
});

describe("parsePageSelection", () => {
	it("只保留真实存在的内容页，去重，最多 3 个", () => {
		const reply = "- basics.md\n`equipment.md`\nbasics.md\nindex.md\nfake.md\nextra.md\nlog.md";

		expect(parsePageSelection(reply, wikiStore)).toEqual(["basics.md", "equipment.md", "extra.md"]);
	});

	it("模型回复 NONE 时返回空列表", () => {
		expect(parsePageSelection("NONE", wikiStore)).toEqual([]);
	});
});

describe("buildMaterial", () => {
	it("按页面拼接资料并带页面名", () => {
		const material = buildMaterial(["basics.md", "equipment.md"], wikiStore);

		expect(material).toContain("=== basics.md ===\n粉水比 1:15。");
		expect(material).toContain("=== equipment.md ===\n滤杯、滤纸。");
	});

	it("资料总长度不超过 6000 字", () => {
		const longStore = createWikiStore(
			{ "index.md": "", "a.md": "长".repeat(5000), "b.md": "长".repeat(5000) },
			[],
		);

		expect(buildMaterial(["a.md", "b.md"], longStore).length).toBeLessThanOrEqual(6000);
	});
});

describe("parseAnswer", () => {
	it("回复 NONE 或空内容时返回 null", () => {
		expect(parseAnswer("NONE", [])).toBeNull();
		expect(parseAnswer("  \n", [])).toBeNull();
	});

	it("提取允许的媒体标记并从文本中去掉标记和图片语法", () => {
		const answer = parseAnswer(
			"粉水比 1:15。\n![x](../media/steps.png)\n[[media:steps.png]]\n[[media:hack.png]]",
			["steps.png"],
		);

		expect(answer).toEqual({
			text: "粉水比 1:15。",
			mediaFiles: ["steps.png"],
		});
	});

	it("媒体最多 4 个", () => {
		const reply =
			"答案\n[[media:1.png]][[media:2.png]][[media:3.png]][[media:4.png]][[media:5.png]]";

		expect(parseAnswer(reply, ["1.png", "2.png", "3.png", "4.png", "5.png"])?.mediaFiles).toEqual([
			"1.png",
			"2.png",
			"3.png",
			"4.png",
		]);
	});
});

describe("getMediaFileType", () => {
	it("按扩展名区分图片与视频", () => {
		expect(getMediaFileType("a.PNG")).toBe(1);
		expect(getMediaFileType("a.jpeg")).toBe(1);
		expect(getMediaFileType("a.mp4")).toBe(2);
		expect(getMediaFileType("a.gif")).toBeNull();
	});
});

describe("replyGroupQuestion", () => {
	it("问题为空时回复使用说明且不调用模型", async () => {
		const chatClient = new FakeChatClient([]);
		const replier = new FakeReplier();

		await replyGroupQuestion({ ...QUESTION, content: "  " }, buildDeps(chatClient, replier));

		expect(chatClient.requests).toHaveLength(0);
		expect(replier.calls).toEqual([{ kind: "text", msgSeq: 1, content: USAGE_TEXT }]);
	});

	it("选页结果为 NONE 时拒答且只调用一次模型", async () => {
		const chatClient = new FakeChatClient(["NONE"]);
		const replier = new FakeReplier();

		await replyGroupQuestion(
			{ ...QUESTION, content: "今天天气怎么样" },
			buildDeps(chatClient, replier),
		);

		expect(chatClient.requests).toHaveLength(1);
		expect(chatClient.requests[0][0].content).toContain("- [基础](basics.md)");
		expect(replier.calls).toEqual([{ kind: "text", msgSeq: 1, content: REFUSAL_TEXT }]);
	});

	it("作答结果为 NONE 时拒答", async () => {
		const chatClient = new FakeChatClient(["basics.md", "NONE"]);
		const replier = new FakeReplier();

		await replyGroupQuestion(QUESTION, buildDeps(chatClient, replier));

		expect(replier.calls).toEqual([{ kind: "text", msgSeq: 1, content: REFUSAL_TEXT }]);
	});

	it("模型调用失败时回复失败提示", async () => {
		const chatClient = new FakeChatClient([new LlmRequestError("超时")]);
		const replier = new FakeReplier();

		await replyGroupQuestion(QUESTION, buildDeps(chatClient, replier));

		expect(replier.calls).toEqual([{ kind: "text", msgSeq: 1, content: FAILURE_TEXT }]);
	});

	it("先发文字再逐个发媒体，msg_seq 递增，作答提示词只含选中页面资料", async () => {
		const chatClient = new FakeChatClient([
			"basics.md",
			"粉水比 1:15。\n[[media:steps.png]]\n[[media:demo.mp4]]",
		]);
		const replier = new FakeReplier();

		await replyGroupQuestion(QUESTION, buildDeps(chatClient, replier));

		const answerPrompt = chatClient.requests[1][0].content;
		expect(answerPrompt).toContain("=== basics.md ===");
		expect(answerPrompt).not.toContain("滤杯");
		expect(answerPrompt).toContain("可用文件：steps.png、notes.gif、demo.mp4");
		expect(chatClient.requests[1][1]).toEqual({ role: "user", content: "粉水比是多少" });
		expect(replier.calls).toEqual([
			{ kind: "text", msgSeq: 1, content: "粉水比 1:15。" },
			{ kind: "upload", fileType: 1, fileUrl: "https://bot.example.com/steps.png" },
			{ kind: "media", msgSeq: 2, fileInfo: "info:https://bot.example.com/steps.png" },
			{ kind: "upload", fileType: 2, fileUrl: "https://bot.example.com/demo.mp4" },
			{ kind: "media", msgSeq: 3, fileInfo: "info:https://bot.example.com/demo.mp4" },
		]);
	});

	it("媒体上传失败或类型不支持时跳过，不影响其他媒体", async () => {
		const chatClient = new FakeChatClient([
			"basics.md",
			"答案\n[[media:notes.gif]]\n[[media:steps.png]]\n[[media:demo.mp4]]",
		]);
		const replier = new FakeReplier();
		replier.failingUploadUrls.add("https://bot.example.com/steps.png");

		await replyGroupQuestion(QUESTION, buildDeps(chatClient, replier));

		expect(replier.calls).toEqual([
			{ kind: "text", msgSeq: 1, content: "答案" },
			{ kind: "upload", fileType: 1, fileUrl: "https://bot.example.com/steps.png" },
			{ kind: "upload", fileType: 2, fileUrl: "https://bot.example.com/demo.mp4" },
			{ kind: "media", msgSeq: 2, fileInfo: "info:https://bot.example.com/demo.mp4" },
		]);
	});
});
