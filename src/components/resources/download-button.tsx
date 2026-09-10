"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useBanNotice } from "@/components/ban-notice";
import { cn } from "@/lib/utils";

/**
 * 下载按钮。
 *
 * 为什么不用 `<a href>` 直链：被封禁的用户点下去会**整页跳转**到那段 JSON
 * 错误（403 + {error:"banned"}），很难看也很难懂。这里改成 fetch：
 *   - 成功 → 用 blob URL 触发下载（上限 5MB，内存可接受）
 *   - 失败 → 留在原页，用 toast 说明原因（封禁到什么时候 / 配额用完）
 *
 * 未登录访客照常能下载，只是额度按 IP 算。
 */
export function DownloadButton({
  resourceId,
  className,
  variant = "compact",
}: {
  resourceId: string;
  className?: string;
  /** compact：列表卡片里的按钮；button：详情页的按钮 */
  variant?: "compact" | "button";
}) {
  const t = useTranslations("resources");
  const social = useTranslations("resources.social");
  const router = useRouter();
  const banNotice = useBanNotice();
  const [pending, setPending] = React.useState(false);

  async function download() {
    setPending(true);
    try {
      const res = await fetch(`/api/resources/${resourceId}/download`);

      if (!res.ok) {
        let data: {
          error?: string;
          bannedUntil?: string | null;
          banReason?: string | null;
        } = {};
        try {
          data = await res.json();
        } catch {
          /* 非 JSON 响应，走兜底文案 */
        }

        if (data.error === "banned") {
          toast.error(banNotice("download", data));
          return;
        }
        if (data.error === "quota_exceeded") {
          toast.error(t("errors.quotaExceeded", { limit: 1 }));
          return;
        }
        toast.error(t("errors.unknown"));
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileNameFrom(res.headers.get("Content-Disposition")) ?? "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      // 下载数变了，刷新一下列表/详情的计数
      router.refresh();
    } catch {
      toast.error(social("actionFailed"));
    } finally {
      setPending(false);
    }
  }

  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={download}
        disabled={pending}
        className={cn(
          "group/dl inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all duration-200 hover:bg-primary/90 active:scale-[0.97] disabled:opacity-60",
          className
        )}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4 transition-transform duration-300 group-hover/dl:translate-y-0.5" />
        )}
        {t("download")}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={pending}
      className={cn(
        "group/dl inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-all duration-200 hover:bg-primary/90 active:scale-[0.96] disabled:opacity-60",
        className
      )}
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Download className="size-3.5 transition-transform duration-300 group-hover/dl:translate-y-0.5" />
      )}
      {t("download")}
    </button>
  );
}

/**
 * 从 Content-Disposition 里取文件名。
 * 优先 RFC 5987 的 filename*（含 UTF-8 中文名），其次 ASCII 的 filename。
 */
function fileNameFrom(header: string | null): string | null {
  if (!header) return null;
  const star = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      /* 解码失败就退回 ASCII 分支 */
    }
  }
  const plain = header.match(/filename="([^"]+)"/i);
  return plain?.[1] ?? null;
}
