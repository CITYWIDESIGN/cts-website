import "server-only";

import type { CurrentUser } from "./auth";
import { getSessionUser } from "./auth";

/*
  select 与"会话版本校验"都从 `@/server/auth` 共用 —— 不再抄第二份。
  抄一份的代价不是"多几行"，而是两边会走偏：例如一边补了 `bannedAt`、
  另一边忘了，route handler 里的封禁判断就会静默失效；或者一边忘了比
  `sessionVersion`，改完密码之后旧 cookie 在 API 这条路上就还能继续用。
*/

/** API 路由专用：读取当前用户（未登录返回 null，不重定向） */
export async function getApiUser(): Promise<CurrentUser | null> {
  return getSessionUser();
}

/** API 路由专用：要求管理员，未登录/非管理员返回 null */
export async function getApiAdmin(): Promise<CurrentUser | null> {
  const user = await getApiUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}
