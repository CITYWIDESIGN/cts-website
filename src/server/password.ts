import "server-only";

import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

/**
 * 密码哈希。
 *
 * 用 Node 内置的 **scrypt**，不引第三方依赖（bcrypt/argon2 都要编译原生模块，
 * 为这一处功能不值得）。scrypt 是内存硬的 KDF，抗 GPU 爆破，标准库实现够用。
 *
 * 存储格式（单字段自描述，方便以后换参数）：
 *   scrypt$<N>$<r>$<p>$<salt-base64>$<key-base64>
 *
 * 注意：**只做哈希，不做加密**，所以无法"找回"密码，只能重置。
 */

const KEY_LEN = 64;
/**
 * 当前写入用的参数。
 *
 * N 从 2^14 提到了 2^16（OWASP 对 scrypt 的建议是 2^17；这台机器 64GB 内存
 * 完全吃得下，但 2^17 每次 128MB 对并发登录还是太占，2^16 = 67MB 是个平衡点）。
 *
 * **提高参数不会让老密码失效**：哈希串本身自带 N/r/p，`verifyPassword` 读的是
 * 存储里的那一份。所以老用户照常登录，登录成功时由调用方用
 * `needsRehash()` 顺手把哈希升级到新参数（见 authenticateLocal）。
 */
const PARAMS = { N: 65536, r: 8, p: 1 } as const;
/** 128 * N * r = 64MB，留一倍余量 */
const MAX_MEM = 160 * 1024 * 1024;

function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/** 密码先做 NFKC 归一化：不同输入法打出的全角字符也会得到同一个哈希 */
function normalize(password: string): string {
  return password.normalize("NFKC");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(normalize(password), salt, KEY_LEN, {
    ...PARAMS,
    maxmem: MAX_MEM,
  });
  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

/**
 * 这个哈希是不是用的**旧参数**写的（需要顺手升级）。
 *
 * 用途：登录成功那一刻是唯一能拿到明文密码的时机，也是唯一能把老哈希
 * 无声升到新参数的时机。服务端只在登录成功时调用，不会泄露任何信息。
 *
 * 解析不出来 / 格式不认识 → 返回 false（那是 `verifyPassword` 该管的事，
 * 这里不该顺手把垃圾数据也"升级"一遍）。
 */
export function needsRehash(stored: string | null | undefined): boolean {
  const params = parseStored(stored);
  if (!params) return false;
  return (
    params.N !== PARAMS.N || params.r !== PARAMS.r || params.p !== PARAMS.p
  );
}

interface StoredParams {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  expected: Buffer;
}

/** 拆解存储格式；任何不合法都返回 null（调用方一律当作"校验失败"） */
function parseStored(stored: string | null | undefined): StoredParams | null {
  if (!stored) return null;

  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return null;
  }

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], "base64");
    expected = Buffer.from(parts[5], "base64");
  } catch {
    return null;
  }
  if (salt.length === 0 || expected.length === 0) return null;

  return { N, r, p, salt, expected };
}

/**
 * 校验密码。
 * 用 timingSafeEqual 做定长比较；账号不存在时调用方也应走一次假校验，
 * 避免通过响应时间判断账号是否存在（见 loginAction）。
 */
export async function verifyPassword(
  password: string,
  stored: string | null | undefined
): Promise<boolean> {
  const params = parseStored(stored);
  if (!params) return false;

  // N/r/p 来自数据库。被改坏时 scrypt 会因为超过 maxmem 抛错，
  // 下面 catch 掉返回 false —— 不会变成一条 DoS 路径。
  try {
    const key = await scryptAsync(normalize(password), params.salt, params.expected.length, {
      N: params.N,
      r: params.r,
      p: params.p,
      maxmem: MAX_MEM,
    });
    return (
      key.length === params.expected.length && timingSafeEqual(key, params.expected)
    );
  } catch {
    return false;
  }
}

/**
 * 账号不存在时用来"陪跑"的假哈希校验。
 * 目的是让"用户不存在"和"密码错误"耗时接近，不泄露账号是否存在。
 */
export async function dummyVerify(password: string): Promise<void> {
  await verifyPassword(password, DUMMY_HASH);
}

/**
 * 固定的一段合法哈希（对应随机密码），只用于消耗时间。
 *
 * ⚠️ **这里的 N 必须和上面的 PARAMS.N 保持一致。**
 * 它的唯一作用就是"陪跑"，如果参数比真实哈希低，假校验会明显更快 ——
 * 账号存不存在又能靠响应时间分辨出来了。
 * `password.test.ts` 里有一条用例专门盯这个。
 */
const DUMMY_HASH =
  `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$AAAAAAAAAAAAAAAAAAAAAA==$` +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
