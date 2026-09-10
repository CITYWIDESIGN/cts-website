"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resolveReportAction } from "@/lib/actions/social";

/**
 * 后台：处理举报。
 *
 * 两个动作，含义明确：
 *   - 忽略：内容没问题，标记为已处理（resolution=dismissed）
 *   - 删除内容：删除被举报的资源/评论，并标记为已处理（resolution=removed）
 *
 * 不做自动处置 —— 是否删除始终由管理员点。
 */
export function ReportActions({
  reportId,
  targetType,
  targetId,
  resourceIdForRevalidate,
  disabled,
}: {
  reportId: string;
  targetType: "RESOURCE" | "COMMENT";
  targetId: string;
  resourceIdForRevalidate?: string;
  /** 目标已被删除时只允许"忽略" */
  disabled?: boolean;
}) {
  const t = useTranslations("admin.reports");
  const common = useTranslations("common");
  const router = useRouter();
  const [pending, setPending] = React.useState<"dismissed" | "removed" | null>(
    null
  );

  async function run(resolution: "dismissed" | "removed") {
    if (
      resolution === "removed" &&
      !window.confirm(t("confirmRemove"))
    ) {
      return;
    }
    setPending(resolution);
    const res = await resolveReportAction(
      reportId,
      resolution,
      { type: targetType, id: targetId },
      resourceIdForRevalidate
    );
    setPending(null);

    if (!res.ok) {
      toast.error(common("error"));
      return;
    }
    toast.success(resolution === "removed" ? t("removed") : t("dismissed"));
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => run("dismissed")}
        disabled={pending !== null}
        className="group"
      >
        {pending === "dismissed" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Check className="size-3.5 transition-transform duration-300 group-hover:scale-110" />
        )}
        {t("dismiss")}
      </Button>

      {!disabled && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => run("removed")}
          disabled={pending !== null}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          {pending === "removed" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
          {t("removeContent")}
        </Button>
      )}
    </div>
  );
}
