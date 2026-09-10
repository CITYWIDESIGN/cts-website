import { z } from "zod";

/* ---------------------------------------------------------------------------
 * 资源分享（附件本体在 route handler 里用 FormData 读取，这里只校验元信息）
 * ------------------------------------------------------------------------- */

export const ResourceMetaSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(5000),
});

export const ResourceUpdateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().min(1).max(5000).optional(),
  imageUrl: z.string().nullable().optional(),
});

export type ResourceMetaInput = z.infer<typeof ResourceMetaSchema>;
export type ResourceUpdateInput = z.infer<typeof ResourceUpdateSchema>;

/* ---------------------------------------------------------------------------
 * 问卷
 * ------------------------------------------------------------------------- */

export const QuestionTypeSchema = z.enum([
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "TEXT",
  "TEXTAREA",
]);

export const QuestionnaireStatusSchema = z.enum([
  "DRAFT",
  "PUBLISHED",
  "PAUSED",
]);

const QuestionOptionInput = z.object({
  id: z.string().optional(),
  text: z.string().min(1).max(200),
  sortOrder: z.number().int().min(0),
});

const QuestionInput = z.object({
  id: z.string().optional(),
  type: QuestionTypeSchema,
  title: z.string().min(1).max(500),
  required: z.boolean(),
  sortOrder: z.number().int().min(0),
  options: z.array(QuestionOptionInput).default([]),
});

export const SaveQuestionnaireSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullish(),
  status: QuestionnaireStatusSchema,
  questions: z.array(QuestionInput).min(1),
});

export type SaveQuestionnaireInput = z.infer<typeof SaveQuestionnaireSchema>;

export const SubmitAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        value: z.string().max(5000),
      })
    )
    .max(100),
});

export type SubmitAnswersInput = z.infer<typeof SubmitAnswersSchema>;

export const UpdateSubmissionStatusSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
});

export const UpdateUserRoleSchema = z.object({
  role: z.enum(["USER", "ADMIN"]),
});
