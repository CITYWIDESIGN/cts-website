import "server-only";

/**
 * `SESSION_SECRET` 的唯一读取点。
 *
 * 这个密钥有两个用途，两个都是安全边界：
 *   1. 加密 session cookie —— 泄露 = 任何人都能伪造登录态
 *   2. 给 OAuth 的 `state` 签名 —— 泄露 = CSRF 防护形同虚设
 *
 * 以前两处各自 `?? "insecure-development-secret"`，于是**生产环境忘配也不会
 * 报错**，只是静默地用一个公开可见的字符串当密钥。这里改成：开发环境照旧
 * 兜底（方便上手），生产环境**直接抛错**。
 *
 * 为什么是懒加载（函数而不是模块级常量）：
 *   `next build` 也会把 NODE_ENV 设成 production。如果在模块顶层抛错，
 *   任何没有运行时密钥的构建环境都会直接构建失败 —— 而构建本来不需要密钥。
 *   所以检查放在**真正用到密钥的时候**（每次请求），构建不受影响。
 */

/** 开发兜底密钥。生产环境出现这个值一律拒绝启动。 */
export const DEV_FALLBACK_SECRET = "insecure-development-secret-change-me";

/** iron-session 要求至少 32 字符 */
export const MIN_SECRET_LENGTH = 32;

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** 密钥是否可用（给 doctor / 构建前检查用，不抛错） */
export function inspectSecret(): {
  ok: boolean;
  reason?: "missing" | "too_short" | "placeholder";
  length: number;
} {
  const raw = process.env.SESSION_SECRET?.trim();
  if (!raw) return { ok: false, reason: "missing", length: 0 };
  if (raw === DEV_FALLBACK_SECRET || raw.includes("replace-me")) {
    return { ok: false, reason: "placeholder", length: raw.length };
  }
  if (raw.length < MIN_SECRET_LENGTH) {
    return { ok: false, reason: "too_short", length: raw.length };
  }
  return { ok: true, length: raw.length };
}

/**
 * 取密钥。
 * 非生产环境没配就用兜底值（本地开发零配置）；生产环境没配就抛。
 */
export function sessionSecret(): string {
  const raw = process.env.SESSION_SECRET?.trim();

  if (!isProduction()) {
    return raw || DEV_FALLBACK_SECRET;
  }

  const status = inspectSecret();
  if (status.ok) return raw!;

  const how =
    status.reason === "missing"
      ? "未配置"
      : status.reason === "too_short"
        ? `太短（${status.length} 字符，至少 ${MIN_SECRET_LENGTH}）`
        : "还是示例里的占位值";

  throw new Error(
    `[session] SESSION_SECRET ${how}，拒绝启动会话。\n` +
      "  它用来加密登录 cookie、给 OAuth state 签名 —— 用默认值等于把伪造登录态的钥匙公开出去。\n" +
      "  生成一个并写进 .env（项目本来就装了 Node，用这个最省事）：\n" +
      '      node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"\n' +
      "  装了 openssl 的话也可以：\n" +
      "      openssl rand -base64 32\n" +
      "  ⚠️ 别用 PowerShell 的 Get-Random —— 它不是密码学安全的随机源。\n"
  );
}
