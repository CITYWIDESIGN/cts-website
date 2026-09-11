import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import {
  Server as ServerIcon,
  Monitor,
  Users,
  CalendarDays,
  Gamepad2,
  Cpu,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stagger, StaggerItem, MotionCard } from "@/components/motion/stagger";
import { SplitHeading } from "@/components/motion/split-heading";
import { siteConfig } from "@/config/site";
import { getRules, getServerInfo } from "@/server/settings";
import { pickLocalized, localizedKey } from "@/lib/localized";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("server");
  return { title: t("title"), description: t("description") };
}

export default async function ServerPage() {
  const t = await getTranslations("server");
  const statusT = await getTranslations("home.status");
  const locale = await getLocale();
  const server = siteConfig.server;

  const [serverInfo, rules] = await Promise.all([getServerInfo(), getRules()]);

  const info = [
    {
      icon: Monitor,
      label: t("platform"),
      value: [server.java ? statusT("java") : null, "Fabric"]
        .filter(Boolean)
        .join(" · "),
    },
    { icon: ServerIcon, label: t("version"), value: server.version },
    {
      icon: Gamepad2,
      label: t("mode"),
      // gameModes 里存的是 i18n 键，这里再翻译成展示文案
      value: server.gameModes.map((m) => t(`modes.${m}`)).join(" · "),
    },
    { icon: Users, label: t("maxPlayers"), value: String(server.maxPlayers) },
    { icon: CalendarDays, label: t("opened"), value: server.openedAt },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      {/* 页头：眉标 → 标题（逐字）→ 描述，各自错开 */}
      <Stagger inView={false} stagger={0.11} className="flex flex-col gap-3">
        <StaggerItem index={0}>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            {t("eyebrow")}
          </span>
        </StaggerItem>
        <StaggerItem index={1}>
          <SplitHeading
            text={t("title")}
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
          />
        </StaggerItem>
        <StaggerItem index={2}>
          <p className="max-w-2xl text-muted-foreground">{t("description")}</p>
        </StaggerItem>
      </Stagger>

      {/*
        服务器介绍。
        **故意不显示服务器地址** —— 地址只在入服审核通过后单独告知，
        不放在公开页面上。
      */}
      <Stagger inView stagger={0.09} delay={0.1} className="mt-10">
        <StaggerItem index={0}>
          <Card className="transition-all duration-300 hover:border-primary/25 hover:shadow-md">
            <CardHeader>
              <CardTitle>{t("introTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-muted-foreground">
                {pickLocalized(locale, serverInfo.intro)}
              </p>
            </CardContent>
          </Card>
        </StaggerItem>
      </Stagger>

      {/* 硬件/系统配置：管理员在后台维护 */}
      {serverInfo.specs.length > 0 && (
        <Stagger inView stagger={0.07} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {serverInfo.specs.map((spec, i) => (
            <MotionCard key={localizedKey(spec.label, i)} index={i} className="h-full">
              <Card className="group h-full gap-3 py-5">
                <div className="flex items-start gap-3 px-6">
                  <Cpu className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:scale-110" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {pickLocalized(locale, spec.label)}
                    </p>
                    <p className="mt-0.5 font-medium">{spec.value}</p>
                  </div>
                </div>
              </Card>
            </MotionCard>
          ))}
        </Stagger>
      )}

      {/* 基本信息 */}
      <Stagger inView stagger={0.07} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {info.map((item, i) => {
          const Icon = item.icon;
          return (
            <MotionCard key={item.label} index={i} className="h-full">
              <Card className="group h-full gap-3 py-5">
                <div className="flex items-start gap-3 px-6">
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:scale-110" />
                  <div>
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                    <p className="mt-0.5 font-medium">{item.value}</p>
                  </div>
                </div>
              </Card>
            </MotionCard>
          );
        })}
      </Stagger>

      {/* 规则摘要：标题单独入场，每条逐项滑入 */}
      <div className="mt-10">
        <Stagger inView stagger={0.08} className="flex flex-col gap-3">
          <StaggerItem index={0}>
            <h2 className="text-xl font-semibold">{t("rulesSummary")}</h2>
          </StaggerItem>
          {rules.map((rule, i) => (
            <StaggerItem
              key={localizedKey(rule.title, i)}
              index={i + 1}
              className="flex items-start gap-3 rounded-lg border px-4 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-sm"
            >
              <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-primary" />
              <div>
                <p className="font-medium">{pickLocalized(locale, rule.title)}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {pickLocalized(locale, rule.content)}
                </p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </div>
  );
}
