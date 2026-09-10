"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { Check, Heart, Link2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { EASE_OUT } from "@/components/motion/transitions";
import { useBanNotice } from "@/components/ban-notice";
import { toggleLikeAction } from "@/lib/actions/social";
import { cn } from "@/lib/utils";

/**
 * 动态的互动栏（点赞 / 评论 / **分享**）。
 *
 * 参考 B 站与 QQ 空间的动态：一行图标 + 计数，点击即操作。
 *
 * 「分享」= **复制这条动态的链接**（不是转发成新动态）：
 * 优先用 Clipboard API；在非 HTTPS / 旧浏览器下回退到
 * 临时 textarea + execCommand("copy")，保证本地 http 调试也能用。
 *
 * 权限：点赞与评论需要登录；**复制链接不需要登录**（任何访客都能分享）。
 *
 * 状态策略：不把 props 复制到 state。数值始终来自服务端
 * （action 返回最新计数、之后 router.refresh() 再取一次），
 * 只用 useOptimistic 叠加一层"立刻可见"的乐观值。
 */
export function InteractionBar({
  resourceId,
  likeCount,
  commentCount,
  liked,
  authed,
  commentInputId,
  className,
}: {
  resourceId: string;
  likeCount: number;
  commentCount: number;
  liked: boolean;
  authed: boolean;
  /** 评论输入框的 id，点评论时聚焦过去 */
  commentInputId?: string;
  className?: string;
}) {
  const t = useTranslations("resources.social");
  const router = useRouter();
  const reduce = useReducedMotion();
  const banNotice = useBanNotice();

  const [optimistic, addOptimistic] = React.useOptimistic(
    { likeCount, liked },
    (
      state: { likeCount: number; liked: boolean },
      patch: { likeCount?: number; liked?: boolean }
    ) => ({ ...state, ...patch })
  );

  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  function requireLogin() {
    toast.error(t("needLogin"));
    router.push("/login");
  }

  async function onLike() {
    if (!authed) return requireLogin();
    if (busy) return;

    const nextLiked = !optimistic.liked;
    setBusy(true);
    React.startTransition(() => {
      addOptimistic({
        liked: nextLiked,
        likeCount: Math.max(0, optimistic.likeCount + (nextLiked ? 1 : -1)),
      });
    });

    const res = await toggleLikeAction(resourceId);
    setBusy(false);

    if (!res.ok) {
      toast.error(
        res.error === "BANNED" ? banNotice("social", res) : t("actionFailed")
      );
      return;
    }
    router.refresh();
  }

  /** 复制链接：Clipboard API 优先，失败回退到 execCommand */
  async function copyLink() {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/resources/${resourceId}`
        : "";

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        // http 环境 / 旧浏览器：临时 textarea + execCommand
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      toast.success(t("linkCopied"));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  function focusComment() {
    if (!authed) return requireLogin();
    if (!commentInputId) return;
    const el = document.getElementById(commentInputId);
    el?.focus();
    el?.scrollIntoView({ block: "center" });
  }

  const btn =
    "group/act inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground";

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {/* 点赞 */}
      <button
        type="button"
        onClick={onLike}
        aria-pressed={optimistic.liked}
        aria-label={t("like")}
        disabled={busy}
        className={cn(
          btn,
          optimistic.liked && "text-destructive hover:text-destructive"
        )}
      >
        <motion.span
          animate={
            reduce ? undefined : { scale: optimistic.liked ? [1, 1.35, 1] : 1 }
          }
          transition={{ duration: 0.32, ease: EASE_OUT }}
          className="flex items-center"
        >
          <Heart className={cn("size-4", optimistic.liked && "fill-current")} />
        </motion.span>
        <span className="tabular-nums">
          {optimistic.likeCount > 0 ? optimistic.likeCount : t("like")}
        </span>
      </button>

      {/* 评论 */}
      <button
        type="button"
        onClick={focusComment}
        aria-label={t("comment")}
        className={btn}
      >
        <MessageSquare className="size-4" />
        <span className="tabular-nums">
          {commentCount > 0 ? commentCount : t("comment")}
        </span>
      </button>

      {/* 分享：复制链接（不需要登录） */}
      <button
        type="button"
        onClick={copyLink}
        aria-label={t("share")}
        title={t("shareHint")}
        className={cn(btn, copied && "text-primary hover:text-primary")}
      >
        {copied ? (
          <Check className="size-4" />
        ) : (
          <Link2 className="size-4 transition-transform duration-300 group-hover/act:-rotate-12" />
        )}
        <span>{copied ? t("linkCopiedShort") : t("share")}</span>
      </button>
    </div>
  );
}
