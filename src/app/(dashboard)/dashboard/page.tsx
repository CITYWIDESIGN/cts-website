import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Fingerprint,
  Settings,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { requireUser } from "@/server/auth";
import { listQuestionnairesForUser } from "@/server/questionnaire";
import { listMySubmissions } from "@/server/submission";
import { QuestionnaireList } from "@/components/dashboard/questionnaire-list";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { QuoteCard } from "@/components/dashboard/quote-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { formatDate, formatUuid } from "@/lib/format";
import { skinHeadUrl } from "@/lib/skin";
import { displayName } from "@/lib/display-name";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function DashboardPage() {
  const user = await requireUser();
  const t = await getTranslations("dashboard");
  const nav = await getTranslations("nav");
  const common = await getTranslations("common");

  const [questionnaires, mySubmissions] = await Promise.all([
    listQuestionnairesForUser(user.id),
    listMySubmissions(user.id),
  ]);

  const latest = mySubmissions[0] ?? null;
  const bound = !!user.minecraftUuid;
  // 没填游戏 ID 就显示账号名，不然未绑定 Minecraft 的用户这里是一片「—」
  const username = displayName(user) ?? "—";
  const initial = (username.charAt(0) ?? "?").toUpperCase();
  const headUrl = skinHeadUrl(user.minecraftUuid, 96);

  const submittedCount = questionnaires.filter((q) => q.submission).length;

  const stats = [
    { label: t("statQuestionnaires"), value: `${submittedCount}/${questionnaires.length}` },
    { label: t("statSubmissions"), value: String(mySubmissions.length) },
    { label: t("statBinding"), value: bound ? t("bound") : t("notBound") },
  ];

  const quickLinks = [
    { href: "/questionnaires", label: nav("myQuestionnaires"), icon: ClipboardList },
    { href: "/dashboard/settings", label: nav("accountSettings"), icon: Settings },
    ...(user.role === "ADMIN"
      ? [{ href: "/admin", label: nav("admin"), icon: ShieldCheck }]
      : []),
  ];

  const reviewState = latest
    ? {
        PENDING: {
          icon: Clock,
          tone: "text-warning",
          bg: "bg-warning/12",
          badge: "warning" as const,
          title: t("statusPending"),
          description: t("statusPendingDescription"),
        },
        APPROVED: {
          icon: CheckCircle2,
          tone: "text-success",
          bg: "bg-success/12",
          badge: "success" as const,
          title: t("statusApproved"),
          description: t("statusApprovedDescription"),
        },
        REJECTED: {
          icon: XCircle,
          tone: "text-destructive",
          bg: "bg-destructive/12",
          badge: "destructive" as const,
          title: t("statusRejected"),
          description: t("statusRejectedDescription"),
        },
      }[latest.status]
    : null;

  const ReviewIcon = reviewState?.icon ?? ClipboardList;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      {/* 1. 身份条：皮肤头像 + 名字 + 三个关键状态 */}
      <Stagger
        inView={false}
        stagger={0.08}
        className="flex flex-col gap-6 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:p-6"
      >
        <StaggerItem index={0} className="flex items-center gap-4">
          <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 ring-1 ring-border">
            {headUrl ? (
              <Image
                src={headUrl}
                alt={username}
                width={64}
                height={64}
                unoptimized
                priority
                referrerPolicy="no-referrer"
                className="size-full [image-rendering:pixelated]"
              />
            ) : (
              <span className="text-xl font-semibold text-primary">{initial}</span>
            )}
          </span>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {t("title")}
            </p>
            <h1 className="truncate text-xl font-semibold tracking-tight">
              {username}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={bound ? "success" : "secondary"}>
                {bound ? t("bound") : t("notBound")}
              </Badge>
              {user.role === "ADMIN" && (
                <Badge variant="default">{nav("admin")}</Badge>
              )}
            </div>
          </div>
        </StaggerItem>

        <StaggerItem
          index={1}
          className="grid flex-1 grid-cols-3 gap-3 sm:border-l sm:pl-6"
        >
          {stats.map((s, i) => (
            <div
              key={s.label}
              className="group transition-transform duration-300 hover:-translate-y-0.5"
              style={{ transitionDelay: `${i * 20}ms` }}
            >
              <p className="text-lg font-semibold tabular-nums">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </StaggerItem>
      </Stagger>

      {/* 2. 主区：审核状态 + 皮肤展示 */}
      <Stagger
        inView={false}
        stagger={0.09}
        delay={0.1}
        className="mt-6 grid gap-6 lg:grid-cols-3"
      >
        <StaggerItem index={0} className="lg:col-span-2">
          <Card className="group h-full transition-all duration-300 hover:border-primary/25 hover:shadow-md">
            <CardHeader>
              <CardTitle className="text-base">{t("reviewStatus")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105 ${
                    reviewState ? reviewState.bg : "bg-accent"
                  }`}
                >
                  <ReviewIcon
                    className={`size-5 ${
                      reviewState ? reviewState.tone : "text-accent-foreground"
                    }`}
                  />
                </span>
                <div className="min-w-0">
                  <p className="font-medium">
                    {reviewState ? reviewState.title : t("statusNone")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {reviewState
                      ? reviewState.description
                      : t("statusNoneDescription")}
                  </p>
                </div>
              </div>

              <Separator />

              {latest ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {latest.questionnaire.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("submittedAt")} {formatDate(latest.submittedAt)}
                    </p>
                  </div>
                  <Badge variant={reviewState?.badge ?? "secondary"}>
                    {common(latest.status.toLowerCase())}
                  </Badge>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("noQuestionnaires")}
                </p>
              )}

              {latest && (
                <Link
                  href={`/questionnaires/${latest.questionnaireId}/result`}
                  className="group/link inline-flex w-fit items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
                >
                  {t("viewAnswers")}
                  <ChevronRight className="size-3.5 transition-transform duration-300 group-hover/link:translate-x-0.5" />
                </Link>
              )}
            </CardContent>
          </Card>
        </StaggerItem>

        {/* 一言 */}
        <StaggerItem index={1}>
          <Card className="h-full transition-all duration-300 hover:border-primary/25 hover:shadow-md">
            <CardHeader>
              <CardTitle className="text-base">{t("quote.title")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <QuoteCard />
            </CardContent>
          </Card>
        </StaggerItem>
      </Stagger>

      {/* 3. 账户信息 */}
      <Stagger inView={false} stagger={0.08} delay={0.18} className="mt-6">
        <StaggerItem index={0}>
          <Card className="group transition-all duration-300 hover:border-primary/25 hover:shadow-md">
            <CardHeader>
              <CardTitle className="text-base">{t("account")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              {[
                { icon: ShieldCheck, label: t("role"), value: user.role },
                { icon: CalendarDays, label: t("registered"), value: formatDate(user.createdAt) },
                { icon: Fingerprint, label: t("uuid"), value: formatUuid(user.minecraftUuid), mono: true },
              ].map((row) => {
                const Icon = row.icon;
                return (
                  <div key={row.label} className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-transform duration-300 group-hover:scale-105">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{row.label}</p>
                      <p
                        className={
                          row.mono
                            ? "break-all font-mono text-xs"
                            : "truncate text-sm font-medium"
                        }
                      >
                        {row.value}
                      </p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </StaggerItem>
      </Stagger>

      {/* 4. 问卷 */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold">{t("questionnaire.title")}</h2>
        <div className="mt-4">
          <QuestionnaireList
            items={questionnaires}
            emptyMessage={t("noQuestionnaires")}
          />
        </div>
      </div>

      {/* 5. 快捷入口（原顶栏下拉菜单的功能） */}
      <Stagger
        inView
        stagger={0.07}
        className="mt-6 grid gap-3 sm:grid-cols-3"
      >
        {quickLinks.map((link, i) => {
          const Icon = link.icon;
          return (
            <StaggerItem key={link.href} index={i}>
              <Link
                href={link.href}
                className="group flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md"
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-transform duration-300 group-hover:scale-105">
                  <Icon className="size-4" />
                </span>
                <span className="text-sm font-medium">{link.label}</span>
                <ChevronRight className="ml-auto size-4 text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
            </StaggerItem>
          );
        })}
      </Stagger>

      <LogoutButton index={quickLinks.length + 2} label={nav("logout")} />
    </div>
  );
}
