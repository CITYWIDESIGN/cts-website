"use client";

import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { PREVIEW_THEMES, PREVIEW_VIEWS, previewIndex } from "@/lib/litematic/build-structure";

/**
 * 四个方向的等轴测预览。
 *
 * 白天/黑夜是**两套分别渲染好的图**（背景是渲染进 PNG 的，不是 CSS 能改的），
 * 所以这里要按当前主题选对应那一张 —— 索引规则见 `previewIndex`，
 * 服务端和这里共用同一个函数，免得两边各算各的。
 *
 * `resolvedTheme` 在挂载前是 undefined（服务端不知道用户选了什么）。
 * 这时先按白天渲染：图片地址会因此变一次，但两张图都在同一台服务器上、
 * 也都是长缓存，代价可接受。用 `mounted` 状态会让首屏空一下，更糟。
 */
export function PreviewGallery({
  resourceId,
  title,
}: {
  resourceId: string;
  title: string;
}) {
  const t = useTranslations("resources");
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const theme = isDark ? "dark" : "light";

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {PREVIEW_VIEWS.map((view, direction) => {
        const index = previewIndex(direction, theme);
        return (
          <figure key={view.key} className="space-y-1.5">
            <div className="overflow-hidden rounded-lg border bg-white dark:bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/resources/${resourceId}/preview?i=${index}`}
                alt={`${title} — ${t(view.key)}`}
                className="aspect-[3/2] w-full object-cover"
                loading="lazy"
              />
            </div>
            <figcaption className="text-center text-xs text-muted-foreground">
              {t(view.key)}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

/** 供别处引用，避免重复写主题列表 */
export { PREVIEW_THEMES };
