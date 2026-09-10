import { getTranslations } from "next-intl/server";
import { AlertTriangle, FileArchive, Settings2, Trash2, UserX } from "lucide-react";
import { requireAdmin } from "@/server/auth";
import { listAuditLogs } from "@/server/audit";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageEnter, Stagger, StaggerItem } from "@/components/motion/stagger";
import { RowReveal } from "@/components/motion/row-reveal";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { formatDateTime } from "@/lib/format";

/**
 * 审计日志（后台「数据」板块）。
 *
 * 起因：有一次库里的资源全没了，`pg_stat_user_tables` 只能告诉我"删过 13 行"，
 * 说不出操作者。这个页面就是为了让这种事**下次 10 秒能查清**。
 *
 * 只记破坏性操作，不记浏览/普通编辑。
 */
export default async function AdminAuditPage() {
  await requireAdmin();
  const t = await getTranslations("admin.audit");

  const logs = await listAuditLogs(200);

  return (
    <PageEnter className="flex flex-col gap-6">
      <Stagger inView={false} stagger={0.09} className="flex flex-col gap-6">
        <StaggerItem index={0}>
          <AdminPageHeader title={t("title")} description={t("description")} />
        </StaggerItem>

        <StaggerItem index={1}>
          <Card className="border-warning/40 bg-warning/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlertTriangle className="size-4 text-warning" />
                {t("noticeTitle")}
              </CardTitle>
              <CardDescription className="text-xs">
                {t("notice")}
              </CardDescription>
            </CardHeader>
          </Card>
        </StaggerItem>

        <StaggerItem index={2} className="flex flex-col gap-2">
          {logs.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              {t("empty")}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {logs.map((log, i) => {
                const Icon =
                  log.action === "user.purge" || log.action === "user.anonymize"
                    ? UserX
                    : log.action === "resource.delete"
                      ? FileArchive
                      : log.action === "join_config.update"
                        ? Settings2
                        : Trash2;
                const danger = log.action === "user.purge";
                /** 配置变更不算"破坏性"，用中性色，免得每次改配置都弹一条警告色 */
                const neutral = log.action === "join_config.update";

                return (
                  <RowReveal
                    key={log.id}
                    index={Math.min(i, 12)}
                    className="rounded-xl border px-4 py-3 transition-colors duration-200 hover:bg-accent/40"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={
                          danger
                            ? "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive"
                            : neutral
                              ? "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                              : "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning"
                        }
                      >
                        <Icon className="size-4" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={danger ? "destructive" : neutral ? "secondary" : "warning"}>
                            {t(`actions.${log.action.replace(/\./g, "_")}`)}
                          </Badge>
                          <span className="truncate text-sm font-medium">
                            {log.targetLabel ?? log.targetId}
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("by", { name: log.actorName ?? t("system") })} ·{" "}
                          {formatDateTime(log.createdAt)}
                        </p>

                        {log.detail != null && (
                          <p className="mt-1 font-mono text-[11px] text-muted-foreground/80">
                            {JSON.stringify(log.detail)}
                          </p>
                        )}
                      </div>

                      <span className="hidden shrink-0 font-mono text-[10px] text-muted-foreground/60 sm:block">
                        {log.targetId}
                      </span>
                    </div>
                  </RowReveal>
                );
              })}
            </ul>
          )}

          {logs.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t("count", { count: logs.length })}
            </p>
          )}
        </StaggerItem>
      </Stagger>
    </PageEnter>
  );
}
