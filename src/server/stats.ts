import "server-only";

import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasAvatarFrame } from "@/lib/frame";
import { displayName } from "@/lib/display-name";

/**
 * 活跃度统计。
 *
 * 口径（三项都是「**这个人/这个 IP 做了多少次**」）：
 *   - comments  ：发出的评论 + 回复（ResourceComment）
 *   - resources ：发布的资源（Resource.uploaderId）
 *   - downloads ：下载资源附件（ResourceDownload）
 *
 * 下载的主体区分登录用户与访客：登录记 userId，未登录记 IP（与 quota 一致），
 * 所以访客的活跃度只能按 IP 看 —— 这是常见近似做法，同一 NAT 出口会合并。
 */

/** 记一条下载明细。登录按 userId，未登录按 IP。 */
export async function recordDownload(
  resourceId: string,
  subject: { userId: string | null; ip: string }
): Promise<void> {
  await prisma.resourceDownload.create({
    data: {
      resourceId,
      subjectType: subject.userId ? "user" : "ip",
      subjectKey: subject.userId ?? subject.ip,
    },
  });
}

export type UserActivityRow = {
  id: string;
  name: string | null;
  uuid: string | null;
  role: Role;
  comments: number;
  resources: number;
  downloads: number;
  /** 三项之和，仅用于排序 */
  activity: number;
};

export type GuestActivityRow = {
  ip: string;
  downloads: number;
  /** 最近一次下载时间 */
  lastAt: Date;
};

export type ActivityStats = {
  users: UserActivityRow[];
  guests: GuestActivityRow[];
  /** 活跃度前 N 名（不受分页影响，图表用） */
  top: UserActivityRow[];
  /** 下载最多的前 N 个访客 IP（图表用） */
  topGuests: GuestActivityRow[];
  totals: {
    comments: number;
    resources: number;
    downloads: number;
    /** 其中来自未登录访客的下载次数 */
    guestDownloads: number;
  };
};

const PAGE_SIZE = 20;
/** 图表展示的名次数 */
const TOP_N = 10;

export async function getActivityStats(page = 1): Promise<{
  stats: ActivityStats;
  page: number;
  totalPages: number;
  totalUsers: number;
}> {
  const [
    users,
    commentGroups,
    userDownloadGroups,
    guestDownloadGroups,
    resourceTotal,
    commentTotal,
    downloadTotal,
  ] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        minecraftUsername: true,
        minecraftUuid: true,
        role: true,
        _count: { select: { resources: true } },
      },
    }),
    prisma.resourceComment.groupBy({
      by: ["userId"],
      _count: { _all: true },
    }),
    prisma.resourceDownload.groupBy({
      by: ["subjectKey"],
      where: { subjectType: "user" },
      _count: { _all: true },
    }),
    prisma.resourceDownload.groupBy({
      by: ["subjectKey"],
      where: { subjectType: "ip" },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    prisma.resource.count(),
    prisma.resourceComment.count(),
    prisma.resourceDownload.count(),
  ]);

  const commentMap = new Map(
    commentGroups.map((g) => [g.userId, g._count._all])
  );
  const userDownloadMap = new Map(
    userDownloadGroups.map((g) => [g.subjectKey, g._count._all])
  );

  const rows: UserActivityRow[] = users.map((u) => {
    const comments = commentMap.get(u.id) ?? 0;
    const resources = u._count.resources;
    const downloads = userDownloadMap.get(u.id) ?? 0;
    return {
      id: u.id,
      // 没填游戏 ID 就退回账号名
      name: displayName(u),
      uuid: u.minecraftUuid,
      role: u.role,
      comments,
      resources,
      downloads,
      activity: comments + resources + downloads,
    };
  });

  // 按活跃度排序；并列时名字靠前的先显示，保证分页稳定
  rows.sort(
    (a, b) =>
      b.activity - a.activity ||
      (a.name ?? "\uffff").localeCompare(b.name ?? "\uffff")
  );

  const guests: GuestActivityRow[] = guestDownloadGroups
    .map((g) => ({
      ip: g.subjectKey,
      downloads: g._count._all,
      lastAt: g._max.createdAt ?? new Date(0),
    }))
    .sort((a, b) => b.downloads - a.downloads);

  const guestDownloads = guests.reduce((sum, g) => sum + g.downloads, 0);

  const safePage = Math.max(1, page);
  const totalUsers = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));

  return {
    stats: {
      users: rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
      guests,
      // 图表固定看前 N 名，翻页不影响
      top: rows.filter((r) => r.activity > 0).slice(0, TOP_N),
      topGuests: guests.slice(0, TOP_N),
      totals: {
        comments: commentTotal,
        resources: resourceTotal,
        downloads: downloadTotal,
        guestDownloads,
      },
    },
    page: safePage,
    totalPages,
    totalUsers,
  };
}

/**
 * 单个用户的资料 + 活跃度（公开页用，任何访客都能看）。
 *
 * ⚠️ 资源列表**必须有 take**。这里原来是把该用户的资源全部 `select` 回来，
 * 页面再把它们全渲染一遍 —— 一个传了几千个资源的账号会让这个**公开页面**
 * 一次拉出几千行、生成几千个 DOM 节点。现在只取最近的一页，
 * 真正的总数走 `_count`（数据库里算，不搬数据）。
 */
export const PROFILE_RESOURCE_LIMIT = 24;

/** 单个用户的资料 + 活跃度（公开页用，任何访客都能看） */
export async function getUserProfile(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      minecraftUsername: true,
      minecraftUuid: true,
      microsoftAccountId: true,
      wearFrame: true,
      role: true,
      createdAt: true,
      bannedAt: true,
      bannedUntil: true,
      banReason: true,
      _count: { select: { resources: true } },
      resources: {
        orderBy: { createdAt: "desc" },
        take: PROFILE_RESOURCE_LIMIT,
        select: {
          id: true,
          title: true,
          description: true,
          fileSize: true,
          downloads: true,
          likeCount: true,
          commentCount: true,
          createdAt: true,
        },
      },
    },
  });

  if (!user) return null;

  const [comments, downloads] = await Promise.all([
    prisma.resourceComment.count({ where: { userId: id } }),
    prisma.resourceDownload.count({
      where: { subjectType: "user", subjectKey: id },
    }),
  ]);

  const { _count, ...rest } = user;
  return {
    ...rest,
    comments,
    downloads,
    /** 该用户发布的资源总数（不是列表长度） */
    resourceCount: _count.resources,
    /** 列表被截断了（总数比展示的多） */
    truncated: _count.resources > user.resources.length,
    framed: hasAvatarFrame(user),
  };
}
