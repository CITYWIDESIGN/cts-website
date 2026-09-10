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

export function proxy(request: NextRequest) {
  const locale = detectLocale(request);

  if (!request.cookies.get(localeCookieName)) {
    const response = NextResponse.next();
    response.cookies.set(localeCookieName, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
