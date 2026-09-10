"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { History, Loader2, Pencil, Trash2, FileUp } from "lucide-react";
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
} from "@/components/ui/dialog";
import {
  deleteResourceAction,
  updateResourceAction,
} from "@/lib/actions/resource";
import { ResourceFields } from "./resource-fields";
import { formatBytes } from "@/lib/format";
import { MB } from "@/lib/validators/limits";
import { useLimits } from "@/components/limits-provider";

/**
 * 资源编辑 / 删除按钮。
 *
 * 权限（服务端同样会校验，前端隐藏只是减少误操作）：
 * 上传者本人或管理员。对齐 git 的直觉——作者可改，维护者也能改。
 * 每次保存都会在服务端写一条修改记录。
 */
export function ResourceEditActions({
  id,
  title,
  description,
  hasImage,
  canDelete = true,
}: {
  id: string;
  title: string;
  description: string;
  /** 有没有封面。**不传 data URL** —— 那玩意儿一张最大 1.4MB */
  hasImage: boolean;
  /** 管理员在后台用同一组件；上传者前台也可用 */
  canDelete?: boolean;
}) {
  const t = useTranslations("resources");
  const common = useTranslations("common");
  const router = useRouter();
  const limits = useLimits();

  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const [form, setForm] = React.useState({ title, description });

  /**
   * 预览用的地址：已有封面就指向图片接口（不是 data URL），
   * 新选的图才是本地 data URL。
   */
  const existingImageUrl = hasImage ? `/api/resources/${id}/image` : null;
  const [image, setImage] = React.useState<string | null>(existingImageUrl);
  /**
   * 封面是否被改过。
   * 只有改过才把它放进 FormData —— 否则每次保存都要把整张图
   * 从浏览器传到服务端再存回去，白白多传 1MB+。
   */
  const [imageDirty, setImageDirty] = React.useState(false);

  /** 选中的新附件；为 null 表示不动原文件 */
  const [newFile, setNewFile] = React.useState<File | null>(null);

  function onImageChange(v: string | null) {
    setImage(v);
    setImageDirty(true);
  }

  function openEdit() {
    setForm({ title, description });
    // 回到"未改动"状态，预览指向服务端的图而不是把 data URL 拉进内存
    setImage(existingImageUrl);
    setImageDirty(false);
    setNewFile(null);
    setEditOpen(true);
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > limits.maxFileMb * MB) {
      toast.error(t("errors.fileTooLarge", { max: limits.maxFileMb }));
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
    // 用 FormData：替换文件时可直接带二进制
    const body = new FormData();
    body.set("title", form.title);
    body.set("description", form.description);
    // 只有封面真的被改过才带上：空字符串 = 移除，data URL = 换成新图。
    // 没改就不带这个字段，服务端据此"原样不动"。
    if (imageDirty) body.set("image", image ?? "");
    if (newFile) body.set("file", newFile);

    const res = await updateResourceAction(id, body);
    setPending(false);

    if (res.ok) {
      toast.success(
        res.fileReplaced ? t("editSavedWithFile") : t("editSaved")
      );
      setEditOpen(false);
      setNewFile(null);
      router.refresh();
    } else {
      toast.error(
        res.error === "forbidden"
          ? t("errors.forbidden")
          : res.error === "fileTooLarge"
            ? t("errors.fileTooLarge", { max: limits.maxFileMb })
            : res.error === "imageTooLarge"
              ? t("errors.imageTooLarge", { max: limits.maxImageMb })
              : res.error === "imageType"
                ? t("errors.imageType")
                : common("error")
      );
    }
  }

  async function remove() {
    setPending(true);
    const res = await deleteResourceAction(id);
    setPending(false);
    if (res.ok) {
      toast.success(t("deleteSuccess"));
      setDeleteOpen(false);
      router.push("/resources");
    } else {
      toast.error(
        res.error === "FORBIDDEN" ? t("errors.forbidden") : common("error")
      );
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={openEdit} className="group">
        <Pencil className="size-4 transition-transform duration-300 group-hover:-rotate-12" />
        {common("edit")}
      </Button>

      {canDelete && (
        <Button
          variant="outline"
          onClick={() => setDeleteOpen(true)}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4" />
          {common("delete")}
        </Button>
      )}

      {/* 编辑 */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("editTitle")}</DialogTitle>
            <DialogDescription>{t("editDescription")}</DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            <ResourceFields
              idPrefix={`res-edit-${id}`}
              title={form.title}
              description={form.description}
              imagePreview={image}
              onTitleChange={(v) => setForm((f) => ({ ...f, title: v }))}
              onDescriptionChange={(v) =>
                setForm((f) => ({ ...f, description: v }))
              }
              onImageChange={onImageChange}
            />

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
                {t("fields.replaceFileHint", { max: limits.maxFileMb })}
              </p>
            </div>
          </div>

          {/* 提示会留记录 */}
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
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("deleteDescription", { title })}
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
