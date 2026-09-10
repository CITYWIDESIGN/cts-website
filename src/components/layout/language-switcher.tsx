"use client";

import * as React from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Languages } from "lucide-react";
import { setLocale } from "@/lib/actions/locale";
import { locales, localeLabels, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/components/motion/transitions";

/**
 * 语言切换器（自定义浮层，不用 Radix Portal）。
 *
 * 之前的实现依赖 DropdownMenu，浮层被 Portal 挂到 body，尺寸与对齐都不受控，
 * 也没有动画。这里改为紧贴触发按钮的绝对定位浮层：
 * - 定位与触发按钮右对齐，间距统一（mt-2），宽度固定不再随内容抖动
 * - 打开/关闭有缩放+位移过渡
 * - 选项逐条错开入场，当前项高亮并弹入对勾
 * - 图标在切换期间旋转，右下角语言简称交叉淡入淡出
 */
export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = React.useState(false);
  const [spin, setSpin] = React.useState(0);
  const reduce = useReducedMotion();
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function handleChange(next: Locale) {
    setOpen(false);
    if (next === locale) return;
    setSpin((s) => s + 1);
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Language"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "group relative inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
          open && "bg-accent text-foreground"
        )}
      >
        <motion.span
          animate={
            reduce
              ? undefined
              : isPending
                ? { rotate: 180, scale: 1.12 }
                : { rotate: 0, scale: 1 }
          }
          transition={{ duration: 0.45, ease: EASE_OUT }}
          className="flex items-center justify-center"
        >
          <Languages className="size-[18px]" />
        </motion.span>

        {/* 当前语言简称：切换时交叉淡入淡出 */}
        <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center overflow-hidden rounded-full bg-primary text-[9px] font-semibold uppercase text-primary-foreground ring-2 ring-background">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={locale}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
            >
              {locale}
            </motion.span>
          </AnimatePresence>
        </span>

        {/* 切换时扫过的一圈高光 */}
        {!reduce && (
          <motion.span
            key={spin}
            aria-hidden
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: [0, 0.55, 0], scale: 1.35 }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
            className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-primary/40"
          />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="absolute right-0 top-full z-50 mt-2 w-40 origin-top-right overflow-hidden rounded-xl border bg-popover p-1.5 shadow-lg"
          >
            {locales.map((code, i) => {
              const current = code === locale;
              return (
                <motion.button
                  key={code}
                  type="button"
                  role="option"
                  aria-selected={current}
                  disabled={isPending}
                  onClick={() => handleChange(code)}
                  initial={reduce ? false : { opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.25,
                    ease: EASE_OUT,
                    delay: reduce ? 0 : 0.04 + i * 0.05,
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-200 disabled:opacity-60",
                    current
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <span className="flex size-4 shrink-0 items-center justify-center">
                    <AnimatePresence initial={false}>
                      {current && (
                        <motion.span
                          key="check"
                          initial={reduce ? false : { scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={
                            reduce
                              ? { duration: 0 }
                              : { type: "spring", stiffness: 400, damping: 22 }
                          }
                        >
                          <Check className="size-4 text-primary" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                  <span className="flex-1">{localeLabels[code]}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    {code}
                  </span>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
