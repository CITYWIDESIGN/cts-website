"use server";

import { cookies } from "next/headers";
import { hasLocale } from "next-intl";
import { localeCookieName, locales } from "@/i18n/routing";

export async function setLocale(locale: string) {
  if (!hasLocale(locales, locale)) {
    return { ok: false };
  }

  const cookieStore = await cookies();
  cookieStore.set(localeCookieName, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  return { ok: true, locale };
}
