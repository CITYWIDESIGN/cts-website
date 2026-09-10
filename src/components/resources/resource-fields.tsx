"use client";

import * as React from "react";
import { ImagePlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ALLOWED_COVER_MIME, COVER_ACCEPT_ATTR } from "@/lib/image-types";

/** 与 src/server/resource.ts 保持一致 */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 1024 * 1024;

export function formatBytes(bytes: number) {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = bytes / Math.pow(1024, i);
  return `${i === 0 ? v : v.toFixed(1)} ${units[i]}`;
}

/**
 * 资源表单的公共字段（标题 / 介绍 / 封面）。
 * 上传达与编辑弹窗共用，避免两处各写一份导致校验与提示不一致。
 */
export function ResourceFields({
  idPrefix,
  title,
  description,
  imagePreview,
  onTitleChange,
  onDescriptionChange,
  onImageChange,
}: {
  idPrefix: string;
  title: string;
  description: string;
  imagePreview: string | null;
  onTitleChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onImageChange: (v: string | null) => void;
}) {
  const t = useTranslations("resources");

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    // 只收栅格图。SVG 能内嵌脚本，服务端也会拒（见 @/lib/image-types）
    if (!(ALLOWED_COVER_MIME as readonly string[]).includes(f.type)) {
      toast.error(t("errors.imageType"));
      e.target.value = "";
      return;
    }
    if (f.size > MAX_IMAGE_BYTES) {
      toast.error(t("errors.imageTooLarge", { max: 1 }));
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onImageChange(String(reader.result));
    reader.readAsDataURL(f);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-title`}>{t("fields.title")}</Label>
        <Input
          id={`${idPrefix}-title`}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder={t("fields.titlePlaceholder")}
          maxLength={120}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-desc`}>{t("fields.description")}</Label>
        <Textarea
          id={`${idPrefix}-desc`}
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder={t("fields.descriptionPlaceholder")}
          rows={4}
          maxLength={5000}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("fields.image")}</Label>
        {imagePreview ? (
          <div className="relative w-fit">
            {/* 预览是本地 data URL，不需要 next/image 优化 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagePreview}
              alt=""
              className="h-28 w-auto rounded-lg border object-cover"
            />
            <button
              type="button"
              onClick={() => onImageChange(null)}
              aria-label={t("fields.removeImage")}
              className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors hover:text-destructive"
            >
              <X className="size-3" />
            </button>
          </div>
        ) : (
          <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
            <ImagePlus className="size-4" />
            {t("fields.pickImage")}
            <input
              type="file"
              accept={COVER_ACCEPT_ATTR}
              className="hidden"
              onChange={onPickImage}
            />
          </label>
        )}
        <p className="text-xs text-muted-foreground">{t("fields.imageHint")}</p>
      </div>
    </div>
  );
}
