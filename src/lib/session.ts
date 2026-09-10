import "server-only";

import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { sessionSecret } from "./session-secret";

export interface SessionData {
  userId?: string;
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
