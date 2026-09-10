import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireAdmin } from "@/server/auth";
import { getStats, getRecentUsers, getRecentSubmissions } from "@/server/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageEnter, Stagger, StaggerItem } from "@/components/motion/stagger";
import { StatCard, type StatIconName } from "@/components/motion/stat-card";
import { displayNameOr } from "@/lib/display-name";
import { formatDateTime } from "@/lib/format";

export default async function AdminDashboardPage() {
  await requireAdmin();
  const t = await getTranslations("admin");
  const common = await getTranslations("common");

  const [stats, recentUsers, recentSubmissions] = await Promise.all([
    getStats(),
    getRecentUsers(),
    getRecentSubmissions(),
  ]);

  const cards: Array<{ label: string; value: number; iconName: StatIconName }> = [
    { label: t("totalUsers"), value: stats.totalUsers, iconName: "users" },
    { label: t("boundUsers"), value: stats.boundUsers, iconName: "shield" },
    { label: t("submissions"), value: stats.totalSubmissions, iconName: "file" },
    { label: t("pendingReview"), value: stats.pendingSubmissions, iconName: "clock" },
  ];

  return (
    <PageEnter className="flex flex-col gap-8">
      <Stagger inView={false} stagger={0.12} className="flex flex-col gap-8">
        <StaggerItem index={0}>
          <h1 className="text-2xl font-semibold tracking-tight">{t("overview")}</h1>
        </StaggerItem>

        <StaggerItem index={1}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card, i) => (
              <StatCard
                key={card.label}
                index={i}
                iconName={card.iconName}
                value={card.value}
                label={card.label}
              />
            ))}
          </div>
        </StaggerItem>

        <StaggerItem index={2}>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="transition-all duration-300 hover:border-primary/25 hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-base">{t("recentUsers")}</CardTitle>
              </CardHeader>
              <CardContent>
                <Stagger inView={false} stagger={0.07} className="flex flex-col gap-3">
                  {recentUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{common("empty")}</p>
                  ) : (
                    recentUsers.map((user, i) => (
                      <StaggerItem
                        key={user.id}
                        index={i}
                        className="flex items-center justify-between rounded-lg border px-4 py-2.5 transition-colors duration-300 hover:bg-accent/50"
                      >
                        <div>
                          <p className="font-medium">
                            {displayNameOr(user)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(user.createdAt)}
                          </p>
                        </div>
                        <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                          {user.role}
                        </Badge>
                      </StaggerItem>
                    ))
                  )}
                </Stagger>
              </CardContent>
            </Card>

            <Card className="transition-all duration-300 hover:border-primary/25 hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-base">{t("recentSubmissions")}</CardTitle>
              </CardHeader>
              <CardContent>
                <Stagger inView={false} stagger={0.07} className="flex flex-col gap-3">
                  {recentSubmissions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{common("empty")}</p>
                  ) : (
                    recentSubmissions.map((sub, i) => (
                      <StaggerItem key={sub.id} index={i}>
                        <Link
                          href={`/admin/submissions/${sub.id}`}
                          className="group/row flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-accent/50"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {displayNameOr(sub.user)}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {sub.questionnaire.title} · {formatDateTime(sub.submittedAt)}
                            </p>
                          </div>
                          <span className="flex shrink-0 items-center gap-2">
                            <Badge
                              variant={
                                sub.status === "APPROVED"
                                  ? "success"
                                  : sub.status === "REJECTED"
                                    ? "destructive"
                                    : "warning"
                              }
                            >
                              {common(sub.status.toLowerCase())}
                            </Badge>
                            <ChevronRight className="size-4 text-muted-foreground transition-transform duration-300 group-hover/row:translate-x-0.5" />
                          </span>
                        </Link>
                      </StaggerItem>
                    ))
                  )}
                </Stagger>
              </CardContent>
            </Card>
          </div>
        </StaggerItem>
      </Stagger>
    </PageEnter>
  );
}
