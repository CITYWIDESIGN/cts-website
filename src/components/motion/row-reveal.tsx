"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { EASE_OUT, STAGGER } from "./transitions";

/**
 * 表格行入场动画。
 * 用 motion.tr 而不是外层 div，避免破坏 <tbody> 的表格结构。
 */
export function RowReveal({
  index = 0,
  children,
  className,
}: {
  index?: number;
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.tr
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        ease: EASE_OUT,
        delay: Math.min(index, 14) * STAGGER,
      }}
      className={className}
    >
      {children}
    </motion.tr>
  );
}
