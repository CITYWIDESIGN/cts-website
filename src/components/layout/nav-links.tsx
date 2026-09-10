"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_OUT, STAGGER } from "@/components/motion/transitions";

const routes = [
  { href: "/", key: "home", exact: true },
  { href: "/server", key: "server", exact: false },
  { href: "/rules", key: "rules", exact: false },
  // 资源在社区左边
  { href: "/resources", key: "resources", exact: false },
  { href: "/community", key: "community", exact: false },
] as const;

type NavLink = {
  href: string;
  label: string;
  exact?: boolean;
  external?: boolean;
};

/**
 * 顶部导航。
 *
 * 动画：
 * - 每个标签依次错开入场（含轻微模糊）
 * - 当前页用一个共享 layoutId 的指示条在标签之间平滑滑动
 * - 悬浮时背景渐显 + 轻微上浮，外链图标位移
 * - 切换页面时指示条自动从旧标签滑到新标签
 */
export function NavLinks({
  orientation = "horizontal",
  onNavigate,
  className,
}: {
  orientation?: "horizontal" | "vertical";
  onNavigate?: () => void;
  className?: string;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const reduce = useReducedMotion();

  // 导航项全部为站内链接：社区也走站内页面（含 QQ 群 / OOPZ / Discord 入口），
  // 不再直接外跳 Discord。
  const links: NavLink[] = routes.map((r) => ({
    href: r.href,
    label: t(r.key),
    exact: r.exact,
  }));

  return (
    <nav
      className={cn(
        orientation === "horizontal"
          ? "flex items-center gap-0.5"
          : "flex flex-col gap-1",
        className
      )}
    >
      {links.map((link, i) => {
        const isActive = link.external
          ? false
          : link.exact
            ? pathname === link.href
            : pathname.startsWith(link.href);

        const inner = (
          <>
            <span className="relative z-10">{link.label}</span>
            {link.external && (
              <ExternalLink className="relative z-10 size-3 opacity-60 transition-transform duration-300 group-hover/nav:translate-x-0.5 group-hover/nav:-translate-y-0.5" />
            )}
          </>
        );

        const classes = cn(
          "group/nav relative flex items-center gap-1.5 rounded-lg text-sm font-medium transition-colors duration-200",
          orientation === "horizontal" ? "px-3 py-2" : "px-3 py-2.5",
          isActive
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground"
        );

        // 悬浮背景（独立一层，避免和指示条打架）
        const hoverLayer = (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-lg bg-accent opacity-0 transition-opacity duration-200 group-hover/nav:opacity-100"
          />
        );

        const activeLayer = isActive && (
          <>
            {orientation === "horizontal" ? (
              <motion.span
                layoutId="nav-active-underline"
                aria-hidden
                className="pointer-events-none absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            ) : (
              <motion.span
                layoutId="mobile-nav-active"
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-lg bg-primary/10"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            {orientation === "vertical" && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary"
              />
            )}
          </>
        );

        const content = (
          <>
            {hoverLayer}
            {activeLayer}
            {inner}
          </>
        );

        const motionProps = reduce
          ? {}
          : {
              initial: { opacity: 0, y: -6, filter: "blur(4px)" },
              animate: { opacity: 1, y: 0, filter: "blur(0px)" },
              transition: {
                duration: 0.4,
                ease: EASE_OUT,
                delay: orientation === "horizontal" ? i * STAGGER : i * 0.05,
              },
            };

        if (link.external) {
          return (
            <motion.a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className={classes}
              onClick={onNavigate}
              {...motionProps}
            >
              {content}
            </motion.a>
          );
        }

        return (
          <motion.div key={link.href} className="relative" {...motionProps}>
            <Link href={link.href} className={classes} onClick={onNavigate}>
              {content}
            </Link>
          </motion.div>
        );
      })}
    </nav>
  );
}
