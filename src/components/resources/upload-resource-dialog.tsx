"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAnimate } from "motion/react";
import { useTranslations } from "next-intl";
import { FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ResourceFields } from "./resource-fields";
import { formatBytes } from "@/lib/format";
import { MB } from "@/lib/validators/limits";
import { useLimits } from "@/components/limits-provider";
import { isLitematicFileName } from "@/lib/litematic/file-name";
import type { PreviewStage } from "@/lib/litematic/preview";
import { useBanNotice } from "@/components/ban-notice";

/**
 * 资源上传弹窗。
 *
 * 校验分两层：这里做即时反馈，服务端再校验一次
 * （见 /api/resources/upload），客户端校验不可信。
 * 封面图在前端转成 data URL 后随表单一起提交。
 */
export function UploadResourceDialog() {
  const t = useTranslations("resources");
  const common = useTranslations("common");
  const router = useRouter();
  const banNotice = useBanNotice();
  const limits = useLimits();
  const [scope, animate] = useAnimate();

  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  /** 投影预览的进度阶段（不是投影、或已生成完就是 null） */
  const [previewStage, setPreviewStage] = React.useState<PreviewStage | null>(null);

  function reset() {
    setTitle("");
    setDescription("");
    setFile(null);
    setImagePreview(null);
    setSubmitting(false);
    setPreviewStage(null);
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > limits.maxFileMb * MB) {
      toast.error(t("errors.fileTooLarge", { max: limits.maxFileMb }));
      e.target.value = "";
      return;
    }
    setFile(f);
  }

  /** 校验失败时轻微抖动，比单纯 toast 更容易被注意到 */
  function shake() {
    animate(
      scope.current,
      { x: [0, -6, 6, -4, 4, 0] },
      { duration: 0.35, ease: "easeOut" }
    );
  }

  async function submit() {
    if (!title.trim()) {
      shake();
      toast.error(t("errors.titleRequired"));
      return;
    }
    if (!description.trim()) {
      shake();
      toast.error(t("errors.descriptionRequired"));
      return;
    }
    if (!file) {
      shake();
      toast.error(t("errors.fileRequired"));
      return;
    }

    setSubmitting(true);
    try {
      const body = new FormData();
      body.set("title", title.trim());
      body.set("description", description.trim());
      body.set("file", file);
      if (imagePreview) body.set("image", imagePreview);

      /*
        .litematic 的投影预览：在浏览器里渲染一帧，和文件一起提交。

        为什么在客户端算：渲染要 WebGL，服务端跑就得装 headless WebGL
        （见 src/lib/litematic/preview.ts 的说明）。用户本来就在浏览器里，
        顺手渲染掉。

        **失败不影响上传** —— 渲染不出来（文件不合法、显存不够、浏览器太老）
        就当没有预览，资源照常传上去。动态 import 也是这个考虑：
        three.js 有几百 KB，只在上传投影时才加载。
      */
      if (isLitematicFileName(file.name)) {
        setPreviewStage("parsing");
        try {
          const { renderLitematicPreview } = await import("@/lib/litematic/preview");
          const preview = await renderLitematicPreview(file, { onStage: setPreviewStage });
          // 三张图打包成一个 JSON 数组提交（multipart 里塞三个同名字段反而更难校验）
          if (preview) body.set("preview", JSON.stringify(preview.images));
        } catch (err) {
          console.warn("[resources] 投影预览生成失败，继续上传：", err);
        } finally {
          setPreviewStage(null);
        }
      }

      const res = await fetch("/api/resources/upload", { method: "POST", body });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        id?: string;
        limit?: number;
        bannedUntil?: string | null;
        banReason?: string | null;
      };

      if (!res.ok || !data.ok) {
        // 封禁：说明被禁到什么时候，否则用户不知道是不是永久的
        if (data.error === "banned") {
          toast.error(banNotice("upload", data));
          return;
        }
        // 次数超限：文案要说清楚"明天恢复"，否则用户会以为永久受限
        if (data.error === "limit_exceeded") {
          toast.error(
            t("errors.limitReached", { limit: data.limit ?? limits.resourcesPerDay })
          );
          return;
        }
        // 流量配额超限：同上。服务端把字节数放在 limit 里
        if (data.error === "quota_exceeded") {
          toast.error(
            t("errors.quotaExceeded", {
              limit: formatBytes(data.limit ?? limits.uploadQuotaMb * MB),
            })
          );
          return;
        }
        const key =
          data.error === "file_too_large"
            ? "fileTooLarge"
            : data.error === "image_too_large"
              ? "imageTooLarge"
              : data.error === "unauthorized"
                ? "needLogin"
                : "unknown";
        toast.error(
          key === "fileTooLarge"
            ? t("errors.fileTooLarge", { max: limits.maxFileMb })
            : key === "imageTooLarge"
              ? t("errors.imageTooLarge", { max: limits.maxImageMb })
              : t(`errors.${key}`)
        );
        return;
      }

      toast.success(t("uploadSuccess"));
      setOpen(false);
      reset();
      router.refresh();
      if (data.id) router.push(`/resources/${data.id}`);
    } catch {
      toast.error(common("error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="group">
          <FileUp className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5" />
          {t("upload")}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <div ref={scope}>
          <DialogHeader>
            <DialogTitle>{t("uploadTitle")}</DialogTitle>
            <DialogDescription>{t("uploadDescription")}</DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-4">
            <ResourceFields
              idPrefix="res-upload"
              title={title}
              description={description}
              imagePreview={imagePreview}
              onTitleChange={setTitle}
              onDescriptionChange={setDescription}
              onImageChange={setImagePreview}
            />

            {/* 附件 */}
            <div className="flex flex-col gap-2">
              <Label>{t("fields.file")}</Label>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed px-3 py-2.5 text-sm transition-colors hover:border-primary/40">
                <span className="flex min-w-0 items-center gap-2">
                  <FileUp className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    {file ? file.name : t("fields.pickFile")}
                  </span>
                </span>
                {file && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatBytes(file.size)}
                  </span>
                )}
                <input type="file" className="hidden" onChange={onPickFile} />
              </label>
              <p className="text-xs text-muted-foreground">
                {t("fields.fileHint", { max: limits.maxFileMb })}
              </p>
              {/*
                投影预览是在浏览器里现渲染的（three.js + WebGL），
                大投影要好几秒 —— 没有提示的话用户会以为卡死了。
              */}
              {previewStage && (
                <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  {t(`previewStage${
                    previewStage === "parsing"
                      ? "Parsing"
                      : previewStage === "merging"
                        ? "Merging"
                        : previewStage === "loading-pack"
                          ? "Pack"
                          : "Rendering"
                  }`)}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              {common("cancel")}
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {common("submitting")}
                </>
              ) : (
                t("upload")
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
