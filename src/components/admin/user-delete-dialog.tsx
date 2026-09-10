"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adminPurgeUser } from "@/lib/actions/admin";

/**
 * 管理员删除用户（彻底删除，含全部内容）。
 *
 * 和用户自己「注销」是两回事：注销保留内容，这个连资源、评论、问卷提交
 * 一起清掉，用来处理垃圾号。所以：
 *   - 要求**照着输入玩家名**才能点确认（不可逆操作，值得多打几个字）
 *   - 逐条列出会被删掉的东西，避免误删
 */
export function UserDeleteDialog({
  userId,
  name,
  variant = "icon",
}: {
  userId: string;
  /** 需要用户照着输入的名字 */
  name: string;
  variant?: "icon" | "button";
}) {
  const t = useTranslations("admin.deleteUser");
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const ready = typed.trim().toLowerCase() === name.trim().toLowerCase();

  async function submit() {
    if (pending || !ready) return;
    setPending(true);
    const res = await adminPurgeUser(userId);
    setPending(false);

    if (!res.ok) {
      toast.error(
        res.error === "cannot_delete_self"
          ? t("cannotDeleteSelf")
          : res.error === "cannot_delete_admin"
            ? t("cannotDeleteAdmin")
            : res.error === "last_admin"
              ? t("lastAdmin")
              : t("failed")
      );
      return;
    }

    setOpen(false);
    setTyped("");
    toast.success(t("done", { name }));
    router.refresh();
  }

  const consequences = [
    t("consequence1"),
    t("consequence2"),
    t("consequence3"),
    t("consequence4"),
  ];

  const trigger =
    variant === "icon" ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("action")}
        title={t("action")}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors duration-200 hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="size-3.5" />
        {t("action")}
      </button>
    ) : (
      <Button variant="destructive" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" />
        {t("action")}
      </Button>
    );

  return (
    <>
      {trigger}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" />
              {t("title", { name })}
            </DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-4">
            <ul className="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5">
              {consequences.map((line) => (
                <li
                  key={line}
                  className="flex items-start gap-2 text-xs leading-relaxed"
                >
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-destructive" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-2">
              <Label htmlFor={`confirm-delete-${userId}`}>
                {t("confirmName", { name })}
              </Label>
              <Input
                id={`confirm-delete-${userId}`}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={name}
                autoComplete="off"
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={submit}
              disabled={pending || !ready}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {t("submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
