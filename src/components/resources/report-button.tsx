"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Flag, Loader2 } from "lucide-react";
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
import { createReportAction } from "@/lib/actions/social";
import { cn } from "@/lib/utils";

/** 与 server/report.ts 的 REPORT_REASONS 对应 */
const REASONS = [
  "spam",
  "harassment",
  "illegal",
  "malware",
  "copyright",
  "other",
] as const;

/**
 * 举报按钮 + 弹窗。
 *
 * 需要登录；必须选择举报原因（可选补充说明 ≤1000 字）。
 * 提交后进入后台待处理列表，由管理员决定是否删除内容 ——
 * 不做自动处置，避免误伤。
 */
export function ReportButton({
  targetType,
  targetId,
  /** 举报评论时传所属资源 id，便于 revalidate */
  resourceIdForRevalidate,
  authed,
  /** 是否已举报（待处理），已举报则显示为不可点 */
  reported = false,
  variant = "icon",
  className,
}: {
  targetType: "RESOURCE" | "COMMENT";
  targetId: string;
  resourceIdForRevalidate?: string;
  authed: boolean;
  reported?: boolean;
  /** icon：评论下方的图标按钮；button：资源页的普通按钮 */
  variant?: "icon" | "button";
  className?: string;
}) {
  const t = useTranslations("resources.report");
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState<string>("");
  const [detail, setDetail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  /**
   * 是否已举报：以 props 为事实来源，只用 useOptimistic 叠加
   * "刚刚提交成功"这一层，避免用 effect 同步 props → state。
   */
  const [done, markReported] = React.useOptimistic(reported, () => true);

  function openDialog() {
    if (!authed) {
      toast.error(t("needLogin"));
      router.push("/login");
      return;
    }
    if (done) {
      toast.info(t("alreadyReported"));
      return;
    }
    setReason("");
    setDetail("");
    setOpen(true);
  }

  async function submit() {
    if (!reason) {
      toast.error(t("reasonRequired"));
      return;
    }
    setSubmitting(true);
    const res = await createReportAction(
      targetType,
      targetId,
      reason,
      detail,
      resourceIdForRevalidate
    );
    setSubmitting(false);

    if (!res.ok) {
      toast.error(
        res.error === "ALREADY_REPORTED"
          ? t("alreadyReported")
          : res.error === "SELF_REPORT"
            ? t("selfReport")
            : t("failed")
      );
      return;
    }

    React.startTransition(() => markReported(true));
    setOpen(false);
    toast.success(t("submitted"));
    router.refresh();
  }

  const trigger =
    variant === "icon" ? (
      <button
        type="button"
        onClick={openDialog}
        aria-label={t("action")}
        title={done ? t("alreadyReported") : t("action")}
        className={cn(
          "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors duration-200",
          done
            ? "text-muted-foreground/60"
            : "text-muted-foreground hover:bg-accent hover:text-destructive",
          className
        )}
      >
        <Flag className={cn("size-3.5", done && "fill-current")} />
        {done ? t("reported") : t("action")}
      </button>
    ) : (
      <Button
        variant="outline"
        onClick={openDialog}
        className={cn("group", className)}
      >
        <Flag className={cn("size-4", done && "fill-current")} />
        {done ? t("reported") : t("action")}
      </Button>
    );

  return (
    <>
      {trigger}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>{t("reason")}</Label>
              <div className="flex flex-col gap-1.5">
                {REASONS.map((r) => (
                  <label
                    key={r}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors duration-200 hover:bg-accent",
                      reason === r && "border-primary bg-accent"
                    )}
                  >
                    <input
                      type="radio"
                      name={`report-reason-${targetId}`}
                      value={r}
                      checked={reason === r}
                      onChange={() => setReason(r)}
                      className="size-3.5 accent-[var(--primary)]"
                    />
                    {t(`reasons.${r}`)}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor={`report-detail-${targetId}`}>
                {t("detail")}
              </Label>
              <Textarea
                id={`report-detail-${targetId}`}
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder={t("detailPlaceholder")}
                rows={3}
                maxLength={1000}
              />
              <p className="text-right text-xs text-muted-foreground">
                {detail.length}/1000
              </p>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={submit}
              disabled={submitting || !reason}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("submitting")}
                </>
              ) : (
                <>
                  <Flag className="size-4" />
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
