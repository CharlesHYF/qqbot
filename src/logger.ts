/**
 * 输出 JSON 结构化日志到 Workers Logs
 * 创建日期：2026-11-23
 * 修改日期：2026-11-23
 */
export type LogFields = Record<string, unknown>;

export interface Logger {
	info(message: string, fields?: LogFields): void;
	warn(message: string, fields?: LogFields): void;
	error(message: string, fields?: LogFields): void;
}

type LogLevel = "INFO" | "WARN" | "ERROR";

// Workers 只能通过 console 输出日志，这里是项目内唯一调用 console 的位置
function writeLog(level: LogLevel, moduleName: string, message: string, fields?: LogFields): void {
	const line = JSON.stringify({
		time: new Date().toISOString(),
		level,
		module: moduleName,
		message,
		...fields,
	});

	if (level === "ERROR") {
		console.error(line);

		return;
	}

	if (level === "WARN") {
		console.warn(line);

		return;
	}

	console.info(line);
}

export function createLogger(moduleName: string): Logger {
	return {
		info(message, fields) {
			writeLog("INFO", moduleName, message, fields);
		},
		warn(message, fields) {
			writeLog("WARN", moduleName, message, fields);
		},
		error(message, fields) {
			writeLog("ERROR", moduleName, message, fields);
		},
	};
}

export function describeError(error: unknown): string {
	if (error instanceof Error) {
		return `${error.name}: ${error.message}`;
	}

	return String(error);
}
