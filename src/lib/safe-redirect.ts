/**
 * 站内跳转白名单。
 *
 * 为什么需要：`/api/auth/login?redirectTo=...` 这个参数会被写进 cookie，
 * 登录成功后再用来跳转。如果直接 `new URL(redirectTo, origin)`，
 * 传一个绝对地址（`https://evil.com`）就能跳到外站 —— 经典的开放重定向，
 * 常被用来做"刚登录完请重新输入密码"的钓鱼。
 *
 * 规则：**只接受站内相对路径**。
 *   - 必须以单个 `/` 开头（`//evil.com` 是协议相对 URL，要挡掉）
 *   - 不能含反斜杠（有些浏览器把 `\` 当 `/`，`/\evil.com` 会跑到外站）
 *   - 不能含控制字符 / 空白（换行能骗过部分解析器）
 */

const CONTROL_OR_SPACE = /[\u0000-\u0020\u007f]/;

export function safeRedirectPath(
  raw: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (typeof raw !== "string") return fallback;

  const value = raw.trim();
  if (!value) return fallback;

  // 必须是站内绝对路径
  if (!value.startsWith("/")) return fallback;
  // //host 是协议相对 URL；/\host 在部分浏览器里等价
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  // 反斜杠与控制字符一律拒绝
  if (value.includes("\\") || CONTROL_OR_SPACE.test(value)) return fallback;

  return value;
}
