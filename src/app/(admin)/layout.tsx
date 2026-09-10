import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ShieldCheck, Home } from "lucide-react";
import { requireAdmin } from "@/server/auth";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { LimitsLoader } from "@/components/limits-loader";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Suspense } from "react";
import { UserMenu } from "@/components/layout/user-menu";
import { Skeleton } from "@/components/ui/skeleton";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  const t = await getTranslations("admin");

  const brand = (
    // pl-3：让品牌图标的左边缘与下方导航条目图标对齐（头部 pl-3 + 这里 pl-3）
    <Link
      href="/admin"
      className="group flex min-w-0 items-center gap-2.5 pl-3"
      aria-label={t("panel")}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform duration-300 group-hover:scale-105">
        <ShieldCheck className="size-4" />
      </span>
      <span className="truncate text-sm font-semibold">{t("panel")}</span>
    </Link>
  );

  return (
    <LimitsLoader>
      <div className="flex min-h-svh flex-col lg:flex-row">
        {/* 桌面端侧边栏（可展开/收起）；"返回网站"入口由 AdminNav 自己渲染，
            这样它才能跟着收起成图标，不会在收起的窄栏里被裁掉 */}
        <AdminSidebar brand={brand}>
          <AdminNav orientation="sidebar" />
        </AdminSidebar>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* 顶部栏 */}
          <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b bg-background/80 px-4 backdrop-blur sm:px-6">
            {/* 移动端：品牌 + 横向导航 */}
            <div className="flex min-w-0 items-center gap-2 lg:hidden">
              <Link href="/admin" className="flex shrink-0 items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <ShieldCheck className="size-4" />
                </span>
              </Link>
              <AdminNav orientation="top" />
            </div>

            {/* 桌面端：回首页 */}
            <Link
              href="/"
              className="group hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground lg:inline-flex"
            >
              <Home className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5" />
              {t("backToSite")}
            </Link>

            <div className="flex shrink-0 items-center gap-1.5">
              {/* 移动端也放一个纯图标入口 */}
              <Link
                href="/"
                aria-label={t("backToSite")}
                title={t("backToSite")}
                className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground lg:hidden"
              >
                <Home className="size-[18px]" />
              </Link>
              <LanguageSwitcher />
              <ThemeToggle />
              <Suspense fallback={<Skeleton className="size-10 rounded-full" />}>
                <UserMenu />
              </Suspense>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </LimitsLoader>
  );
}
