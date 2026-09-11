"use client";

import * as React from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { EASE_OUT } from "@/components/motion/transitions";
import { cn } from "@/lib/utils";

/**
 * 首页图片轮播（封面流 / coverflow）。
 *
 * 视觉：
 * - 中间是当前张，左右各露出一部分相邻张（缩放 + 透明 + 模糊 + 轻微 3D 旋转）
 * - 整体随鼠标位置做 3D 倾斜（透视 + rotateX/rotateY）
 * - 当前张持续极轻微上下浮动，避免画面"死"
 * - 点击侧边张即可切换
 *
 * 尺寸用固定高度而不是 aspect 容器：让左右两张能真正"露出来"，
 * 而不会被外框裁掉。图片用 object-cover 填满，比例不一致也不会变形。
 *
 * 文案与图片来自数据库（管理员在 /admin/carousel 维护），在服务端已经按
 * 当前语言取好，所以这里不需要 useTranslations 去查 items.*。
 */

/**
 * 渲染一张轮播卡所需的最小信息。
 *
 * 刻意不复用 `@/config/carousel` 的 `CarouselSlide`（那个带 `key` 且指向
 * 静态文件），因为现在有两个来源：数据库里的管理员上传图，以及没有配置
 * 任何轮播时的内置占位图。
 */
export interface CarouselItem {
  /** 稳定 key：数据库条目用 id，内置占位图用 slideN */
  key: string;
  src: string;
  title: string;
  subtitle: string;
  overlay?: boolean;
}

/** 单张卡片的宽度（像素），随容器宽度自适应 */
const SIDE_OFFSET = 0.62; // 相邻张水平偏移 = 卡宽 × 该系数
const SIDE_SCALE = 0.82;
/** 视口内渲染的最大张数（左右各 2） */
const VISIBLE_RANGE = 2;

/**
 * 鼠标倾斜幅度（度）：刻意收得很小。
 * 太大时整块内容都在晃，看图反而不舒服；纵轴比横轴更收敛，
 * 因为上下倾斜会带动文字基线，更容易晕。
 */
const TILT_MAX_Y = 3.5; // 横向（绕 Y 轴）
const TILT_MAX_X = 2; // 纵向（绕 X 轴）

export function Carousel({
  items,
  intervalMs = 6000,
}: {
  items: CarouselItem[];
  intervalMs?: number;
}) {
  const t = useTranslations("home.carousel");
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [dims, setDims] = React.useState({ width: 0, cardWidth: 0, height: 0 });
  const [pointer, setPointer] = React.useState({ x: 0, y: 0 });
  const reduce = useReducedMotion();
  const rootRef = React.useRef<HTMLDivElement>(null);

  const count = items.length;

  // 观测容器尺寸，算出卡片宽高（用于左右偏移与高度）
  React.useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const update = () => {
      const width = el.clientWidth;
      const cardWidth = Math.min(880, Math.max(280, width * 0.76));
      setDims({ width, cardWidth, height: Math.round(cardWidth * 0.5625) }); // 16:9
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const go = React.useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count]
  );

  // 自动播放
  React.useEffect(() => {
    if (!intervalMs || paused || reduce || count < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, paused, reduce, count]);

  if (count === 0) return null;

  /** 相对当前张的偏移量（-2..2），超出范围不渲染 */
  function offsetOf(i: number) {
    let o = i - index;
    const half = count / 2;
    if (o > half) o -= count;
    if (o < -half) o += count;
    return o;
  }

  return (
    <section className="pb-2 pt-6 sm:pt-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div
          ref={rootRef}
          tabIndex={0}
          role="region"
          aria-roledescription="carousel"
          aria-label={t("label")}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => {
            setPaused(false);
            setPointer({ x: 0, y: 0 });
          }}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          onPointerMove={(e) => {
            if (reduce) return;
            const r = e.currentTarget.getBoundingClientRect();
            setPointer({
              x: (e.clientX - r.left) / r.width - 0.5,
              y: (e.clientY - r.top) / r.height - 0.5,
            });
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") {
              e.preventDefault();
              go(index + 1);
            } else if (e.key === "ArrowLeft") {
              e.preventDefault();
              go(index - 1);
            }
          }}
          className="group relative outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
          style={{ perspective: "1400px" }}
        >
          {/* 随鼠标倾斜的整体容器（幅度很小，见 TILT_MAX_*） */}
          <motion.div
            animate={
              reduce
                ? undefined
                : {
                    rotateY: pointer.x * TILT_MAX_Y * 2,
                    rotateX: -pointer.y * TILT_MAX_X * 2,
                  }
            }
            transition={{ type: "spring", stiffness: 80, damping: 22 }}
            style={{ transformStyle: "preserve-3d", height: dims.height || 320 }}
            className="relative"
          >
            {items.map((item, i) => {
              const o = offsetOf(i);
              if (Math.abs(o) > VISIBLE_RANGE) return null;
              const active = o === 0;

              return (
                <motion.button
                  key={item.key}
                  type="button"
                  tabIndex={active ? 0 : -1}
                  aria-label={item.title}
                  aria-hidden={Math.abs(o) > 1}
                  onClick={() => !active && go(i)}
                  className={cn(
                    "absolute left-1/2 top-0 origin-center overflow-hidden rounded-2xl border bg-muted shadow-lg",
                    active ? "cursor-default" : "cursor-pointer"
                  )}
                  style={{
                    width: dims.cardWidth || 520,
                    height: dims.height || 320,
                    marginLeft: -(dims.cardWidth || 520) / 2,
                    transformStyle: "preserve-3d",
                  }}
                  animate={
                    reduce
                      ? undefined
                      : {
                          x: o * (dims.cardWidth || 520) * SIDE_OFFSET,
                          scale: active ? 1 : SIDE_SCALE,
                          opacity: Math.abs(o) > 1 ? 0.35 : active ? 1 : 0.6,
                          filter:
                            active || reduce
                              ? "blur(0px)"
                              : `blur(${Math.min(Math.abs(o) * 1.6, 4)}px)`,
                          rotateY: o * -12,
                          zIndex: 10 - Math.abs(o),
                          // 当前张轻微浮动
                          y: active ? [0, -6, 0] : 0,
                        }
                  }
                  transition={
                    active && !reduce
                      ? {
                          x: { type: "spring", stiffness: 220, damping: 26 },
                          scale: { type: "spring", stiffness: 220, damping: 26 },
                          rotateY: { type: "spring", stiffness: 220, damping: 26 },
                          opacity: { duration: 0.4, ease: EASE_OUT },
                          filter: { duration: 0.4, ease: EASE_OUT },
                          y: { duration: 4.2, repeat: Infinity, ease: "easeInOut" },
                        }
                      : {
                          type: "spring",
                          stiffness: 220,
                          damping: 26,
                        }
                  }
                >
                  <Image
                    src={item.src}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 90vw, 880px"
                    priority={i === 0}
                    className="object-cover"
                  />
                  {item.overlay !== false && (
                    <span
                      aria-hidden
                      className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"
                    />
                  )}

                  {/* 文案只给当前张，避免侧边小卡文字糊成一团 */}
                  {active && (
                    <span className="absolute inset-x-0 bottom-0 block p-5 text-left sm:p-7">
                      <motion.span
                        initial={reduce ? false : { opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.1 }}
                        className="block max-w-xl"
                      >
                        <span className="block text-lg font-semibold text-white sm:text-2xl">
                          {item.title}
                        </span>
                        <span className="mt-1.5 block text-sm text-white/80 sm:text-base">
                          {item.subtitle}
                        </span>
                      </motion.span>
                    </span>
                  )}
                </motion.button>
              );
            })}
          </motion.div>

          {/* 左右箭头 */}
          {count > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(index - 1)}
                aria-label={t("previous")}
                className="absolute left-2 top-1/2 z-30 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border bg-background/85 text-foreground opacity-0 shadow-md backdrop-blur transition-all duration-300 hover:scale-110 hover:bg-background focus-visible:opacity-100 group-hover:opacity-100 sm:left-4"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => go(index + 1)}
                aria-label={t("next")}
                className="absolute right-2 top-1/2 z-30 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border bg-background/85 text-foreground opacity-0 shadow-md backdrop-blur transition-all duration-300 hover:scale-110 hover:bg-background focus-visible:opacity-100 group-hover:opacity-100 sm:right-4"
              >
                <ChevronRight className="size-5" />
              </button>
            </>
          )}
        </div>

        {/* 指示圆点 */}
        {count > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            {items.map((s, i) => {
              const active = i === index;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={t("goTo", { index: i + 1 })}
                  aria-current={active}
                  className="group/dot flex h-2.5 items-center justify-center"
                >
                  <motion.span
                    animate={
                      reduce
                        ? undefined
                        : { width: active ? 26 : 8, opacity: active ? 1 : 0.4 }
                    }
                    transition={{ duration: 0.35, ease: EASE_OUT }}
                    className={cn(
                      "block h-2.5 rounded-full transition-colors duration-300",
                      active
                        ? "bg-primary"
                        : "bg-muted-foreground/40 group-hover/dot:bg-muted-foreground/70"
                    )}
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
