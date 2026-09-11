"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { PREVIEW_VIEWS } from "@/lib/litematic/build-structure";

/** 关闭动画时长，和下面 motion 的 transition 对齐 */
const CLOSE_MS = 150;

/**
 * 四个方向的等轴测预览 + 站内放大。
 *
 * 背景是**透明**的（渲染器那边打过补丁：alpha 通道打开、清除色透明、
 * 天空整段跳过），所以**不要**给容器加底色 —— 让页面的底色直接透过来，
 * 明暗主题就是天然跟随的，也不用为两套主题各渲染一份。
 *
 * 点开是**站内浮层**而不是新标签页：新标签页会丢掉当前浏览上下文，
 * 对"看一眼细节"这种操作太重。再点一次（或按 Esc）退出。
 */
export function PreviewGrid({
  srcs,
  title,
}: {
  /** 按 PREVIEW_VIEWS 顺序排列；可能少于 4 张（老数据只有 1 张） */
  srcs: string[];
  title: string;
}) {
  const t = useTranslations("resources");
  const [open, setOpen] = React.useState<number | null>(null);
  /** 正在播关闭动画 —— 播完才真的卸载 */
  const [closing, setClosing] = React.useState(false);

  /**
   * 播放关闭动画后再卸载。
   *
   * ⚠️ **没有用 AnimatePresence。** 它和 `createPortal` 搭配是出了名的容易
   * 失效 —— Motion 要靠 context 把"正在退出"传给子组件，而 portal 会打断
   * 这条链，站长反馈"放大动画压根不触发"就是这个。
   *
   * 换成手动驱动：closing 一变 true，motion 的 animate 目标就变成缩小 + 透明；
   * 动画播完再 setOpen(null) 真正卸载。进出两个方向都走 animate，
   * 不依赖卸载时机。
   */
  const close = React.useCallback(() => {
    setClosing((already) => {
      if (already) return already;
      window.setTimeout(() => {
        setOpen(null);
        setClosing(false);
      }, CLOSE_MS);
      return true;
    });
  }, []);

  // Esc 关闭。打开期间锁住页面滚动，免得浮层下面的内容跟着滚。
  React.useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  const shown = (i: number) => srcs[i] ?? srcs[0] ?? null;

  if (srcs.length === 0) return null;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PREVIEW_VIEWS.map((view, i) => {
          const src = shown(i);
          if (!src) return null;
          return (
            <figure key={view.key} className="space-y-1.5">
              <button
                type="button"
                onClick={() => setOpen(i)}
                aria-label={t("previewZoom")}
                className="block w-full overflow-hidden rounded-lg border transition-opacity hover:opacity-90"
              >
                {/* object-contain：透明底的图不能被裁掉 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`${title} — ${t(view.key)}`}
                  className="aspect-[3/2] w-full cursor-zoom-in object-contain"
                  loading="lazy"
                />
              </button>
              <figcaption className="text-center text-xs text-muted-foreground">
                {t(view.key)}
              </figcaption>
            </figure>
          );
        })}
      </div>

      {/*
        ⚠️ 必须用 portal 挂到 <body>。

        `fixed inset-0` 是相对**视口**定位的 —— 但只要祖先里有任何元素带
        transform / filter / will-change，它就会退化成"相对那个祖先"。
        详情页外面包着 Motion 的 Stagger / StaggerItem（动画会留下 transform），
        于是浮层被关在了卡片里。
      */}
      {open !== null &&
        createPortal(
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0 }}
            animate={{ opacity: closing ? 0 : 1 }}
            transition={{ duration: CLOSE_MS / 1000, ease: "easeOut" }}
            // 点浮层任意处退出；图片自己 stopPropagation，点图不会误关
            onClick={close}
            className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-background/95 p-6 backdrop-blur-sm"
          >
            <button
              type="button"
              aria-label={t("previewClose")}
              className="absolute right-4 top-4 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-5" />
            </button>
            {/*
              ⚠️ 必须写 h-full w-full，不能只写 max-h-full max-w-full。
              后者只会**限制**尺寸、不会**放大** —— img 的盒子默认等于图片的
              自然尺寸，所以在大屏上它一直就那么点。
              盒子撑满视口之后，object-contain 才会按比例缩放到贴合。
            */}
            <motion.img
              src={shown(open) ?? ""}
              alt={title}
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: closing ? 0.94 : 1, opacity: closing ? 0 : 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 30, mass: 0.7 }}
              className="h-full w-full cursor-default object-contain"
            />
          </motion.div>,
          document.body
        )}
    </>
  );
}
