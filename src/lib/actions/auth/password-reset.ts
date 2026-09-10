"use server";

import {
  EmailCodeError,
  verifyEmailCode,
} from "@/server/email-code";
import { findUserByEmail, setPassword } from "@/server/account";
import { PasswordResetSchema } from "@/lib/validators/auth";
import type { AuthState } from "./types";
import { clearFails, isThrottled, noteFail, throttleKey } from "./throttle";


/* ---------------------------------------------------------- 忘记密码 */

/** 第二步：带验证码设置新密码。不需要登录。 */
export async function resetPasswordAction(input: {
  email: string;
  code: string;
  password: string;
}): Promise<AuthState> {
  const key = await throttleKey("reset");
  if (isThrottled(key)) return { ok: false, error: "TOO_MANY" };

  const parsed = PasswordResetSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path?.[0];
    if (field === "email") return { ok: false, error: "EMAIL_INVALID" };
    if (field === "code") return { ok: false, error: "CODE_INVALID_CODE" };
    return { ok: false, error: `PASSWORD_${issue?.message ?? "INVALID"}` };
  }

  const target = await findUserByEmail(parsed.data.email);
  if (!target) {
    noteFail(key);
    return { ok: false, error: "CODE_NOT_FOUND" };
  }

  try {
    const verified = await verifyEmailCode({
      email: parsed.data.email,
      purpose: "reset",
      code: parsed.data.code,
    });
    if (!verified.userId || verified.userId !== target.id) {
      noteFail(key);
      return { ok: false, error: "CODE_NOT_FOUND" };
    }
    await setPassword(target.id, parsed.data.password);
  } catch (err) {
    if (err instanceof EmailCodeError) {
      noteFail(key);
      return { ok: false, error: `CODE_${err.code}` };
    }
    console.error("[resetPasswordAction]", err);
    return { ok: false, error: "UNKNOWN" };
  }

  clearFails(key);
  return { ok: true, redirectTo: "/login" };
}
