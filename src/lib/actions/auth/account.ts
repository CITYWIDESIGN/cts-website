"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireUser } from "@/server/auth";
import {
  AccountError,
  changeUsername,
  setMinecraftIdentity,
  setWearFrame,
  unbindMicrosoft,
} from "@/server/account";
import { addDailyCount, checkDailyLimit } from "@/server/limit";
import { anonymizeAccount, isLastAdmin } from "@/server/user-deletion";
import { recordAudit } from "@/server/audit";
import { verifyPassword } from "@/server/password";
import { ChangeUsernameSchema, MinecraftIdentitySchema } from "@/lib/validators/auth";
import type { AuthState } from "./types";


/**
 * 个人中心相关的 action：改用户名 / 填游戏身份 / 头像框 / 注销账号。
 */

/* ------------------------------------------------------------ 改用户名 */

/** 改用户名。非管理员每天只能改一次。 */
export async function changeUsernameAction(input: {
  username: string;
}): Promise<AuthState> {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  const parsed = ChangeUsernameSchema.safeParse(input);
  if (!parsed.success) {
    const code = parsed.error.issues[0]?.message;
    return { ok: false, error: `USERNAME_${code ?? "INVALID"}` };
  }

  // 没变就直接成功，不消耗当天额度
  if (parsed.data.username === user.username) return { ok: true };

  const limit = await checkDailyLimit(user.id, "username", isAdmin);
  if (!limit.allowed) {
    return { ok: false, error: "USERNAME_COOLDOWN", limit: limit.limit };
  }

  try {
    await changeUsername(user.id, parsed.data.username);
    await addDailyCount(user.id, "username", isAdmin);
  } catch (err) {
    if (err instanceof AccountError) return { ok: false, error: err.code };
    console.error("[changeUsernameAction]", err);
    return { ok: false, error: "UNKNOWN" };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  revalidatePath(`/u/${user.id}`);
  return { ok: true };
}

/* -------------------------------------------------- 个人中心：资料修改 */

export async function saveMinecraftIdentityAction(input: {
  minecraftUsername: string;
  minecraftUuid: string;
}): Promise<AuthState> {
  const user = await requireUser();

  const parsed = MinecraftIdentitySchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path?.[0];
    const code = issue?.message;
    return {
      ok: false,
      error: `${field === "minecraftUuid" ? "UUID" : "NAME"}_${code ?? "INVALID"}`,
    };
  }

  try {
    await setMinecraftIdentity(user.id, parsed.data);
  } catch (err) {
    if (err instanceof AccountError) return { ok: false, error: err.code };
    console.error("[saveMinecraftIdentityAction]", err);
    return { ok: false, error: "UNKNOWN" };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  revalidatePath(`/u/${user.id}`);
  revalidatePath("/resources");
  return { ok: true };
}

export async function setWearFrameAction(wear: boolean): Promise<AuthState> {
  const user = await requireUser();

  try {
    await setWearFrame(user.id, wear);
  } catch (err) {
    console.error("[setWearFrameAction]", err);
    return { ok: false, error: "UNKNOWN" };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  revalidatePath(`/u/${user.id}`);
  return { ok: true };
}

export async function unbindMicrosoftAction(): Promise<AuthState> {
  const user = await requireUser();

  try {
    await unbindMicrosoft(user.id);
  } catch (err) {
    console.error("[unbindMicrosoftAction]", err);
    return { ok: false, error: "UNKNOWN" };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath(`/u/${user.id}`);
  return { ok: true };
}

/* ------------------------------------------------------------ 注销账号 */

/**
 * 用户自己注销账号。
 *
 * 二次确认要求**输入账号名 + 当前密码**（有密码的话）—— 这是不可逆操作，
 * 点错一次就回不来了，值得多打几个字。
 *
 * 注销后：身份信息全部抹除、永久无法登录，但**发过的资源与评论保留**，
 * 作者显示为「已注销用户」。问卷提交（含个人信息）会删掉。
 */
export async function deleteOwnAccountAction(input: {
  confirmName: string;
  password: string;
}): Promise<AuthState> {
  const user = await requireUser();

  // 最后一个管理员不能注销，否则后台彻底进不去
  if (await isLastAdmin(user.id)) {
    return { ok: false, error: "LAST_ADMIN" };
  }

  // 有密码就必须验密码；纯 Microsoft 账号没有密码，只靠名字确认
  if (user.username) {
    if (input.confirmName.trim().toLowerCase() !== user.username.toLowerCase()) {
      return { ok: false, error: "CONFIRM_MISMATCH" };
    }
  } else if (!input.confirmName.trim()) {
    return { ok: false, error: "CONFIRM_MISMATCH" };
  }

  // CurrentUser 不带 hash（没必要到处传），单独取一次
  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (record?.passwordHash) {
    const ok = await verifyPassword(input.password, record.passwordHash);
    if (!ok) return { ok: false, error: "INVALID_CREDENTIALS" };
  }
  try {
    await anonymizeAccount(user.id);
  } catch (err) {
    console.error("[deleteOwnAccountAction]", err);
    return { ok: false, error: "UNKNOWN" };
  }

  await recordAudit({
    action: "user.anonymize",
    actorId: user.id,
    actorName: user.minecraftUsername ?? user.username ?? null,
    targetType: "user",
    targetId: user.id,
    targetLabel: user.minecraftUsername ?? user.username ?? user.id,
    detail: { self: true },
  });

  // 注销完会话也一起销毁
  const session = await getSession();
  session.destroy();
  return { ok: true, redirectTo: "/" };
}
