import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/server/auth";
import { getQuestionnaireById } from "@/server/questionnaire";
import { QuestionnaireEditor } from "@/components/admin/questionnaire-editor";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Edit questionnaire", robots: { index: false, follow: false } };
}

export default async function EditQuestionnairePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdmin();

  const questionnaire = await getQuestionnaireById(id);
  if (!questionnaire) notFound();

  return (
    <QuestionnaireEditor
      questionnaire={{
        id: questionnaire.id,
        title: questionnaire.title,
        description: questionnaire.description,
        status: questionnaire.status,
        questions: questionnaire.questions,
      }}
    />
  );
}
