/**
 * 定义跨模块共享的类型
 * 创建日期：2026-11-23
 * 修改日期：2026-11-23
 */
export type FetchFunction = typeof fetch;

// Workers 要求以全局对象调用 fetch，直接保存 fetch 引用后调用会抛 Illegal invocation
export const globalFetch: FetchFunction = (input, init) => fetch(input, init);
