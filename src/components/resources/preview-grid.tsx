"use client";

import * as React from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { PREVIEW_VIEWS } from "@/lib/litematic/build-structure";

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

  // Esc 关闭。打开期间锁住页面滚动，免得浮层下面的内容跟着滚。
  React.useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

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

      {open !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          // 点浮层任意处退出；stopPropagation 保证点图片本身不会误关
          onClick={() => setOpen(null)}
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-background/95 p-6 backdrop-blur-sm"
        >
          <button
            type="button"
            aria-label={t("previewClose")}
            className="absolute right-4 top-4 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {/*
            ⚠️ 必须写 h-full w-full，不能只写 max-h-full max-w-full。
            后者只会**限制**尺寸、不会**放大** —— img 的盒子默认等于图片的
            自然尺寸（1080×720），所以在大屏上它一直就那么点，
            浮层显得空荡荡的（站长就是这个反馈）。
            盒子撑满视口之后，object-contain 才会按比例缩放到贴合，
            同时还保持不变形。
          */}
          <img
            src={shown(open) ?? ""}
            alt={title}
            onClick={(e) => e.stopPropagation()}
            className="h-full w-full cursor-default object-contain"
          />
        </div>
      )}
    </>
  );
}
