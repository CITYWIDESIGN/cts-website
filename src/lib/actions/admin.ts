"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { UpdateUserRoleSchema } from "@/lib/validators/questionnaire";
import { banUser, unbanUser, BanError, BAN_PRESETS, type BanPreset } from "@/server/ban";
import { isLastAdmin, purgeUser } from "@/server/user-deletion";
import { recordAudit } from "@/server/audit";

export type ActionState = { ok: boolean; error?: string };

/** Admin：更新用户角色 */
export async function adminUpdateUserRole(
  userId: string,
  role: string
): Promise<ActionState> {
  const admin = await requireAdmin();

  // 防止管理员误降级自己导致锁死
  if (admin.id === userId) {
    return { ok: false, error: "cannot_change_self" };
  }

  const parsed = UpdateUserRoleSchema.safeParse({ role });
  if (!parsed.success) return { ok: false, error: "invalid" };

  await prisma.user.update({
    where: { id: userId },
    data: { role: parsed.data.role },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}

/* ------------------------------------------------------------------ 封禁 */

/**
 * Admin：封禁用户。
 * preset 见 @/server/ban 的 BAN_PRESETS（1d / 3d / 7d / 30d / forever）。
 */
export async function adminBanUser(
  userId: string,
  preset: string,
  reason: string
): Promise<ActionState> {
  const admin = await requireAdmin();

  if (!BAN_PRESETS.includes(preset as BanPreset)) {
    return { ok: false, error: "invalid" };
  }

  try {
    await banUser({
      userId,
      actorId: admin.id,
      preset: preset as BanPreset,
      reason,
    });
  } catch (err) {
    if (err instanceof BanError) return { ok: false, error: err.code };
    console.error("[adminBanUser]", err);
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/stats");
  revalidatePath(`/u/${userId}`);
  return { ok: true };
}

/** Admin：解除封禁 */
export async function adminUnbanUser(userId: string): Promise<ActionState> {
  await requireAdmin();

  try {
    await unbanUser(userId);
  } catch (err) {
    console.error("[adminUnbanUser]", err);
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/stats");
  revalidatePath(`/u/${userId}`);
  return { ok: true };
}

/* ------------------------------------------------------------ 删除用户 */

/**
 * Admin：**彻底删除**用户及其全部内容。
 *
 * 和用户自己「注销」的区别：注销只抹掉身份、内容保留；
 * 删除是把资源、评论、问卷提交、点赞、消息一起清掉。
 * 用于处理垃圾号 / 刷屏号 —— 想保留内容就别用这个。
 *
 * 三重保护：不能删自己、不能删其他管理员、不能删最后一个管理员。
 */
export async function adminPurgeUser(userId: string): Promise<ActionState> {
  const admin = await requireAdmin();

  if (admin.id === userId) return { ok: false, error: "cannot_delete_self" };

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      username: true,
      minecraftUsername: true,
      _count: { select: { resources: true, submissions: true } },
    },
  });
  if (!target) return { ok: false, error: "not_found" };

  // 管理员之间不互相删除，避免把后台锁死
  if (target.role === "ADMIN") {
    return { ok: false, error: "cannot_delete_admin" };
  }

  if (await isLastAdmin(userId)) {
    return { ok: false, error: "last_admin" };
  }

  // 记账：审计里要写清楚连带删了多少东西
  const [comments, likes] = await Promise.all([
    prisma.resourceComment.count({ where: { userId } }),
    prisma.resourceLike.count({ where: { userId } }),
  ]);
  const counts = {
    resources: target._count.resources,
    submissions: target._count.submissions,
    comments,
    likes,
  };

  try {
    await purgeUser(userId);
  } catch (err) {
    console.error("[adminPurgeUser]", err);
    return { ok: false, error: "unknown" };
  }

  await recordAudit({
    action: "user.purge",
    actorId: admin.id,
    actorName: admin.minecraftUsername ?? admin.username ?? null,
    targetType: "user",
    targetId: userId,
    targetLabel: target.minecraftUsername ?? target.username ?? userId,
    detail: { counts },
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/stats");
  revalidatePath("/admin/audit");
  revalidatePath("/resources");
  revalidatePath(`/u/${userId}`);
  return { ok: true };
}
