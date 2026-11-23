/**
 * 抓取狼队公告并生成 Wiki 更新日志页面
 * 创建日期：2026-11-23
 * 修改日期：2026-11-23
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ANNOUNCEMENT_URL = "https://wolfteam.ymbc.net/api/announcements";

const TIME_ZONE = "Asia/Shanghai";

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const CACHE_PATH = join(PROJECT_ROOT, "data", "announcements.json");

const OUTPUT_PATH = join(PROJECT_ROOT, "wiki", "pages", "announcements.md");

const JSON_INDENT = 2;

function formatDate(publishedAt) {
	const formatter = new Intl.DateTimeFormat("zh-CN", {
		timeZone: TIME_ZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	const parts = formatter.formatToParts(new Date(publishedAt));

	let year = "";
	let month = "";
	let day = "";

	for (const part of parts) {
		if (part.type === "year") {
			year = part.value;
		}

		if (part.type === "month") {
			month = part.value;
		}

		if (part.type === "day") {
			day = part.value;
		}
	}

	return `${year}-${month}-${day}`;
}

function buildMarkdown(announcements) {
	const groups = [];

	for (const item of announcements) {
		const date = formatDate(item.publishedAt);
		const lastGroup = groups[groups.length - 1];

		if (lastGroup !== undefined && lastGroup.date === date) {
			lastGroup.items.push(item);
		} else {
			groups.push({
				date,
				items: [item],
			});
		}
	}

	let markdown = "# 更新日志\n";

	for (const group of groups) {
		markdown += `\n## ${group.date}\n`;

		for (const item of group.items) {
			markdown += `\n${item.body.trim()}\n`;
		}
	}

	return markdown;
}

async function fetchFromWeb() {
	const response = await fetch(ANNOUNCEMENT_URL);

	if (!response.ok) {
		throw new Error(`公告接口返回 HTTP ${response.status}`);
	}

	const announcements = await response.json();

	if (!Array.isArray(announcements) || announcements.length === 0) {
		throw new Error("公告接口没有返回任何条目");
	}

	await mkdir(dirname(CACHE_PATH), { recursive: true });
	await writeFile(CACHE_PATH, JSON.stringify(announcements, null, JSON_INDENT), "utf8");

	return announcements;
}

async function readFromCache() {
	if (!existsSync(CACHE_PATH)) {
		return null;
	}

	const text = await readFile(CACHE_PATH, "utf8");
	const announcements = JSON.parse(text);

	if (!Array.isArray(announcements) || announcements.length === 0) {
		return null;
	}

	return announcements;
}

async function main() {
	let announcements = null;
	let source = "web";

	try {
		announcements = await fetchFromWeb();
	} catch (error) {
		console.warn(`从 web 获取公告失败，改用本地缓存：${error.message}`);
	}

	if (announcements === null) {
		announcements = await readFromCache();
		source = "local";
	}

	if (announcements === null) {
		throw new Error("web 与本地缓存都没有可用的公告");
	}

	await writeFile(OUTPUT_PATH, buildMarkdown(announcements), "utf8");

	console.log(`已写入 ${announcements.length} 条公告到 ${OUTPUT_PATH}，来源：${source}`);
}

main().catch((error) => {
	console.error("抓取公告失败：", error.message);
	process.exitCode = 1;
});
