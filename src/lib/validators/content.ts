import { z } from "zod";

/**
 * 管理员可编辑的站点内容：统计数字、服务器介绍与配置、规则。
 *
 * 和 @/lib/validators/join-config、limits 一样放在这里而不是 src/server 下：
 * 后台表单（客户端）也要用这些 schema 和默认值。
 *
 * 双语字段用 `{ zh, en }`（见 @/lib/localized），英文可选、缺失回退中文。
 */

/** 中文必填、英文可选的一段文本 */
export const LocalizedSchema = z.object({
  zh: z.string().trim().min(1, "required").max(2000),
  en: z.string().trim().max(2000).default(""),
});

/** 首页数据区块的四个数字 */
export const StatsConfigSchema = z.object({
  players: z.number().int().min(0).max(99_999_999),
  builds: z.number().int().min(0).max(99_999_999),
  members: z.number().int().min(0).max(99_999_999),
  days: z.number().int().min(0).max(99_999_999),
});

export type StatsConfig = z.infer<typeof StatsConfigSchema>;

export const DEFAULT_STATS: StatsConfig = {
  players: 320,
  builds: 480,
  members: 260,
  days: 720,
};

/** 一条服务器配置，例如 内存 / 64 GB */
export const ServerSpecSchema = z.object({
  label: LocalizedSchema,
  value: z.string().trim().min(1, "required").max(120),
});

export const ServerInfoSchema = z.object({
  /** 服务器介绍，展示在 /server 页顶部 */
  intro: LocalizedSchema,
  /** 硬件/系统配置列表 */
  specs: z.array(ServerSpecSchema).max(20),
});

export type ServerInfo = z.infer<typeof ServerInfoSchema>;

export const DEFAULT_SERVER_INFO: ServerInfo = {
  intro: {
    zh: "我们使用一台独立物理服务器长期运行这个世界。",
    en: "The world runs on a dedicated machine, kept online for the long term.",
  },
  specs: [
    { label: { zh: "操作系统", en: "OS" }, value: "Debian 13" },
    { label: { zh: "处理器", en: "CPU" }, value: "Intel i9-13900K" },
    { label: { zh: "内存", en: "Memory" }, value: "64 GB" },
    { label: { zh: "存储", en: "Storage" }, value: "2 TB" },
    { label: { zh: "服务端", en: "Server" }, value: "Fabric" },
  ],
};

/** 一条服务器规则 */
export const RuleSchema = z.object({
  title: LocalizedSchema,
  content: LocalizedSchema,
});

export const RulesConfigSchema = z.array(RuleSchema).max(20);

export type RulesConfig = z.infer<typeof RulesConfigSchema>;

export const DEFAULT_RULES: RulesConfig = [
  {
    title: { zh: "基本行为规范", en: "Conduct" },
    content: {
      zh: "尊重其他玩家。禁止骚扰、仇恨言论或任何形式的歧视。",
      en: "Respect other players. Harassment, hate speech and discrimination of any kind are not allowed.",
    },
  },
  {
    title: { zh: "游戏规则", en: "Gameplay" },
    content: {
      zh: "禁止作弊、外挂或利用漏洞。允许使用原版机制内的自动化与红石设计。",
      en: "Cheating, hacked clients and bug exploitation are not allowed. Automation and redstone built from vanilla mechanics are.",
    },
  },
  {
    title: { zh: "建筑规则", en: "Building" },
    content: {
      zh: "未经允许，不得破坏他人建筑或占用他人已规划的用地。",
      en: "Do not damage other players' builds or occupy land they have already claimed, without permission.",
    },
  },
  {
    title: { zh: "红石与机械", en: "Redstone and machines" },
    content: {
      zh: "允许建造机械与自动化设施；禁止以消耗服务器性能为目的的装置，例如超大量实体堆叠或高频红石卡服。",
      en: "Machines and automation are welcome. Devices whose only purpose is to consume server performance — huge entity stacks, fast clocks used to lag the server — are not.",
    },
  },
  {
    title: { zh: "处罚规则", en: "Enforcement" },
    content: {
      zh: "违反规则视情节轻重，可能面临警告、临时封禁或永久封禁。",
      en: "Depending on severity, breaking these rules may lead to a warning, a temporary ban or a permanent one.",
    },
  },
];

/* ---------------------------------------------------------------- 公告 */

/**
 * 后台提交的公告数据。
 *
 * `publishedAt` 走 `YYYY-MM-DD`（`<input type="date">` 的格式）而不是 Date：
 * 跨 Server Action 边界传 Date 也行，但字符串更好校验，也避免了时区在序列化
 * 过程中被悄悄改掉。日期补成当天 UTC 零点，展示只用到日期部分。
 */
export const AnnouncementInputSchema = z.object({
  titleZh: z.string().trim().min(1, "required").max(200),
  titleEn: z.string().trim().max(200).default(""),
  bodyZh: z.string().trim().min(1, "required").max(4000),
  bodyEn: z.string().trim().max(4000).default(""),
  tagZh: z.string().trim().max(40).default(""),
  tagEn: z.string().trim().max(40).default(""),
  published: z.boolean(),
  publishedAt: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "invalid_date"),
});

export type AnnouncementInput = z.infer<typeof AnnouncementInputSchema>;
