/**
 * 提供 Wiki 页面、索引与媒体引用的查询
 * 创建日期：2026-11-23
 * 修改日期：2026-11-23
 */
import { WIKI_MEDIA_FILES, WIKI_PAGES } from "./generated-pages";

export const INDEX_PAGE_NAME = "index.md";

// log.md 只记录 Wiki 维护历史，不作为回答依据
const NON_CONTENT_PAGE_NAMES = new Set([INDEX_PAGE_NAME, "log.md"]);

const MARKDOWN_IMAGE_REGEX = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

const MARKDOWN_LINK_REGEX = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

export interface WikiStore {
	getIndex(): string;
	getPage(pageName: string): string | undefined;
	isContentPage(pageName: string): boolean;
	listPageMedia(pageName: string): string[];
}

function getFileName(path: string): string {
	const segments = path.split("/");

	return decodeURIComponent(segments[segments.length - 1]);
}

export function createWikiStore(
	pages: Readonly<Record<string, string>> = WIKI_PAGES,
	mediaFiles: readonly string[] = WIKI_MEDIA_FILES,
): WikiStore {
	const mediaFileSet = new Set(mediaFiles);

	return {
		getIndex() {
			return pages[INDEX_PAGE_NAME] ?? "";
		},

		getPage(pageName) {
			return Object.hasOwn(pages, pageName) ? pages[pageName] : undefined;
		},

		isContentPage(pageName) {
			return Object.hasOwn(pages, pageName) && !NON_CONTENT_PAGE_NAMES.has(pageName);
		},

		// 只返回页面里通过图片或链接语法引用、且 wiki/media 中真实存在的文件
		listPageMedia(pageName) {
			const content = Object.hasOwn(pages, pageName) ? pages[pageName] : "";
			const referencedFiles: string[] = [];

			for (const pattern of [MARKDOWN_IMAGE_REGEX, MARKDOWN_LINK_REGEX]) {
				for (const match of content.matchAll(pattern)) {
					const fileName = getFileName(match[1]);

					if (mediaFileSet.has(fileName) && !referencedFiles.includes(fileName)) {
						referencedFiles.push(fileName);
					}
				}
			}

			return referencedFiles;
		},
	};
}
