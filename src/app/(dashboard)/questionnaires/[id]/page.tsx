import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getQuestionnaireWithQuestions } from "@/server/questionnaire";
import { prisma } from "@/lib/prisma";
import { QuestionnaireForm } from "@/components/questionnaire/questionnaire-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Questionnaire", robots: { index: false, follow: false } };
}

export default async function FillQuestionnairePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const questionnaire = await getQuestionnaireWithQuestions(id);
  if (!questionnaire) notFound();

  if (questionnaire.status !== "PUBLISHED") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="text-muted-foreground">
          This questionnaire is not available right now.
        </p>
      </div>
    );
  }

  const existing = await prisma.submission.findUnique({
    where: { questionnaireId_userId: { questionnaireId: id, userId: user.id } },
    select: { id: true },
  });

  if (existing) {
    redirect(`/questionnaires/${id}/result`);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <QuestionnaireForm
        questionnaire={{
          id: questionnaire.id,
          title: questionnaire.title,
          description: questionnaire.description,
          questions: questionnaire.questions,
        }}
      />
    </div>
  );
}
