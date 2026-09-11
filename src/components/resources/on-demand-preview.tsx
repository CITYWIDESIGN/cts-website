"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { PREVIEW_VIEWS, previewIndex } from "@/lib/litematic/build-structure";

/**
 * 查看时现场渲染预览。
 *
 * 为什么不在上传时渲：那一串（解析 → 建结构 → 拉 3MB 材质包 → 渲 8 帧）
 * 全压在提交按钮上，传一个大投影要等十几秒（站长反馈"卡提交中了 好久"）。
 * 挪到这里之后，上传是秒回的。
 *
 * 代价只落在**第一个**打开的人身上：渲完会 POST 回服务端存起来，
 * 之后所有人秒开。所以这里不需要"生成预览"按钮 —— 自动开始，
 * 并且给出进度，让第一个等的人知道在动。
 *
 * 渲染失败（文件太大、显存不够、浏览器太老）就显示一行提示，
 * **不影响资源本身的浏览和下载**。
 */
export function OnDemandPreview({
  resourceId,
  title,
}: {
  resourceId: string;
  title: string;
}) {
  const t = useTranslations("resources");
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [state, setState] = React.useState<"rendering" | "ready" | "error">("rendering");
  const [images, setImages] = React.useState<string[]>([]);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/resources/${resourceId}/model`);
        if (!res.ok) throw new Error(`model ${res.status}`);
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (cancelled) return;

        // 动态引入：three.js 只在真的要看预览时才加载
        const { renderLitematicPreviews } = await import("@/lib/litematic/preview");
        const result = await renderLitematicPreviews(bytes);
        if (cancelled) return;
        if (!result) throw new Error("render failed");

        setImages(result.images);
        setState("ready");

        /*
          回存：让后面的人秒开。**失败不影响展示** —— 图已经在本地了，
          存不进去最多是下一个人再渲一遍。
          权限不足（不是上传者/管理员）时服务端会返回 403，这是正常的：
          访客能看到预览，但只有作者能把结果固化下来。
        */
        fetch(`/api/resources/${resourceId}/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ images: result.images }),
        }).catch(() => {});
      } catch (err) {
        console.warn("[litematic] 现场渲染失败：", err);
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [resourceId]);

  if (state === "error") {
    return (
      <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        {t("previewError")}
      </p>
    );
  }

  if (state === "rendering" || images.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {t("previewRendering")}
      </div>
    );
  }

  const theme = isDark ? "dark" : "light";
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {PREVIEW_VIEWS.map((view, direction) => {
        const src = images[previewIndex(direction, theme)] ?? images[0];
        if (!src) return null;
        return (
          <figure key={view.key} className="space-y-1.5">
            {/* 点开看原图：新标签页打开这张图的接口地址 */}
            <a
              href={`/api/resources/${resourceId}/preview?i=${previewIndex(direction, theme)}`}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-lg border bg-white transition-opacity hover:opacity-90 dark:bg-black"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`${title} — ${t(view.key)}`}
                className="aspect-[3/2] w-full cursor-zoom-in object-cover"
              />
            </a>
            <figcaption className="text-center text-xs text-muted-foreground">
              {t(view.key)}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
