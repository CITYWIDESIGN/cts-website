import "server-only";

import { prisma } from "@/lib/prisma";
import { getLimits } from "@/server/settings";
import { limitsToBytes } from "@/lib/validators/limits";

/**
 * 每日传输配额。
 *
 * 规则：
 *   - 上传：**非管理员**每天默认 1GB（管理员不限）
 *   - 下载：**非管理员与未登录访客**每天默认 1GB（管理员不限）
 * 具体数字由管理员在后台「限额设置」里调整（见 @/server/settings）。
 *
 * 设计要点：
 * 1. 计数以「UTC 日期 + 主体」为键落库（见 schema 的 TransferUsage），
 *    跨天自然是新记录，不需要定时任务清零。
 * 2. 主体区分登录用户（user id）与访客（IP）。访客只能按 IP 计，
 *    这是常见的近似做法：同一 NAT 出口会共享额度。
 * 3. 这是**软限制**：高并发下 check 与 add 之间存在竞态，可能略微超出。
 *    对"防滥用"这个目的足够；如果要严格，需要在同一事务里加行锁。
 */

export type QuotaKind = "upload" | "download";

export interface QuotaSubject {
  /** 是否管理员 —— 管理员不参与配额 */
  isAdmin: boolean;
  /** 登录用户 id；未登录传 null */
  userId: string | null;
  /** 客户端 IP（仅访客用） */
  ip: string;
}

export interface QuotaStatus {
  allowed: boolean;
  used: number;
  limit: number;
  /** 本次操作的大小 */
  amount: number;
}

/** UTC 日期键，例如 2026-09-11 */
function dayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** 从请求头里取客户端 IP（优先取代理链的第一个） */
export function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "unknown"
  );
}

function subjectKeyFor(subject: QuotaSubject): {
  subjectType: string;
  subjectKey: string;
} {
  if (subject.userId) return { subjectType: "user", subjectKey: subject.userId };
  return { subjectType: "ip", subjectKey: subject.ip };
}

/** 读取当天用量（没有记录时为 0） */
export async function readUsage(
  subject: QuotaSubject,
  kind: QuotaKind
): Promise<number> {
  if (subject.isAdmin) return 0;

  const { subjectType, subjectKey } = subjectKeyFor(subject);
  const row = await prisma.transferUsage.findUnique({
    where: {
      // 复合唯一键在 schema 里被命名为 day_subject
      day_subject: {
        day: dayKey(),
        subjectType,
        subjectKey,
      },
    },
    select: { uploadBytes: true, downloadBytes: true },
  });

  if (!row) return 0;
  const value = kind === "upload" ? row.uploadBytes : row.downloadBytes;
  return Number(value);
}

/**
 * 检查是否还有额度。
 * 返回 allowed=false 时调用方应直接拒绝（上传返回 413，下载返回 429）。
 */
export async function checkQuota(
  subject: QuotaSubject,
  kind: QuotaKind,
  amount: number
): Promise<QuotaStatus> {
  const bytes = limitsToBytes(await getLimits());
  const limit =
    kind === "upload" ? bytes.uploadQuotaBytes : bytes.downloadQuotaBytes;

  if (subject.isAdmin) {
    return { allowed: true, used: 0, limit, amount };
  }
  const used = await readUsage(subject, kind);
  return {
    allowed: used + amount <= limit,
    used,
    limit,
    amount,
  };
}

/** 记入用量。管理员不计。 */
export async function addUsage(
  subject: QuotaSubject,
  kind: QuotaKind,
  amount: number
): Promise<void> {
  if (subject.isAdmin || amount <= 0) return;

  const { subjectType, subjectKey } = subjectKeyFor(subject);
  const day = dayKey();
  const field = kind === "upload" ? "uploadBytes" : "downloadBytes";

  await prisma.transferUsage.upsert({
    where: {
      day_subject: { day, subjectType, subjectKey },
    },
    create: {
      day,
      subjectType,
      subjectKey,
      uploadBytes: kind === "upload" ? BigInt(amount) : BigInt(0),
      downloadBytes: kind === "download" ? BigInt(amount) : BigInt(0),
    },
    update: {
      [field]: { increment: BigInt(amount) },
    },
  });
}
