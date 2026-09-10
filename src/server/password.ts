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
const PARAMS = { N: 16384, r: 8, p: 1 } as const;
/** 128 * N * r = 16MB，留一倍余量 */
const MAX_MEM = 64 * 1024 * 1024;

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
 * 校验密码。
 * 用 timingSafeEqual 做定长比较；账号不存在时调用方也应走一次假校验，
 * 避免通过响应时间判断账号是否存在（见 loginAction）。
 */
export async function verifyPassword(
  password: string,
  stored: string | null | undefined
): Promise<boolean> {
  if (!stored) return false;

  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return false;
  }

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], "base64");
    expected = Buffer.from(parts[5], "base64");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  try {
    const key = await scryptAsync(normalize(password), salt, expected.length, {
      N,
      r,
      p,
      maxmem: MAX_MEM,
    });
    return key.length === expected.length && timingSafeEqual(key, expected);
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

/** 固定的一段合法哈希（对应随机密码），只用于消耗时间 */
const DUMMY_HASH =
  "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
