"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { PreviewGrid } from "./preview-grid";
import { PreviewMetaList } from "./preview-meta";
import { OnDemandPreview } from "./on-demand-preview";

/**
 * 投影预览的外壳：**默认折叠，展开才渲染**。
 *
 * 为什么这么设计：预览不是必需品，而它的代价不小 —— 第一次打开要下载模型
 * （投影本体可能几十 MB）+ 拉 3MB 材质包 + 渲 4 帧。默认折叠之后，
 * 不想看的人**一点代价都不用付**（连模型都不下载）。
 *
 * 展开过一次之后内容会**保持挂载**：一来关合时才有东西可动画，
 * 二来渲染结果已经在内存/服务端了，反复开合不该重来一遍。
 * 所以"节约"体现在"没点开过 = 零代价"，而不是"每次关合都重来"。
 *
 * 高度动画用 CSS 的 `grid-template-rows: 0fr ↔ 1fr`，不是 JS 量高度：
 * 不用测量、不用等图片加载完再算、也不会因为内容变化算错。
 */
export function PreviewSection({
  resourceId,
  title,
  hasPreview,
  meta,
}: {
  resourceId: string;
  title: string;
  /** 已经有渲染好的图（直接取接口）；否则现场渲染 */
  hasPreview: boolean;
  meta: unknown;
}) {
  const t = useTranslations("resources");
  const [open, setOpen] = React.useState(false);
  /** 展开过一次之后就一直挂着，关合时才有东西可动画 */
  const [mounted, setMounted] = React.useState(false);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) setMounted(true);
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left"
      >
        <span className="text-base font-semibold">{t("previewLabel")}</span>
        <ChevronDown
          className={`size-4 text-muted-foreground transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
        />
        <span className="ml-auto text-xs text-muted-foreground">
          {open ? t("previewCollapse") : t("previewExpand")}
        </span>
      </button>

      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        {/* overflow-hidden 是 0fr 能真的收成 0 高度的前提 */}
        <div className="overflow-hidden">
          <div className="pt-4">
            {mounted &&
              (hasPreview ? (
                <PreviewGrid
                  title={title}
                  srcs={[0, 1, 2, 3].map(
                    (i) => `/api/resources/${resourceId}/preview?i=${i}`
                  )}
                />
              ) : (
                <OnDemandPreview resourceId={resourceId} title={title} />
              ))}
            {hasPreview && meta ? <PreviewMetaList meta={meta} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
