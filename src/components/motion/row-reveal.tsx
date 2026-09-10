"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { EASE_OUT, STAGGER } from "./transitions";

/**
 * 逐行入场动画。
 *
 * 默认渲染 `motion.tr`（表格行必须是 `<tbody>` 的直接子元素，外面套 div
 * 会被浏览器重新解析 → 水合报错）；列表形态的"行"（例如审计日志）用
 * `as="li"`，否则会出现 `<tr>` 出现在 `<ul>` 里、`<div>` 出现在 `<tr>` 里
 * 这类非法嵌套。
 */
export function RowReveal({
  index = 0,
  children,
  className,
  as = "tr",
}: {
  index?: number;
  children: React.ReactNode;
  className?: string;
  as?: "tr" | "li";
}) {
  const reduce = useReducedMotion();

  const props = {
    initial: reduce ? (false as const) : { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: 0.35,
      ease: EASE_OUT,
      delay: Math.min(index, 14) * STAGGER,
    },
    className,
  };

  if (as === "li") return <motion.li {...props}>{children}</motion.li>;
  return <motion.tr {...props}>{children}</motion.tr>;
}
