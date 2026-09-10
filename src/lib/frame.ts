/**
 * 头像框：**绑定 Microsoft 的奖励**。
 *
 * 只自己填了 Minecraft ID / UUID 的账号**没有**头像框 —— 那部分信息无法验证；
 * Microsoft OAuth 拉回来的是真实身份，所以给一个可见的标记。
 *
 * 这里放在非 server-only 的模块里，服务端组件与客户端组件都能用。
 */
export function hasAvatarFrame(
  user:
    | {
        microsoftAccountId?: string | null;
        wearFrame?: boolean | null;
      }
    | null
    | undefined
): boolean {
  if (!user?.microsoftAccountId) return false;
  // 默认佩戴：没设置过（null/undefined）也算 true
  return user.wearFrame !== false;
}
