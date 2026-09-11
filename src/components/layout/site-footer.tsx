import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "./logo";
import { siteConfig } from "@/config/site";
import { siteYear } from "@/lib/format";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  const nav = await getTranslations("nav");

  // 用站点时区，不用本地时区：容器跑 UTC 时元旦当天会显示成去年
  const year = siteYear();

  return (
    <footer className="relative border-t bg-muted/40">
      {/* 顶部一道渐隐的品牌色细线：比纯 border 更有质感，也不喧宾夺主 */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent"
      />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">
            {t("tagline")}
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold">{t("navigation")}</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/" className="transition-colors hover:text-foreground">
                {nav("home")}
              </Link>
            </li>
            <li>
              <Link
                href="/server"
                className="transition-colors hover:text-foreground"
              >
                {nav("server")}
              </Link>
            </li>
            <li>
              <Link
                href="/rules"
                className="transition-colors hover:text-foreground"
              >
                {nav("rules")}
              </Link>
            </li>
            <li>
              <Link
                href="/resources"
                className="transition-colors hover:text-foreground"
              >
                {nav("resources")}
              </Link>
            </li>
            <li>
              <Link
                href="/community"
                className="transition-colors hover:text-foreground"
              >
                {nav("community")}
              </Link>
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold">{t("community")}</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              {/* 站内社区页（含 QQ 群二维码 / OOPZ / Discord 入口） */}
              <Link
                href="/community"
                className="transition-colors hover:text-foreground"
              >
                {nav("community")}
              </Link>
            </li>
            <li>
              <a
                href={siteConfig.links.discord}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-foreground"
              >
                Discord
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <p>
            © {year} {siteConfig.name}. {t("copyright")}
          </p>
          <p>{t("madeWith")}</p>
        </div>
      </div>
    </footer>
  );
}
