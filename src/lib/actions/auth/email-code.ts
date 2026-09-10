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

/** 用验证码验证并绑定新邮箱（注册后验证 / 换绑都走这里） */
export async function verifyEmailAction(input: {
  email: string;
  code: string;
}): Promise<AuthState> {
  const user = await requireUser();

  const parsedEmail = EmailSchema.safeParse(input.email);
  const parsedCode = CodeSchema.safeParse(input.code);
  if (!parsedEmail.success) return { ok: false, error: "EMAIL_INVALID" };
  if (!parsedCode.success) return { ok: false, error: "CODE_INVALID_CODE" };

  try {
    const verified = await verifyEmailCode({
      email: parsedEmail.data,
      purpose: "bind",
      code: parsedCode.data,
    });
    // 验证码必须属于当前登录的人，否则 A 可以用 B 的邮箱验证码
    if (verified.userId && verified.userId !== user.id) {
      return { ok: false, error: "CODE_NOT_FOUND" };
    }
    await changeEmail(user.id, parsedEmail.data);
  } catch (err) {
    if (err instanceof EmailCodeError) return { ok: false, error: `CODE_${err.code}` };
    if (err instanceof AccountError) return { ok: false, error: err.code };
    console.error("[verifyEmailAction]", err);
    return { ok: false, error: "UNKNOWN" };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath(`/u/${user.id}`);
  return { ok: true };
}
