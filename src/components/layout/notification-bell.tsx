"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import {
  Bell,
  CheckCheck,
  Flag,
  Heart,
  MessageSquare,
  X,
} from "lucide-react";
import { EASE_OUT } from "@/components/motion/transitions";
import {
  deleteNotificationAction,
  markAllReadAction,
} from "@/lib/actions/notify";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export type NotificationItem = {
  id: string;
  type: "REPORT_RESOLVED" | "LIKE" | "COMMENT_LIKE" | "REPLY";
  actorName: string | null;
  resourceId: string | null;
  resolution: string | null;
  readAt: string | null;
  createdAt: string;
};

/**
 * 消息铃铛。
 *
 * 只展示四类：举报进度、资源被点赞、评论被点赞、评论被回复。
 * 自己对自己的操作不会产生消息（在服务端 notify() 里过滤）。
 *
 * 动画：面板淡入 + 轻微位移；条目逐个错开入场。
 * 未读用主色小圆点标记，打开面板后点"全部已读"或逐条关闭。
 */
export function NotificationBell({
  items,
  unread,
  authed,
}: {
  items: NotificationItem[];
  unread: number;
  authed: boolean;
}) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const reduce = useReducedMotion();

  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  // 点击外部 / Esc 关闭
  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!authed) return null;

  async function markAll() {
    setBusy(true);
    await markAllReadAction();
    setBusy(false);
    router.refresh();
  }

  async function dismiss(id: string) {
    await deleteNotificationAction(id);
    router.refresh();
  }

  function iconFor(type: NotificationItem["type"]) {
    switch (type) {
      case "REPORT_RESOLVED":
        return Flag;
      case "LIKE":
        return Heart;
      case "COMMENT_LIKE":
        return Heart;
      case "REPLY":
        return MessageSquare;
    }
  }

  function textFor(n: NotificationItem) {
    switch (n.type) {
      case "REPORT_RESOLVED":
        return {
          title:
            n.resolution === "removed"
              ? t("reportResolvedRemoved")
              : t("reportResolvedDismissed"),
          body: t("reportResolvedBody"),
        };
      case "LIKE":
        return {
          title: t("likedResource", { name: n.actorName ?? t("someone") }),
          body: null,
        };
      case "COMMENT_LIKE":
        return {
          title: t("likedComment", { name: n.actorName ?? t("someone") }),
          body: null,
        };
      case "REPLY":
        return {
          title: t("replied", { name: n.actorName ?? t("someone") }),
          body: null,
        };
    }
  }

  return (
    /*
      注意：这个根节点**故意不是 `relative`**。
      铃铛在图标组里靠左，如果弹窗相对铃铛对齐（right-0），弹窗右边缘就停在
      铃铛处，看起来"没靠右"。这里让弹窗的包含块上浮到 site-header 里那个
      `relative` 的容器，于是 `right-4 sm:right-6` 正好贴住 header 的右内边距，
      和右侧图标对齐。改动 header 结构时要留意这一点。
    */
    <div ref={rootRef}>
      <button
        type="button"
        aria-label={t("title")}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          // 打开即视为已读，避免红点长期挂着
          if (!open && unread > 0) {
            void markAll();
          }
        }}
        className={cn(
          "relative inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
          open && "bg-accent text-foreground"
        )}
      >
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-destructive-foreground">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label={t("title")}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="absolute right-4 top-full z-50 mt-2 w-80 origin-top-right overflow-hidden rounded-xl border bg-popover shadow-lg sm:right-6"
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="text-sm font-semibold">{t("title")}</span>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={markAll}
                  disabled={busy}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  <CheckCheck className="size-3.5" />
                  {t("markAllRead")}
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <Bell className="size-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{t("empty")}</p>
              </div>
            ) : (
              <ul className="max-h-96 overflow-y-auto">
                {items.map((n, i) => {
                  const Icon = iconFor(n.type);
                  const { title, body } = textFor(n);
                  const href = n.resourceId ? `/resources/${n.resourceId}` : null;
                  const unreadItem = !n.readAt;

                  const inner = (
                    <>
                      <span
                        className={cn(
                          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
                          n.type === "REPORT_RESOLVED"
                            ? "bg-warning/15 text-warning"
                            : "bg-primary/12 text-primary"
                        )}
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm leading-snug">
                          {title}
                        </span>
                        {body && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {body}
                          </span>
                        )}
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          {formatDateTime(n.createdAt)}
                        </span>
                      </span>
                      {unreadItem && (
                        <span
                          aria-hidden
                          className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                        />
                      )}
                    </>
                  );

                  return (
                    <motion.li
                      key={n.id}
                      initial={reduce ? false : { opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        duration: 0.24,
                        ease: EASE_OUT,
                        delay: reduce ? 0 : Math.min(i, 8) * 0.03,
                      }}
                      className="group/note relative border-b last:border-b-0"
                    >
                      {href ? (
                        <Link
                          href={href}
                          onClick={() => setOpen(false)}
                          className="flex gap-3 px-4 py-3 pr-9 transition-colors duration-200 hover:bg-accent/50"
                        >
                          {inner}
                        </Link>
                      ) : (
                        <div className="flex gap-3 px-4 py-3 pr-9">{inner}</div>
                      )}

                      <button
                        type="button"
                        onClick={() => dismiss(n.id)}
                        aria-label={t("dismiss")}
                        className="absolute right-2 top-3 text-muted-foreground opacity-0 transition-opacity duration-200 hover:text-destructive group-hover/note:opacity-100"
                      >
                        <X className="size-3.5" />
                      </button>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
