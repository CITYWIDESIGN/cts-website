import "server-only";

import { prisma } from "@/lib/prisma";
import { notify } from "./notify";

/**
 * 资源动态的互动：点赞 / 评论 / 转发。
 *
 * 权限：**只要登录即可**，不要求通过入服审核（与上传一致）。
 * 计数策略：明细表（唯一键防重复）+ Resource 上的冗余计数，
 * 两者在**同一个事务**里更新，保证列表能一次查出计数而不必聚合。
 */

export class SocialError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_FOUND"
      | "EMPTY"
      | "TOO_LONG"
      | "NESTED_REPLY"
      | "ALREADY_REPORTED"
      | "SELF_REPORT"
  ) {
    super(message);
    this.name = "SocialError";
  }
}

const MAX_COMMENT = 1000;

/* --------------------------------------------------------------- 点赞 */

/** 切换点赞状态，返回切换后的状态与最新计数 */
export async function toggleLike(
  resourceId: string,
  userId: string,
  /** 触发者名字，仅用于消息展示 */
  actorName?: string | null
): Promise<{ liked: boolean; count: number }> {
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    select: { id: true, uploaderId: true },
  });
  if (!resource) throw new SocialError("Resource not found.", "NOT_FOUND");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.resourceLike.findUnique({
      where: { resourceId_userId: { resourceId, userId } },
      select: { id: true },
    });

    if (existing) {
      await tx.resourceLike.delete({ where: { id: existing.id } });
      const updated = await tx.resource.update({
        where: { id: resourceId },
        data: { likeCount: { decrement: 1 } },
        select: { likeCount: true },
      });
      // 计数兜底：历史数据异常时不出现负数
      if (updated.likeCount < 0) {
        await tx.resource.update({
          where: { id: resourceId },
          data: { likeCount: 0 },
        });
        return { liked: false, count: 0 };
      }
      return { liked: false, count: updated.likeCount };
    }

    await tx.resourceLike.create({ data: { resourceId, userId } });
    const updated = await tx.resource.update({
      where: { id: resourceId },
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true },
    });
    return { liked: true, count: updated.likeCount };
  }).then(async (result) => {
    // 只有"点赞成功"才通知上传者；notify 内部会过滤掉自己点自己
    if (result.liked) {
      await notify({
        userId: resource.uploaderId,
        type: "LIKE",
        actorId: userId,
        actorName: actorName ?? null,
        resourceId,
      });
    }
    return result;
  });
}

/* --------------------------------------------------------------- 评论 */

export async function addComment(input: {
  resourceId: string;
  userId: string;
  authorName: string | null;
  content: string;
  /** 回复某条顶层评论时传它的 id（只允许一层） */
  parentId?: string | null;
}) {
  const content = input.content.trim();
  if (!content) throw new SocialError("Comment is empty.", "EMPTY");
  if (content.length > MAX_COMMENT)
    throw new SocialError("Comment is too long.", "TOO_LONG");

  const resource = await prisma.resource.findUnique({
    where: { id: input.resourceId },
    select: { id: true },
  });
  if (!resource) throw new SocialError("Resource not found.", "NOT_FOUND");

  // 回复只允许一层：不能回复"回复"
  let parentId: string | null = null;
  let replyToName: string | null = null;
  /** 被回复评论的作者，用于发消息 */
  let replyToUserId: string | null = null;
  if (input.parentId) {
    const parent = await prisma.resourceComment.findUnique({
      where: { id: input.parentId },
      select: {
        id: true,
        parentId: true,
        authorName: true,
        userId: true,
        resourceId: true,
      },
    });
    if (!parent || parent.resourceId !== input.resourceId) {
      throw new SocialError("Comment not found.", "NOT_FOUND");
    }
    // 若目标是回复，则挂到它的顶层父评论上（扁平化，避免无限层级）
    parentId = parent.parentId ?? parent.id;
    replyToName = parent.authorName ?? null;
    replyToUserId = parent.userId;
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.resourceComment.create({
      data: {
        resourceId: input.resourceId,
        userId: input.userId,
        authorName: input.authorName,
        content: content.slice(0, MAX_COMMENT),
        parentId,
        replyToName,
      },
    });

    // 资源的总评论数始终 +1（回复也算一条评论）
    const updatedResource = await tx.resource.update({
      where: { id: input.resourceId },
      data: { commentCount: { increment: 1 } },
      select: { commentCount: true },
    });

    // 顶层评论的回复数
    if (parentId) {
      await tx.resourceComment.update({
        where: { id: parentId },
        data: { replyCount: { increment: 1 } },
      });
    }

    return { comment: created, count: updatedResource.commentCount };
  }).then(async (result) => {
    // 只有"回复别人"才通知（notify 内部也会过滤自己回复自己）
    if (replyToUserId) {
      await notify({
        userId: replyToUserId,
        type: "REPLY",
        actorId: input.userId,
        actorName: input.authorName,
        resourceId: input.resourceId,
      });
    }
    return result;
  });
}

/**
 * 评论列表：顶层评论（旧→新）每条带自己的回复。
 * 一次查完再在内存里分组，避免 N+1。
 */
export async function listComments(resourceId: string, take = 200) {
  const rows = await prisma.resourceComment.findMany({
    where: { resourceId },
    orderBy: { createdAt: "asc" },
    take,
    select: {
      id: true,
      userId: true,
      authorName: true,
      content: true,
      parentId: true,
      replyToName: true,
      likeCount: true,
      replyCount: true,
      createdAt: true,
    },
  });

  const top = rows.filter((r) => !r.parentId);
  const repliesByParent = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!r.parentId) continue;
    const list = repliesByParent.get(r.parentId) ?? [];
    list.push(r);
    repliesByParent.set(r.parentId, list);
  }

  return top.map((t) => ({
    ...t,
    replies: repliesByParent.get(t.id) ?? [],
  }));
}

/** 当前用户点赞过的评论 id 集合（用于渲染已点赞态） */
export async function getLikedCommentIds(
  commentIds: string[],
  userId: string | null
): Promise<Set<string>> {
  if (!userId || commentIds.length === 0) return new Set();
  const rows = await prisma.commentLike.findMany({
    where: { userId, commentId: { in: commentIds } },
    select: { commentId: true },
  });
  return new Set(rows.map((r) => r.commentId));
}

/** 评论点赞开关 */
export async function toggleCommentLike(
  commentId: string,
  userId: string,
  actorName?: string | null
): Promise<{ liked: boolean; count: number }> {
  const comment = await prisma.resourceComment.findUnique({
    where: { id: commentId },
    select: { id: true, userId: true, resourceId: true },
  });
  if (!comment) throw new SocialError("Comment not found.", "NOT_FOUND");

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.commentLike.findUnique({
      where: { commentId_userId: { commentId, userId } },
      select: { id: true },
    });

    if (existing) {
      await tx.commentLike.delete({ where: { id: existing.id } });
      const u = await tx.resourceComment.update({
        where: { id: commentId },
        data: { likeCount: { decrement: 1 } },
        select: { likeCount: true },
      });
      if (u.likeCount < 0) {
        await tx.resourceComment.update({
          where: { id: commentId },
          data: { likeCount: 0 },
        });
        return { liked: false, count: 0 };
      }
      return { liked: false, count: u.likeCount };
    }

    await tx.commentLike.create({ data: { commentId, userId } });
    const u = await tx.resourceComment.update({
      where: { id: commentId },
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true },
    });
    return { liked: true, count: u.likeCount };
  });

  // 只有"点赞成功"才通知评论作者（自己赞自己会被 notify 过滤）
  if (result.liked) {
    await notify({
      userId: comment.userId,
      type: "COMMENT_LIKE",
      actorId: userId,
      actorName: actorName ?? null,
      resourceId: comment.resourceId,
    });
  }
  return result;
}

/** 删除评论：作者本人或管理员。删顶层评论会连带删除其回复。 */
export async function deleteComment(commentId: string, userId: string, isAdmin: boolean) {
  const comment = await prisma.resourceComment.findUnique({
    where: { id: commentId },
    select: { id: true, userId: true, resourceId: true, parentId: true, replyCount: true },
  });
  if (!comment) throw new SocialError("Comment not found.", "NOT_FOUND");
  if (!isAdmin && comment.userId !== userId) {
    throw new SocialError("Not allowed.", "NOT_FOUND");
  }

  // 删除时会被连带删掉的回复数量，用于把计数一次减对
  const cascadeReplies = comment.parentId
    ? 0
    : await prisma.resourceComment.count({ where: { parentId: commentId } });
  const totalRemoved = 1 + cascadeReplies;

  await prisma.$transaction(async (tx) => {
    await tx.resourceComment.delete({ where: { id: commentId } });

    const resource = await tx.resource.update({
      where: { id: comment.resourceId },
      data: { commentCount: { decrement: totalRemoved } },
      select: { commentCount: true },
    });
    if (resource.commentCount < 0) {
      await tx.resource.update({
        where: { id: comment.resourceId },
        data: { commentCount: 0 },
      });
    }

    if (comment.parentId) {
      const parent = await tx.resourceComment.update({
        where: { id: comment.parentId },
        data: { replyCount: { decrement: 1 } },
        select: { replyCount: true },
      });
      if (parent.replyCount < 0) {
        await tx.resourceComment.update({
          where: { id: comment.parentId },
          data: { replyCount: 0 },
        });
      }
    }
  });
}

/* --------------------------------------------------------------- 分享 */

/**
 * 「分享」只是复制链接，不需要服务端参与。
 *
 * 说明：早先实现的是"转发成一条新动态"（ResourceRepost 表 + 计数），
 * 但需求其实是**复制这条动态的分享链接**。现在由 InteractionBar
 * 直接用 Clipboard API 完成：不落库、不计次、不需要登录。
 */

/* --------------------------------------------------------------- 查看者状态 */

/**
 * 当前用户对一批资源的点赞状态。
 * 列表页一次性查出，避免每条动态各查一次。
 */
export async function getViewerState(
  resourceIds: string[],
  userId: string | null
): Promise<{
  liked: Set<string>;
}> {
  if (!userId || resourceIds.length === 0) {
    return { liked: new Set() };
  }

  const likes = await prisma.resourceLike.findMany({
    where: { userId, resourceId: { in: resourceIds } },
    select: { resourceId: true },
  });

  return { liked: new Set(likes.map((l) => l.resourceId)) };
}
