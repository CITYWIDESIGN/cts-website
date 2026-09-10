import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/server/auth";
import { getSubmissionDetail } from "@/server/submission";
import { SubmissionStatusActions } from "@/components/admin/submission-status-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageEnter, Stagger, StaggerItem } from "@/components/motion/stagger";
import { formatDateTime, formatUuid } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Submission detail", robots: { index: false, follow: false } };
}

function decodeValue(value: string, type: string): string[] {
  if (type === "MULTIPLE_CHOICE") {
    try {
      const arr = JSON.parse(value);
      return Array.isArray(arr) ? arr : [value];
    } catch {
      return [value];
    }
  }
  return [value];
}

export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdmin();
  const t = await getTranslations("admin.results.review");
  const common = await getTranslations("common");

  const submission = await getSubmissionDetail(id);
  if (!submission) notFound();

  return (
    <PageEnter className="mx-auto flex max-w-3xl flex-col gap-6">
      <Stagger inView={false} stagger={0.07} className="flex flex-col gap-6">
        <StaggerItem index={0} className="flex items-center justify-between gap-4">
          <Button asChild variant="ghost" size="sm" className="group">
            <Link href={`/admin/questionnaires/${submission.questionnaireId}/results`}>
              <ArrowLeft className="transition-transform duration-300 group-hover:-translate-x-0.5" />
              {t("back")}
            </Link>
          </Button>
          <SubmissionStatusActions
            submissionId={submission.id}
            status={submission.status}
          />
        </StaggerItem>

        <StaggerItem index={1}>
          <Card className="transition-all duration-300 hover:border-primary/25 hover:shadow-md">
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>{submission.questionnaire.title}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {submission.user.minecraftUsername ?? "—"}
                </p>
              </div>
              <Badge
                variant={
                  submission.status === "APPROVED"
                    ? "success"
                    : submission.status === "REJECTED"
                      ? "destructive"
                      : "warning"
                }
              >
                {common(submission.status.toLowerCase())}
              </Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">{t("player")}</span>
                <span className="font-medium">
                  {submission.user.minecraftUsername ?? "—"}
                </span>
              </div>
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">{t("uuid")}</span>
                <span className="break-all font-mono text-xs">
                  {formatUuid(submission.user.minecraftUuid)}
                </span>
              </div>
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">{t("submitted")}</span>
                <span className="font-medium">
                  {formatDateTime(submission.submittedAt)}
                </span>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>

        {submission.answers.map((answer, i) => {
          const values = decodeValue(answer.value, answer.question.type);
          return (
            <StaggerItem key={answer.id} index={i + 2}>
              <Card className="transition-all duration-300 hover:border-primary/25 hover:shadow-md">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    <span className="mr-2 font-mono text-xs text-muted-foreground">
                      Q{i + 1}
                    </span>
                    {answer.question.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm">
                    {values.length === 0 ? (
                      <span className="text-muted-foreground">{common("none")}</span>
                    ) : (
                      <ul className="list-disc space-y-1 pl-4">
                        {values.map((v) => (
                          <li key={v}>{v}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          );
        })}
      </Stagger>
    </PageEnter>
  );
}
