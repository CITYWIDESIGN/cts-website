import "server-only";

import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { sessionSecret } from "./session-secret";

export interface SessionData {
  userId?: string;
  /**
   * 签发这份 cookie 时用户的 `sessionVersion`。
   *
   * cookie 是无状态的，服务端没法主动作废它 —— 改密码之后把 User 上的
   * `sessionVersion` +1，这里存的值就对不上了，`getCurrentUser` 会当作未登录。
   * 老版本签发的 cookie 没有这个字段（undefined），一律视为失效，
   * 也就是说**这次改动会让所有人重新登录一次**。
   */
  sessionVersion?: number;
}

/**
 * cookie 名与属性。
 *
 * 注意这里**没有 password** —— 密钥通过 `sessionSecret()` 在每次请求时取，
 * 好处是生产环境缺密钥会在请求时报错，而不是让 `next build` 直接失败
 * （构建本来不需要运行时密钥）。详见 @/lib/session-secret。
 */
const baseOptions: Omit<SessionOptions, "password"> = {
  cookieName: "mc_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, {
    ...baseOptions,
    password: sessionSecret(),
  });
}
