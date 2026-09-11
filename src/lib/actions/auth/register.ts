"use server";

import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  AccountError,
  registerLocalAccount,
} from "@/server/account";
import {
  EmailCodeError,
  issueEmailCode,
  verifyEmailCode,
} from "@/server/email-code";
import { CodeSchema, RegisterSchema } from "@/lib/validators/auth";
import type { AuthState } from "./types";
import {
  clearFails,
  isThrottled,
  noteFail,
  requestIp,
  sweep,
  throttleKey,
} from "./throttle";


/* ---------------------------------------------------------------- 注册 */

/**
 * 注册第一步：**只校验 + 发验证码，不建账号**。
 *
 * 账号在第二步（验证码通过）才创建。这样有两个好处：
 *   - 邮箱没验证就**不可能**有账号 —— 满足"注册必须绑定邮箱"
 *   - 别人拿你的邮箱也没法抢注：未验证的邮箱不占唯一索引，
 *     你自己随时还能用同一个邮箱注册
 *
 * 用户名 / 邮箱的占用情况在这里先查一次给即时反馈，
 * 第二步建号前会再查一次（防并发抢注）。
 */
export async function registerAction(input: {
  username: string;
  email: string;
  password: string;
  confirm: string;
}): Promise<AuthState> {
  sweep();
  const key = await throttleKey("register");
  if (isThrottled(key)) return { ok: false, error: "TOO_MANY" };

  if (input.password !== input.confirm) {
    return { ok: false, error: "PASSWORD_MISMATCH" };
  }

  const parsed = RegisterSchema.safeParse({
    username: input.username,
    email: input.email,
    password: input.password,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path?.[0];
    const code = issue?.message;
    // 把「哪个字段 + 什么错」拼成错误码，前端据此挑文案
    if (field === "email") return { ok: false, error: "EMAIL_INVALID" };
    if (field === "password") {
      return { ok: false, error: `PASSWORD_${code ?? "INVALID"}` };
    }
    return { ok: false, error: `USERNAME_${code ?? "INVALID"}` };
  }

  // 先查占用，给"用户名/邮箱已被使用"这种能看懂的即时反馈
  const [byName, byEmail] = await Promise.all([
    prisma.user.findUnique({
      where: { username: parsed.data.username },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    }),
  ]);
  if (byName) return { ok: false, error: "USERNAME_TAKEN" };
  if (byEmail) return { ok: false, error: "EMAIL_TAKEN" };

  try {
    const res = await issueEmailCode({
      email: parsed.data.email,
      purpose: "register",
      ip: await requestIp(),
    });
    return { ok: true, needsCode: true, codeSent: true, devCode: res.devCode };
  } catch (err) {
    if (err instanceof EmailCodeError) return { ok: false, error: err.code };
    console.error("[registerAction]", err);
    return { ok: false, error: "UNKNOWN" };
  }
}

/**
 * 注册第二步：**验证码通过才建账号**，建完直接登录。
 *
 * 密码在两步之间放在客户端内存里（同一次填写，没有再存一份到服务端），
 * 所以这里要重新完整校验一遍 —— 客户端传回来的东西一律不可信。
 */
export async function completeRegistrationAction(input: {
  username: string;
  email: string;
  password: string;
  code: string;
}): Promise<AuthState> {
  const key = await throttleKey("register");
  if (isThrottled(key)) return { ok: false, error: "TOO_MANY" };

  const parsed = RegisterSchema.safeParse({
    username: input.username,
    email: input.email,
    password: input.password,
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path?.[0];
    if (field === "email") return { ok: false, error: "EMAIL_INVALID" };
    return { ok: false, error: "UNKNOWN" };
  }

  const code = CodeSchema.safeParse(input.code);
  if (!code.success) return { ok: false, error: "CODE_INVALID_CODE" };

  // 1. 验证码必须对（这一步没过就绝对不会建号）
  try {
    await verifyEmailCode({
      email: parsed.data.email,
      purpose: "register",
      code: code.data,
    });
  } catch (err) {
    if (err instanceof EmailCodeError) {
      noteFail(key);
      return { ok: false, error: `CODE_${err.code}` };
    }
    console.error("[completeRegistrationAction:verify]", err);
    return { ok: false, error: "UNKNOWN" };
  }

  // 2. 再查一次占用（第一步到现在可能被别人抢先）
  try {
    const { id, sessionVersion } = await registerLocalAccount(parsed.data);
    const session = await getSession();
    session.userId = id;
    session.sessionVersion = sessionVersion;
    await session.save();
    clearFails(key);
    return { ok: true, redirectTo: "/dashboard/settings" };
  } catch (err) {
    if (err instanceof AccountError) return { ok: false, error: err.code };
    console.error("[completeRegistrationAction]", err);
    return { ok: false, error: "UNKNOWN" };
  }
}
