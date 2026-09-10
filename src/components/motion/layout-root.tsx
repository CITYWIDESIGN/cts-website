"use client";

import * as React from "react";
import { motion } from "motion/react";

/**
 * sticky / fixed 容器的 shared-layout 测量基准。
 *
 * 为什么必须有这个：Motion 的 `layoutId` 动画是**相对页面**测量的 —— 它拿
 * `getBoundingClientRect()`（视口坐标）再加 `window.scrollY` 换算成文档坐标。
 * 对普通元素没问题，但对 `position: sticky` 的元素是错的：吸顶之后它在视口里
 * 的位置永远不变，于是算出来的"文档位置"会随 `scrollY` 一起漂。
 *
 * 具体表现（页头导航就是这个 bug）：
 *   1. 页面滚到底，scrollY = 3000，页头吸顶在视口顶部
 *   2. 点另一个导航项，Motion 记下的"旧位置" = 3000 + 56 ≈ 3056
 *   3. 路由切换后 Next 把页面滚回顶部，scrollY = 0，"新位置" = 56
 *   4. Motion 以为元素要从 3056 移到 56 —— 指示条从屏幕外飞上来
 *
 * `layoutRoot` 告诉 Motion"以这个元素为原点测量子元素"，子元素的相对位置就
 * 不再受页面滚动影响。Motion 自己的类型定义里写得很直白：
 *   "Currently used for `position: sticky` elements in Framer."
 *
 * 所以凡是 **sticky / fixed 容器里有 layoutId 指示条**的地方，都要用这个包一层。
 */
export function StickyLayoutRoot({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.header layoutRoot className={className}>
      {children}
    </motion.header>
  );
}
