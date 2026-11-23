/**
 * 抓取狼队公告接口并生成 Wiki 更新日志页面
 * 创建日期：2026-11-23
 * 修改日期：2026-11-23
 */
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ANNOUNCEMENT_URL = "https://wolfteam.ymbc.net/api/announcements";

const TIME_ZONE = "Asia/Shanghai";

const OUTPUT_PATH = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"wiki",
	"pages",
	"announcements.md",
);

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

async function main() {
	const response = await fetch(ANNOUNCEMENT_URL);

	if (!response.ok) {
		throw new Error(`公告接口返回 HTTP ${response.status}`);
	}

	const announcements = await response.json();

	if (!Array.isArray(announcements) || announcements.length === 0) {
		throw new Error("公告接口没有返回任何条目");
	}

	await writeFile(OUTPUT_PATH, buildMarkdown(announcements), "utf8");

	console.log(`已写入 ${announcements.length} 条公告到 ${OUTPUT_PATH}`);
}

main().catch((error) => {
	console.error("抓取公告失败：", error.message);
	process.exitCode = 1;
});
