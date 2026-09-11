import { getTranslations } from "next-intl/server";
import { Users, Server as ServerIcon, Gamepad2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { CountUp } from "@/components/motion/count-up";
import { siteConfig } from "@/config/site";

/**
 * 服务器状态卡片。
 *
 * **故意不显示服务器地址** —— 地址只在入服审核通过后单独告知。
 * 第三列改成支持平台，保持三栏结构不变。
 *
 * 在线人数当前是 siteConfig 里的 mock 值，未来可换成
 * Minecraft Server Status API（如 mcsrvstat.us）的实时数据。
 */
export async function ServerStatus() {
  const t = await getTranslations("home.status");
  const common = await getTranslations("common");
  const server = siteConfig.server;

  const statusLabel = server.online ? common("online") : common("offline");
  const platform = [server.java ? t("java") : null, "Fabric"]
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
                  {server.online && (
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
                  )}
                  <span
                    className={`relative inline-flex size-2.5 rounded-full ${
                      server.online ? "bg-success" : "bg-muted-foreground"
                    }`}
                  />
                </span>
                {statusLabel}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-2 text-sm">
                <ServerIcon className="size-4 text-muted-foreground" />
                {common("version")} {server.version}
              </span>
              <span className="flex items-center gap-2 text-sm">
                <Users className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t("playersOnline")}:</span>
                <CountUp value={server.onlinePlayers} duration={1.2} /> / {server.maxPlayers}
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
