import "server-only";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import type { CurrentUser } from "./auth";

const userSelect = {
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

/** API 路由专用：读取当前用户（未登录返回 null，不重定向） */
export async function getApiUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session.userId) return null;

  return prisma.user.findUnique({
    where: { id: session.userId },
    select: userSelect,
  });
}

/** API 路由专用：要求管理员，未登录/非管理员返回 null */
export async function getApiAdmin(): Promise<CurrentUser | null> {
  const user = await getApiUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}
