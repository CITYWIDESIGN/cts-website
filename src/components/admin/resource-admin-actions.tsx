"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { History, Loader2, Pencil, Trash2, FileUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAX_FILE_BYTES, formatBytes } from "@/components/resources/resource-fields";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteResourceAction,
  updateResourceAction,
} from "@/lib/actions/resource";

/**
 * 后台资源管理操作：编辑元信息 + 删除。
 *
 * 用的是与前台完全相同的 action（updateResourceAction / deleteResourceAction），
 * 权限判定在服务端（上传者本人或管理员）。这里不另写一套，
 * 避免两处在权限或"是否留修改记录"上出现分歧。
 */
export function ResourceAdminActions({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description: string;
}) {
  const t = useTranslations("resources");
  const ta = useTranslations("admin.resources");
  const common = useTranslations("common");
  const router = useRouter();

  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [form, setForm] = React.useState({ title, description });
  const [newFile, setNewFile] = React.useState<File | null>(null);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > MAX_FILE_BYTES) {
      toast.error(t("errors.fileTooLarge", { max: 5 }));
      e.target.value = "";
      return;
    }
    setNewFile(f);
  }

  async function save() {
    if (!form.title.trim()) {
      toast.error(t("errors.titleRequired"));
      return;
    }
    if (!form.description.trim()) {
      toast.error(t("errors.descriptionRequired"));
      return;
    }
    setPending(true);
    const body = new FormData();
    body.set("title", form.title);
    body.set("description", form.description);
    if (newFile) body.set("file", newFile);

    const res = await updateResourceAction(id, body);
    setPending(false);
    if (res.ok) {
      toast.success(res.fileReplaced ? t("editSavedWithFile") : ta("updated"));
      setEditOpen(false);
      setNewFile(null);
      router.refresh();
    } else {
      toast.error(common("error"));
    }
  }

  async function remove() {
    setPending(true);
    const res = await deleteResourceAction(id);
    setPending(false);
    if (res.ok) {
      toast.success(ta("deleted"));
      setDeleteOpen(false);
      router.refresh();
    } else {
      toast.error(common("error"));
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="group"
        onClick={() => {
          setForm({ title, description });
          setEditOpen(true);
        }}
      >
        <Pencil className="size-3.5 transition-transform duration-300 group-hover:-rotate-12" />
        {common("edit")}
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 className="size-3.5" />
        {common("delete")}
      </Button>

      {/* 编辑 */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{ta("editTitle")}</DialogTitle>
            <DialogDescription>{ta("editDescription")}</DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`res-title-${id}`}>{ta("fields.title")}</Label>
              <Input
                id={`res-title-${id}`}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                maxLength={120}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`res-desc-${id}`}>{ta("fields.description")}</Label>
              <Textarea
                id={`res-desc-${id}`}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={5}
                maxLength={5000}
              />
            </div>
          </div>

          {/* 替换附件（可选） */}
          <div className="mt-4 flex flex-col gap-2">
            <Label>{t("fields.file")}</Label>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed px-3 py-2.5 text-sm transition-colors hover:border-primary/40">
              <span className="flex min-w-0 items-center gap-2">
                <FileUp className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">
                  {newFile ? newFile.name : t("fields.keepFile")}
                </span>
              </span>
              {newFile && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatBytes(newFile.size)}
                </span>
              )}
              <input type="file" className="hidden" onChange={onPickFile} />
            </label>
            <p className="text-xs text-muted-foreground">
              {t("fields.replaceFileHint", { max: 5 })}
            </p>
          </div>

          <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
            <History className="size-3.5" />
            {t("revisionNotice")}
          </p>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={pending}
            >
              {common("cancel")}
            </Button>
            <Button onClick={save} disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {common("saving")}
                </>
              ) : (
                common("save")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{ta("deleteTitle")}</DialogTitle>
            <DialogDescription>
              {ta("deleteDescription", { title })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={pending}
            >
              {common("cancel")}
            </Button>
            <Button variant="destructive" onClick={remove} disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {common("saving")}
                </>
              ) : (
                common("delete")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
