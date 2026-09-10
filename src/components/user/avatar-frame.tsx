"use client";

import { cn } from "@/lib/utils";

/** 环宽：小尺寸下 2px，大尺寸下按比例 */
function ringWidth(size: number): number {
  return Math.max(2, Math.round(size * 0.075));
}

/** 头像与环之间留的底色宽度 */
function gapWidth(size: number): number {
  return Math.max(1, Math.round(size * 0.04));
}

/**
 * 佩戴头像框时，内部头像本体应有的边长。
 * 调用方拿它去渲染 `<SkinHead size={...}>`，保证头像正好填满框内。
 */
export function avatarInnerSize(size: number): number {
  return size - (ringWidth(size) + gapWidth(size)) * 2;
}

/**
 * 头像框 —— **绑定 Microsoft 的奖励**。
 *
 * 设计思路：
 *   头像是 8×8 的像素方块（Minecraft 皮肤），在 26–40px 这种尺寸下
 *   任何细碎的装饰都会糊成一团。所以只保留两个元素：
 *
 *   1. **渐变描边环**：绿 → 青 → 琥珀（复用图表色 chart-1/2/3，
 *      和站点的单色体系同源，不会像贴上去的）。环宽随尺寸等比缩放。
 *   2. **右下角菱形徽记**：一个小菱形，深底 + 主色描边 + 内点，
 *      是"这是加分项"的视觉锚点，也是和普通头像最直观的区别。
 *
 *   外加一层很淡的外发光，让头像在列表里"浮"起来一点。
 *   全部 CSS 实现，不依赖图片，任意尺寸不失真。
 */
export function AvatarFrame({
  size,
  children,
  className,
}: {
  /** 头像边长（px），与内部 SkinHead 的 size 一致 */
  size: number;
  children: React.ReactNode;
  className?: string;
}) {
  // 环宽：小尺寸下 2px，大尺寸下按比例
  const ring = ringWidth(size);
  // 头像与环之间留一点底，避免贴死
  const gap = gapWidth(size);
  // 徽记大小
  const badge = Math.max(7, Math.round(size * 0.28));
  const radius = Math.max(5, Math.round(size * 0.2));

  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {/* 很淡的外发光 */}
      <span
        aria-hidden
        className="absolute -inset-px rounded-[8px] opacity-45 blur-[3px] bg-gradient-to-br from-chart-1 via-chart-2 to-chart-3"
      />

      {/* 渐变环 */}
      <span
        aria-hidden
        className="absolute inset-0 bg-gradient-to-br from-chart-1 via-chart-2 to-chart-3"
        style={{ borderRadius: radius }}
      />

      {/* 环与头像之间的底色 */}
      <span
        aria-hidden
        className="absolute bg-background"
        style={{ inset: ring, borderRadius: radius - 2 }}
      />

      {/* 头像本体 */}
      <span
        className="absolute block overflow-hidden"
        style={{
          inset: ring + gap,
          borderRadius: Math.max(3, radius - 4),
        }}
      >
        {children}
      </span>

      {/* 右下角菱形徽记 */}
      <span
        aria-hidden
        className="absolute flex items-center justify-center"
        style={{
          right: -badge * 0.18,
          bottom: -badge * 0.18,
          width: badge,
          height: badge,
        }}
      >
        <span
          className="block rotate-45 rounded-[2px] bg-gradient-to-br from-chart-1 to-chart-2 ring-2 ring-background"
          style={{ width: badge * 0.62, height: badge * 0.62 }}
        />
      </span>
    </span>
  );
}
