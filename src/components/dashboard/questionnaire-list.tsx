import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronRight, CheckCircle2, ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Reveal } from "@/components/motion/reveal";
import { formatDateTime } from "@/lib/format";

export type QuestionnaireListItem = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: Date;
  _count: { questions: number };
  submission: {
    status: string;
    submittedAt: Date;
  } | null;
};

export async function QuestionnaireList({
  items,
  emptyMessage,
}: {
  items: QuestionnaireListItem[];
  emptyMessage?: string;
}) {
  const t = await getTranslations("questionnaire");

  if (items.length === 0) {
    return (
      <Reveal>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
            <ClipboardList className="size-5 text-muted-foreground" />
          </span>
          <p className="text-muted-foreground">{emptyMessage}</p>
        </div>
      </Reveal>
    );
  }

  return (
    <Stagger className="flex flex-col gap-3">
      {items.map((q, i) => {
        const submitted = !!q.submission;
        return (
          <StaggerItem key={q.id} index={i}>
            <Card className="flex-row items-center justify-between gap-4 px-6 py-5 transition-all duration-300 ease-out hover:-translate-y-1 hover:border-primary/25 hover:shadow-md">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-semibold">{q.title}</h3>
                  <Badge variant={submitted ? "success" : "secondary"}>
                    {submitted ? t("completed") : t("notCompleted")}
                  </Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {q.description || t("questionCount", { count: q._count.questions })}
                </p>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{t("questionCount", { count: q._count.questions })}</span>
                  {submitted && (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="size-3.5 text-success" />
                      {t("submittedAt")} {formatDateTime(q.submission!.submittedAt)}
                    </span>
                  )}
                </div>
              </div>

              {submitted ? (
                <Button asChild variant="outline" size="sm" className="group shrink-0">
                  <Link href={`/questionnaires/${q.id}/result`}>
                    {t("viewSubmission")}
                    <ChevronRight className="transition-transform duration-300 group-hover:translate-x-0.5" />
                  </Link>
                </Button>
              ) : (
                <Button asChild size="sm" className="group shrink-0">
                  <Link href={`/questionnaires/${q.id}`}>
                    {t("start")}
                    <ChevronRight className="transition-transform duration-300 group-hover:translate-x-0.5" />
                  </Link>
                </Button>
              )}
            </Card>
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}
