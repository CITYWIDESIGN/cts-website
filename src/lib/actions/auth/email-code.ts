"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireUser } from "@/server/auth";
import { AccountError, changeEmail, findUserByEmail } from "@/server/account";
import {
  EmailCodeError,
  issueEmailCode,
  verifyEmailCode,
  type CodePurpose,
} from "@/server/email-code";
import { CodeSchema, EmailSchema } from "@/lib/validators/auth";
import type { AuthState } from "./types";
import { requestIp } from "./throttle";


/* ------------------------------------------------------- 邮箱验证码 */

/**
 * 发送验证码。
 *   - purpose="bind"：注册后验证邮箱 / 个人中心换绑新邮箱
 *   - purpose="reset"：忘记密码
 *
 * 注意 bind 的两种场景目标邮箱不同：注册后验的是**当前账号的邮箱**，
 * 换绑验的是**新邮箱**。所以这里显式接收 email，只做格式校验，
 * 归属由后面的 verifyEmailCode + changeEmail 保证。
 */
export async function sendEmailCodeAction(input: {
  email: string;
  purpose: CodePurpose;
}): Promise<AuthState> {
  const parsedEmail = EmailSchema.safeParse(input.email);
  if (!parsedEmail.success) return { ok: false, error: "EMAIL_INVALID" };
  if (!["register", "bind", "reset"].includes(input.purpose)) {
    return { ok: false, error: "UNKNOWN" };
  }

  const email = parsedEmail.data;
  const user = await getCurrentUser();

  // register：未登录也能发，但**邮箱必须还没被占用**
  if (input.purpose === "register") {
    const taken = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (taken) return { ok: false, error: "EMAIL_TAKEN" };

    try {
      const res = await issueEmailCode({
        email,
        purpose: "register",
        ip: await requestIp(),
      });
      return { ok: true, codeSent: true, devCode: res.devCode };
    } catch (err) {
      if (err instanceof EmailCodeError) return { ok: false, error: err.code };
      console.error("[sendEmailCodeAction:register]", err);
      return { ok: false, error: "UNKNOWN" };
    }
  }

  // reset：无论邮箱是否存在都回 ok，避免被用来枚举账号
  if (input.purpose === "reset") {
    const target = await findUserByEmail(email);
    if (!target) return { ok: true, codeSent: true };

    try {
      const res = await issueEmailCode({
        email,
        purpose: "reset",
        userId: target.id,
        ip: await requestIp(),
      });
      return { ok: true, codeSent: true, devCode: res.devCode };
    } catch (err) {
      if (err instanceof EmailCodeError) return { ok: false, error: err.code };
      console.error("[sendEmailCodeAction:reset]", err);
      return { ok: false, error: "UNKNOWN" };
    }
  }

  // bind：必须登录
  if (!user) return { ok: false, error: "UNAUTHORIZED" };
  // 验证自己的当前邮箱时直接放行；换绑则校验新邮箱没被别人占用
  if (email !== (user.email ?? "").toLowerCase()) {
    const taken = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (taken && taken.id !== user.id) {
      return { ok: false, error: "EMAIL_TAKEN" };
    }
  }

  try {
    const res = await issueEmailCode({
      email,
      purpose: "bind",
      userId: user.id,
      ip: await requestIp(),
    });
    return { ok: true, codeSent: true, devCode: res.devCode };
  } catch (err) {
    if (err instanceof EmailCodeError) return { ok: false, error: err.code };
    console.error("[sendEmailCodeAction:bind]", err);
    return { ok: false, error: "UNKNOWN" };
  }
}

/* ------------------------------------------------------------ 换绑邮箱 */

/**
 * 换绑第一步：给**新旧两个邮箱各发一个验证码**。
 *
 * 为什么旧的也要验：邮箱是找回密码的唯一凭据。会话被别人拿到（XSS、
 * 共用电脑没退出）时，只验新邮箱就够把找回渠道改到攻击者手里，
 * 原主人再也拿不回账号。要求同时证明「我控制当前邮箱」，
 * 这条路径就被堵死了。
 *
 * 账号本来就没有邮箱（纯 Microsoft 登录）时不发旧邮箱的码 ——
 * 没有旧的可验，只需要验新的。
 */
export async function startEmailChangeAction(input: {
  newEmail: string;
}): Promise<AuthState> {
  const user = await requireUser();

  const parsedEmail = EmailSchema.safeParse(input.newEmail);
  if (!parsedEmail.success) return { ok: false, error: "EMAIL_INVALID" };
  const email = parsedEmail.data;

  const current = (user.email ?? "").toLowerCase();
  if (email === current) return { ok: false, error: "EMAIL_SAME" };

  const taken = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (taken && taken.id !== user.id) return { ok: false, error: "EMAIL_TAKEN" };

  const ip = await requestIp();
  try {
    const toNew = await issueEmailCode({
      email,
      purpose: "bind",
      userId: user.id,
      ip,
    });
    // 有当前邮箱就必须也验一次
    let oldDevCode: string | undefined;
    if (current) {
      const toOld = await issueEmailCode({
        email: current,
        purpose: "bind",
        userId: user.id,
        ip,
      });
      oldDevCode = toOld.devCode;
    }
    return {
      ok: true,
      codeSent: true,
      needsOldCode: Boolean(current),
      devCode: toNew.devCode,
      oldDevCode,
    };
  } catch (err) {
    if (err instanceof EmailCodeError) return { ok: false, error: err.code };
    console.error("[startEmailChangeAction]", err);
    return { ok: false, error: "UNKNOWN" };
  }
}

/**
 * 换绑第二步：**两个验证码都通过**才真的改。
 *
 * 顺序有意为之：先验旧邮箱。旧邮箱都控制不了，就没必要浪费新邮箱的
 * 尝试次数（验证码有 5 次上限，验错会消耗额度）。
 */
export async function confirmEmailChangeAction(input: {
  newEmail: string;
  oldCode: string;
  newCode: string;
}): Promise<AuthState> {
  const user = await requireUser();

  const parsedEmail = EmailSchema.safeParse(input.newEmail);
  if (!parsedEmail.success) return { ok: false, error: "EMAIL_INVALID" };
  const email = parsedEmail.data;
  const current = (user.email ?? "").toLowerCase();

  const parsedNew = CodeSchema.safeParse(input.newCode);
  if (!parsedNew.success) return { ok: false, error: "CODE_INVALID_CODE" };

  // 1. 旧邮箱（有的话）
  if (current) {
    const parsedOld = CodeSchema.safeParse(input.oldCode);
    if (!parsedOld.success) return { ok: false, error: "CODE_INVALID_CODE" };
    try {
      await verifyEmailCode({
        email: current,
        purpose: "bind",
        code: parsedOld.data,
      });
    } catch (err) {
      if (err instanceof EmailCodeError) {
        return { ok: false, error: `CODE_${err.code}`, step: "old" };
      }
      console.error("[confirmEmailChangeAction:old]", err);
      return { ok: false, error: "UNKNOWN" };
    }
  }

  // 2. 新邮箱
  try {
    const verified = await verifyEmailCode({
      email,
      purpose: "bind",
      code: parsedNew.data,
    });
    // 码必须属于当前登录的人，否则 A 能拿 B 的邮箱验证码
    if (verified.userId && verified.userId !== user.id) {
      return { ok: false, error: "CODE_NOT_FOUND", step: "new" };
    }
    await changeEmail(user.id, email);
  } catch (err) {
    if (err instanceof EmailCodeError) {
      return { ok: false, error: `CODE_${err.code}`, step: "new" };
    }
    if (err instanceof AccountError) return { ok: false, error: err.code };
    console.error("[confirmEmailChangeAction:new]", err);
    return { ok: false, error: "UNKNOWN" };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath(`/u/${user.id}`);
  return { ok: true };
}
