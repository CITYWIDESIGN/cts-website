"use client";

import * as React from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import {
  BLUR,
  DURATION,
  EASE_OUT,
  OFFSET_Y,
  STAGGER,
  VIEWPORT_LIST,
} from "./transitions";

/* ---------------------------------------------------------------------------
 * 为什么这里不直接继承 React.ComponentProps<"div">：
 * React 与 Motion 的 onDrag / onAnimationStart 等同名回调签名不同，直接展开会
 * 触发 TS2322。这里按用途分别声明最小属性集，既保持类型干净，也能通过
 * tsc --noEmit 与 eslint。
 *
 * 如果将来确实需要透传任意 HTML 属性，请显式加进来，不要笼统地改成
 * ComponentProps<"div">。
 * ------------------------------------------------------------------------- */

/** 三类容器都会用到的通用属性 */
interface BaseMotionProps extends React.AriaAttributes {
  children?: React.ReactNode;
  className?: string;
  id?: string;
  style?: React.CSSProperties;
  role?: string;
  tabIndex?: number;
}

/** 列表/卡片项会用到的事件与数据属性 */
interface ItemMotionProps extends BaseMotionProps {
  "data-slot"?: string;
  onClick?: React.MouseEventHandler<HTMLElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLElement>;
  title?: string;
}

function makeItemVariants(offsetY: number, blur: number): Variants {
  return {
    hidden: { opacity: 0, y: offsetY, filter: `blur(${blur}px)` },
    show: (index: number = 0) => ({
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        duration: DURATION,
        ease: EASE_OUT,
        delay: Math.min(index, 12) * STAGGER,
      },
    }),
  };
}

/* ---------------------------------------------------------------------------
 * Stagger —— 一组子元素依次入场
 * 用 variant 编排（父级触发、子级各自偏移），比逐项手写 delay 更稳，
 * 也不会因为列表变长而累积出很长的排队。
 * ------------------------------------------------------------------------- */

interface StaggerProps extends BaseMotionProps {
  /** 首个元素之前的额外延迟（秒） */
  delay?: number;
  /** 子元素出现间隔（秒） */
  stagger?: number;
  /** 是否在滚动进入视口时触发（false = 挂载即播放） */
  inView?: boolean;
  /** 子元素之间的间距（px），覆盖 className 里的 gap */
  gap?: number;
}

export function Stagger({
  children,
  className,
  id,
  style,
  delay = 0,
  stagger = STAGGER,
  inView = true,
  gap,
}: StaggerProps) {
  const reduce = useReducedMotion();
  const mergedStyle =
    gap === undefined ? style : { ...style, gap };

  if (reduce) {
    return (
      <div className={className} id={id} style={mergedStyle}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      id={id}
      style={mergedStyle}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: stagger, delayChildren: delay } },
      }}
      initial="hidden"
      {...(inView
        ? { whileInView: "show", viewport: VIEWPORT_LIST }
        : { animate: "show" })}
    >
      {children}
    </motion.div>
  );
}

/* ---------------------------------------------------------------------------
 * StaggerItem —— 必须作为 Stagger 的直接子元素使用
 * ------------------------------------------------------------------------- */

interface StaggerItemProps extends ItemMotionProps {
  /** 在列表中的序号，用于计算递增延迟 */
  index?: number;
  /** 渲染的标签：列表用 li，表格行用 tr */
  as?: "div" | "li" | "tr";
  /** 覆盖入场位移距离（px） */
  y?: number;
  /** 覆盖入场模糊强度（px） */
  blur?: number;
}

export function StaggerItem({
  children,
  className,
  index = 0,
  as = "div",
  y = OFFSET_Y,
  blur = BLUR,
  id,
  style,
  ...rest
}: StaggerItemProps) {
  const reduce = useReducedMotion();
  const variants = React.useMemo(() => makeItemVariants(y, blur), [y, blur]);

  if (reduce) {
    const Tag = as;
    return (
      <Tag className={className} id={id} style={style} {...rest}>
        {children}
      </Tag>
    );
  }

  const Component = as === "li" ? motion.li : as === "tr" ? motion.tr : motion.div;

  return (
    <Component
      className={className}
      id={id}
      style={style}
      custom={index}
      variants={variants}
      {...rest}
    >
      {children}
    </Component>
  );
}

/* ---------------------------------------------------------------------------
 * MotionCard —— 卡片入场 + 悬停微抬升
 * 悬停用 CSS transition（比 Motion 更省，也不影响子元素布局）。
 * ------------------------------------------------------------------------- */

interface MotionCardProps extends StaggerItemProps {
  /** 是否启用悬停抬升 */
  hover?: boolean;
}

export function MotionCard({
  children,
  className,
  index = 0,
  hover = true,
  as = "div",
  id,
  style,
  ...rest
}: MotionCardProps) {
  const reduce = useReducedMotion();
  const variants = React.useMemo(() => makeItemVariants(OFFSET_Y, BLUR), []);

  const className_ = [
    hover
      ? "transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-1 hover:shadow-md hover:border-primary/25"
      : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  if (reduce) {
    const Tag = as;
    return (
      <Tag className={className} id={id} style={style} {...rest}>
        {children}
      </Tag>
    );
  }

  const Component = as === "li" ? motion.li : motion.div;

  return (
    <Component
      className={className_}
      id={id}
      style={style}
      custom={index}
      variants={variants}
      {...rest}
    >
      {children}
    </Component>
  );
}

/* ---------------------------------------------------------------------------
 * PageEnter —— 页面级入场：整页内容轻微上浮淡入
 * 解决路由切换时内容"突然出现"的生硬感。
 * ------------------------------------------------------------------------- */

interface PageEnterProps extends BaseMotionProps {
  /** 页面级通常不需要模糊，保持干净 */
  blur?: number;
}

export function PageEnter({
  children,
  className,
  id,
  style,
  blur = 0,
}: PageEnterProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <div className={className} id={id} style={style}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      id={id}
      style={style}
      initial={{ opacity: 0, y: 8, filter: `blur(${blur}px)` }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.45, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}
