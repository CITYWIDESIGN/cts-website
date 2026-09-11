import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * 过期数据清理。
 *
 * 这几张表**只增不减**，而且都没有任何自动清理：
 *
 *   EmailCode        每个验证码一行，里面是 scrypt 哈希（涨得最快）
 *   ResourceDownload 每次下载一行
 *   TransferUsage    每天每个主体一行
 *   DailyAction      每天每个主体每类行为一行
 *   Notification     每条站内消息一行（已读的没有保留价值）
 *
 * 在 2TB 的盘上不至于撑爆，但"没有上限"本身就是个定时炸弹：真到了几十万行
 * 再想清，就得面对一次长事务和大锁。所以给它们定一个明确的保留期，
 * 由 `debug.bat cleanup` 定期跑（cron 每天一次即可）。
 *
 * 保留期的选取原则：**只删"已经不可能再被用到"的东西**，
 * 统计口径（默认 90 天）和审计（365 天）都留够回溯空间。
 */
const DAY_MS = 24 * 60 * 60 * 1000;

export const RETENTION_DAYS = {
  /** 验证码有效期只有 10 分钟，留一天足够排查"没收到邮件" */
  emailCodes: 1,
  /** 下载明细：统计页按它算活跃度，留 90 天 */
  downloadRecords: 90,
  /** 每日流量 / 次数：同上 */
  usageCounters: 90,
  /** 已读的站内消息 */
  readNotifications: 90,
  /** 审计日志：出事了要能往回查，留一年 */
  auditLogs: 365,
} as const;

/** 单批删除的行数。分批是为了避免一次删几十万行时把表锁住 */
const BATCH = 2000;
/** 单次运行最多删多少批 —— 防止脚本跑成"停不下来" */
const MAX_BATCHES = 200;

export type PruneCounts = Record<string, number>;

export interface PruneOptions {
  /** 只统计不删除 */
  dryRun?: boolean;
  /** 覆盖保留天数（测试 / 手工用） */
  days?: Partial<Record<keyof typeof RETENTION_DAYS, number>>;
}

function cutoff(key: keyof typeof RETENTION_DAYS, options: PruneOptions): Date {
  const days = options.days?.[key] ?? RETENTION_DAYS[key];
  return new Date(Date.now() - days * DAY_MS);
}

/**
 * 分批删除。
 *
 * 不用一条 `deleteMany({ where })`：那会在一张可能很大的表上开一个长事务，
 * 期间持有行锁，站点那边的写入会排队甚至超时。分批删每次都是短事务。
 */
async function pruneBatched(
  label: string,
  count: (where: Record<string, unknown>) => Promise<number>,
  findIds: (where: Record<string, unknown>, take: number) => Promise<string[]>,
  remove: (ids: string[]) => Promise<number>,
  where: Record<string, unknown>,
  dryRun: boolean
): Promise<[string, number]> {
  if (dryRun) {
    return [label, await count(where)];
  }

  let total = 0;
  for (let i = 0; i < MAX_BATCHES; i++) {
    const ids = await findIds(where, BATCH);
    if (ids.length === 0) break;
    total += await remove(ids);
    // 这一批没取满，说明已经删完了
    if (ids.length < BATCH) break;
  }
  return [label, total];
}

/** 清掉所有超过保留期的数据。返回每类删了多少行。 */
export async function pruneOldData(options: PruneOptions = {}): Promise<PruneCounts> {
  const dryRun = options.dryRun ?? false;

  const emailCutoff = cutoff("emailCodes", options);
  const downloadCutoff = cutoff("downloadRecords", options);
  const usageCutoff = cutoff("usageCounters", options);
  const notificationCutoff = cutoff("readNotifications", options);
  const auditCutoff = cutoff("auditLogs", options);

  const jobs = await Promise.all([
    pruneBatched(
      "emailCodes",
      (w) => prisma.emailCode.count({ where: w }),
      async (w, take) =>
        (
          await prisma.emailCode.findMany({
            where: w,
            select: { id: true },
            take,
          })
        ).map((r) => r.id),
      async (ids) =>
        (await prisma.emailCode.deleteMany({ where: { id: { in: ids } } })).count,
      // 已消费的和已过期的都没用了；未消费且未过期的要留着
      { OR: [{ consumedAt: { not: null } }, { expiresAt: { lt: emailCutoff } }] },
      dryRun
    ),
    pruneBatched(
      "downloadRecords",
      (w) => prisma.resourceDownload.count({ where: w }),
      async (w, take) =>
        (
          await prisma.resourceDownload.findMany({
            where: w,
            select: { id: true },
            take,
          })
        ).map((r) => r.id),
      async (ids) =>
        (await prisma.resourceDownload.deleteMany({ where: { id: { in: ids } } }))
          .count,
      { createdAt: { lt: downloadCutoff } },
      dryRun
    ),
    pruneBatched(
      "transferUsage",
      (w) => prisma.transferUsage.count({ where: w }),
      async (w, take) =>
        (
          await prisma.transferUsage.findMany({
            where: w,
            select: { id: true },
            take,
          })
        ).map((r) => r.id),
      async (ids) =>
        (await prisma.transferUsage.deleteMany({ where: { id: { in: ids } } })).count,
      { updatedAt: { lt: usageCutoff } },
      dryRun
    ),
    pruneBatched(
      "dailyAction",
      (w) => prisma.dailyAction.count({ where: w }),
      async (w, take) =>
        (
          await prisma.dailyAction.findMany({
            where: w,
            select: { id: true },
            take,
          })
        ).map((r) => r.id),
      async (ids) =>
        (await prisma.dailyAction.deleteMany({ where: { id: { in: ids } } })).count,
      { updatedAt: { lt: usageCutoff } },
      dryRun
    ),
    pruneBatched(
      "readNotifications",
      (w) => prisma.notification.count({ where: w }),
      async (w, take) =>
        (
          await prisma.notification.findMany({
            where: w,
            select: { id: true },
            take,
          })
        ).map((r) => r.id),
      async (ids) =>
        (await prisma.notification.deleteMany({ where: { id: { in: ids } } })).count,
      // 未读的一律不动 —— 用户还没看到，删了就是"消息凭空消失"
      { readAt: { not: null, lt: notificationCutoff } },
      dryRun
    ),
    pruneBatched(
      "auditLogs",
      (w) => prisma.auditLog.count({ where: w }),
      async (w, take) =>
        (
          await prisma.auditLog.findMany({ where: w, select: { id: true }, take })
        ).map((r) => r.id),
      async (ids) =>
        (await prisma.auditLog.deleteMany({ where: { id: { in: ids } } })).count,
      { createdAt: { lt: auditCutoff } },
      dryRun
    ),
  ]);

  return Object.fromEntries(jobs);
}
