"use client";

import { useTranslations } from "next-intl";
import { PREVIEW_THEMES, PREVIEW_VIEWS, previewIndex } from "@/lib/litematic/build-structure";

/**
 * 四个方向的等轴测预览。
 *
 * 白天/黑夜是**两套分别渲染好的图**（背景是渲染进 PNG 的，不是 CSS 能改的），
 * 所以这里把两张都渲染出来，用 **CSS 的 `dark:` 变体**决定显示哪张。
 *
 * ⚠️ 一开始是用 `useTheme().resolvedTheme` 在 JS 里选 `?i=` 的，**不工作**：
 * next-themes 的 `resolvedTheme` 在挂载完成前是 `undefined`，而主题又是
 * 用户在客户端切的 —— 结果切了主题图不换（站长就是这个反馈）。
 * 用 CSS 就没有这个问题：切主题只是给 `<html>` 换 class，浏览器立刻重算，
 * 不经过 React，也不存在 hydration 时机的问题。
 *
 * 代价是浏览器会同时请求明暗两组图（4 张变 8 张）。都是同源、可缓存的
 * 静态响应，而且只在有这个卡片时才请求，可以接受。
 */
export function PreviewGallery({
  resourceId,
  title,
}: {
  resourceId: string;
  title: string;
}) {
  const t = useTranslations("resources");

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {PREVIEW_VIEWS.map((view, direction) => (
        <figure key={view.key} className="space-y-1.5">
          {/*
            点开看大图：新标签页打开接口地址。不做站内弹层是因为那个要自己写
            遮罩/键盘/焦点陷阱，而浏览器自带的图片查看器（缩放、另存为）够用。
          */}
          <a
            href={`/api/resources/${resourceId}/preview?i=${previewIndex(direction, "light")}`}
            target="_blank"
            rel="noreferrer"
            className="block overflow-hidden rounded-lg border bg-white transition-opacity hover:opacity-90 dark:bg-black"
          >
            {PREVIEW_THEMES.map((theme) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={theme.key}
                src={`/api/resources/${resourceId}/preview?i=${previewIndex(direction, theme.key)}`}
                alt={`${title} — ${t(view.key)}`}
                loading="lazy"
                className={
                  theme.key === "dark"
                    ? "hidden aspect-[3/2] w-full cursor-zoom-in object-cover dark:block"
                    : "block aspect-[3/2] w-full cursor-zoom-in object-cover dark:hidden"
                }
              />
            ))}
          </a>
          <figcaption className="text-center text-xs text-muted-foreground">
            {t(view.key)}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
