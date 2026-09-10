/**
 * 错误码 → 文案。
 *
 * 单独成一个模块：这些码被登录、注册、验证码、个人中心好几处共用，
 * 如果留在某个组件里就会形成循环 import。
 *
 * 文案放在 `auth.formErrors.*` 而不是 `auth.errors.*` —— 后者已经被
 * OAuth 的 `{title, description}` 对象占了，同名会撞成对象。
 */

/** 有对应文案的错误码；其余统一走 generic */
export const KNOWN_ERRORS = new Set([
  "TOO_MANY",
  "PASSWORD_MISMATCH",
  "EMAIL_INVALID",
  "EMAIL_SAME",
  "EMAIL_TAKEN",
  "USERNAME_TAKEN",
  "USERNAME_COOLDOWN",
  "INVALID_CREDENTIALS",
  "UUID_TAKEN",
  "UNAUTHORIZED",
  "UNKNOWN",
  "USERNAME_TOO_SHORT",
  "USERNAME_TOO_LONG",
  "USERNAME_INVALID_CHARS",
  "PASSWORD_TOO_SHORT",
  "PASSWORD_TOO_LONG",
  "CODE_TOO_SOON",
  "CODE_TOO_MANY",
  "CODE_NOT_FOUND",
  "CODE_EXPIRED",
  "CODE_WRONG_CODE",
  "CODE_INVALID_CODE",
  "CODE_MAIL_NOT_CONFIGURED",
  "CODE_MAIL_FAILED",
]);

export function messageFor(
  t: (key: string, values?: Record<string, string | number>) => string,
  code: string | undefined
): string {
  if (!code) return t("formErrors.generic");
  return t(`formErrors.${KNOWN_ERRORS.has(code) ? code : "generic"}`);
}
