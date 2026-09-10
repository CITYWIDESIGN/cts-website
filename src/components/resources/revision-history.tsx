"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { ChevronDown, History, ShieldCheck, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EASE_OUT } from "@/components/motion/transitions";
import { formatDateTime } from "@/lib/format";

export type RevisionItem = {
  id: string;
  version: number;
  /** 字段级差异：[{ field, before, after }] */
  changes: Array<{ field: string; before: string | null; after: string | null }>;
  note: string | null;
  editorName: string | null;
  createdAt: string;
};

/**
 * 修改记录（类似 git log）。
 *
 * 默认折叠，展开后按版本倒序列出每次改动：谁、什么时候、改了哪个字段。
 * 长文本（介绍）只显示前后摘要，避免把整段文字铺满页面。
 */
export function RevisionHistory({ revisions }: { revisions: RevisionItem[] }) {
  const t = useTranslations("resources");
  const reduce = useReducedMotion();
  const [open, setOpen] = React.useState(false);

  if (revisions.length === 0) return null;

  return (
    <div className="rounded-xl border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors duration-200 hover:bg-accent/40"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <History className="size-4 text-muted-foreground" />
          {t("historyTitle")}
          <Badge variant="secondary">{revisions.length}</Badge>
        </span>
        <motion.span
          animate={reduce ? undefined : { rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
          className="text-muted-foreground"
        >
          <ChevronDown className="size-4" />
        </motion.span>
      </button>

      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.3, ease: EASE_OUT }}
        className="overflow-hidden"
      >
        <ul className="flex flex-col gap-3 border-t p-5">
          {revisions.map((rev) => (
            <li key={rev.id} className="flex gap-3">
              {/* 时间轴竖线与节点 */}
              <span className="relative flex w-4 shrink-0 justify-center">
                <span className="absolute inset-y-0 w-px bg-border" />
                <span className="relative mt-1.5 size-2 rounded-full bg-primary" />
              </span>

              <div className="min-w-0 flex-1 pb-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">
                    v{rev.version}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    {rev.note === "admin" ? (
                      <ShieldCheck className="size-3.5 text-primary" />
                    ) : (
                      <User className="size-3.5" />
                    )}
                    {rev.editorName ?? "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(rev.createdAt)}
                  </span>
                </div>

                <ul className="mt-1.5 flex flex-col gap-1">
                  {rev.changes.map((c, i) => (
                    <li
                      key={`${c.field}-${i}`}
                      className="text-xs text-muted-foreground"
                    >
                      <span className="font-mono text-foreground/80">
                        {t(`historyFields.${c.field}`)}
                      </span>
                      {c.field === "image" ? (
                        <span className="ml-1.5">
                          {c.before ? t("historyImagePresent") : t("historyImageAbsent")}
                          {" → "}
                          {c.after ? t("historyImagePresent") : t("historyImageAbsent")}
                        </span>
                      ) : (
                        <>
                          <span className="ml-1.5 line-through opacity-70">
                            {truncate(c.before)}
                          </span>
                          <span className="mx-1">→</span>
                          <span>{truncate(c.after)}</span>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      </motion.div>
    </div>
  );
}

/** 长文本只显示首尾，中间省略，避免把页面撑爆 */
function truncate(value: string | null, max = 60): string {
  if (!value) return "—";
  const oneLine = value.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}
