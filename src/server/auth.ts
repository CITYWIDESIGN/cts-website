import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export type CurrentUser = Pick<
  User,
  | "id"
  | "username"
  | "email"
  | "emailVerifiedAt"
  | "minecraftUuid"
  | "minecraftUsername"
  | "microsoftAccountId"
  | "role"
  | "wearFrame"
  | "createdAt"
  | "bannedAt"
  | "bannedUntil"
  | "banReason"
>;

/**
 * 当前用户的字段白名单。
 *
 * **导出给 `@/server/api-auth` 共用** —— 那边原来抄了一份一模一样的 select。
 * 两份拷贝迟早会走偏，而走偏的方向通常很糟糕：一边加了 `bannedAt`、
 * 另一边没加，于是 route handler 里 `isBanned()` 永远返回 false。
 * 要加字段就在这一处加。
 */
export const CURRENT_USER_SELECT = {
  id: true,
  username: true,
  email: true,
  emailVerifiedAt: true,
  minecraftUuid: true,
  minecraftUsername: true,
  microsoftAccountId: true,
  role: true,
  wearFrame: true,
  createdAt: true,
  bannedAt: true,
  bannedUntil: true,
  banReason: true,
} as const;

/**
 * 读取当前登录用户。每次请求都会从数据库读取，确保角色等信息是实时的。
 * 使用 React `cache` 在同一渲染中复用，避免重复查询。
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  const userId = session.userId;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: CURRENT_USER_SELECT,
  });

  return user;
});

/** 要求已登录，否则跳转到登录页 */
export const requireUser = cache(async (): Promise<CurrentUser> => {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
});

/** 要求管理员权限，否则跳转到登录页（非管理员跳转到 dashboard） */
export const requireAdmin = cache(async (): Promise<CurrentUser> => {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    redirect("/dashboard");
  }
  return user;
});

/** 服务端角色判断（不依赖前端） */
export function isAdmin(user: { role: Role } | null | undefined): boolean {
  return user?.role === "ADMIN";
}
