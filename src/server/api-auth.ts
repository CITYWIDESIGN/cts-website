import "server-only";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { CURRENT_USER_SELECT, type CurrentUser } from "./auth";

/*
  select 从 `@/server/auth` 共用 —— 不再抄第二份。
  抄一份的代价不是"多几行"，而是两边会走偏：例如一边补了 `bannedAt`、
  另一边忘了，route handler 里的封禁判断就会静默失效。
*/

/** API 路由专用：读取当前用户（未登录返回 null，不重定向） */
export async function getApiUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session.userId) return null;

  return prisma.user.findUnique({
    where: { id: session.userId },
    select: CURRENT_USER_SELECT,
  });
}

/** API 路由专用：要求管理员，未登录/非管理员返回 null */
export async function getApiAdmin(): Promise<CurrentUser | null> {
  const user = await getApiUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}
