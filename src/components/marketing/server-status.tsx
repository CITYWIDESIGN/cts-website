import { getTranslations } from "next-intl/server";
import { Users, Server as ServerIcon, Gamepad2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { CountUp } from "@/components/motion/count-up";
import { siteConfig } from "@/config/site";
import { getServerStatus } from "@/server/mc-ping";

/**
 * 服务器状态卡片。
 *
 * **故意不显示服务器地址** —— 地址只在入服审核通过后单独告知。
 * 第三列改成支持平台，保持三栏结构不变。
 *
 * 在线人数来自 **Server List Ping**（见 @/server/mc-ping）：站点和服务器同机，
 * 直接对 `127.0.0.1:25565` 说一次协议就能拿到真实人数，不需要装插件、
 * 也不经过第三方 API。三种情况分得很清楚：
 *
 *   - `MC_PING=0`（关掉探测）→ 回退到 `siteConfig` 里的静态值
 *   - 探测成功             → 用真实人数与上限
 *   - 探测失败（服务器没开）→ 显示"离线"，**不显示过期的数字**
 */
export async function ServerStatus() {
  const t = await getTranslations("home.status");
  const common = await getTranslations("common");
  const config = siteConfig.server;

  const live = await getServerStatus();

  // 没开启探测就完全按静态配置渲染，行为和以前一致
  const online = live ? live.online : config.online;
  const playersOnline = live ? (live.players?.online ?? null) : config.onlinePlayers;
  const maxPlayers = live ? (live.players?.max ?? config.maxPlayers) : config.maxPlayers;
  const version = live?.version ?? config.version;

  const statusLabel = online ? common("online") : common("offline");
  const platform = [config.java ? t("java") : null, "Fabric"]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <Reveal>
        <Card className="mx-auto max-w-3xl">
          <CardContent className="grid gap-5 p-5 sm:grid-cols-3 sm:p-6">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {t("eyebrow")}
              </span>
              <span className="mt-2 inline-flex items-center gap-2 text-sm font-medium">
                <span className="relative flex size-2.5">
                  {online && (
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
                  )}
                  <span
                    className={`relative inline-flex size-2.5 rounded-full ${
                      online ? "bg-success" : "bg-muted-foreground"
                    }`}
                  />
                </span>
                {statusLabel}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-2 text-sm">
                <ServerIcon className="size-4 text-muted-foreground" />
                {common("version")} {version}
              </span>
              <span className="flex items-center gap-2 text-sm">
                <Users className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t("playersOnline")}:</span>
                {playersOnline === null ? (
                  // 离线时服务端不会给人数，宁可留空也不显示上次的数字
                  <span className="tabular-nums">—</span>
                ) : (
                  <>
                    <CountUp value={playersOnline} duration={1.2} /> / {maxPlayers}
                  </>
                )}
              </span>
            </div>

            <div className="flex flex-col items-start gap-2 sm:items-end">
              <span className="text-xs text-muted-foreground">{t("platform")}</span>
              <span className="flex items-center gap-2 text-sm font-medium">
                <Gamepad2 className="size-4 text-muted-foreground" />
                {platform}
              </span>
            </div>
          </CardContent>
        </Card>
      </Reveal>
    </section>
  );
}
