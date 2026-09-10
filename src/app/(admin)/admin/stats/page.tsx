import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  Download,
  FolderArchive,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { requireAdmin } from "@/server/auth";
import { getActivityStats } from "@/server/stats";
import { UserAvatarLink } from "@/components/user/user-avatar-link";
import { ActivityBarChart } from "@/components/admin/activity-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageEnter, Stagger, StaggerItem } from "@/components/motion/stagger";
import { StatCard, type StatIconName } from "@/components/motion/stat-card";
import { RowReveal } from "@/components/motion/row-reveal";
import { formatDateTime } from "@/lib/format";

/**
 * 活跃度统计（后台"数据"板块）。
 *
 * 三项口径都是「这个人/这个 IP 做了多少次」：
 *   - 评论：发出的评论 + 回复
 *   - 资源：发布的资源
 *   - 下载：下载资源附件
 *
 * 未登录访客只能按 IP 统计（下载是唯一不需要登录的操作），单列一块。
 * 点任意头像进 `/u/<id>` 资料页 —— 那个页面**任何访客都能看**。
 */
export default async function AdminStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdmin();
  const t = await getTranslations("admin.stats");
  const common = await getTranslations("common");
  const params = await searchParams;

  const { stats, page, totalPages, totalUsers } = await getActivityStats(
    Number(params.page) || 1
  );

  const cards: Array<{ label: string; value: number; iconName: StatIconName }> = [
    { label: t("totalComments"), value: stats.totals.comments, iconName: "message" },
    { label: t("totalResources"), value: stats.totals.resources, iconName: "archive" },
    { label: t("totalDownloads"), value: stats.totals.downloads, iconName: "download" },
    { label: t("guestDownloads"), value: stats.totals.guestDownloads, iconName: "network" },
  ];

  return (
    <PageEnter className="flex flex-col gap-8">
      <Stagger inView={false} stagger={0.1} className="flex flex-col gap-8">
        <StaggerItem index={0}>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
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

        {/* 图表：条形图看排行 */}
        <StaggerItem index={2}>
          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="transition-all duration-300 hover:border-primary/25 hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-base">{t("chartUsers")}</CardTitle>
                <p className="text-xs text-muted-foreground">{t("chartUsersHint")}</p>
              </CardHeader>
              <CardContent>
                <ActivityBarChart
                  rows={stats.top.map((u) => ({
                    key: u.id,
                    label: u.name ?? "—",
                    comments: u.comments,
                    resources: u.resources,
                    downloads: u.downloads,
                    user: { id: u.id, uuid: u.uuid },
                  }))}
                />
              </CardContent>
            </Card>

            <Card className="transition-all duration-300 hover:border-primary/25 hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-base">{t("chartGuests")}</CardTitle>
                <p className="text-xs text-muted-foreground">{t("guestHint")}</p>
              </CardHeader>
              <CardContent>
                <ActivityBarChart
                  rows={stats.topGuests.map((g) => ({
                    key: g.ip,
                    label: g.ip,
                    comments: 0,
                    resources: 0,
                    downloads: g.downloads,
                  }))}
                />
              </CardContent>
            </Card>
          </div>
        </StaggerItem>

        {/* 明细表 */}
        <StaggerItem index={3} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">{t("byUser")}</h2>
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("user")}</TableHead>
                  <TableHead>{t("role")}</TableHead>
                  <TableHead className="w-28 text-right">{t("comments")}</TableHead>
                  <TableHead className="w-28 text-right">{t("resources")}</TableHead>
                  <TableHead className="w-28 text-right">{t("downloads")}</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.users.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {common("empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  stats.users.map((u, i) => (
                    <RowReveal
                      key={u.id}
                      index={i}
                      className="transition-colors duration-200 hover:bg-accent/40"
                    >
                      <TableCell>
                        <span className="flex items-center gap-2.5">
                          <UserAvatarLink
                            userId={u.id}
                            name={u.name}
                            uuid={u.uuid}
                            size={28}
                          />
                          <Link
                            href={`/u/${u.id}`}
                            className="truncate font-medium hover:underline"
                          >
                            {u.name ?? "—"}
                          </Link>
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>
                          {u.role}
                        </Badge>
                      </TableCell>
                      <MetricCell icon={MessageSquare} value={u.comments} />
                      <MetricCell icon={FolderArchive} value={u.resources} />
                      <MetricCell icon={Download} value={u.downloads} />
                      <TableCell>
                        <Link
                          href={`/u/${u.id}`}
                          aria-label={t("viewProfile")}
                          className="inline-flex text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <ChevronRight className="size-4" />
                        </Link>
                      </TableCell>
                    </RowReveal>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{t("userCount", { count: totalUsers })}</span>
            <Pagination page={page} totalPages={totalPages} />
          </div>
        </StaggerItem>

        {/* 访客完整名单（图表只看前 10，这里给全量） */}
        <StaggerItem index={4} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">{t("byGuest")}</h2>
          <div className="max-h-80 overflow-y-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("ip")}</TableHead>
                  <TableHead className="w-28 text-right">{t("downloads")}</TableHead>
                  <TableHead className="w-56">{t("lastDownload")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.guests.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {common("empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  stats.guests.map((g, i) => (
                    <RowReveal
                      key={g.ip}
                      index={Math.min(i, 12)}
                      className="transition-colors duration-200 hover:bg-accent/40"
                    >
                      <TableCell className="font-mono text-xs">{g.ip}</TableCell>
                      <MetricCell icon={Download} value={g.downloads} />
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(g.lastAt)}
                      </TableCell>
                    </RowReveal>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </StaggerItem>
      </Stagger>
    </PageEnter>
  );
}

/** 带图标的数字单元格 */
function MetricCell({
  icon: Icon,
  value,
}: {
  icon: typeof Download;
  value: number;
}) {
  return (
    <TableCell className="text-right">
      <span className="inline-flex items-center gap-1.5 tabular-nums">
        <Icon
          className={
            value > 0
              ? "size-3.5 text-muted-foreground"
              : "size-3.5 text-muted-foreground/40"
          }
        />
        <span className={value > 0 ? undefined : "text-muted-foreground/50"}>
          {value}
        </span>
      </span>
    </TableCell>
  );
}

function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  return (
    <div className="flex items-center gap-2">
      {page > 1 ? (
        <Link href={`?page=${page - 1}`} className="rounded-md border px-3 py-1 hover:bg-accent">
          ‹
        </Link>
      ) : (
        <span className="rounded-md border px-3 py-1 opacity-40">‹</span>
      )}
      <span>
        {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={`?page=${page + 1}`} className="rounded-md border px-3 py-1 hover:bg-accent">
          ›
        </Link>
      ) : (
        <span className="rounded-md border px-3 py-1 opacity-40">›</span>
      )}
    </div>
  );
}
