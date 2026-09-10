import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Eye, ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/server/auth";
import { getQuestionnaireById } from "@/server/questionnaire";
import { listSubmissionsForQuestionnaire } from "@/server/submission";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageEnter, Stagger, StaggerItem } from "@/components/motion/stagger";
import { RowReveal } from "@/components/motion/row-reveal";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { formatDateTime, formatUuid } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Results", robots: { index: false, follow: false } };
}

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdmin();
  const t = await getTranslations("admin.results");
  const common = await getTranslations("common");

  const questionnaire = await getQuestionnaireById(id);
  if (!questionnaire) notFound();

  const submissions = await listSubmissionsForQuestionnaire(id);

  return (
    <PageEnter className="flex flex-col gap-6">
      <Stagger inView={false} stagger={0.09} className="flex flex-col gap-6">
        <StaggerItem index={0}>
          <AdminPageHeader
            title={questionnaire.title}
            description={`${submissions.length} ${t("submissions")}`}
            actions={
              <Button asChild variant="ghost" size="sm" className="group">
                <Link href="/admin/questionnaires">
                  <ArrowLeft className="transition-transform duration-300 group-hover:-translate-x-0.5" />
                  {t("review.back")}
                </Link>
              </Button>
            }
          />
        </StaggerItem>

        <StaggerItem index={1}>
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("player")}</TableHead>
                  <TableHead>UUID</TableHead>
                  <TableHead>{t("submittedAt")}</TableHead>
                  <TableHead>{common("status")}</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      {t("noSubmissions")}
                    </TableCell>
                  </TableRow>
                ) : (
                  submissions.map((sub, i) => (
                    <RowReveal
                      key={sub.id}
                      index={i}
                      className="transition-colors duration-200 hover:bg-accent/40"
                    >
                      <TableCell className="font-medium">
                        {sub.user.minecraftUsername ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {formatUuid(sub.user.minecraftUuid)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(sub.submittedAt)}
                      </TableCell>
                      <TableCell>
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
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="icon">
                          <Link href={`/admin/submissions/${sub.id}`}>
                            <Eye />
                          </Link>
                        </Button>
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
