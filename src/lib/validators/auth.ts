import { z } from "zod";

/* ---------------------------------------------------------------------------
 * 本地账号（用户名 + 邮箱 + 密码）
 * ------------------------------------------------------------------------- */

/**
 * 账号名：字母数字下划线连字符，3–20 位。
 * **统一转小写**存库 —— 否则 "Alice" 和 "alice" 会是两个账号，
 * 而 Postgres 的唯一索引默认区分大小写，光靠约束拦不住。
 */
export const UsernameSchema = z
  .string()
  .trim()
  .min(3, "TOO_SHORT")
  .max(20, "TOO_LONG")
  .regex(/^[a-zA-Z0-9_-]+$/, "INVALID_CHARS")
  .transform((v) => v.toLowerCase());

/**
 * 邮箱。
 * `.pipe()` 而不是 `.email()` 链在 string 上：Zod 4 把邮箱校验挪到了顶层
 * `z.email()`，串在 string 上已废弃。transform 统一转小写。
 */
export const EmailSchema = z
  .string()
  .trim()
  .pipe(z.email().max(120))
  .transform((v) => v.toLowerCase());

export const RegisterSchema = z.object({
  username: UsernameSchema,
  email: EmailSchema,
  password: z.string().min(8, "TOO_SHORT").max(72, "TOO_LONG"),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

/** 登录：账号名或邮箱都行，所以这里不校验格式，交给查询 */
export const LoginSchema = z.object({
  identifier: z.string().trim().min(1).max(120),
  password: z.string().min(1).max(72),
});

export type LoginInput = z.infer<typeof LoginSchema>;

/* ---------------------------------------------------------------------------
 * 用户自己填的 Minecraft 身份
 * ------------------------------------------------------------------------- */

/** Minecraft ID：3–16 位，只允许字母数字下划线（正版规则） */
export const MinecraftNameSchema = z
  .string()
  .trim()
  .min(3, "TOO_SHORT")
  .max(16, "TOO_LONG")
  .regex(/^[A-Za-z0-9_]+$/, "INVALID_CHARS");

/**
 * UUID 允许带连字符的标准格式，也允许 32 位纯十六进制（会自动补连字符）。
 * 空字符串表示"只填 ID 不填 UUID"。
 */
export const MinecraftUuidSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/-/g, "").toLowerCase())
  .refine((v) => v === "" || /^[0-9a-f]{32}$/.test(v), "INVALID_UUID");

export const MinecraftIdentitySchema = z.object({
  minecraftUsername: MinecraftNameSchema,
  minecraftUuid: MinecraftUuidSchema,
});

export type MinecraftIdentityInput = z.infer<typeof MinecraftIdentitySchema>;

/* ---------------------------------------------------------------------------
 * 邮箱验证码 / 改用户名 / 改邮箱 / 重置密码
 * ------------------------------------------------------------------------- */

/** 6 位数字验证码 */
export const CodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "INVALID_CODE");

export const ChangeUsernameSchema = z.object({ username: UsernameSchema });

export const PasswordResetSchema = z.object({
  email: EmailSchema,
  code: CodeSchema,
  password: z.string().min(8, "TOO_SHORT").max(72, "TOO_LONG"),
});
