"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, requireAdmin } from "@/server/auth";
import {
  submitAnswers,
  SubmissionError,
  updateSubmissionStatus,
} from "@/server/submission";
import {
  createQuestionnaire,
  updateQuestionnaire,
  updateQuestionnaireStatus,
  deleteQuestionnaire,
} from "@/server/questionnaire";
import {
  SaveQuestionnaireSchema,
  SubmitAnswersSchema,
  UpdateSubmissionStatusSchema,
  type SaveQuestionnaireInput,
} from "@/lib/validators/questionnaire";
import type { SubmissionStatus } from "@prisma/client";

export type ActionState = { ok: boolean; error?: string; id?: string };

function fail(message: string): ActionState {
  return { ok: false, error: message };
}

/** 用户提交问卷 */
export async function submitQuestionnaire(
  questionnaireId: string,
  input: unknown
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized");

  const parsed = SubmitAnswersSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");

  try {
    await submitAnswers(questionnaireId, user.id, parsed.data.answers);
  } catch (err) {
    if (err instanceof SubmissionError) return fail(err.message);
    console.error("[submitQuestionnaire]", err);
    return fail("unknown");
  }

  revalidatePath("/dashboard");
  revalidatePath("/questionnaires");
  revalidatePath(`/questionnaires/${questionnaireId}`);
  return { ok: true };
}

/** Admin：创建问卷 */
export async function adminCreateQuestionnaire(input: {
  title: string;
  description?: string;
}): Promise<ActionState> {
  await requireAdmin();

  const title = input.title?.trim();
  if (!title) return fail("title_required");

  const q = await createQuestionnaire({
    title,
    description: input.description ?? null,
    status: "DRAFT",
  });

  revalidatePath("/admin/questionnaires");
  return { ok: true, id: q.id };
}

/** Admin：保存（创建/更新）问卷整体内容 */
export async function adminSaveQuestionnaire(
  id: string,
  input: unknown
): Promise<ActionState> {
  await requireAdmin();

  const parsed = SaveQuestionnaireSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");

  try {
    await updateQuestionnaire(id, parsed.data);
  } catch (err) {
    console.error("[adminSaveQuestionnaire]", err);
    return fail("unknown");
  }

  revalidatePath("/admin/questionnaires");
  revalidatePath(`/admin/questionnaires/${id}`);
  return { ok: true };
}

/** Admin：更新问卷状态（发布/暂停/草稿） */
export async function adminUpdateQuestionnaireStatus(
  id: string,
  status: "DRAFT" | "PUBLISHED" | "PAUSED"
): Promise<ActionState> {
  await requireAdmin();

  await updateQuestionnaireStatus(id, status);

  revalidatePath("/admin/questionnaires");
  return { ok: true };
}

/** Admin：删除问卷 */
export async function adminDeleteQuestionnaire(id: string): Promise<ActionState> {
  await requireAdmin();

  try {
    await deleteQuestionnaire(id);
  } catch (err) {
    console.error("[adminDeleteQuestionnaire]", err);
    return fail("unknown");
  }

  revalidatePath("/admin/questionnaires");
  return { ok: true };
}

/** Admin：更新提交审核状态 */
export async function adminUpdateSubmissionStatus(
  submissionId: string,
  status: SubmissionStatus
): Promise<ActionState> {
  await requireAdmin();

  const parsed = UpdateSubmissionStatusSchema.safeParse({ status });
  if (!parsed.success) return fail("invalid");

  await updateSubmissionStatus(submissionId, parsed.data.status);

  revalidatePath("/admin");
  return { ok: true };
}

export type { SaveQuestionnaireInput };
