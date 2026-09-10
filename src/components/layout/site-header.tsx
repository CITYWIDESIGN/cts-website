import * as React from "react";
import { Suspense } from "react";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";
import { MobileNav } from "./mobile-nav";
import { UserMenu } from "./user-menu";
import { NotificationMenu } from "./notification-menu";
import { ThemeToggle } from "./theme-toggle";
import { LanguageSwitcher } from "./language-switcher";
import { Skeleton } from "@/components/ui/skeleton";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur transition-colors">
      <div className="relative mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        {/* 左：移动端菜单 + Logo */}
        <div className="flex flex-1 items-center gap-2">
          <MobileNav />
          <Logo />
        </div>

        {/* 中：导航绝对居中，不受两侧宽度影响 */}
        <div className="absolute left-1/2 hidden -translate-x-1/2 md:block">
          <NavLinks />
        </div>

        {/* 右：消息 / 语言 / 主题 / 用户 */}
        <div className="flex flex-1 items-center justify-end gap-1.5">
          {/* 消息铃铛（未登录时不渲染）。
              弹窗不跟着铃铛对齐，而是贴到 header 右边缘 —— 见 notification-bell.tsx */}
          <Suspense fallback={<Skeleton className="size-9 rounded-md" />}>
            <NotificationMenu />
          </Suspense>
          <LanguageSwitcher />
          <ThemeToggle />
          <Suspense fallback={<Skeleton className="size-9 rounded-full" />}>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
