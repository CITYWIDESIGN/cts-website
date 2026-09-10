"use client";

import * as React from "react";
import { Copy, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function CopyAddress({
  address,
  className,
}: {
  address: string;
  className?: string;
}) {
  const t = useTranslations();
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      // 回退方案：使用临时 textarea
      const el = document.createElement("textarea");
      el.value = address;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }

    setCopied(true);
    toast.success(t("common.copied"));
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={t("home.status.copyAddress")}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
        className
      )}
    >
      {copied ? (
        <Check className="size-3.5 text-success" />
      ) : (
        <Copy className="size-3.5" />
      )}
      {address}
    </button>
  );
}
