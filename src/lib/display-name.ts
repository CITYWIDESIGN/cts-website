/**
 * 显示名：优先游戏 ID，其次本地账号名。
 *
 * 为什么要这个：**绑定 Minecraft 是可选的**，只注册了本地账号、还没填
 * 游戏 ID 的用户，`minecraftUsername` 是 null。以前各处直接取
 * `minecraftUsername`，于是这些人到处显示成「—」或者「匿名玩家」，
 * 看起来像数据坏了 —— 其实他们只是没填而已。
 *
 * 放在非 server-only 模块里：服务端和客户端都要用。
 */
export function displayName(
  user:
    | {
        minecraftUsername?: string | null;
        username?: string | null;
      }
    | null
    | undefined
): string | null {
  return user?.minecraftUsername ?? user?.username ?? null;
}

/** 同上，但给表格/列表用，实在没有名字时给个占位符 */
export function displayNameOr(
  user:
    | {
        minecraftUsername?: string | null;
        username?: string | null;
      }
    | null
    | undefined,
  fallback = "—"
): string {
  return displayName(user) ?? fallback;
}
