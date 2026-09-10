/**
 * 验证码的展示参数。
 *
 * 放在这里（而不是 server/email-code.ts）是因为客户端也要用：
 * 服务端模块带 `server-only`，客户端 import 会直接报错。
 * 服务端从这儿读，保证两边显示的数字永远一致。
 */

/** 验证码位数 */
export const CODE_LENGTH = 6;

/** 有效期（分钟） */
export const CODE_TTL_MINUTES = 10;

/** 同一邮箱两次发送之间的冷却（秒），与服务端 RESEND_COOLDOWN_MS 对应 */
export const CODE_RESEND_COOLDOWN_SECONDS = 60;
