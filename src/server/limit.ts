import "server-only";

import { prisma } from "@/lib/prisma";
import { getLimits } from "@/server/settings";
import type { LimitsConfig } from "@/lib/validators/limits";

/**
 * 每日**行为次数**限制。
 *
 * 规则：**非管理员**每天最多
 *   - 评论（含回复）：默认 50 条
 *   - 发布资源：默认 50 个
 *   - 改用户名：1 次（固定）
 * 管理员完全不受限，也不落库。
 *
 * 评论与资源的数字由管理员在后台「限额设置」里调整（见 @/server/settings）；
 * 用户名那一条**故意不开放配置** —— 它是防"改名躲人"的措施，不是配额，
 * 而且放宽到几次就失去意义了。
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

/** 用户名每天只能改一次，避免"改名躲人"。固定值，不进配置 */
export const USERNAME_CHANGES_PER_DAY = 1;

export type DailyAction = "comment" | "resource" | "username";

/** 取某个行为今天的上限 */
function limitFor(config: LimitsConfig, kind: DailyAction): number {
  switch (kind) {
    case "comment":
      return config.commentsPerDay;
    case "resource":
      return config.resourcesPerDay;
    case "username":
      return USERNAME_CHANGES_PER_DAY;
  }
}

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
  const limit = limitFor(await getLimits(), kind);
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
