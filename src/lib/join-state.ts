import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/server/auth";

export type SubmissionStatusName = "PENDING" | "APPROVED" | "REJECTED";

export type JoinAction =
  /** 已提交，等待审核 */
  | { kind: "pending"; submissionId: string }
  /** 已通过审核 —— 不再展示任何入口 */
  | { kind: "approved" }
  /** 未提交（或被拒后可重填），给出可填写的问卷 */
  | {
      kind: "questionnaire";
      questionnaireId: string;
      /** 是否需要先登录（未登录时为 true） */
      requiresLogin: boolean;
    }
  /** 没有可填写的问卷且未提交 —— 展示占位以保持布局稳定 */
  | { kind: "empty" };

export interface JoinState {
  action: JoinAction;
  /** 当前用户是否已登录 */
  authed: boolean;
}

/**
 * 计算首页/导航 CTA 在不同登录与审核状态下的行为。
 *
 * 状态优先级：
 *   未登录              → 去登录
 *   已提交且审核中       → 查询审核结果
 *   已通过              → 不显示入口（用等尺寸占位保持布局）
 *   未提交 / 已被拒      → 去填写问卷
 *   无可填写问卷         → 等尺寸占位
 *
 * 用 React cache 保证同一次请求内只查一次库。
 */
export const loadJoinState = cache(async (): Promise<JoinState> => {
  const [user, questionnaires] = await Promise.all([
    getCurrentUser(),
    prisma.questionnaire.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
  ]);

  const firstId = questionnaires[0]?.id ?? null;

  if (!user) {
    return {
      authed: false,
      action: firstId
        ? { kind: "questionnaire", questionnaireId: firstId, requiresLogin: true }
        : { kind: "empty" },
    };
  }

  const submission = await prisma.submission.findFirst({
    where: { userId: user.id },
    orderBy: { submittedAt: "desc" },
    select: { id: true, questionnaireId: true, status: true },
  });

  if (submission?.status === "APPROVED") {
    return { authed: true, action: { kind: "approved" } };
  }

  if (submission && submission.status === "PENDING") {
    return { authed: true, action: { kind: "pending", submissionId: submission.id } };
  }

  // 未提交，或被拒后可重新填写：优先回到自己那份问卷，否则用最新问卷
  const targetId = submission?.questionnaireId ?? firstId;
  if (targetId) {
    return {
      authed: true,
      action: { kind: "questionnaire", questionnaireId: targetId, requiresLogin: false },
    };
  }

  return { authed: true, action: { kind: "empty" } };
});
