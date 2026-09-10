import "server-only";

import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@prisma/client";

/**
 * 站内消息（右上角铃铛）。
 *
 * 只产生四类消息：
 *   REPORT_RESOLVED  自己提交的举报有了处理结果
 *   LIKE             自己的资源被点赞
 *   COMMENT_LIKE     自己的评论被点赞
 *   REPLY            自己的评论被回复
 *
 * **自己对自己不产生消息**：所有写入函数都会先判断
 * 「接收者 === 触发者」并直接跳过（点赞自己、回复自己都算）。
 */

export interface NotifyInput {
  /** 收件人 */
  userId: string;
  type: NotificationType;
  actorId?: string | null;
  actorName?: string | null;
  resourceId?: string | null;
  resolution?: string | null;
}

/** 写入一条消息；收件人就是触发者时直接忽略 */
export async function notify(input: NotifyInput): Promise<void> {
  if (input.actorId && input.actorId === input.userId) return;

  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        actorId: input.actorId ?? null,
        actorName: input.actorName ?? null,
        resourceId: input.resourceId ?? null,
        resolution: input.resolution ?? null,
      },
    });
  } catch (err) {
    // 消息失败不应影响主流程（点赞/评论本身已经成功）
    console.error("[notify]", err);
  }
}

/** 未读数量（铃铛红点用） */
export async function countUnread(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

/** 最近的消息列表 */
export async function listNotifications(userId: string, take = 30) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      type: true,
      actorName: true,
      resourceId: true,
      resolution: true,
      readAt: true,
      createdAt: true,
    },
  });
}

/** 全部标记为已读 */
export async function markAllRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

/** 删除一条（例如已处理完的通知） */
export async function deleteNotification(id: string, userId: string) {
  await prisma.notification.deleteMany({ where: { id, userId } });
}
