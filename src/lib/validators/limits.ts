import { z } from "zod";

/**
 * 普通用户的用量限额配置。
 *
 * 和 @/lib/validators/join-config 一样放在这里而不是 src/server 下：这份
 * schema 客户端也要用（上传前的前端预校验要显示"最大 5MB"这类文案），
 * 而 src/server 下的模块都带 `server-only`。
 *
 * **单位约定**：配置里一律存 MB（整数），字节数由 limitsToBytes() 派生。
 * 不用字节直接存是因为管理后台的表单要填数字，1024 比 1073741824 好填太多；
 * 也不用 GB 存是因为 0.5GB 这类小数会带来浮点转换的边界问题。
 *
 * 这些限额**只对普通用户生效**：管理员在 checkDailyLimit / checkQuota 里
 * 直接跳过，也不记账（见 @/server/limit 与 @/server/quota）。
 */

export const MB = 1024 * 1024;

/** 单个资源文件的理论上限：1GB。再大就不该走这个站内上传通道了 */
export const MAX_FILE_MB_CEILING = 1024;
/** 单张封面图上限：100MB。封面是转成 data URL 随表单传的，不宜过大 */
export const MAX_IMAGE_MB_CEILING = 100;

export const LimitsConfigSchema = z.object({
  /** 每天能发的评论数（含回复） */
  commentsPerDay: z.number().int().min(1).max(10_000),
  /** 每天能发布的资源数 */
  resourcesPerDay: z.number().int().min(1).max(1_000),
  /** 每天的上传总量上限（MB） */
  uploadQuotaMb: z.number().int().min(1).max(1024 * 1024),
  /** 每天的下载总量上限（MB） */
  downloadQuotaMb: z.number().int().min(1).max(1024 * 1024),
  /** 单个资源附件的大小上限（MB） */
  maxFileMb: z.number().int().min(1).max(MAX_FILE_MB_CEILING),
  /** 单张封面图的大小上限（MB） */
  maxImageMb: z.number().int().min(1).max(MAX_IMAGE_MB_CEILING),
});

export type LimitsConfig = z.infer<typeof LimitsConfigSchema>;

/**
 * 默认值 —— 和"可配置"之前写死在代码里的数字完全一致，
 * 所以升级后行为不变，管理员改之前没人受影响。
 */
export const DEFAULT_LIMITS: LimitsConfig = {
  commentsPerDay: 50,
  resourcesPerDay: 50,
  uploadQuotaMb: 1024, // 1GB
  downloadQuotaMb: 1024, // 1GB
  maxFileMb: 5,
  maxImageMb: 1,
};

/** 把 MB 单位换算成各处的字节数，避免每处都重复写 * 1024 * 1024 */
export function limitsToBytes(config: LimitsConfig) {
  return {
    uploadQuotaBytes: config.uploadQuotaMb * MB,
    downloadQuotaBytes: config.downloadQuotaMb * MB,
    maxFileBytes: config.maxFileMb * MB,
    maxImageBytes: config.maxImageMb * MB,
  };
}

/**
 * 比 zod 更严的业务校验：zod 只管单字段范围，管不了字段之间的关系。
 * 返回 null 表示通过，否则返回错误 key（由调用方翻译）。
 *
 * 为什么这两条必须拦：单文件上限高于每日总额度的话，用户永远传不完一个
 * 文件就被额度挡住 —— 表面配置合法，实际功能不可用。
 */
export function validateLimits(config: LimitsConfig): string | null {
  if (config.maxFileMb > config.uploadQuotaMb) return "file_over_quota";
  if (config.maxImageMb > config.uploadQuotaMb) return "image_over_quota";
  return null;
}
