import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Headphones, MessageSquare, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { SplitHeading } from "@/components/motion/split-heading";
import { PseudoQr } from "@/components/community/pseudo-qr";
import { siteConfig } from "@/config/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("community");
  return { title: t("title"), description: t("description") };
}

export default async function CommunityPage() {
  const t = await getTranslations("community");
  const { links } = siteConfig;

  const channels = [
    {
      key: "qq",
      icon: MessageSquare,
      badge: t("channels.qq.badge"),
    },
    {
      key: "oopz",
      icon: Headphones,
      badge: t("channels.oopz.badge"),
    },
    {
      key: "discord",
      icon: Users,
      badge: t("channels.discord.badge"),
    },
  ] as const;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      {/* 页头 */}
      <Stagger inView={false} stagger={0.11} className="flex flex-col gap-3">
        <StaggerItem index={0}>
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <span aria-hidden className="size-1.5 rounded-[2px] bg-primary" />
            {t("eyebrow")}
          </span>
        </StaggerItem>
        <StaggerItem index={1}>
          <SplitHeading
            text={t("title")}
            className="tracking-display text-3xl font-semibold sm:text-4xl"
          />
        </StaggerItem>
        <StaggerItem index={2}>
          <p className="max-w-2xl text-muted-foreground">{t("description")}</p>
        </StaggerItem>
      </Stagger>

      {/* 渠道卡片 */}
      <Stagger
        inView
        stagger={0.09}
        className="mt-10 grid gap-5 lg:grid-cols-3"
      >
        {channels.map((channel, i) => {
          const Icon = channel.icon;
          return (
            <StaggerItem key={channel.key} index={i} className="h-full">
              <Card className="group h-full transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-md">
                <CardHeader className="gap-3">
                  <div className="flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-transform duration-300 group-hover:scale-105">
                      <Icon className="size-5" />
                    </span>
                    <Badge variant="secondary">{channel.badge}</Badge>
                  </div>
                  <CardTitle className="text-base">
                    {t(`channels.${channel.key}.title`)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <p className="text-sm text-muted-foreground">
                    {t(`channels.${channel.key}.description`)}
                  </p>

                  {/* QQ 群：二维码 + 群号 */}
                  {channel.key === "qq" && (
                    <div className="mt-auto flex flex-col gap-3">
                      <div className="mx-auto rounded-xl border bg-background p-3">
                        {links.qqQrImage ? (
                          <Image
                            src={links.qqQrImage}
                            alt={t("channels.qq.qrAlt")}
                            width={148}
                            height={148}
                            className="size-[148px] rounded-md object-contain"
                          />
                        ) : (
                          <PseudoQr className="size-[148px] text-foreground/80" />
                        )}
                      </div>
                      <p className="text-center text-xs text-muted-foreground">
                        {t("channels.qq.groupLabel")}{" "}
                        <span className="font-mono font-medium text-foreground">
                          {links.qqGroup}
                        </span>
                      </p>
                    </div>
                  )}

                  {/* OOPZ 跳转按钮 */}
                  {channel.key === "oopz" && (
                    <div className="mt-auto">
                      <Button asChild className="group/btn w-full">
                        <a
                          href={links.oopz}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t("channels.oopz.button")}
                          <ArrowRight className="size-4 transition-transform duration-300 group-hover/btn:translate-x-0.5" />
                        </a>
                      </Button>
                    </div>
                  )}

                  {/* Discord 跳转按钮 */}
                  {channel.key === "discord" && (
                    <div className="mt-auto">
                      <Button
                        asChild
                        variant="outline"
                        className="group/btn w-full"
                      >
                        <a
                          href={links.discord}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t("channels.discord.button")}
                          <ArrowRight className="size-4 transition-transform duration-300 group-hover/btn:translate-x-0.5" />
                        </a>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </StaggerItem>
          );
        })}
      </Stagger>

      {/* 待补充内容占位 */}
      <Stagger inView stagger={0.08} className="mt-6">
        <StaggerItem index={0}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("placeholderTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                {t("placeholderDescription")}
              </p>
              <Separator />
              <ul className="flex flex-col gap-2">
                {["item1", "item2", "item3"].map((key) => (
                  <li
                    key={key}
                    className="flex items-center gap-3 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground"
                  >
                    <span
                      aria-hidden
                      className="size-1.5 shrink-0 rounded-[2px] bg-muted-foreground/40"
                    />
                    {t(`placeholder.${key}`)}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </StaggerItem>
      </Stagger>
    </div>
  );
}
