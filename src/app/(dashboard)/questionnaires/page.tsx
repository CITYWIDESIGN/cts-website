import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/server/auth";
import { listQuestionnairesForUser } from "@/server/questionnaire";
import { QuestionnaireList } from "@/components/dashboard/questionnaire-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("questionnaire");
  return { title: t("listTitle"), robots: { index: false, follow: false } };
}

export default async function QuestionnairesPage() {
  const user = await requireUser();
  const t = await getTranslations("questionnaire");
  const d = await getTranslations("dashboard");
  const items = await listQuestionnairesForUser(user.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("listTitle")}
        </h1>
        <p className="text-muted-foreground">{t("listDescription")}</p>
      </div>

      <div className="mt-8">
        <QuestionnaireList items={items} emptyMessage={d("noQuestionnaires")} />
      </div>
    </div>
  );
}
