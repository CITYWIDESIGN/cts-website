import "server-only";

import { prisma } from "@/lib/prisma";
import { notify } from "./notify";

/**
 * 举报：资源与评论共用一套。
 *
 * 流程：
 *   用户提交（填原因，可附说明）→ 后台 /admin/reports 待处理
 *   → 管理员处理（可顺手删除被举报内容）→ 状态置为 RESOLVED
 *
 * 权限：提交举报需要登录；处理举报需要管理员。
 * 不做自动处置 —— 是否删除内容始终由管理员决定，避免误伤。
 */

export const REPORT_REASONS = [
  "spam",
  "harassment",
  "illegal",
  "malware",
  "copyright",
  "other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export class ReportError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_FOUND"
      | "INVALID_REASON"
      | "ALREADY_REPORTED"
      | "SELF_REPORT"
      | "EMPTY"
      | "TOO_LONG"
  ) {
    super(message);
    this.name = "ReportError";
  }
}

const MAX_DETAIL = 1000;

export type ReportTargetType = "RESOURCE" | "COMMENT";

/** 提交举报。同一人对同一对象只能有一条待处理举报。 */
export async function createReport(input: {
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  detail?: string | null;
  reporterId: string;
  reporterName: string | null;
}) {
  if (!REPORT_REASONS.includes(input.reason as ReportReason)) {
    throw new ReportError("Invalid reason.", "INVALID_REASON");
  }
  const detail = (input.detail ?? "").trim();
  if (detail.length > MAX_DETAIL) {
    throw new ReportError("Detail is too long.", "TOO_LONG");
  }

  // 目标必须存在
  if (input.targetType === "RESOURCE") {
    const r = await prisma.resource.findUnique({
      where: { id: input.targetId },
      select: { id: true, uploaderId: true },
    });
    if (!r) throw new ReportError("Target not found.", "NOT_FOUND");
    if (r.uploaderId === input.reporterId) {
      throw new ReportError("Cannot report your own post.", "SELF_REPORT");
    }
  } else {
    const c = await prisma.resourceComment.findUnique({
      where: { id: input.targetId },
      select: { id: true, userId: true },
    });
    if (!c) throw new ReportError("Target not found.", "NOT_FOUND");
    if (c.userId === input.reporterId) {
      throw new ReportError("Cannot report your own comment.", "SELF_REPORT");
    }
  }

  // 同一人重复举报（仍处于待处理）时直接拒绝，避免刷单
  const existing = await prisma.report.findFirst({
    where: {
      targetType: input.targetType,
      targetId: input.targetId,
      reporterId: input.reporterId,
      status: "PENDING",
    },
    select: { id: true },
  });
  if (existing) {
    throw new ReportError("Already reported.", "ALREADY_REPORTED");
  }

  return prisma.report.create({
    data: {
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      detail: detail || null,
      reporterId: input.reporterId,
      reporterName: input.reporterName,
    },
  });
}

/** 当前用户对一批对象的待处理举报（用于把按钮变成"已举报"） */
export async function getMyPendingReports(
  targets: Array<{ targetType: ReportTargetType; targetId: string }>,
  userId: string | null
): Promise<Set<string>> {
  if (!userId || targets.length === 0) return new Set();
  const rows = await prisma.report.findMany({
    where: {
      reporterId: userId,
      status: "PENDING",
      OR: targets.map((t) => ({
        targetType: t.targetType,
        targetId: t.targetId,
      })),
    },
    select: { targetType: true, targetId: true },
  });
  return new Set(rows.map((r) => `${r.targetType}:${r.targetId}`));
}

/**
 * 后台列表：待处理优先，同状态内按时间倒序。
 * 同时把被举报对象的摘要查出来，便于管理员判断。
 */
export async function listReports(status?: "PENDING" | "RESOLVED") {
  const reports = await prisma.report.findMany({
    where: status ? { status } : undefined,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  const resourceIds = reports
    .filter((r) => r.targetType === "RESOURCE")
    .map((r) => r.targetId);
  const commentIds = reports
    .filter((r) => r.targetType === "COMMENT")
    .map((r) => r.targetId);

  const [resources, comments] = await Promise.all([
    resourceIds.length
      ? prisma.resource.findMany({
          where: { id: { in: resourceIds } },
          select: { id: true, title: true, uploaderId: true },
        })
      : [],
    commentIds.length
      ? prisma.resourceComment.findMany({
          where: { id: { in: commentIds } },
          select: { id: true, content: true, userId: true, resourceId: true },
        })
      : [],
  ]);

  const resourceMap = new Map(resources.map((r) => [r.id, r]));
  const commentMap = new Map(comments.map((c) => [c.id, c]));

  return reports.map((r) => {
    if (r.targetType === "RESOURCE") {
      const target = resourceMap.get(r.targetId);
      return {
        ...r,
        targetExists: Boolean(target),
        targetTitle: target?.title ?? null,
        targetExcerpt: null as string | null,
        /** 资源被举报时，点进去就是详情页 */
        link: `/resources/${r.targetId}`,
      };
    }
    const target = commentMap.get(r.targetId);
    return {
      ...r,
      targetExists: Boolean(target),
      targetTitle: null,
      targetExcerpt: target?.content?.slice(0, 120) ?? null,
      link: target ? `/resources/${target.resourceId}` : null,
    };
  });
}

export type ReportListItem = Awaited<ReturnType<typeof listReports>>[number];

/** 待处理数量（后台侧边栏/概览用） */
export async function countPendingReports() {
  return prisma.report.count({ where: { status: "PENDING" } });
}

/** 处理举报：记录结果与处理人，并通知举报人 */
export async function resolveReport(
  reportId: string,
  handlerId: string,
  resolution: "dismissed" | "removed"
) {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      reporterId: true,
      targetType: true,
      targetId: true,
    },
  });
  if (!report) throw new ReportError("Report not found.", "NOT_FOUND");

  const updated = await prisma.report.update({
    where: { id: reportId },
    data: {
      status: "RESOLVED",
      resolution,
      handledBy: handlerId,
      handledAt: new Date(),
    },
  });

  // 举报进度通知：告诉举报人处理结果
  // 关联资源 id，点通知能跳回被举报内容所在的位置
  let resourceId: string | null = null;
  if (report.targetType === "RESOURCE") {
    resourceId = report.targetId;
  } else {
    const c = await prisma.resourceComment.findUnique({
      where: { id: report.targetId },
      select: { resourceId: true },
    });
    resourceId = c?.resourceId ?? null;
  }

  await notify({
    userId: report.reporterId,
    type: "REPORT_RESOLVED",
    actorId: handlerId,
    resourceId,
    resolution,
  });

  return updated;
}
