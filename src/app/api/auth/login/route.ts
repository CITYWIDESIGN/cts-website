import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  buildAuthorizeUrl,
  generateOAuthState,
  isMicrosoftConfigured,
} from "@/lib/auth/microsoft";

export async function GET(request: Request) {
  if (!isMicrosoftConfigured()) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "not_configured");
    return NextResponse.redirect(url);
  }

  const state = generateOAuthState();
  const redirectTo =
    new URL(request.url).searchParams.get("redirectTo") ?? "/dashboard";

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

  return NextResponse.redirect(buildAuthorizeUrl(state, redirectUri));
}
