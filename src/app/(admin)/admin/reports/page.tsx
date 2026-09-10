import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ExternalLink, Flag } from "lucide-react";
import { requireAdmin } from "@/server/auth";
import { listReports, countPendingReports } from "@/server/report";
import { ReportActions } from "@/components/admin/report-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Stagger, StaggerItem, PageEnter } from "@/components/motion/stagger";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * 后台：举报处理。
 *
 * 待处理排在前面；每条举报都会把被举报内容的摘要一起带出来，
 * 管理员不用来回跳转就能判断。
 */
export default async function AdminReportsPage() {
  await requireAdmin();
  const t = await getTranslations("admin.reports");
  const tr = await getTranslations("resources.report.reasons");

  const [reports, pendingCount] = await Promise.all([
    listReports(),
    countPendingReports(),
  ]);

  const pending = reports.filter((r) => r.status === "PENDING");
  const resolved = reports.filter((r) => r.status === "RESOLVED");

  return (
    <PageEnter className="flex flex-col gap-6">
      <Stagger inView={false} stagger={0.09} className="flex flex-col gap-6">
        <StaggerItem index={0}>
          <AdminPageHeader
            title={t("title")}
            description={t("description")}
            badge={
              pendingCount > 0 ? (
                <Badge variant="warning">
                  {t("pendingCount", { count: pendingCount })}
                </Badge>
              ) : undefined
            }
          />
        </StaggerItem>

        {/* 待处理 */}
        <StaggerItem index={1} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t("pending")}
          </h2>

          {pending.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                <span className="flex size-11 items-center justify-center rounded-full bg-muted">
                  <Flag className="size-5 text-muted-foreground" />
                </span>
                <p className="text-sm text-muted-foreground">{t("empty")}</p>
              </CardContent>
            </Card>
          ) : (
            pending.map((r) => (
              <Card key={r.id}>
                <CardContent className="flex flex-col gap-4 pt-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        r.targetType === "RESOURCE" ? "default" : "secondary"
                      }
                    >
                      {t(`targets.${r.targetType.toLowerCase()}`)}
                    </Badge>
                    <Badge variant="warning">{tr(r.reason)}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {t("reportedBy", { name: r.reporterName ?? "—" })} ·{" "}
                      {formatDateTime(r.createdAt)}
                    </span>
                  </div>

                  {/* 被举报内容摘要 */}
                  <div className="rounded-lg bg-muted/50 px-4 py-3">
                    {!r.targetExists ? (
                      <p className="text-sm text-muted-foreground">
                        {t("targetGone")}
                      </p>
                    ) : r.targetType === "RESOURCE" ? (
                      <p className="text-sm">
                        <span className="text-muted-foreground">
                          {t("resourceLabel")}：
                        </span>
                        {r.link ? (
                          <Link
                            href={r.link}
                            className="group inline-flex items-center gap-1 font-medium hover:text-primary"
                          >
                            {r.targetTitle ?? r.targetId}
                            <ExternalLink className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                          </Link>
                        ) : (
                          (r.targetTitle ?? r.targetId)
                        )}
                      </p>
                    ) : (
                      <p className="whitespace-pre-wrap text-sm">
                        <span className="text-muted-foreground">
                          {t("commentLabel")}：
                        </span>
                        {r.targetExcerpt ?? t("targetGone")}
                      </p>
                    )}

                    {r.detail && (
                      <p className="mt-2 whitespace-pre-wrap border-t pt-2 text-sm text-muted-foreground">
                        <span className="font-medium">{t("detailLabel")}：</span>
                        {r.detail}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <ReportActions
                      reportId={r.id}
                      targetType={r.targetType}
                      targetId={r.targetId}
                      disabled={!r.targetExists}
                    />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </StaggerItem>

        {/* 已处理 */}
        {resolved.length > 0 && (
          <StaggerItem index={2} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {t("resolved")}
            </h2>
            <div className="overflow-hidden rounded-xl border">
              <ul className="divide-y">
                {resolved.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm"
                  >
                    <Badge variant="secondary">
                      {t(`targets.${r.targetType.toLowerCase()}`)}
                    </Badge>
                    <span className="text-muted-foreground">{tr(r.reason)}</span>
                    <span className="truncate text-muted-foreground">
                      {r.targetTitle ?? r.targetExcerpt ?? r.targetId}
                    </span>
                    <span
                      className={cn(
                        "ml-auto shrink-0 text-xs",
                        r.resolution === "removed"
                          ? "text-destructive"
                          : "text-muted-foreground"
                      )}
                    >
                      {r.resolution === "removed"
                        ? t("resolvedRemoved")
                        : t("resolvedDismissed")}
                      {r.handledAt ? ` · ${formatDateTime(r.handledAt)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </StaggerItem>
        )}
      </Stagger>
    </PageEnter>
  );
}
