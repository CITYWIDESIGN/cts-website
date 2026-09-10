import { z } from "zod";

/**
 * 「加入我们」按钮的行为配置。
 *
 * 为什么单独放一个文件：这份 schema 同时被服务端（读写数据库、校验管理员
 * 提交）和客户端（后台表单、按钮渲染）使用。放在 src/server 下会被
 * `server-only` 挡住，所以定义在这里，由 @/server/settings.ts 负责落库。
 */

/** 支持的四种行为。加新类型时同步改这里、JoinConfigSchema 和按钮渲染。 */
export const JOIN_ACTION_KINDS = [
  /** 去做问卷（管理员指定，或用最新发布的） */
  "questionnaire",
  /** 跳外链（QQ 群、Discord、外部报名表……） */
  "link",
  /** 跳站内页面（/rules、/server 之类） */
  "page",
  /** 关闭入口 —— 首页不再显示「加入我们」按钮 */
  "disabled",
] as const;

export type JoinActionKind = (typeof JOIN_ACTION_KINDS)[number];

/** 只允许 http/https —— 挡掉 `javascript:` 这类能执行脚本的伪协议 */
export function isSafeHttpUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * 站内路径。规则和 @/lib/safe-redirect 一致：
 * 必须以单个 `/` 开头，挡掉 `//evil.com`、`/\evil.com`、反斜杠和控制字符。
 */
export function isSafeSitePath(raw: string): boolean {
  if (!raw.startsWith("/")) return false;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return false;
  if (raw.includes("\\")) return false;
  return !/[\u0000-\u0020\u007f]/.test(raw);
}

export const JoinConfigSchema = z.object({
  /**
   * 是否要求先登录。
   * 默认 true —— 未登录点「加入我们」先去 /login，登录后再落回真正的目标。
   */
  requireLogin: z.boolean(),

  action: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("questionnaire"),
      /** null = 用最新的已发布问卷 */
      questionnaireId: z.string().min(1).nullable(),
    }),
    z.object({
      kind: z.literal("link"),
      url: z.string().trim().min(1).max(500),
      /** 是否新标签页打开（外链默认 true） */
      newTab: z.boolean(),
    }),
    z.object({
      kind: z.literal("page"),
      path: z.string().trim().min(1).max(300),
    }),
    z.object({ kind: z.literal("disabled") }),
  ]),
});

export type JoinConfig = z.infer<typeof JoinConfigSchema>;
export type JoinActionConfig = JoinConfig["action"];

/**
 * 没配置过时的默认行为：未登录先登录，登录后去最新的一份已发布问卷。
 * 和加这个配置之前的老逻辑完全一致。
 */
export const DEFAULT_JOIN_CONFIG: JoinConfig = {
  requireLogin: true,
  action: { kind: "questionnaire", questionnaireId: null },
};

/**
 * 比 zod 更严的业务校验（zod 只管类型和长度）。
 * 返回 null 表示通过，否则返回错误 key（由调用方翻译）。
 */
export function validateJoinConfig(config: JoinConfig): string | null {
  if (config.action.kind === "link" && !isSafeHttpUrl(config.action.url)) {
    return "invalid_url";
  }
  if (config.action.kind === "page" && !isSafeSitePath(config.action.path)) {
    return "invalid_path";
  }
  return null;
}
