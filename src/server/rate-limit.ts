import "server-only";

/**
 * 进程内的滑动窗口计数。
 *
 * 用途：给"某个 IP 一小时内最多做 N 次"这类兜底限流用（目前是邮箱验证码的
 * 发送上限）。和 `lib/actions/auth/throttle.ts` 的失败计数是同一个取舍：
 *
 *   - **进程内**：重启清零，多实例之间不共享
 *   - 因此它只挡脚本批量刷，挡不住认真做分布式绕过的人
 *
 * 之所以不复用数据库：那要给 `EmailCode` 加一列、要跑一次 schema 变更，
 * 为一个兜底限流不值得把部署流程变复杂。站点哪天多实例了，把它换成
 * Redis 或一张计数表即可，调用点不用动。
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** 超过这个数量就顺手清一遍过期条目，避免 Map 无上限增长 */
const SWEEP_THRESHOLD = 5_000;

function sweep(now: number): void {
  for (const [key, row] of buckets) {
    if (row.resetAt <= now) buckets.delete(key);
  }
}

/**
 * 消耗一个令牌。
 * @returns true = 放行；false = 超过窗口内的上限
 */
export function takeToken(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();

  if (buckets.size > SWEEP_THRESHOLD) sweep(now);

  const row = buckets.get(key);
  if (!row || row.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (row.count >= limit) return false;
  row.count += 1;
  return true;
}
