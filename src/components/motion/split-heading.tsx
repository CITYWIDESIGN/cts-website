"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { EASE_OUT } from "./transitions";

/** 逐字/逐词之间的间隔：刻意很短，避免中文标题显得"碎"或拖沓 */
const UNIT_STAGGER = 0.026;

type SplitMode = "words" | "chars";

/**
 * 逐字 / 逐词入场标题。
 *
 * 把标题拆成独立单元，各自带轻微位移与模糊依次浮现。
 * 单元间隔很短（26ms），整句仍能在 ~0.5s 内呈现完毕，不会拖慢首屏。
 *
 * 文本以字符串 prop 传入（服务端翻译后），不破坏 server/client 边界。
 */
export function SplitHeading({
  text,
  className,
  as: Tag = "h1",
  mode = "chars",
}: {
  text: string;
  className?: string;
  as?: "h1" | "h2" | "h3";
  mode?: SplitMode;
}) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <Tag className={className}>{text}</Tag>;
  }

  // 按字符拆分；按词拆分时以空格为界保留空格单元
  const units =
    mode === "words" ? text.split(/(\s+)/).filter(Boolean) : Array.from(text);

  return (
    <Tag className={className}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={text}
          initial="hidden"
          animate="show"
          exit="exit"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: UNIT_STAGGER } },
            exit: {
              transition: { staggerChildren: 0.012, staggerDirection: -1 },
            },
          }}
          className="inline-block"
        >
          {units.map((unit, i) => (
            <motion.span
              key={`${unit}-${i}`}
              variants={{
                hidden: { opacity: 0, y: "0.3em", filter: "blur(5px)" },
                show: {
                  opacity: 1,
                  y: 0,
                  filter: "blur(0px)",
                  transition: { duration: 0.42, ease: EASE_OUT },
                },
                exit: {
                  opacity: 0,
                  y: "-0.22em",
                  filter: "blur(4px)",
                  transition: { duration: 0.22, ease: EASE_OUT },
                },
              }}
              className="inline-block whitespace-pre"
            >
              {unit}
            </motion.span>
          ))}
        </motion.span>
      </AnimatePresence>
    </Tag>
  );
}
