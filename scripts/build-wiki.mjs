/**
 * 读取 wiki/pages 与 wiki/media 生成 Worker 内置的 Wiki 数据文件
 * 创建日期：2026-11-23
 * 修改日期：2026-11-23
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const PAGES_DIR = join(PROJECT_ROOT, "wiki", "pages");

const MEDIA_DIR = join(PROJECT_ROOT, "wiki", "media");

const OUTPUT_FILE = join(PROJECT_ROOT, "src", "wiki", "generated-pages.ts");

const INDEX_PAGE = "index.md";

const MEDIA_EXTENSION_REGEX = /\.(png|jpe?g|mp4)$/i;

const DATE_LENGTH = 10;

const JSON_INDENT = "\t";

async function listFileNames(directory, namePattern) {
	let entries;

	try {
		entries = await readdir(directory, { withFileTypes: true });
	} catch {
		// 目录可以不存在，例如删空 wiki/media 之后
		return [];
	}

	const fileNames = [];

	for (const entry of entries) {
		if (entry.isFile() && namePattern.test(entry.name)) {
			fileNames.push(entry.name);
		}
	}

	fileNames.sort();

	return fileNames;
}

async function readExistingOutput() {
	try {
		return await readFile(OUTPUT_FILE, "utf8");
	} catch {
		return null;
	}
}

async function buildWiki() {
	const pageNames = await listFileNames(PAGES_DIR, /\.md$/i);

	if (!pageNames.includes(INDEX_PAGE)) {
		throw new Error(`缺少 wiki/pages/${INDEX_PAGE}`);
	}

	const pages = {};

	for (const pageName of pageNames) {
		pages[pageName] = await readFile(join(PAGES_DIR, pageName), "utf8");
	}

	const mediaFiles = await listFileNames(MEDIA_DIR, MEDIA_EXTENSION_REGEX);
	const today = new Date().toISOString().slice(0, DATE_LENGTH);
	const output = `/**
 * 由 scripts/build-wiki.mjs 生成的 Wiki 数据，请勿手工修改
 * 创建日期：${today}
 * 修改日期：${today}
 */
export const WIKI_PAGES: Readonly<Record<string, string>> = ${JSON.stringify(pages, null, JSON_INDENT)};

export const WIKI_MEDIA_FILES: readonly string[] = ${JSON.stringify(mediaFiles, null, JSON_INDENT)};
`;

	// 内容未变化时不写文件，避免 wrangler dev 监听到改动后循环构建
	if ((await readExistingOutput()) === output) {
		return;
	}

	await mkdir(dirname(OUTPUT_FILE), { recursive: true });
	await writeFile(OUTPUT_FILE, output, "utf8");
	process.stdout.write(
		`已生成 Wiki 数据：${pageNames.length} 个页面，${mediaFiles.length} 个媒体文件\n`,
	);
}

try {
	await buildWiki();
} catch (error) {
	process.stderr.write(
		`生成 Wiki 数据失败：${error instanceof Error ? error.message : String(error)}\n`,
	);
	process.exit(1);
}
