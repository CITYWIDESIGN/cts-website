"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { CornerDownRight, Heart, Loader2, LogIn, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatarLink } from "@/components/user/user-avatar-link";
import { EASE_OUT } from "@/components/motion/transitions";
import { useBanNotice } from "@/components/ban-notice";
import {
  addCommentAction,
  deleteCommentAction,
  toggleCommentLikeAction,
} from "@/lib/actions/social";
import { ReportButton } from "./report-button";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export type CommentItem = {
  id: string;
  userId: string;
  authorName: string | null;
  /** 作者绑定的 Minecraft UUID，用于渲染双层皮肤头像；未绑定为 null */
  authorUuid: string | null;
  /** 作者是否佩戴头像框（绑定 Microsoft 的奖励） */
  authorFramed: boolean;
  content: string;
  parentId: string | null;
  replyToName: string | null;
  likeCount: number;
  replyCount: number;
  liked: boolean;
  reported: boolean;
  createdAt: string;
  replies?: CommentItem[];
};

/**
 * 评论区：支持**回复（一层）**、**点赞**、**举报**。
 *
 * 权限：登录即可（不要求过审）。未登录时显示登录入口。
 * 状态：不把 props 复制进 state；服务端数据是事实来源，
 *       useOptimistic 只叠加"刚发出/刚删除"这两种临时状态。
 */
export function CommentSection({
  resourceId,
  comments,
  viewerId,
  viewerUuid,
  viewerFramed,
  isAdmin,
  authed,
  inputId,
}: {
  resourceId: string;
  comments: CommentItem[];
  viewerId: string | null;
  /** 当前登录用户的 UUID，用于乐观渲染自己的头像 */
  viewerUuid: string | null;
  /** 当前登录用户是否佩戴头像框 */
  viewerFramed: boolean;
  isAdmin: boolean;
  authed: boolean;
  /** 供互动栏的"评论"按钮聚焦顶层输入框 */
  inputId: string;
}) {
  const t = useTranslations("resources.social");
  const common = useTranslations("common");
  const router = useRouter();
  const reduce = useReducedMotion();
  const banNotice = useBanNotice();

  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  /** 正在回复哪条顶层评论（null 表示发顶层评论） */
  const [replyTo, setReplyTo] = React.useState<{
    id: string;
    name: string | null;
  } | null>(null);

  type Patch = { add?: CommentItem; removeId?: string };
  const [optimisticList, addOptimistic] = React.useOptimistic<
    CommentItem[],
    Patch
  >(comments, (state, patch) => {
    if (patch.removeId) return state.filter((c) => c.id !== patch.removeId);
    if (patch.add) {
      const added = patch.add;
      // 顶层评论直接追加；回复挂到对应父评论下
      if (!added.parentId) return [...state, added];
      return state.map((c) =>
        c.id === added.parentId
          ? { ...c, replies: [...(c.replies ?? []), added] }
          : c
      );
    }
    return state;
  });

  async function submit() {
    const content = text.trim();
    if (!content) return;

    setSending(true);
    const res = await addCommentAction(resourceId, content, replyTo?.id ?? null);
    setSending(false);

    if (!res.ok) {
      if (res.error === "BANNED") {
        toast.error(banNotice("social", res));
      } else if (res.error === "DAILY_LIMIT") {
        toast.error(t("commentLimitReached", { limit: res.limit ?? 50 }));
      } else if (res.error === "TOO_LONG") {
        toast.error(t("commentTooLong"));
      } else {
        toast.error(t("actionFailed"));
      }
      return;
    }

    React.startTransition(() => {
      addOptimistic({
        add: {
          id: res.id ?? `local-${Date.now()}`,
          userId: viewerId ?? "",
          authorName: null,
          authorUuid: viewerUuid,
          authorFramed: viewerFramed,
          content,
          parentId: replyTo?.id ?? null,
          replyToName: replyTo?.name ?? null,
          likeCount: 0,
          replyCount: 0,
          liked: false,
          reported: false,
          createdAt: new Date().toISOString(),
        },
      });
    });
    setText("");
    setReplyTo(null);
    router.refresh();
  }

  async function remove(id: string) {
    setDeleting(id);
    const res = await deleteCommentAction(id, resourceId);
    setDeleting(null);
    if (!res.ok) {
      toast.error(t("actionFailed"));
      return;
    }
    React.startTransition(() => addOptimistic({ removeId: id }));
    router.refresh();
  }

  function startReply(c: CommentItem) {
    if (!authed) {
      toast.error(t("needLogin"));
      router.push("/login");
      return;
    }
    setReplyTo({ id: c.id, name: c.authorName });
    const el = document.getElementById(inputId);
    el?.focus();
    el?.scrollIntoView({ block: "center" });
  }

  /** 单条评论（顶层与回复共用渲染） */
  function renderComment(c: CommentItem, isReply: boolean) {
    const canDelete = isAdmin || c.userId === viewerId;
    return (
      <div className={cn("group flex gap-3", isReply && "gap-2.5")}>
        {/* 头像可点：进 `/u/<id>` 公开资料页（任何访客都能看） */}
        <UserAvatarLink
          userId={c.userId}
          name={c.authorName}
          uuid={c.authorUuid}
          framed={c.authorFramed}
          size={isReply ? 28 : 32}
        />

        <div className="min-w-0 flex-1">
          {/* 头部行：作者 + 时间 —— 右侧放操作（举报 / 删除） */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className={cn("font-medium", isReply ? "text-xs" : "text-sm")}>
                {c.authorName ?? t("anonymous")}
              </span>
              {c.replyToName && (
                <span className="text-xs text-muted-foreground">
                  {t("replyTo", { name: c.replyToName })}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {formatDateTime(c.createdAt)}
              </span>
            </div>

            {/* 操作：举报 + 删除（仅作者本人与管理员可删） */}
            <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
              <ReportButton
                targetType="COMMENT"
                targetId={c.id}
                resourceIdForRevalidate={resourceId}
                authed={authed}
                reported={c.reported}
              />
              {canDelete && (
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  disabled={deleting === c.id}
                  aria-label={common("delete")}
                  title={t("deleteHint")}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-destructive disabled:opacity-50"
                >
                  {deleting === c.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                  {common("delete")}
                </button>
              )}
            </div>
          </div>

          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
            {c.content}
          </p>

          {/* 单条评论的操作：点赞 / 回复 */}
          <CommentActions
            comment={c}
            resourceId={resourceId}
            authed={authed}
            onReply={() => startReply(c)}
          />
        </div>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        {t("comments")}
        <span className="text-muted-foreground tabular-nums">
          {optimisticList.length}
        </span>
      </h2>

      {/* 输入区 */}
      {authed ? (
        <div className="flex flex-col gap-2">
          {replyTo && (
            <div className="flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-xs text-accent-foreground">
              <CornerDownRight className="size-3.5" />
              <span className="truncate">
                {t("replyingTo", { name: replyTo.name ?? t("anonymous") })}
              </span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                aria-label={t("cancelReply")}
                className="ml-auto text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}
          <Textarea
            id={inputId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              replyTo ? t("replyPlaceholder") : t("commentPlaceholder")
            }
            rows={3}
            maxLength={1000}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {text.length}/1000
            </span>
            <Button
              onClick={submit}
              disabled={sending || !text.trim()}
              size="sm"
              className="group/btn"
            >
              {sending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("sending")}
                </>
              ) : (
                <>
                  <Send className="size-4 transition-transform duration-300 group-hover/btn:translate-x-0.5" />
                  {t("send")}
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed px-4 py-3">
          <p className="text-sm text-muted-foreground">{t("loginToInteract")}</p>
          <Button asChild size="sm" variant="outline" className="ml-auto">
            <a href="/login">
              <LogIn className="size-4" />
              {t("signIn")}
            </a>
          </Button>
        </div>
      )}

      {/* 列表
          动画刻意做得很轻：纯 CSS 入场（淡入 + 轻微上移），不用
          AnimatePresence/layout —— 之前那套在父级高度变化时会反复触发
          子项的重排与进出，看起来又抖又乱。删除时直接消失即可。 */}
      {optimisticList.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t("noComments")}
        </p>
      ) : (
        <ul className="flex flex-col divide-y">
          {optimisticList.map((c, i) => (
            <li
              key={c.id}
              className="animate-in fade-in slide-in-from-top-1 py-4 duration-300"
              style={{
                // 逐条错开一点点，避免整列同时出现
                animationDelay: reduce ? undefined : `${Math.min(i, 8) * 30}ms`,
                animationFillMode: "backwards",
              }}
            >
              {renderComment(c, false)}

              {/* 回复列表：缩进一层，左侧一条细线 */}
              {c.replies && c.replies.length > 0 && (
                <ul className="ml-4 mt-3 flex flex-col gap-3 border-l pl-4">
                  {c.replies.map((r) => (
                    <li key={r.id}>{renderComment(r, true)}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** 单条评论的操作行：点赞 / 回复 */
function CommentActions({
  comment,
  resourceId,
  authed,
  onReply,
}: {
  comment: CommentItem;
  resourceId: string;
  authed: boolean;
  onReply: () => void;
}) {
  const t = useTranslations("resources.social");
  const router = useRouter();
  const reduce = useReducedMotion();
  const banNotice = useBanNotice();

  type Patch = { liked?: boolean; likeCount?: number };
  const [optimistic, addOptimistic] = React.useOptimistic<
    { liked: boolean; likeCount: number },
    Patch
  >(
    { liked: comment.liked, likeCount: comment.likeCount },
    (state, patch) => ({ ...state, ...patch })
  );

  async function onLike() {
    if (!authed) {
      toast.error(t("needLogin"));
      router.push("/login");
      return;
    }
    const next = !optimistic.liked;
    React.startTransition(() => {
      addOptimistic({
        liked: next,
        likeCount: Math.max(0, optimistic.likeCount + (next ? 1 : -1)),
      });
    });
    const res = await toggleCommentLikeAction(comment.id, resourceId);
    if (!res.ok) {
      toast.error(
        res.error === "BANNED" ? banNotice("social", res) : t("actionFailed")
      );
      return;
    }
    router.refresh();
  }

  const btn =
    "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground";

  return (
    <div className="mt-1 flex items-center gap-1">
      <button
        type="button"
        onClick={onLike}
        aria-pressed={optimistic.liked}
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
          <Heart className={cn("size-3.5", optimistic.liked && "fill-current")} />
        </motion.span>
        <span className="tabular-nums">
          {optimistic.likeCount > 0 ? optimistic.likeCount : ""}
        </span>
      </button>

      <button type="button" onClick={onReply} className={btn}>
        <CornerDownRight className="size-3.5" />
        {t("reply")}
      </button>
    </div>
  );
}
