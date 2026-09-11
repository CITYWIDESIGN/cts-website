/**
 * 站点 / 服务器基本信息。
 *
 * 这些数据目前作为静态配置存在，便于首页、服务器页、SEO 等复用。
 * 未来如需「管理员编辑服务器信息」，可将这些字段迁移到数据库，并保留本文件作为默认回退。
 */

export const siteConfig = {
  name: "CTS服务器",
  shortName: "CTServer",
  description:
    "Fabric 服务端，原版机制，以生电（红石与自动化）和建筑为主要玩法。没有经济系统，也没有插件。",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  server: {
    address: "ctserver.top",
    version: "1.21.x",
    /** Fabric 服务端 → 只支持 Java 版 */
    java: true,
    bedrock: false,
    maxPlayers: 50,
    // 在线人数 / 状态在真实环境中由 Minecraft Server Status API 提供，这里仅作 mock 回退
    online: true,
    onlinePlayers: 8,
    /**
     * 游戏模式。存的是 **i18n 键**（`server.modes.*`）而不是展示文案 ——
     * 直接写 "Survival" 之类的话，中文页面上会冒出英文。
     */
    gameModes: ["survival", "technical", "building"],
    openedAt: "2024",
  },
  /** 首页数据区块。目前是 mock 值，接入真实统计后替换 */
  stats: {
    players: 320,
    builds: 480,
    members: 260,
    days: 720,
  },
  links: {
    discord: "https://discord.gg/nsHa44gRP",
    /** OOPZ 语音频道邀请链接 */
    oopz: "https://oopz.cn/i/TxvBKI",
    /** QQ 群号，展示在社区页 */
    qqGroup: "1020898782",
    /**
     * QQ 群二维码图片。
     * **留空即可** —— 留空时社区页用内置的矢量二维码
     * （src/components/community/qq-qr.tsx，站点配色、跟随明暗主题）。
     * 想换成自备图片（例如官方导出的原图）就把这里指过去，
     * 例如 "/community/qq-qr.png"。
     */
    qqQrImage: "",
  },
} as const;

export type SiteConfig = typeof siteConfig;
