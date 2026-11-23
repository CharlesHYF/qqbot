/**
 * 定义项目统一的业务错误类型
 * 创建日期：2026-11-23
 * 修改日期：2026-11-23
 */
export class AppError extends Error {
	readonly code: string;

	constructor(code: string, message: string) {
		super(message);
		this.name = "AppError";
		this.code = code;
	}
}

export class ConfigError extends AppError {
	constructor(message: string) {
		super("CONFIG_INVALID", message);
		this.name = "ConfigError";
	}
}

export class QqApiError extends AppError {
	constructor(message: string) {
		super("QQ_API_FAILED", message);
		this.name = "QqApiError";
	}
}

export class LlmRequestError extends AppError {
	constructor(message: string) {
		super("LLM_REQUEST_FAILED", message);
		this.name = "LlmRequestError";
	}
}
