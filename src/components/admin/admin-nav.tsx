"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import {
  LayoutDashboard,
  Users,
  FileText,
  FolderArchive,
  Flag,
  BarChart3,
  History,
  DoorOpen,
  Gauge,
  Megaphone,
  PenLine,
  Home,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_OUT, STAGGER } from "@/components/motion/transitions";
import { useSidebarCollapsed, useSidebarAnimateIn } from "./admin-sidebar";

type NavItem = {
  href: string;
  key: string;
  icon: LucideIcon;
  exact?: boolean;
};

const groups: Array<{ labelKey: string; items: NavItem[] }> = [
  {
    labelKey: "overviewGroup",
    items: [{ href: "/admin", key: "overview", icon: LayoutDashboard, exact: true }],
  },
  {
    labelKey: "manageGroup",
    items: [
      { href: "/admin/users", key: "users", icon: Users },
      { href: "/admin/questionnaires", key: "questionnaires", icon: FileText },
      { href: "/admin/resources", key: "resourcesNav", icon: FolderArchive },
      { href: "/admin/reports", key: "reportsNav", icon: Flag },
    ],
  },
  {
    // 面向访客的站点内容与入口，和「管理用户产生的东西」分开
    labelKey: "siteGroup",
    items: [
      { href: "/admin/announcements", key: "announcementsNav", icon: Megaphone },
      { href: "/admin/content", key: "contentNav", icon: PenLine },
      { href: "/admin/join", key: "joinNav", icon: DoorOpen },
      { href: "/admin/limits", key: "limitsNav", icon: Gauge },
    ],
  },
  {
    labelKey: "dataGroup",
    items: [
      { href: "/admin/stats", key: "statsNav", icon: BarChart3 },
      { href: "/admin/audit", key: "auditNav", icon: History },
    ],
  },
];

/** 每个分组第一项在整列里的序号，用于入场动画的全局错开 */
const groupOffsets = groups.map((_, gi) =>
  groups.slice(0, gi).reduce((sum, g) => sum + g.items.length, 0)
);

/**
 * 后台导航。
 *
 * 收起/展开的行为约定：
 *   - **侧边栏宽度**由 AdminSidebar 用 300ms 的 CSS transition 负责；
 *   - **文字**不做宽度折叠动画，只在收起时移除、展开时淡入。
 *
 * 为什么文字不做折叠动画：先后试过「绝对定位 + overflow-hidden 裁剪盒」和
 * 「grid 1fr → 0fr」两种技巧，都在实际页面里出现过"边框照常伸缩、文字整段
 * 消失"的问题 —— 收起态一旦被算成 0 宽度，展开时不会自动恢复。文字的
 * 可见性比那 300ms 的插值重要，所以改成条件渲染。
 *
 * 入场动画（文字逐个滑入）只在挂载时播放一次，由 SidebarAnimateIn 控制。
 */
export function AdminNav({
  orientation = "sidebar",
  collapsed: collapsedProp,
}: {
  orientation?: "sidebar" | "top";
  collapsed?: boolean;
}) {
  const t = useTranslations("admin");
  const common = useTranslations("common");
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const collapsedFromContext = useSidebarCollapsed();
  const animateIn = useSidebarAnimateIn();
  const collapsed = collapsedProp ?? collapsedFromContext;

  const flat = groups.flatMap((g) => g.items);
  const shouldAnimate = animateIn && !reduce;

  // 顶部横向导航：移动端用，不做收起逻辑
  if (orientation === "top") {
    return (
      <nav className="flex items-center gap-1 overflow-x-auto">
        {flat.map((item) => {
          const Icon = item.icon;
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {active && (
                <motion.span
                  layoutId="admin-nav-active-top"
                  aria-hidden
                  className="pointer-events-none absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <Icon className="relative z-10 size-4" />
              <span className="relative z-10">{t(item.key)}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  /** 带图标 + 可收缩文字的一行（条目与"返回网站"共用） */
  const renderRow = (
    {
      href,
      label,
      icon: Icon,
      active,
    }: {
      href: string;
      label: string;
      icon: LucideIcon;
      active: boolean;
    },
    index: number
  ) => (
    <motion.div
      key={href}
      className="relative"
      initial={shouldAnimate ? { opacity: 0, x: -8 } : false}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.4,
        ease: EASE_OUT,
        delay: shouldAnimate ? 0.04 + index * STAGGER : 0,
      }}
    >
      <Link
        href={href}
        title={collapsed ? label : undefined}
        aria-current={active ? "page" : undefined}
        className={cn(
          // h-10 是**固定行高**，不是 py-2.5。
          // 原因：展开时行内文字（text-sm → line-height 20px）比图标（16px）高，
          // 由内容撑出来的行高是 40px；收起后文字被移除，行高掉到 36px，
          // 于是整列图标每行向上跳 4px —— 就是"上下瞬移"。
          // 写死 h-10 后两种状态行高一致，垂直位置完全不动。
          "group/nav relative flex h-10 items-center rounded-lg pl-3 pr-3 text-sm font-medium",
          // 同理，图标位置必须只由「侧栏内边距 + Link 内边距」决定（都是常量），
          // 不能按收起状态切 justify，否则图标会横向跳。
          active ? "text-primary" : "text-muted-foreground hover:text-foreground"
        )}
      >
        {/* 悬浮背景 */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-lg bg-accent opacity-0 transition-opacity duration-200 group-hover/nav:opacity-100"
        />

        {/* 当前项指示块：共享 layoutId，切换页面时平滑滑动 */}
        {active && (
          <motion.span
            layoutId="admin-nav-active"
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-lg bg-primary/10 ring-1 ring-primary/20"
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
          />
        )}

        <Icon
          className={cn(
            "relative z-10 size-4 shrink-0 transition-transform duration-200 group-hover/nav:scale-110",
            active && "text-primary"
          )}
        />

        {/*
          文字：收起时**直接从布局里移除**（只留 sr-only 给读屏），展开时用
          纯 CSS 淡入。

          为什么不再做宽度折叠动画：试过「绝对定位裁剪盒」和「grid 0fr→1fr」
          两版，都出现过"边框在动、文字整段消失"的情况 —— 这类方案依赖
          overflow/transform 在 flex 行内的中间帧表现，容易在收起态被算成
          0 宽度并且再也回不来。侧边栏宽度本身已经有 300ms 过渡，文字的
          出入用淡入就足够顺，代价是切换瞬间不做插值。

          结论：能用条件渲染保证"一定显示"，就不拿可见性去换那一点动画。
        */}
        {collapsed ? (
          <span className="sr-only">{label}</span>
        ) : (
          <span className="relative z-10 ml-2.5 whitespace-nowrap duration-200 animate-in fade-in slide-in-from-left-1">
            {label}
          </span>
        )}
      </Link>
    </motion.div>
  );

  return (
    /*
      layoutRoot：当前项指示块是 layoutId 共享元素，Motion 会按**文档坐标**
      做 FLIP。后台各页高度差得不小，切到更矮的一页时浏览器会把 scrollY 往回夹，
      "切换前的位置"和"切换后的位置"就不在同一个滚动基准上了 —— 指示块会从屏幕
      外滑进来。声明 layoutRoot 后它只相对这列导航测量。
    */
    <motion.nav layoutRoot className="flex flex-col gap-5">
      {groups.map((group, gi) => (
        <div key={group.labelKey} className="flex flex-col gap-1">
          {/*
            分组标题：收起时用 invisible 而不是 sr-only / 条件渲染。
            invisible（visibility: hidden）**保留盒模型**，所以整列的垂直位置
            不会因为标题消失而往上跳；同时它也会从无障碍树里移除。
            用条件渲染或 sr-only 都会让标题所占的高度塌陷 → 下面的条目上移。
          */}
          <span
            className={cn(
              "block pb-1 pl-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70",
              collapsed ? "invisible" : "duration-200 animate-in fade-in"
            )}
          >
            {t(group.labelKey)}
          </span>

          {group.items.map((item, i) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return renderRow(
              {
                href: item.href,
                label: t(item.key),
                icon: item.icon,
                active,
              },
              groupOffsets[gi] + i
            );
          })}
        </div>
      ))}

      {/* 返回网站 */}
      <div className="border-t pt-4">
        {renderRow(
          {
            href: "/",
            label: common("back"),
            icon: Home,
            active: false,
          },
          flat.length
        )}
      </div>
    </motion.nav>
  );
}
