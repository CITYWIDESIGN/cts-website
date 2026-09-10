import "server-only";

import { Prisma, type QuestionnaireStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const questionsWithOptions = {
  questions: {
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      type: true,
      title: true,
      required: true,
      sortOrder: true,
      options: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, text: true, sortOrder: true },
      },
    },
  },
} satisfies Prisma.QuestionnaireInclude;

export type QuestionnaireWithQuestions = Prisma.QuestionnaireGetPayload<{
  include: typeof questionsWithOptions;
}>;

/** 公开：已发布问卷列表（含题目数量） */
export async function listPublishedQuestionnaires() {
  return prisma.questionnaire.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      createdAt: true,
      _count: { select: { questions: true } },
    },
  });
}

/** 用户视角：已发布问卷 + 当前用户的提交状态 */
export async function listQuestionnairesForUser(userId: string) {
  const questionnaires = await prisma.questionnaire.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      createdAt: true,
      _count: { select: { questions: true } },
    },
  });

  const submissions = await prisma.submission.findMany({
    where: { userId, questionnaireId: { in: questionnaires.map((q) => q.id) } },
    select: { questionnaireId: true, status: true, submittedAt: true },
  });

  const submissionMap = new Map(
    submissions.map((s) => [s.questionnaireId, s])
  );

  return questionnaires.map((q) => ({
    ...q,
    submission: submissionMap.get(q.id) ?? null,
  }));
}

/** 获取问卷（含题目与选项），用于填写 */
export async function getQuestionnaireWithQuestions(id: string) {
  return prisma.questionnaire.findUnique({
    where: { id },
    include: questionsWithOptions,
  });
}

// ------------------------------------------------------------------
// Admin
// ------------------------------------------------------------------

export async function listAllQuestionnaires() {
  return prisma.questionnaire.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: { questions: true, submissions: true },
      },
    },
  });
}

export async function getQuestionnaireById(id: string) {
  return prisma.questionnaire.findUnique({
    where: { id },
    include: questionsWithOptions,
  });
}

export async function createQuestionnaire(data: {
  title: string;
  description?: string | null;
  status: QuestionnaireStatus;
}) {
  return prisma.questionnaire.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      status: data.status,
    },
  });
}

/**
 * 更新问卷（标题/描述/状态/题目与选项）。
 * 采用「整体替换」策略：删除不在输入中的题目/选项，更新或创建新的。
 * 注意：这会级联删除对应答案（onDelete: Cascade）。
 */
export async function updateQuestionnaire(
  id: string,
  data: {
    title: string;
    description?: string | null;
    status: QuestionnaireStatus;
    questions: Array<{
      id?: string;
      type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TEXT" | "TEXTAREA";
      title: string;
      required: boolean;
      sortOrder: number;
      options: Array<{ id?: string; text: string; sortOrder: number }>;
    }>;
  }
) {
  return prisma.$transaction(async (tx) => {
    await tx.questionnaire.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description ?? null,
        status: data.status,
      },
    });

    const existingQuestions = await tx.question.findMany({
      where: { questionnaireId: id },
      select: { id: true },
    });
    const keepQuestionIds = new Set(
      data.questions.map((q) => q.id).filter(Boolean) as string[]
    );
    const toDeleteQuestions = existingQuestions
      .filter((q) => !keepQuestionIds.has(q.id))
      .map((q) => q.id);

    if (toDeleteQuestions.length > 0) {
      await tx.question.deleteMany({
        where: { id: { in: toDeleteQuestions } },
      });
    }

    for (const q of data.questions) {
      const choiceTypes =
        q.type === "SINGLE_CHOICE" || q.type === "MULTIPLE_CHOICE";

      if (q.id) {
        await tx.question.update({
          where: { id: q.id },
          data: {
            type: q.type,
            title: q.title,
            required: q.required,
            sortOrder: q.sortOrder,
          },
        });

        // 同步选项
        const existingOptions = await tx.questionOption.findMany({
          where: { questionId: q.id },
          select: { id: true },
        });
        const keepOptionIds = new Set(
          q.options.map((o) => o.id).filter(Boolean) as string[]
        );
        await tx.questionOption.deleteMany({
          where: {
            questionId: q.id,
            id: { notIn: [...keepOptionIds] },
          },
        });

        if (choiceTypes) {
          for (const opt of q.options) {
            if (opt.id) {
              await tx.questionOption.update({
                where: { id: opt.id },
                data: { text: opt.text, sortOrder: opt.sortOrder },
              });
            } else {
              await tx.questionOption.create({
                data: {
                  questionId: q.id,
                  text: opt.text,
                  sortOrder: opt.sortOrder,
                },
              });
            }
          }
        } else {
          // 非选择题清空选项
          await tx.questionOption.deleteMany({
            where: { questionId: q.id },
          });
        }
        void existingOptions;
      } else {
        await tx.question.create({
          data: {
            questionnaireId: id,
            type: q.type,
            title: q.title,
            required: q.required,
            sortOrder: q.sortOrder,
            options:
              choiceTypes && q.options.length > 0
                ? {
                    create: q.options.map((o) => ({
                      text: o.text,
                      sortOrder: o.sortOrder,
                    })),
                  }
                : undefined,
          },
        });
      }
    }
  });

  return getQuestionnaireById(id);
}

export async function updateQuestionnaireStatus(
  id: string,
  status: QuestionnaireStatus
) {
  return prisma.questionnaire.update({
    where: { id },
    data: { status },
  });
}

export async function deleteQuestionnaire(id: string) {
  return prisma.questionnaire.delete({ where: { id } });
}
