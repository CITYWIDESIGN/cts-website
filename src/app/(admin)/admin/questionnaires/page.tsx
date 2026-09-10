import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Edit, BarChart3 } from "lucide-react";
import { requireAdmin } from "@/server/auth";
import { listAllQuestionnaires } from "@/server/questionnaire";
import { NewQuestionnaireButton, QuestionnaireStatusButton, DeleteQuestionnaireButton } from "@/components/admin/questionnaire-actions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageEnter, Stagger, StaggerItem } from "@/components/motion/stagger";
import { Reveal } from "@/components/motion/reveal";
import { formatDate } from "@/lib/format";

export default async function AdminQuestionnairesPage() {
  await requireAdmin();
  const t = await getTranslations("admin.questionnaireManagement");
  const common = await getTranslations("common");

  const questionnaires = await listAllQuestionnaires();

  const statusVariant = (status: string) =>
    status === "PUBLISHED"
      ? "success"
      : status === "PAUSED"
        ? "warning"
        : "secondary";

  return (
    <PageEnter className="flex flex-col gap-6">
      <Reveal>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
            <p className="text-muted-foreground">{t("description")}</p>
          </div>
          <NewQuestionnaireButton />
        </div>
      </Reveal>

      {questionnaires.length === 0 ? (
        <Reveal>
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-20 text-center">
            <p className="text-muted-foreground">{t("noQuestionnaires")}</p>
            <NewQuestionnaireButton />
          </div>
        </Reveal>
      ) : (
        <Stagger className="flex flex-col gap-3">
          {questionnaires.map((q, i) => (
            <StaggerItem key={q.id} index={i}>
              <Card className="gap-4 transition-all duration-300 ease-out hover:-translate-y-1 hover:border-primary/25 hover:shadow-md">
                <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-semibold">{q.title}</h3>
                      <Badge variant={statusVariant(q.status)}>
                        {common(q.status.toLowerCase())}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {q._count.questions} · {q._count.submissions}{" "}
                      {t("submissions")}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("createdAt")} {formatDate(q.createdAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/questionnaires/${q.id}/edit`}>
                        <Edit />
                        {common("edit")}
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/questionnaires/${q.id}/results`}>
                        <BarChart3 />
                        {t("viewResults")}
                      </Link>
                    </Button>
                    <QuestionnaireStatusButton id={q.id} status={q.status} />
                    <DeleteQuestionnaireButton id={q.id} />
                  </div>
                </div>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </PageEnter>
  );
}
