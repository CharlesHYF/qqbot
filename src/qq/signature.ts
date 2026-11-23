/**
 * 基于 AppSecret 派生 Ed25519 密钥并完成 QQ 回调签名与验签
 * 创建日期：2026-11-23
 * 修改日期：2026-11-23
 */
const ED25519_SEED_LENGTH = 32;

const HEX_RADIX = 16;

const HEX_BYTE_WIDTH = 2;

// PKCS#8 封装 Ed25519 私钥种子时固定的 ASN.1 前缀
const PKCS8_ED25519_PREFIX_HEX = "302e020100300506032b657004220420";

const ED25519_ALGORITHM = { name: "Ed25519" };

export interface SignatureKeys {
	privateKey: CryptoKey;
	publicKey: CryptoKey;
}

const keyCache = new Map<string, Promise<SignatureKeys>>();

const textEncoder = new TextEncoder();

// AppSecret 循环重复到 32 字节作为种子，与 QQ 官方 SDK 一致
export function buildSeed(appSecret: string): Uint8Array {
	if (appSecret === "") {
		throw new Error("AppSecret 不能为空");
	}

	const secretBytes = textEncoder.encode(appSecret);
	const seed = new Uint8Array(ED25519_SEED_LENGTH);

	for (let index = 0; index < ED25519_SEED_LENGTH; index++) {
		seed[index] = secretBytes[index % secretBytes.length];
	}

	return seed;
}

async function importSignatureKeys(appSecret: string): Promise<SignatureKeys> {
	const seed = buildSeed(appSecret);
	const pkcs8Prefix = decodeHex(PKCS8_ED25519_PREFIX_HEX);

	if (pkcs8Prefix === null) {
		throw new Error("PKCS#8 前缀格式错误");
	}

	const pkcs8 = new Uint8Array(pkcs8Prefix.length + seed.length);
	pkcs8.set(pkcs8Prefix, 0);
	pkcs8.set(seed, pkcs8Prefix.length);

	const privateKey = await crypto.subtle.importKey("pkcs8", pkcs8, ED25519_ALGORITHM, true, [
		"sign",
	]);
	const privateJwk = (await crypto.subtle.exportKey("jwk", privateKey)) as JsonWebKey;

	if (typeof privateJwk.x !== "string") {
		throw new Error("无法从私钥计算 Ed25519 公钥");
	}

	const publicKey = await crypto.subtle.importKey(
		"jwk",
		{
			kty: "OKP",
			crv: "Ed25519",
			x: privateJwk.x,
		},
		ED25519_ALGORITHM,
		false,
		["verify"],
	);

	return {
		privateKey,
		publicKey,
	};
}

export function getSignatureKeys(appSecret: string): Promise<SignatureKeys> {
	const cachedKeys = keyCache.get(appSecret);

	if (cachedKeys !== undefined) {
		return cachedKeys;
	}

	const pendingKeys = importSignatureKeys(appSecret);
	keyCache.set(appSecret, pendingKeys);
	// 导入失败时移除缓存，下次请求重新导入
	pendingKeys.catch(() => keyCache.delete(appSecret));

	return pendingKeys;
}

function encodeHex(bytes: Uint8Array): string {
	let hex = "";

	for (const byte of bytes) {
		hex += byte.toString(HEX_RADIX).padStart(HEX_BYTE_WIDTH, "0");
	}

	return hex;
}

function decodeHex(hex: string): Uint8Array | null {
	if (hex.length % HEX_BYTE_WIDTH !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) {
		return null;
	}

	const bytes = new Uint8Array(hex.length / HEX_BYTE_WIDTH);

	for (let index = 0; index < bytes.length; index++) {
		const start = index * HEX_BYTE_WIDTH;
		bytes[index] = Number.parseInt(hex.slice(start, start + HEX_BYTE_WIDTH), HEX_RADIX);
	}

	return bytes;
}

export async function signText(appSecret: string, text: string): Promise<string> {
	const keys = await getSignatureKeys(appSecret);
	const signature = await crypto.subtle.sign(
		ED25519_ALGORITHM,
		keys.privateKey,
		textEncoder.encode(text),
	);

	return encodeHex(new Uint8Array(signature));
}

export async function verifyText(
	appSecret: string,
	signatureHex: string,
	text: string,
): Promise<boolean> {
	const signature = decodeHex(signatureHex);

	if (signature === null) {
		return false;
	}

	const keys = await getSignatureKeys(appSecret);

	return crypto.subtle.verify(
		ED25519_ALGORITHM,
		keys.publicKey,
		signature,
		textEncoder.encode(text),
	);
}
