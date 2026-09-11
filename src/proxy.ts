import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { defaultLocale, localeCookieName, locales, type Locale } from "@/i18n/routing";

function detectLocale(request: NextRequest): Locale {
  const cookie = request.cookies.get(localeCookieName)?.value;
  if (cookie && locales.includes(cookie as Locale)) {
    return cookie as Locale;
  }

  const acceptLanguage = request.headers.get("accept-language");
  if (acceptLanguage) {
    const preferred = acceptLanguage.split(",")[0].trim().toLowerCase();
    if (preferred.startsWith("zh")) return "zh";
    if (preferred.startsWith("en")) return "en";
  }

  return defaultLocale;
}

/**
 * 语言探测（middleware / Next 16 的 proxy）。
 *
 * ⚠️ **只在检测到的语言和默认语言不同时才写 cookie。**
 *
 * 原来是无条件写：任何访客访问任何页面，响应里都会带一条
 * `Set-Cookie: NEXT_LOCALE=zh`。后果不只是"多一个没用的 cookie"：
 * **带 Set-Cookie 的响应没法被 CDN/边缘缓存**，而本站的全部响应都因此
 * 变成不可缓存（实测 `cf-cache-status: DYNAMIC`，首页每次都要回源）。
 *
 * 为什么"写"和"不写"是这样分工的：
 *   - `src/i18n/request.ts` 只读 cookie、不看 Accept-Language
 *   - 所以默认语言的访客**不需要 cookie 也有正确的语言**（回退到 defaultLocale）
 *   - 非默认语言的访客需要一个 cookie 来"记住"选择，否则每次都会掉回中文
 *
 * 这同时保证了缓存是安全的：边缘上只可能缓存到默认语言那一份，
 * 非默认语言的访客带 cookie 会被缓存规则排除掉。
 * （如果让响应按 Accept-Language 变化，同一 URL 就会有两种语言的内容，
 * 而边缘缓存默认不区分 Accept-Language —— 那才会真的串语言。）
 */
export function proxy(request: NextRequest) {
  const locale = detectLocale(request);

  // 已经是显式选过的语言，或者就是默认语言 → 什么都不用做
  if (request.cookies.get(localeCookieName) || locale === defaultLocale) {
    return NextResponse.next();
  }

  // 只有"需要记住的非默认语言"才写
  const response = NextResponse.next();
  response.cookies.set(localeCookieName, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
