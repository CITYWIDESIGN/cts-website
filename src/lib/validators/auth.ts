import { z } from "zod";

/* ---------------------------------------------------------------------------
 * 名字类字段的公共规则
 * ------------------------------------------------------------------------- */

/**
 * 允许出现在**任何**用户自填名字里的字符。
 *
 * 规则（站长定）：中文 + 英文大小写字母 + 数字 + `_` `-`。
 * 其它一律拒绝。
 *
 * ⚠️ **必须是白名单，不能是黑名单。** 踩过一次：有人把名字填成
 * `曲奇§▼v▼§`，`§` 是 Minecraft 的颜色代码前缀 —— 它后面那一整段在客户端
 * 会被当成格式码吃掉/变色，界面上就花了。而 `§` 只是最显眼的一个：
 * 控制字符、零宽字符（U+200B）、双向文本控制符（U+202E 能把后面的文字
 * 整个倒过来显示）、组合字符无限堆叠…… 黑名单永远列不全。
 *
 * 白名单能保证"存进去什么、显示出来就是什么"。
 * `\p{Script=Han}` 覆盖全部汉字（不只是基本区），带 `u` 标志才有这个语法。
 */
const SAFE_NAME_CHARS = /^[\p{Script=Han}A-Za-z0-9_-]+$/u;

/* ---------------------------------------------------------------------------
 * 本地账号（用户名 + 邮箱 + 密码）
 * ------------------------------------------------------------------------- */

/**
 * 账号名：中文 / 字母 / 数字 / `_` `-`，3–20 位。
 *
 * **大小写敏感**（站长定）：`Alice` 和 `alice` 是两个不同的账号，
 * 所以这里**不做小写归一化**。Postgres 的唯一索引默认就区分大小写，
 * 和这个规则一致，不会出现"数据库认为是两个、界面认为是同一个"的错位。
 */
export const UsernameSchema = z
  .string()
  .trim()
  .min(3, "TOO_SHORT")
  .max(20, "TOO_LONG")
  .regex(SAFE_NAME_CHARS, "INVALID_CHARS");

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

/**
 * Minecraft ID：3–16 位。
 *
 * 正版规则只允许 `[A-Za-z0-9_]`，但这里**也放行汉字** —— 站长要求兼容中文，
 * 而且这个字段本来就是用户自填、不做正版校验（`minecraftUuid` 同样）。
 * 真正要挡住的是 `§` 那类会把界面搞花的字符，所以复用同一套白名单。
 * 大小写**保留**：正版 ID 就是大小写敏感显示的。
 */
export const MinecraftNameSchema = z
  .string()
  .trim()
  .min(3, "TOO_SHORT")
  .max(16, "TOO_LONG")
  .regex(SAFE_NAME_CHARS, "INVALID_CHARS");

/**
 * UUID：标准 36 位（带连字符）或 32 位纯十六进制，大小写都收，
 * 存库前统一成**小写无连字符**的 32 位。
 * 空字符串表示"只填 ID 不填 UUID"。
 *
 * 这个字段本来就是严格的十六进制白名单，`§` 之类进不来；
 * 但它会被拼进皮肤头像的 URL，所以依然要卡死格式 —— 别改成宽松匹配。
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
