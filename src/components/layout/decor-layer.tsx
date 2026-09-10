"use client";

import * as React from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";

/**
 * 全站装饰层（参考鹰角网络的设计语汇：细网格、42° 斜纹、同心圆环、
 * 角标准星、单色技术标注、等距斜线）。
 *
 * 两类运动：
 * 1. 静态装饰动画 —— 斜纹无缝平铺流动、圆环同/反向自转、细线阵列横移、呼吸
 * 2. 滚动视差 —— 各层以不同速度随滚动位移，图层之间产生纵深
 *
 * 对比度比上一版更明确（8%–22%），但仍低于文字层级，不抢内容。
 * 全部 aria-hidden + pointer-events-none，reduced-motion 下停止运动。
 */
export function DecorLayer() {
  const reduce = useReducedMotion();

  const { scrollY } = useScroll();
  const farY = useTransform(scrollY, [0, 2400], [0, -160]);
  const midY = useTransform(scrollY, [0, 2400], [0, -380]);
  const nearY = useTransform(scrollY, [0, 2400], [0, -660]);
  const slowFar = useSpring(farY, { stiffness: 40, damping: 20 });
  const slowMid = useSpring(midY, { stiffness: 40, damping: 20 });
  const slowNear = useSpring(nearY, { stiffness: 40, damping: 20 });

  const p = (y: MotionValue<number>) => (reduce ? undefined : { y });

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* 1 · 细网格（最远层） */}
      <motion.div
        style={p(slowFar)}
        className="deco-grid absolute inset-x-0 -top-24 h-[130%] opacity-[0.65] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_30%,black,transparent)]"
      />

      {/* 2 · 横向扫描线（向上缓慢移动，替代原来的点阵） */}
      <motion.div
        style={p(slowMid)}
        className="deco-scanlines absolute inset-x-0 top-[18%] h-[40%] opacity-60 [mask-image:linear-gradient(to_bottom,transparent,black_30%,black_70%,transparent)]"
      />

      {/* 3 · 42° 斜纹（背景尺寸 = 条纹周期，四向无缝） */}
      <motion.div
        style={p(slowMid)}
        className="deco-hatch absolute -left-1/4 -top-24 h-[135%] w-[150%] opacity-[0.55] [mask-image:linear-gradient(to_bottom,transparent,black_22%,black_68%,transparent)]"
      />

      {/* 4 · 右上同心圆环：内外反向自转 */}
      <motion.div
        style={p(slowNear)}
        className="absolute -right-44 -top-44 hidden lg:block"
      >
        <div className="deco-spin-slow relative size-[560px] rounded-full border border-foreground/10">
          <span className="absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-primary/60" />
          <span className="absolute bottom-0 left-1/2 h-2 w-px -translate-x-1/2 bg-foreground/20" />
          <div className="deco-spin-reverse absolute inset-12 rounded-full border border-dashed border-foreground/10" />
          <div className="absolute inset-32 rounded-full border border-foreground/[0.07]" />
        </div>
      </motion.div>

      {/* 5 · 左下角标 + 准星 */}
      <motion.div
        style={p(slowNear)}
        className="absolute bottom-24 left-6 hidden xl:block"
      >
        <div className="relative size-44">
          <span className="absolute left-0 top-0 h-6 w-px bg-foreground/20" />
          <span className="absolute left-0 top-0 h-px w-6 bg-foreground/20" />
          <span className="absolute bottom-0 right-0 h-6 w-px bg-foreground/20" />
          <span className="absolute bottom-0 right-0 h-px w-6 bg-foreground/20" />
          <span className="absolute left-1/2 top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground/15" />
          <span className="absolute left-1/2 top-1/2 h-px w-12 -translate-x-1/2 bg-foreground/15" />
          <span className="absolute left-1/2 top-1/2 h-12 w-px -translate-y-1/2 bg-foreground/15" />
          <span className="deco-pulse absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/60" />
        </div>
      </motion.div>

      {/* 6 · 左上百斜线块：与第 3 层同样的周期，斜线能接得上 */}
      <motion.div
        style={p(slowMid)}
        className="absolute -left-12 top-40 hidden lg:block"
      >
        <div className="deco-hatchblock h-56 w-40 opacity-70 [mask-image:linear-gradient(135deg,black,transparent_78%)]" />
      </motion.div>

      {/* 7 · 右下斜向短线组 */}
      <motion.div
        style={p(slowMid)}
        className="absolute bottom-44 right-8 hidden lg:flex lg:flex-col lg:items-end lg:gap-2"
      >
        <span className="h-px w-20 bg-foreground/15" />
        <span className="h-px w-12 bg-foreground/12" />
        <span className="h-px w-7 bg-primary/45" />
        <span className="mt-1 size-1.5 rotate-45 bg-primary/40" />
      </motion.div>
    </div>
  );
}
