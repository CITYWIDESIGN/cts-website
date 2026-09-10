import "server-only";

import type { SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class SubmissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubmissionError";
  }
}

/** 提交问卷：校验必填项后原子写入 Submission + Answer */
export async function submitAnswers(
  questionnaireId: string,
  userId: string,
  answers: Array<{ questionId: string; value: string }>
) {
  const questionnaire = await prisma.questionnaire.findUnique({
    where: { id: questionnaireId },
    include: {
      questions: {
        where: { required: true },
        select: { id: true },
      },
    },
  });

  if (!questionnaire) {
    throw new SubmissionError("Questionnaire not found.");
  }
  if (questionnaire.status !== "PUBLISHED") {
    throw new SubmissionError("This questionnaire is not open for submission.");
  }

  // 服务端必填校验：所有必填题目都必须有非空答案
  const answered = new Map(answers.map((a) => [a.questionId, a.value]));
  for (const q of questionnaire.questions) {
    const value = answered.get(q.id);
    if (value === undefined || value.trim() === "") {
      throw new SubmissionError("Please complete all required questions.");
    }
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.submission.findUnique({
      where: {
        questionnaireId_userId: { questionnaireId, userId },
      },
    });
    if (existing) {
      throw new SubmissionError("You have already submitted this questionnaire.");
    }

    const submission = await tx.submission.create({
      data: {
        questionnaireId,
        userId,
        status: "PENDING",
      },
    });

    await tx.answer.createMany({
      data: answers.map((a) => ({
        submissionId: submission.id,
        questionId: a.questionId,
        value: a.value,
      })),
    });

    return submission;
  });
}

/** 当前用户的提交列表 */
export async function listMySubmissions(userId: string) {
  return prisma.submission.findMany({
    where: { userId },
    orderBy: { submittedAt: "desc" },
    include: {
      questionnaire: {
        select: { id: true, title: true },
      },
    },
  });
}

/** 用户查看自己在某份问卷的提交详情 */
export async function getMySubmissionForQuestionnaire(
  questionnaireId: string,
  userId: string
) {
  return prisma.submission.findUnique({
    where: {
      questionnaireId_userId: { questionnaireId, userId },
    },
    include: {
      questionnaire: {
        select: { id: true, title: true },
      },
      answers: {
        include: {
          question: {
            select: {
              id: true,
              title: true,
              type: true,
              options: {
                orderBy: { sortOrder: "asc" },
                select: { id: true, text: true },
              },
            },
          },
        },
        orderBy: {
          question: { sortOrder: "asc" },
        },
      },
    },
  });
}

/** 用户查看自己的某次提交详情 */
export async function getMySubmission(submissionId: string, userId: string) {
  return prisma.submission.findFirst({
    where: { id: submissionId, userId },
    include: {
      questionnaire: {
        select: { id: true, title: true },
      },
      answers: {
        include: {
          question: {
            select: {
              id: true,
              title: true,
              type: true,
              options: {
                orderBy: { sortOrder: "asc" },
                select: { id: true, text: true },
              },
            },
          },
        },
        orderBy: {
          question: { sortOrder: "asc" },
        },
      },
    },
  });
}

// ------------------------------------------------------------------
// Admin
// ------------------------------------------------------------------

export async function listSubmissionsForQuestionnaire(questionnaireId: string) {
  return prisma.submission.findMany({
    where: { questionnaireId },
    orderBy: { submittedAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          minecraftUuid: true,
          minecraftUsername: true,
        },
      },
    },
  });
}

export async function getSubmissionDetail(submissionId: string) {
  return prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      questionnaire: {
        select: { id: true, title: true },
      },
      user: {
        select: {
          id: true,
          username: true,
          minecraftUuid: true,
          minecraftUsername: true,
        },
      },
      answers: {
        include: {
          question: {
            select: {
              id: true,
              title: true,
              type: true,
              options: {
                orderBy: { sortOrder: "asc" },
                select: { id: true, text: true },
              },
            },
          },
        },
        orderBy: {
          question: { sortOrder: "asc" },
        },
      },
    },
  });
}

export async function updateSubmissionStatus(
  submissionId: string,
  status: SubmissionStatus
) {
  return prisma.submission.update({
    where: { id: submissionId },
    data: { status },
  });
}

export async function countSubmissionsByStatus() {
  const grouped = await prisma.submission.groupBy({
    by: ["status"],
    _count: { status: true },
  });
  const result: Record<string, number> = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
  for (const g of grouped) {
    result[g.status] = g._count.status;
  }
  return result;
}
