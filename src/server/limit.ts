import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * 每日**行为次数**限制。
 *
 * 规则：**非管理员**每天最多
 *   - 评论（含回复）：50 条
 *   - 发布资源：50 个
 * 管理员完全不受限，也不落库。
 *
 * 和 quota.ts（字节配额）的分工：
 *   - quota.ts 防"流量"滥用  → TransferUsage，记字节
 *   - 这里     防"刷屏"滥用  → DailyAction，记条数
 *
 * 设计要点：
 * 1. 计数以「UTC 日期 + 主体 + 行为」为键落库，跨天自然是新记录，
 *    不需要定时任务清零（与 TransferUsage 同一套思路）。
 * 2. 这是**软限制**：check 与 add 之间存在竞态，高并发下可能略微超出。
 *    对"防刷屏"这个目的足够；要严格就得在同一事务里加行锁。
 */

export const DAILY_ACTION_LIMITS = {
  /** 评论 + 回复合计 */
  comment: 50,
  /** 发布资源 */
  resource: 50,
  /** 改用户名 —— 每天只能改一次，避免"改名躲人" */
  username: 1,
} as const;

export type DailyAction = keyof typeof DAILY_ACTION_LIMITS;

export interface LimitStatus {
  allowed: boolean;
  used: number;
  limit: number;
}

/** UTC 日期键，例如 2026-09-11 */
function dayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** 读取今天已用次数（没有记录时为 0） */
export async function readDailyCount(
  userId: string,
  kind: DailyAction
): Promise<number> {
  const row = await prisma.dailyAction.findUnique({
    where: {
      // 复合唯一键在 schema 里被命名为 day_subject_kind
      day_subject_kind: {
        day: dayKey(),
        subjectType: "user",
        subjectKey: userId,
        kind,
      },
    },
    select: { count: true },
  });
  return row?.count ?? 0;
}

/**
 * 检查今天是否还能再做一次。
 * 返回 allowed=false 时调用方应拒绝并给出提示。
 */
export async function checkDailyLimit(
  userId: string,
  kind: DailyAction,
  isAdmin = false
): Promise<LimitStatus> {
  const limit = DAILY_ACTION_LIMITS[kind];
  if (isAdmin) return { allowed: true, used: 0, limit };

  const used = await readDailyCount(userId, kind);
  return { allowed: used < limit, used, limit };
}

/** 记一次用量。**只在操作成功后调用**，管理员不计。 */
export async function addDailyCount(
  userId: string,
  kind: DailyAction,
  isAdmin = false
): Promise<void> {
  if (isAdmin) return;

  const day = dayKey();
  await prisma.dailyAction.upsert({
    where: {
      day_subject_kind: {
        day,
        subjectType: "user",
        subjectKey: userId,
        kind,
      },
    },
    create: { day, subjectType: "user", subjectKey: userId, kind, count: 1 },
    update: { count: { increment: 1 } },
  });
}
