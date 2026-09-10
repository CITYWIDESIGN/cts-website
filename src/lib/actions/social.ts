"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/server/auth";
import {
  addComment,
  deleteComment,
  SocialError,
  toggleCommentLike,
  toggleLike,
} from "@/server/social";
import {
  createReport,
  ReportError,
  resolveReport,
  type ReportTargetType,
} from "@/server/report";
import { deleteResource, getResource } from "@/server/resource";
import { recordAudit } from "@/server/audit";
import { displayName } from "@/lib/display-name";
import { addDailyCount, checkDailyLimit } from "@/server/limit";
import { isBanned } from "@/server/ban";
import type { CurrentUser } from "@/server/auth";

/**
 * 互动与举报的 Server Actions。
 *
 * 权限约定：
 *   - 点赞 / 评论 / 回复 / 举报：**登录即可**（不要求过审）
 *   - 处理举报：**管理员**
 *   - 删除被举报内容：复用资源/评论各自的删除逻辑（作者或管理员）
 *
 * 频次约定：
 *   - 评论（含回复）非管理员每天 50 条，见 @/server/limit
 *
 * 封禁约定：
 *   - 被封禁的用户**不能点赞 / 评论 / 回复**（见 @/server/ban）
 *   - 举报不拦：那是给管理员提供线索的渠道
 */

export type SocialActionState = {
  ok: boolean;
  error?: string;
  liked?: boolean;
  count?: number;
  /** error 为 DAILY_LIMIT 时带回上限，供提示文案使用 */
  limit?: number;
  /** error 为 BANNED 时带回封禁信息 */
  bannedForever?: boolean;
  bannedUntil?: string | null;
  banReason?: string | null;
  id?: string;
};

function fail(code: string): SocialActionState {
  return { ok: false, error: code };
}

/** 被封禁就直接返回错误态；没被封返回 null */
function banGuard(user: CurrentUser): SocialActionState | null {
  if (!isBanned(user)) return null;
  return {
    ok: false,
    error: "BANNED",
    bannedForever: !user.bannedUntil,
    bannedUntil: user.bannedUntil ? user.bannedUntil.toISOString() : null,
    banReason: user.banReason ?? null,
  };
}

/* --------------------------------------------------------------- 资源互动 */

export async function toggleLikeAction(
  resourceId: string
): Promise<SocialActionState> {
  const user = await requireUser();
  const banned = banGuard(user);
  if (banned) return banned;
  try {
    const res = await toggleLike(resourceId, user.id, displayName(user));
    revalidatePath("/resources");
    revalidatePath(`/resources/${resourceId}`);
    return { ok: true, liked: res.liked, count: res.count };
  } catch (err) {
    if (err instanceof SocialError) return fail(err.code);
    console.error("[toggleLikeAction]", err);
    return fail("unknown");
  }
}

/* --------------------------------------------------------------- 评论 */

export async function addCommentAction(
  resourceId: string,
  content: string,
  parentId?: string | null
): Promise<SocialActionState> {
  const user = await requireUser();
  const banned = banGuard(user);
  if (banned) return banned;
  const isAdmin = user.role === "ADMIN";

  // 每日评论次数限制：回复也算一条，管理员不限
  const limit = await checkDailyLimit(user.id, "comment", isAdmin);
  if (!limit.allowed) {
    return { ok: false, error: "DAILY_LIMIT", limit: limit.limit };
  }

  try {
    const res = await addComment({
      resourceId,
      userId: user.id,
      authorName: displayName(user),
      content,
      parentId: parentId ?? null,
    });
    // 成功后才计数
    await addDailyCount(user.id, "comment", isAdmin);
    revalidatePath(`/resources/${resourceId}`);
    return { ok: true, id: res.comment.id, count: res.count };
  } catch (err) {
    if (err instanceof SocialError) return fail(err.code);
    console.error("[addCommentAction]", err);
    return fail("unknown");
  }
}

export async function deleteCommentAction(
  commentId: string,
  resourceId: string
): Promise<SocialActionState> {
  const user = await requireUser();
  try {
    await deleteComment(commentId, user.id, user.role === "ADMIN");
    revalidatePath(`/resources/${resourceId}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof SocialError) return fail(err.code);
    console.error("[deleteCommentAction]", err);
    return fail("unknown");
  }
}

export async function toggleCommentLikeAction(
  commentId: string,
  resourceId: string
): Promise<SocialActionState> {
  const user = await requireUser();
  const banned = banGuard(user);
  if (banned) return banned;
  try {
    const res = await toggleCommentLike(commentId, user.id, displayName(user));
    revalidatePath(`/resources/${resourceId}`);
    return { ok: true, liked: res.liked, count: res.count };
  } catch (err) {
    if (err instanceof SocialError) return fail(err.code);
    console.error("[toggleCommentLikeAction]", err);
    return fail("unknown");
  }
}

/* --------------------------------------------------------------- 举报 */

export async function createReportAction(
  targetType: ReportTargetType,
  targetId: string,
  reason: string,
  detail: string,
  /** 举报评论时用于 revalidate 对应的资源页 */
  resourceIdForRevalidate?: string
): Promise<SocialActionState> {
  const user = await requireUser();
  try {
    const created = await createReport({
      targetType,
      targetId,
      reason,
      detail,
      reporterId: user.id,
      reporterName: displayName(user),
    });
    if (resourceIdForRevalidate) {
      revalidatePath(`/resources/${resourceIdForRevalidate}`);
    }
    revalidatePath("/admin/reports");
    return { ok: true, id: created.id };
  } catch (err) {
    if (err instanceof ReportError) return fail(err.code);
    console.error("[createReportAction]", err);
    return fail("unknown");
  }
}

/** 管理员处理举报；可选择同时删除被举报内容 */
export async function resolveReportAction(
  reportId: string,
  resolution: "dismissed" | "removed",
  target: { type: ReportTargetType; id: string },
  resourceIdForRevalidate?: string
): Promise<SocialActionState> {
  const admin = await requireAdmin();

  try {
    await resolveReport(reportId, admin.id, resolution);

    if (resolution === "removed") {
      if (target.type === "RESOURCE") {
        // 先把标题取出来 —— 删掉之后就查不到了
        const doomed = await getResource(target.id);
        await deleteResource(target.id);
        await recordAudit({
          action: "resource.delete",
          actorId: admin.id,
          actorName: displayName(admin),
          targetType: "resource",
          targetId: target.id,
          targetLabel: doomed?.title ?? null,
          detail: { via: "report", reportId },
        });
      } else {
        // 管理员删除评论
        await deleteComment(target.id, admin.id, true);
        await recordAudit({
          action: "report.remove_content",
          actorId: admin.id,
          actorName: displayName(admin),
          targetType: "comment",
          targetId: target.id,
          detail: { reportId },
        });
      }
    }
  } catch (err) {
    if (err instanceof ReportError || err instanceof SocialError) {
      return fail(err.code);
    }
    console.error("[resolveReportAction]", err);
    return fail("unknown");
  }

  revalidatePath("/admin/reports");
  revalidatePath("/admin/audit");
  revalidatePath("/resources");
  if (resourceIdForRevalidate) {
    revalidatePath(`/resources/${resourceIdForRevalidate}`);
  }
  return { ok: true };
}
