"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { EASE_OUT } from "./transitions";

/** 逐字/逐词之间的间隔：刻意很短，避免中文标题显得"碎"或拖沓 */
const UNIT_STAGGER = 0.026;

type SplitMode = "words" | "chars";

/**
 * 一个换行单元。
 *
 * - `atomic`：整体参与动画的一个小单元（汉字、标点、空格）
 * - `word`：拉丁词。**必须整体不可断行** —— 见 toUnits() 的说明
 */
type Unit =
  | { kind: "atomic"; text: string }
  | { kind: "word"; text: string };

/**
 * 把文本切成换行单元。
 *
 * 为什么不能简单地 `Array.from(text)` 逐字渲染：
 * 逐字方案下每个字符都是一个 `inline-block`，而**相邻 inline-block 之间
 * 浏览器是允许断行的**（就像一排徽章会换行一样）。于是英文单词会被从中间
 * 劈开 —— "Minecraft" 渲染成 "Minecr" / "aft" 两行。
 *
 * 所以先把连续的拉丁字母/数字合成一个整体，交给外层 `whitespace-pre` 包住；
 * 中文与标点仍然逐字，保持中文可以任意处换行的正常表现。
 */
const TOKEN_RE = /[A-Za-z0-9][A-Za-z0-9'’._-]*|\s+|[\s\S]/g;

function toUnits(text: string): Unit[] {
  const out: Unit[] = [];
  for (const token of text.match(TOKEN_RE) ?? []) {
    if (/^\s+$/.test(token)) {
      out.push({ kind: "atomic", text: token });
    } else if (/^[A-Za-z0-9]/.test(token)) {
      out.push({ kind: "word", text: token });
    } else {
      // 正常情况下 [\s\S] 一次只吃一个字符，这里的循环是防御性写法
      for (const ch of Array.from(token)) out.push({ kind: "atomic", text: ch });
    }
  }
  return out;
}

/** 按词拆分（登录页等处用）：保留空格，但整词作为一个动画单元 */
function toWordUnits(text: string): Unit[] {
  return text
    .split(/(\s+)/)
    .filter(Boolean)
    .map((w) =>
      /^\s+$/.test(w)
        ? ({ kind: "atomic", text: w } as const)
        : ({ kind: "word", text: w } as const)
    );
}

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

  const units = mode === "words" ? toWordUnits(text) : toUnits(text);

  /** 单个单元的入场/退场：位移 + 模糊，幅度按 em 走，跟随字号缩放 */
  const unitVariants = {
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
  };

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
          {units.map((unit, i) => {
            /*
              逐字模式下的拉丁词：外层不可断行的容器负责"这个词不许拆行"，
              内层再逐字做动画 —— 动画粒度与换行粒度分开。
              变体是通过 Context 往下传的，中间夹一层普通 <span> 不影响传播。
            */
            if (mode === "chars" && unit.kind === "word" && unit.text.length > 1) {
              return (
                <span key={`w-${i}`} className="inline-block whitespace-pre">
                  {Array.from(unit.text).map((ch, j) => (
                    <motion.span
                      key={`${ch}-${j}`}
                      variants={unitVariants}
                      className="inline-block whitespace-pre"
                    >
                      {ch}
                    </motion.span>
                  ))}
                </span>
              );
            }

            return (
              <motion.span
                key={`${unit.text}-${i}`}
                variants={unitVariants}
                className="inline-block whitespace-pre"
              >
                {unit.text}
              </motion.span>
            );
          })}
        </motion.span>
      </AnimatePresence>
    </Tag>
  );
}
