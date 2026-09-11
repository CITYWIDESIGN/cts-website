"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ImagePlus, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  adminCreateSlide,
  adminDeleteSlide,
  adminReorderSlides,
  adminUpdateSlide,
} from "@/lib/actions/admin-carousel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LocalizedField, type LocalizedText } from "./content-fields";
import { COVER_ACCEPT_ATTR } from "@/lib/image-types";
import { MAX_CAROUSEL_IMAGE_BYTES } from "@/lib/validators/carousel";

export interface SlideRow {
  id: string;
  titleZh: string;
  titleEn: string | null;
  subtitleZh: string;
  subtitleEn: string | null;
  sortOrder: number;
  published: boolean;
  hasImage: boolean;
}

type Draft = {
  title: LocalizedText;
  subtitle: LocalizedText;
  published: boolean;
};

const emptyDraft = (): Draft => ({
  title: { zh: "", en: "" },
  subtitle: { zh: "", en: "" },
  published: true,
});

const MAX_MB = Math.round(MAX_CAROUSEL_IMAGE_BYTES / 1024 / 1024);

/**
 * 后台：首页轮播图管理。
 *
 * 图片随表单一起提交（Server Action 收 FormData）。编辑时**不选新文件就保留
 * 原图** —— 改个标题不该被迫重传几 MB 的图。
 *
 * 新图先在前端读成 data URL 做即时预览；真正上传的是原始 File，走 multipart，
 * 不做 base64（那会让体积膨胀 33%）。
 */
export function CarouselManager({ items }: { items: SlideRow[] }) {
  const t = useTranslations("admin.carousel");
  const common = useTranslations("common");
  const router = useRouter();
  const [pending, start] = useTransition();

  const [editing, setEditing] = React.useState<SlideRow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<SlideRow | null>(null);
  const [draft, setDraft] = React.useState<Draft>(emptyDraft);
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);

  const open = creating || editing !== null;

  function reset() {
    setCreating(false);
    setEditing(null);
    setFile(null);
    setPreview(null);
  }

  function openCreate() {
    setDraft(emptyDraft());
    setFile(null);
    setPreview(null);
    setCreating(true);
  }

  function openEdit(row: SlideRow) {
    setDraft({
      title: { zh: row.titleZh, en: row.titleEn ?? "" },
      subtitle: { zh: row.subtitleZh, en: row.subtitleEn ?? "" },
      published: row.published,
    });
    setFile(null);
    // 已有图直接指向接口，不把图片字节塞进 data URL
    setPreview(row.hasImage ? `/api/carousel/${row.id}/image` : null);
    setEditing(row);
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
    if (f.size > MAX_CAROUSEL_IMAGE_BYTES) {
      toast.error(t("errors.image_too_large", { max: MAX_MB }));
      e.target.value = "";
      return;
    }
    setFile(f);
    // 只用于预览；上传的仍是原始 File
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result));
    reader.readAsDataURL(f);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.title.zh.trim() || !draft.subtitle.zh.trim()) {
      return toast.error(t("errors.required"));
    }
    if (creating && !file) {
      return toast.error(t("errors.image_required"));
    }

    const body = new FormData();
    body.set("titleZh", draft.title.zh);
    body.set("titleEn", draft.title.en);
    body.set("subtitleZh", draft.subtitle.zh);
    body.set("subtitleEn", draft.subtitle.en);
    if (draft.published) body.set("published", "on");
    if (file) body.set("image", file);

    start(async () => {
      const res = editing
        ? await adminUpdateSlide(editing.id, body)
        : await adminCreateSlide(body);
      if (!res.ok) {
        const key = `errors.${res.error ?? "unknown"}`;
        toast.error(t.has(key) ? t(key, { max: MAX_MB }) : t("errors.unknown"));
        return;
      }
      toast.success(editing ? t("updated") : t("created"));
      reset();
      router.refresh();
    });
  }

  function remove() {
    if (!deleting) return;
    start(async () => {
      const res = await adminDeleteSlide(deleting.id);
      if (!res.ok) {
        toast.error(t(`errors.${res.error ?? "unknown"}`));
        return;
      }
      toast.success(t("deleted"));
      setDeleting(null);
      router.refresh();
    });
  }

  function move(index: number, delta: number) {
    const next = [...items];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    start(async () => {
      const res = await adminReorderSlides(next.map((s) => s.id));
      if (!res.ok) {
        toast.error(t("errors.unknown"));
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex">
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          {t("new")}
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((row, i) => (
            <li key={row.id}>
              <Card className="transition-colors duration-200 hover:bg-accent/40">
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                  {/* 缩略图：16:9 */}
                  <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg border bg-muted sm:w-40">
                    {row.hasImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/carousel/${row.id}/image`}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="flex size-full items-center justify-center text-xs text-muted-foreground">
                        {t("noImage")}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {!row.published && <Badge variant="warning">{t("draft")}</Badge>}
                      <span className="truncate font-medium">{row.titleZh}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {row.subtitleZh}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0 || pending}
                      aria-label={t("moveUp")}
                      className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === items.length - 1 || pending}
                      aria-label={t("moveDown")}
                      className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="group"
                      onClick={() => openEdit(row)}
                    >
                      <Pencil className="size-3.5 transition-transform duration-300 group-hover:-rotate-12" />
                      {common("edit")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDeleting(row)}
                    >
                      <Trash2 className="size-3.5" />
                      {common("delete")}
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* 新建 / 编辑 */}
      <Dialog open={open} onOpenChange={(v) => !v && reset()}>
        <DialogContent className="max-h-[88svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? t("editTitle") : t("createTitle")}</DialogTitle>
            <DialogDescription>{t("formHint", { max: MAX_MB })}</DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label>{t("fieldImage")}</Label>
              <label className="relative flex aspect-video cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed transition-colors hover:border-primary/40">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="" className="size-full object-cover" />
                ) : (
                  <span className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                    <ImagePlus className="size-5" />
                    {t("pickImage")}
                  </span>
                )}
                <input
                  type="file"
                  accept={COVER_ACCEPT_ATTR}
                  className="hidden"
                  onChange={onPickFile}
                />
              </label>
              <p className="text-xs text-muted-foreground">
                {editing ? t("imageKeepHint") : t("imageHint", { max: MAX_MB })}
              </p>
            </div>

            <LocalizedField
              idPrefix="slide-title"
              label={t("fieldTitle")}
              value={draft.title}
              onChange={(title) => setDraft((d) => ({ ...d, title }))}
              maxLength={120}
            />

            <LocalizedField
              idPrefix="slide-subtitle"
              label={t("fieldSubtitle")}
              value={draft.subtitle}
              onChange={(subtitle) => setDraft((d) => ({ ...d, subtitle }))}
              maxLength={300}
            />

            <Label
              htmlFor="slide-published"
              className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border px-3 py-2.5"
            >
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{t("fieldPublished")}</span>
                <span className="text-xs text-muted-foreground">
                  {t("fieldPublishedHint")}
                </span>
              </span>
              <Switch
                id="slide-published"
                checked={draft.published}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, published: v }))}
              />
            </Label>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={reset} disabled={pending}>
                {common("cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                {pending ? common("saving") : common("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <Dialog open={deleting !== null} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("deleteDescription", { title: deleting?.titleZh ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={pending}>
              {common("cancel")}
            </Button>
            <Button variant="destructive" onClick={remove} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {common("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
