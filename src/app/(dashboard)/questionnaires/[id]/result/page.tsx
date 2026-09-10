import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CheckCircle2 } from "lucide-react";
import { requireUser } from "@/server/auth";
import { getMySubmissionForQuestionnaire } from "@/server/submission";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stagger, StaggerItem, PageEnter } from "@/components/motion/stagger";
import { formatDateTime } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Submission", robots: { index: false, follow: false } };
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

export default async function SubmissionResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const t = await getTranslations("questionnaire");
  const common = await getTranslations("common");

  const submission = await getMySubmissionForQuestionnaire(id, user.id);
  if (!submission) notFound();

  return (
    <PageEnter className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Stagger inView={false} stagger={0.06} className="flex flex-col gap-4">
        <StaggerItem index={0} className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/12">
            <CheckCircle2 className="size-5 text-success" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold">
              {submission.questionnaire.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("submittedAt")} {formatDateTime(submission.submittedAt)}
            </p>
          </div>
          <Badge variant="success" className="ml-auto shrink-0">
            {common("submitted")}
          </Badge>
        </StaggerItem>

        {submission.answers.map((answer, i) => {
          const values = decodeValue(answer.value, answer.question.type);
          return (
            <StaggerItem key={answer.id} index={i + 1}>
              <Card className="transition-all duration-300 hover:border-primary/25 hover:shadow-md">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    <span className="mr-2 font-mono text-xs text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
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
