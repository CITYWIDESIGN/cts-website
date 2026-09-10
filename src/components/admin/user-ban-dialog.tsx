"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Gavel, Loader2, ShieldOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adminBanUser, adminUnbanUser } from "@/lib/actions/admin";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** 与 server/ban.ts 的 BAN_PRESETS 对应 */
const PRESETS = ["1d", "3d", "7d", "30d", "forever"] as const;

/**
 * 封禁 / 解封。
 *
 * - 未封禁：显示"封禁"按钮 → 弹窗选时长（含永久）+ 填理由
 * - 已封禁：显示封禁状态 + "解封"按钮
 *
 * 时长只做到期时间，不落"是否生效"的布尔值：到期自动失效，不需要定时任务。
 */
export function UserBanDialog({
  userId,
  name,
  banned,
  bannedUntil,
  banReason,
  /** button：资料页用；icon：表格行里用 */
  variant = "button",
  className,
}: {
  userId: string;
  name: string | null;
  banned: boolean;
  /** ISO 字符串；null 表示永久 */
  bannedUntil: string | null;
  banReason?: string | null;
  variant?: "button" | "icon";
  className?: string;
}) {
  const t = useTranslations("admin.ban");
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [preset, setPreset] = React.useState<string>("7d");
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function submit() {
    setPending(true);
    const res = await adminBanUser(userId, preset, reason);
    setPending(false);

    if (!res.ok) {
      toast.error(
        res.error === "CANNOT_BAN_ADMIN"
          ? t("cannotBanAdmin")
          : res.error === "CANNOT_BAN_SELF"
            ? t("cannotBanSelf")
            : t("failed")
      );
      return;
    }

    setOpen(false);
    setReason("");
    toast.success(t("bannedToast", { name: name ?? t("thisUser") }));
    router.refresh();
  }

  async function unban() {
    setPending(true);
    const res = await adminUnbanUser(userId);
    setPending(false);
    if (!res.ok) {
      toast.error(t("failed"));
      return;
    }
    toast.success(t("unbannedToast", { name: name ?? t("thisUser") }));
    router.refresh();
  }

  if (banned) {
    return (
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        <span
          className="inline-flex items-center gap-1.5 rounded-lg bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive"
          title={banReason ?? undefined}
        >
          <ShieldOff className="size-3.5" />
          {bannedUntil
            ? t("bannedUntil", { date: formatDateTime(bannedUntil) })
            : t("bannedForever")}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={unban}
          disabled={pending}
          className="h-7 gap-1.5 px-2 text-xs"
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ShieldCheck className="size-3.5" />
          )}
          {t("unban")}
        </Button>
      </div>
    );
  }

  const trigger =
    variant === "icon" ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("action")}
        title={t("action")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-destructive",
          className
        )}
      >
        <Gavel className="size-3.5" />
        {t("action")}
      </button>
    ) : (
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className={cn("group", className)}
      >
        <Gavel className="size-4" />
        {t("action")}
      </Button>
    );

  return (
    <>
      {trigger}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("title", { name: name ?? t("thisUser") })}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>{t("duration")}</Label>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPreset(p)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-sm transition-colors duration-200 hover:bg-accent",
                      preset === p && "border-primary bg-accent text-foreground"
                    )}
                  >
                    {t(`presets.${p}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor={`ban-reason-${userId}`}>{t("reason")}</Label>
              <Textarea
                id={`ban-reason-${userId}`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("reasonPlaceholder")}
                rows={3}
                maxLength={300}
              />
              <p className="text-right text-xs text-muted-foreground">
                {reason.length}/300
              </p>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={submit} disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("submitting")}
                </>
              ) : (
                <>
                  <Gavel className="size-4" />
                  {t("submit")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
