import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * 封禁。
 *
 * 数据模型（见 schema 的 User）：
 *   - bannedAt 为空           → 从未被封禁
 *   - bannedAt 有值、until 空 → **永久**
 *   - bannedAt 有值、until 有值 → 到期自动失效，不需要定时任务去解封
 *
 * 被封禁的用户**不能**：点赞、评论（含回复）、下载、发布资源。
 * 仍然可以：浏览、看自己的资料。
 *
 * 判定只看时间，不看是否"被执行过解封"——解封会把三个字段一起清空，
 * 所以 isBanned 是一个纯函数，随时可以安全调用。
 */

/** 取消封禁/判断态的字段子集（getCurrentUser 会带上） */
export interface BannableUser {
  bannedAt?: Date | string | null;
  bannedUntil?: Date | string | null;
}

export type BanPreset = "1d" | "3d" | "7d" | "30d" | "forever";

/** 预设时长（天）；forever 用 null 表示 */
export const BAN_PRESET_DAYS: Record<Exclude<BanPreset, "forever">, number> = {
  "1d": 1,
  "3d": 3,
  "7d": 7,
  "30d": 30,
};

export const BAN_PRESETS: BanPreset[] = ["1d", "3d", "7d", "30d", "forever"];

function toDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  return v instanceof Date ? v : new Date(v);
}

/** 当前是否处于封禁中（纯函数，不查库） */
export function isBanned(user: BannableUser | null | undefined): boolean {
  if (!user) return false;
  const from = toDate(user.bannedAt);
  if (!from) return false;
  const until = toDate(user.bannedUntil);
  if (!until) return true; // 永久
  return until.getTime() > Date.now();
}

export class BanError extends Error {
  constructor(
    message: string,
    readonly code: "BANNED" | "NOT_FOUND" | "CANNOT_BAN_ADMIN" | "CANNOT_BAN_SELF" | "INVALID",
    readonly until: Date | null = null,
    readonly reason: string | null = null
  ) {
    super(message);
    this.name = "BanError";
  }
}

/** 封禁一个用户。preset 为 "forever" 表示永久。 */
export async function banUser(input: {
  userId: string;
  /** 由管理员传入，用于阻止自我封禁 */
  actorId: string;
  preset: BanPreset;
  reason: string | null;
}): Promise<{ bannedUntil: Date | null }> {
  if (input.userId === input.actorId) {
    throw new BanError("You cannot ban yourself.", "CANNOT_BAN_SELF");
  }

  const target = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, role: true },
  });
  if (!target) throw new BanError("User not found.", "NOT_FOUND");

  // 管理员之间不互相封禁：避免把后台彻底锁死
  if (target.role === "ADMIN") {
    throw new BanError("You cannot ban an admin.", "CANNOT_BAN_ADMIN");
  }

  const now = new Date();
  let bannedUntil: Date | null = null;
  if (input.preset !== "forever") {
    const days = BAN_PRESET_DAYS[input.preset];
    if (!days) throw new BanError("Invalid preset.", "INVALID");
    bannedUntil = new Date(now.getTime() + days * 86_400_000);
  }

  const reason = input.reason?.trim().slice(0, 300) || null;

  await prisma.user.update({
    where: { id: input.userId },
    data: { bannedAt: now, bannedUntil, banReason: reason },
  });

  return { bannedUntil };
}

/** 解除封禁 */
export async function unbanUser(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { bannedAt: null, bannedUntil: null, banReason: null },
  });
}
