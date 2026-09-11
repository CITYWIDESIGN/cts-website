import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  buildAuthorizeUrl,
  generateOAuthState,
  isMicrosoftConfigured,
} from "@/lib/auth/microsoft";
import { safeRedirectPath } from "@/lib/safe-redirect";

export async function GET(request: Request) {
  if (!isMicrosoftConfigured()) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "not_configured");
    return NextResponse.redirect(url);
  }

  const state = generateOAuthState();
  // 只接受站内路径：这个值会写进 cookie，登录后再拿来跳转
  const redirectTo = safeRedirectPath(
    new URL(request.url).searchParams.get("redirectTo"),
    "/dashboard"
  );

  // 动态匹配请求地址，避免 localhost / 127.0.0.1 混用导致 cookie 域不一致
  const redirectUri = `${new URL(request.url).origin}/api/auth/callback`;

  const cookieStore = await cookies();
  cookieStore.set("oauth_redirect", redirectTo, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
    secure: process.env.NODE_ENV === "production",
  });

  /*
    state 同时写进 cookie（双提交）。callback 那边要求 URL 里的 state
    与这里的**完全一致** —— 不然就是一个无状态的签名，谁都能拿去用，
    可以被拿来做 login CSRF（把受害者的会话写成攻击者的账号）。
    详见 verifyOAuthState 的注释。
  */
  cookieStore.set("oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
    secure: process.env.NODE_ENV === "production",
  });

  return NextResponse.redirect(buildAuthorizeUrl(state, redirectUri));
}
