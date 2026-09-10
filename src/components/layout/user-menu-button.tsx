"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { EASE_OUT } from "@/components/motion/transitions";
import { SkinHead } from "@/components/skin/skin-head";
import { AvatarFrame, avatarInnerSize } from "@/components/user/avatar-frame";

/**
 * 右上角用户入口（客户端，负责悬停与"当前所在页"的高亮）。
 *
 * 高亮方式刻意做得很轻，不用文字徽标：
 * - 头像外围一圈**描边**（方形，跟随头像形状），常态就是品牌色，悬停加深
 * - 名字下方一条**下划线**，常态已可见，悬停补全宽度
 * - 头像右下角一个 6px 的**脉冲圆点**，作为"你在这里"的暗示
 *
 * 头像用方形皮肤头（双层：内层 + 帽子/头发外层），没有皮肤时回退首字母。
 */
export function UserMenuButton({
  username,
  initial,
  skinUrl,
  framed = false,
  label,
  menuLabel,
  hereLabel,
}: {
  username: string;
  initial: string;
  skinUrl: string | null;
  /** 是否佩戴头像框（绑定 Microsoft 的奖励） */
  framed?: boolean;
  label: string;
  /** 悬停提示（tooltip） */
  menuLabel: string;
  /** 已在个人中心时的无障碍标签后缀 */
  hereLabel: string;
}) {
  const reduce = useReducedMotion();
  const [hovered, setHovered] = React.useState(false);
  const active = hovered && !reduce;
  const pathname = usePathname();

  /** 已经身处个人中心（或其后代页面） */
  const isHere =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  const ringVisible = isHere || hovered;
  const ringStrong = active || (isHere && hovered);

  return (
    <Link
      href="/dashboard"
      aria-label={isHere ? `${label} · ${hereLabel}` : label}
      aria-current={isHere ? "page" : undefined}
      title={isHere ? `${label} · ${hereLabel}` : menuLabel}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      className="group relative flex items-center gap-2.5 rounded-xl p-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
    >
      <span className="relative flex shrink-0 items-center justify-center">
        {/* 描边高亮：跟随头像的方形轮廓 */}
        <motion.span
          aria-hidden
          animate={{
            opacity: ringVisible ? 1 : 0,
            scale: ringVisible ? 1 : 0.92,
          }}
          transition={{ duration: 0.24, ease: EASE_OUT }}
          className={`pointer-events-none absolute -inset-[3px] rounded-lg border-2 ${
            ringStrong ? "border-primary" : "border-primary/45"
          }`}
        />

        <motion.span
          animate={active ? { scale: 1.05, y: -1 } : { scale: 1, y: 0 }}
          transition={{ duration: 0.26, ease: EASE_OUT }}
          className="relative flex items-center justify-center"
        >
          {skinUrl ? (
            framed ? (
              <AvatarFrame size={40}>
                <SkinHead
                  skinUrl={skinUrl}
                  alt={username}
                  size={avatarInnerSize(40)}
                />
              </AvatarFrame>
            ) : (
              <SkinHead skinUrl={skinUrl} alt={username} size={40} />
            )
          ) : (
            <span className="flex size-10 items-center justify-center rounded-md bg-primary/12 text-sm font-semibold text-primary ring-1 ring-border">
              {initial}
            </span>
          )}
        </motion.span>

        {/* "你在这里"的暗示：一个极小的脉冲圆点 */}
        {isHere && (
          <span
            aria-hidden
            className="absolute -bottom-0.5 -right-0.5 flex size-2.5 items-center justify-center"
          >
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-primary ring-2 ring-background" />
          </span>
        )}
      </span>

      {/* 名字 + 下划线（常态已可见，悬停补全） */}
      <span className="hidden flex-col sm:flex">
        <span
          className={`max-w-[120px] truncate text-sm leading-tight ${
            isHere ? "font-semibold" : "font-medium"
          }`}
        >
          {username}
        </span>
        <span className="relative mt-0.5 h-px w-full overflow-hidden">
          <motion.span
            aria-hidden
            animate={{
              scaleX: hovered ? 1 : isHere ? 0.5 : 0,
              opacity: hovered || isHere ? 1 : 0,
            }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
            className="absolute inset-0 block origin-left rounded-full bg-primary"
          />
        </span>
      </span>
    </Link>
  );
}
