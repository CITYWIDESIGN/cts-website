"use server";

import { getSession } from "@/lib/session";
import { AccountError, authenticateLocal } from "@/server/account";
import { LoginSchema } from "@/lib/validators/auth";
import type { AuthState } from "./types";
import {
  clearFails,
  isThrottled,
  noteFail,
  sweep,
  throttleKey,
} from "./throttle";


/* ---------------------------------------------------------------- 登录 */

export async function loginAction(input: {
  identifier: string;
  password: string;
}): Promise<AuthState> {
  sweep();
  const key = await throttleKey("login");
  if (isThrottled(key)) return { ok: false, error: "TOO_MANY" };

  const parsed = LoginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_CREDENTIALS" };

  try {
    const { id, sessionVersion } = await authenticateLocal(
      parsed.data.identifier,
      parsed.data.password
    );
    const session = await getSession();
    session.userId = id;
    // cookie 是无状态的，版本号是服务端唯一能"作废"它的手段（改密时 +1）
    session.sessionVersion = sessionVersion;
    await session.save();
    clearFails(key);
    return { ok: true, redirectTo: "/dashboard" };
  } catch (err) {
    if (err instanceof AccountError) {
      noteFail(key);
      return { ok: false, error: err.code };
    }
    console.error("[loginAction]", err);
    return { ok: false, error: "UNKNOWN" };
  }
}

/* ---------------------------------------------------------------- 登出 */

export async function logoutAction(): Promise<AuthState> {
  const session = await getSession();
  session.destroy();
  return { ok: true, redirectTo: "/" };
}
