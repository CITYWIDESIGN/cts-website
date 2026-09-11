"use client";

import { useTranslations } from "next-intl";
import { PREVIEW_VIEWS, previewIndex } from "@/lib/litematic/build-structure";
import { PreviewGrid } from "./preview-grid";

/**
 * 已缓存好的预览（从接口按 `?i=` 取）。
 *
 * 透明的 PNG 直接铺在页面底色上，所以这里**不给容器加背景色** ——
 * 明暗主题是天然跟随的，不需要为两套主题各存一份图。
 *
 * 现场渲染那条路见 on-demand-preview.tsx；两者共用 PreviewGrid
 * （网格 + 站内放大）。
 */
export function PreviewGallery({
  resourceId,
  title,
}: {
  resourceId: string;
  title: string;
}) {
  const t = useTranslations("resources");
  void t;
  return (
    <PreviewGrid
      title={title}
      srcs={PREVIEW_VIEWS.map(
        (_view, direction) => `/api/resources/${resourceId}/preview?i=${previewIndex(direction)}`
      )}
    />
  );
}
