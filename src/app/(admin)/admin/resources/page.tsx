import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireAdmin } from "@/server/auth";
import { listResources } from "@/server/resource";
import { ResourceAdminActions } from "@/components/admin/resource-admin-actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageEnter, Stagger, StaggerItem } from "@/components/motion/stagger";
import { RowReveal } from "@/components/motion/row-reveal";
import { formatBytes, formatDateTime } from "@/lib/format";

export default async function AdminResourcesPage() {
  await requireAdmin();
  const t = await getTranslations("admin.resources");

  const resources = await listResources();

  return (
    <PageEnter className="flex flex-col gap-6">
      <Stagger inView={false} stagger={0.09} className="flex flex-col gap-6">
        <StaggerItem index={0}>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </StaggerItem>

        <StaggerItem index={1}>
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columns.title")}</TableHead>
                  <TableHead>{t("columns.uploader")}</TableHead>
                  <TableHead>{t("columns.size")}</TableHead>
                  <TableHead>{t("columns.downloads")}</TableHead>
                  <TableHead>{t("columns.createdAt")}</TableHead>
                  <TableHead className="w-56" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {resources.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {t("empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  resources.map((r, i) => (
                    <RowReveal
                      key={r.id}
                      index={i}
                      className="transition-colors duration-200 hover:bg-accent/40"
                    >
                      <TableCell className="max-w-[240px]">
                        <Link
                          href={`/resources/${r.id}`}
                          className="group inline-flex items-center gap-1.5 font-medium hover:text-primary"
                        >
                          <span className="truncate">{r.title}</span>
                          <ExternalLink className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">
                          {r.fileName}
                        </p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.uploaderName ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{formatBytes(r.fileSize)}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {r.downloads}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(r.createdAt)}
                      </TableCell>
                      <TableCell>
                        <ResourceAdminActions
                          id={r.id}
                          title={r.title}
                          description={r.description}
                        />
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
