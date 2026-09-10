import "server-only";

import { headers } from "next/headers";


/**
 * 登录 / 注册的**进程内失败限流**。
 *
 * 同一 IP 10 分钟内失败 8 次就拒绝。这只是挡住最粗糙的暴力破解 ——
 * 进程重启会清零，多实例之间也不共享；要真正可靠得换成 Redis 或数据库计数。
 * 够这个规模用。
 *
 * 不是 "use server" 文件：这里是普通函数，被各个 action 引用，
 * 不应该被当成可以直接从客户端调用的服务端函数。
 */

/* ------------------------------------------------------------ 失败限流 */

const WINDOW_MS = 10 * 60_000;
const MAX_FAILS = 8;
const fails = new Map<string, { count: number; resetAt: number }>();

export async function throttleKey(scope: string): Promise<string> {
  return `${scope}:${await requestIp()}`;
}

/** 请求来源 IP（用于限流 + 写进验证码邮件里） */
export async function requestIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip")?.trim() || "unknown";
}

export function isThrottled(key: string): boolean {
  const row = fails.get(key);
  if (!row) return false;
  if (row.resetAt < Date.now()) {
    fails.delete(key);
    return false;
  }
  return row.count >= MAX_FAILS;
}

export function noteFail(key: string): void {
  const now = Date.now();
  const row = fails.get(key);
  if (!row || row.resetAt < now) {
    fails.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  row.count += 1;
}

export function clearFails(key: string): void {
  fails.delete(key);
}

/** 定期清掉过期条目，避免 Map 无上限增长 */
export function sweep(): void {
  const now = Date.now();
  for (const [key, row] of fails) {
    if (row.resetAt < now) fails.delete(key);
  }
}
