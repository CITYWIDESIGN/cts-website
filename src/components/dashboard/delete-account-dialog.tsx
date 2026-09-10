"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2, Trash2, UserX } from "lucide-react";
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
import { deleteOwnAccountAction } from "@/lib/actions/auth";
import { messageFor } from "@/components/auth/error-messages";

/**
 * 个人中心的「危险操作」区：注销自己的账号。
 *
 * 因为不可逆，确认弹窗要求**输入账号名 + 当前密码**，并且把"会发生什么"
 * 逐条列清楚 —— 尤其要说明内容**会保留**（很多人以为注销会把帖子一起删掉，
 * 不说清楚反而会引发"为什么我的资源还在"的误会）。
 */
export function DeleteAccountDialog({
  accountName,
  hasPassword,
}: {
  /** 需要用户照着输入的账号名 */
  accountName: string;
  /** 纯 Microsoft 账号没有密码，就不用显示密码框 */
  hasPassword: boolean;
}) {
  const t = useTranslations("dashboard.dangerZone");
  const ta = useTranslations("auth");
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const ready =
    name.trim().toLowerCase() === accountName.toLowerCase() &&
    (!hasPassword || password.length > 0);

  async function submit() {
    if (pending || !ready) return;
    setPending(true);
    const res = await deleteOwnAccountAction({
      confirmName: name,
      password,
    });
    setPending(false);

    if (!res.ok) {
      toast.error(
        res.error === "LAST_ADMIN"
          ? t("lastAdmin")
          : res.error === "CONFIRM_MISMATCH"
            ? t("confirmMismatch")
            : messageFor(ta, res.error)
      );
      return;
    }

    toast.success(t("done"));
    router.push(res.redirectTo ?? "/");
    router.refresh();
  }

  const consequences = [t("consequence1"), t("consequence2"), t("consequence3")];

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        <UserX className="size-4" />
        {t("action")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" />
              {t("title")}
            </DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-4">
            {/* 逐条说明后果 —— 比一句"确定吗"有用得多 */}
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
              <Label htmlFor="confirm-account">
                {t("confirmName", { name: accountName })}
              </Label>
              <Input
                id="confirm-account"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={accountName}
                autoComplete="off"
              />
            </div>

            {hasPassword && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirm-password">{ta("password")}</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
            )}
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
