"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  adminCreateAnnouncement,
  adminDeleteAnnouncement,
  adminUpdateAnnouncement,
} from "@/lib/actions/admin-announcements";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { LocalizedField } from "./content-fields";

export interface AnnouncementRow {
  id: string;
  titleZh: string;
  titleEn: string | null;
  bodyZh: string;
  bodyEn: string | null;
  tagZh: string | null;
  tagEn: string | null;
  published: boolean;
  publishedAt: string; // YYYY-MM-DD（服务端已经转好，避免时区在两端来回改）
}

type Draft = {
  title: { zh: string; en: string };
  body: { zh: string; en: string };
  tag: { zh: string; en: string };
  published: boolean;
  publishedAt: string;
};

function emptyDraft(): Draft {
  return {
    title: { zh: "", en: "" },
    body: { zh: "", en: "" },
    tag: { zh: "", en: "" },
    published: true,
    publishedAt: new Date().toISOString().slice(0, 10),
  };
}

function toDraft(row: AnnouncementRow): Draft {
  return {
    title: { zh: row.titleZh, en: row.titleEn ?? "" },
    body: { zh: row.bodyZh, en: row.bodyEn ?? "" },
    tag: { zh: row.tagZh ?? "", en: row.tagEn ?? "" },
    published: row.published,
    publishedAt: row.publishedAt,
  };
}

/**
 * 后台：公告管理。
 *
 * 公告直接显示在首页，所以表单里带「发布」开关 —— 草稿态可以先写好存着，
 * 不发到前台。列表按发布日期倒序，跟首页一致。
 */
export function AnnouncementManager({ items }: { items: AnnouncementRow[] }) {
  const t = useTranslations("admin.announcements");
  const common = useTranslations("common");
  const router = useRouter();
  const [pending, start] = useTransition();

  const [editing, setEditing] = React.useState<AnnouncementRow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<AnnouncementRow | null>(null);
  const [draft, setDraft] = React.useState<Draft>(emptyDraft);

  function openCreate() {
    setDraft(emptyDraft());
    setCreating(true);
  }

  function openEdit(row: AnnouncementRow) {
    setDraft(toDraft(row));
    setEditing(row);
  }

  function payload() {
    return {
      titleZh: draft.title.zh,
      titleEn: draft.title.en,
      bodyZh: draft.body.zh,
      bodyEn: draft.body.en,
      tagZh: draft.tag.zh,
      tagEn: draft.tag.en,
      published: draft.published,
      publishedAt: draft.publishedAt,
    };
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.title.zh.trim() || !draft.body.zh.trim()) {
      return toast.error(t("errors.required"));
    }
    start(async () => {
      const res = editing
        ? await adminUpdateAnnouncement(editing.id, payload())
        : await adminCreateAnnouncement(payload());
      if (!res.ok) {
        toast.error(t(`errors.${res.error ?? "unknown"}`));
        return;
      }
      toast.success(editing ? t("updated") : t("created"));
      setEditing(null);
      setCreating(false);
      router.refresh();
    });
  }

  function remove() {
    if (!deleting) return;
    start(async () => {
      const res = await adminDeleteAnnouncement(deleting.id);
      if (!res.ok) {
        toast.error(t(`errors.${res.error ?? "unknown"}`));
        return;
      }
      toast.success(t("deleted"));
      setDeleting(null);
      router.refresh();
    });
  }

  const open = creating || editing !== null;

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
        <ul className="flex flex-col gap-2">
          {items.map((row) => (
            <li key={row.id}>
              <Card className="transition-colors duration-200 hover:bg-accent/40">
                <div className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {row.tagZh && <Badge variant="secondary">{row.tagZh}</Badge>}
                      {!row.published && (
                        <Badge variant="warning">{t("draft")}</Badge>
                      )}
                      <span className="truncate font-medium">{row.titleZh}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {row.bodyZh}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("publishedOn", { date: row.publishedAt })}
                      {row.titleEn ? ` · ${t("hasEnglish")}` : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
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
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) {
            setCreating(false);
            setEditing(null);
          }
        }}
      >
        <DialogContent className="max-h-[88svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? t("editTitle") : t("createTitle")}</DialogTitle>
            <DialogDescription>{t("formHint")}</DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="flex flex-col gap-5">
            <LocalizedField
              idPrefix="ann-title"
              label={t("fieldTitle")}
              value={draft.title}
              onChange={(title) => setDraft((d) => ({ ...d, title }))}
              maxLength={200}
            />

            <LocalizedField
              idPrefix="ann-body"
              label={t("fieldBody")}
              value={draft.body}
              onChange={(body) => setDraft((d) => ({ ...d, body }))}
              multiline
              rows={4}
              maxLength={4000}
            />

            <LocalizedField
              idPrefix="ann-tag"
              label={t("fieldTag")}
              value={draft.tag}
              onChange={(tag) => setDraft((d) => ({ ...d, tag }))}
              maxLength={40}
              placeholder={t("fieldTagPlaceholder")}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="ann-date">{t("fieldDate")}</Label>
                <Input
                  id="ann-date"
                  type="date"
                  value={draft.publishedAt}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, publishedAt: e.target.value }))
                  }
                  required
                />
              </div>

              <Label
                htmlFor="ann-published"
                className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border px-3 py-2.5"
              >
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{t("fieldPublished")}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("fieldPublishedHint")}
                  </span>
                </span>
                <Switch
                  id="ann-published"
                  checked={draft.published}
                  onCheckedChange={(v) => setDraft((d) => ({ ...d, published: v }))}
                />
              </Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreating(false);
                  setEditing(null);
                }}
                disabled={pending}
              >
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
            <Button
              variant="outline"
              onClick={() => setDeleting(null)}
              disabled={pending}
            >
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
