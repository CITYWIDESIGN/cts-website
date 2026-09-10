"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/components/motion/transitions";

/**
 * 一格一位的验证码输入（Steam Guard 那种）。
 *
 * 交互细节，都是逐条踩过的坑：
 *   - **自动前进**：填完一格跳到下一格
 *   - **退格回退**：当前格为空时，退格会退回上一格并清掉它（否则要按两次）
 *   - **粘贴整串**：从任意位置粘贴，自动剥掉非数字、从左往右铺开
 *   - **方向键 / Home / End**：在格子间移动光标
 *   - **填满即自动提交**：`onComplete`，不用再点一次按钮
 *   - **错误抖动**：`invalid` 变 true 时整排抖一下，比 toast 更快被注意到
 *
 * 无障碍：整排当成一个 fieldset，每格有 aria-label；读屏会依次念"第 n 位"。
 */
export function CodeInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  invalid = false,
  autoFocus = true,
  className,
}: {
  length?: number;
  /** 当前值（不足位数时用空串补齐） */
  value: string;
  onChange: (next: string) => void;
  /** 填满时触发（每次填满只会触发一次） */
  onComplete?: (code: string) => void;
  disabled?: boolean;
  /** 置为 true 时整排抖动一下，用于校验失败 */
  invalid?: boolean;
  autoFocus?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const refs = React.useRef<Array<HTMLInputElement | null>>([]);
  const [focusIndex, setFocusIndex] = React.useState(0);
  /** 防止"填满"在重渲染中被重复触发 */
  const completedRef = React.useRef<string | null>(null);

  const digits = React.useMemo(() => {
    const chars = value.replace(/\D/g, "").slice(0, length).split("");
    return Array.from({ length }, (_, i) => chars[i] ?? "");
  }, [value, length]);

  /* 自动聚焦第一格（或第一个空位） */
  React.useEffect(() => {
    if (!autoFocus || disabled) return;
    const firstEmpty = digits.findIndex((d) => d === "");
    const target = firstEmpty === -1 ? 0 : firstEmpty;
    refs.current[target]?.focus();
    // 只在挂载时跑一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 填满后自动提交 */
  React.useEffect(() => {
    if (disabled) return;
    const full = digits.join("");
    if (full.length !== length) {
      completedRef.current = null;
      return;
    }
    if (completedRef.current === full) return;
    completedRef.current = full;
    onComplete?.(full);
  }, [digits, length, onComplete, disabled]);

  /* 校验失败时把光标放回最后一格，用户可以直接改那一位（不用再点一次） */
  React.useEffect(() => {
    if (!invalid || disabled) return;
    const el = refs.current[length - 1];
    el?.focus();
    el?.select();
    // focusIndex 由 input 的 onFocus 更新，这里不直接 setState
  }, [invalid, disabled, length]);

  function commit(next: string[]) {
    onChange(next.join("").replace(/\s/g, ""));
  }

  function setDigit(index: number, char: string) {
    const next = [...digits];
    next[index] = char;
    commit(next);
  }

  function focusAt(index: number) {
    const clamped = Math.max(0, Math.min(length - 1, index));
    const el = refs.current[clamped];
    el?.focus();
    el?.select();
    setFocusIndex(clamped);
  }

  function handleChange(index: number, raw: string) {
    const cleaned = raw.replace(/\D/g, "");
    if (!cleaned) {
      setDigit(index, "");
      return;
    }
    // 一次输入多个字符（例如手机输入法联想）→ 当作粘贴处理
    if (cleaned.length > 1) {
      fillFrom(index, cleaned);
      return;
    }
    setDigit(index, cleaned);
    if (index < length - 1) focusAt(index + 1);
  }

  /** 从 index 开始铺开一串数字 */
  function fillFrom(index: number, text: string) {
    const next = [...digits];
    const start = text.length >= length ? 0 : index;
    const chars = text.slice(0, length - start).split("");
    chars.forEach((c, i) => {
      next[start + i] = c;
    });
    commit(next);
    focusAt(Math.min(length - 1, start + chars.length));
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "Backspace":
        e.preventDefault();
        if (digits[index]) {
          setDigit(index, "");
          return;
        }
        // 当前格已空 → 退回上一格并清掉
        if (index > 0) {
          setDigit(index - 1, "");
          focusAt(index - 1);
        }
        return;
      case "Delete":
        e.preventDefault();
        setDigit(index, "");
        return;
      case "ArrowLeft":
        e.preventDefault();
        focusAt(index - 1);
        return;
      case "ArrowRight":
        e.preventDefault();
        focusAt(index + 1);
        return;
      case "Home":
        e.preventDefault();
        focusAt(0);
        return;
      case "End":
        e.preventDefault();
        focusAt(length - 1);
        return;
      default:
        return;
    }
  }

  function handlePaste(index: number, e: React.ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!text) return;
    fillFrom(index, text);
  }

  return (
    <motion.div
      role="group"
      aria-label="verification code"
      animate={invalid && !reduce ? { x: [0, -7, 7, -5, 5, -2, 0] } : { x: 0 }}
      transition={{ duration: 0.42, ease: EASE_OUT }}
      className={cn("flex items-center justify-center gap-2 sm:gap-2.5", className)}
    >
      {digits.map((digit, i) => {
        const focused = focusIndex === i;
        return (
          <div key={i} className="relative">
            <input
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={(e) => handlePaste(i, e)}
              onFocus={(e) => {
                setFocusIndex(i);
                e.currentTarget.select();
              }}
              disabled={disabled}
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              aria-label={`${i + 1}`}
              maxLength={1}
              className={cn(
                "size-11 rounded-xl border-2 bg-background text-center font-mono text-xl font-semibold tabular-nums caret-transparent outline-none transition-all duration-200 sm:size-13 sm:text-2xl",
                "disabled:cursor-not-allowed disabled:opacity-50",
                invalid
                  ? "border-destructive/70 bg-destructive/5 text-destructive"
                  : focused
                    ? "border-primary bg-primary/5 shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_14%,transparent)]"
                    : digit
                      ? "border-primary/35 bg-primary/5"
                      : "border-border text-foreground"
              )}
            />

            {/* 数字落入时轻微弹出，比硬切换更有"按下去"的手感 */}
            {digit && (
              <motion.span
                key={`${i}-${digit}`}
                aria-hidden
                initial={reduce ? false : { scale: 0.55, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.22, ease: EASE_OUT }}
                className={cn(
                  "pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-xl font-semibold tabular-nums sm:text-2xl",
                  invalid ? "text-destructive" : "text-foreground"
                )}
              >
                {digit}
              </motion.span>
            )}

            {/* 空格的待输入下划线：聚焦的那格会亮起来 */}
            {!digit && (
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute bottom-2 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full transition-all duration-200",
                  focused ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </motion.div>
  );
}
