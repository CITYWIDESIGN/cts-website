/**
 * 站点 / 服务器基本信息。
 *
 * 这些数据目前作为静态配置存在，便于首页、服务器页、SEO 等复用。
 * 未来如需「管理员编辑服务器信息」，可将这些字段迁移到数据库，并保留本文件作为默认回退。
 */

export const siteConfig = {
  name: "Minecraft Server",
  shortName: "MCServer",
  description: "一个属于玩家的 Minecraft 世界",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  server: {
    address: "play.example.com",
    version: "1.21.x",
    java: true,
    bedrock: false,
    maxPlayers: 100,
    // 在线人数 / 状态在真实环境中由 Minecraft Server Status API 提供，这里仅作 mock 回退
    online: true,
    onlinePlayers: 37,
    gameModes: ["Survival", "Creative"],
    openedAt: "2024",
  },
  stats: {
    players: 12847,
    builds: 3200,
    members: 5600,
    days: 1240,
  },
  links: {
    discord: "https://discord.gg/nsHa44gRP",
    /** OOPZ 语音频道邀请链接 */
    oopz: "https://oopz.cn/i/TxvBKI",
    /** QQ 群号，展示在社区页 */
    qqGroup: "1020898782",
    /**
     * QQ 群二维码图片。
     * 留空时社区页会渲染一个"占位二维码"（纯装饰、不可扫）。
     * 换真图：把图片放到 public/community/qq-qr.png，然后把这里改成
     * "/community/qq-qr.png"。
     */
    qqQrImage: "",
  },
} as const;

export type SiteConfig = typeof siteConfig;
