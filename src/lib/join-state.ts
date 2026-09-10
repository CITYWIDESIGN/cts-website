import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/server/auth";
import { getJoinConfig } from "@/server/settings";
import type { JoinActionConfig } from "@/lib/validators/join-config";

export type SubmissionStatusName = "PENDING" | "APPROVED" | "REJECTED";

export type JoinAction =
  /** 已提交，等待审核 */
  | { kind: "pending"; submissionId: string }
  /** 已通过审核 —— 不再展示任何入口 */
  | { kind: "approved" }
  /** 去做问卷（管理员指定，或最新发布的） */
  | { kind: "questionnaire"; questionnaireId: string }
  /** 跳外链（QQ 群 / Discord / 外部报名表……） */
  | { kind: "link"; url: string; newTab: boolean }
  /** 跳站内页面 */
  | { kind: "page"; path: string }
  /** 没有可用目标 —— 展示占位以保持布局稳定 */
  | { kind: "empty" };

export interface JoinState {
  action: JoinAction;
  /** 当前用户是否已登录 */
  authed: boolean;
  /**
   * 未登录、且管理员要求先登录 —— 按钮应指向 /login。
   * 登录后再点一次就会落到真正的目标。
   */
  needsLogin: boolean;
}

/**
 * 计算首页/导航 CTA 在不同配置、登录与审核状态下的行为。
 *
 * 行为由管理员在后台「加入我们」配置里决定（kind 见 JoinActionConfig），
 * 但审核状态优先 —— 已经提交过申请的人关心的是"我过没过"，不是重新填一遍：
 *
 *   后台关闭入口         → 不显示（用等尺寸占位保持布局）
 *   已通过              → 不显示
 *   审核中              → 查询审核结果
 *   未登录且要求登录     → 去登录（指向 /login，状态里带 needsLogin）
 *   未提交 / 已被拒      → 走管理员配置的行为
 *
 * 用 React cache 保证同一次请求内只查一次库。
 */
export const loadJoinState = cache(async (): Promise<JoinState> => {
  const [user, config] = await Promise.all([getCurrentUser(), getJoinConfig()]);

  const authed = Boolean(user);
  const needsLogin = config.requireLogin && !authed;
  const noAction: JoinState = { authed, needsLogin: false, action: { kind: "empty" } };

  // 管理员关掉了入口 —— 登录与否都不显示
  if (config.action.kind === "disabled") return noAction;

  // 已登录才谈得上审核状态
  const submission = user
    ? await prisma.submission.findFirst({
        where: { userId: user.id },
        orderBy: { submittedAt: "desc" },
        select: { id: true, questionnaireId: true, status: true },
      })
    : null;

  if (submission?.status === "APPROVED") {
    return { authed, needsLogin: false, action: { kind: "approved" } };
  }

  if (submission?.status === "PENDING") {
    return { authed, needsLogin: false, action: { kind: "pending", submissionId: submission.id } };
  }

  // 未提交、或被拒后可重填、或未登录：交给配置
  const action = await resolveAction(config.action, {
    previousQuestionnaireId: submission?.questionnaireId ?? null,
  });

  return { authed, needsLogin, action };
});

/**
 * 把配置里的行为翻译成可渲染的目标。
 *
 * 参数排除了 "disabled"：那种情况下首页根本不显示按钮，调用方已经提前返回，
 * 在这里再判一次只会让 switch 分支永远走不到。
 *
 * 问卷这一支要做"目标还在不在"的兜底：管理员选了某份问卷，之后那问卷被
 * 下线或删掉，首页不能因此空掉或报错 —— 退回最新一份已发布问卷。
 */
async function resolveAction(
  config: Exclude<JoinActionConfig, { kind: "disabled" }>,
  ctx: { previousQuestionnaireId: string | null }
): Promise<JoinAction> {
  switch (config.kind) {
    case "link":
      return { kind: "link", url: config.url, newTab: config.newTab };

    case "page":
      return { kind: "page", path: config.path };

    case "questionnaire": {
      const id = await resolveQuestionnaireId(config.questionnaireId, ctx.previousQuestionnaireId);
      return id ? { kind: "questionnaire", questionnaireId: id } : { kind: "empty" };
    }
  }
}

/**
 * 决定最终用哪份问卷：
 *   1. 管理员指定了具体问卷 → 用它（若已下线则忽略）
 *   2. 用户之前填过、被拒过 → 回到那一份，省得重新找
 *   3. 否则 → 最新发布的
 */
async function resolveQuestionnaireId(
  configuredId: string | null,
  previousQuestionnaireId: string | null
): Promise<string | null> {
  // 优先级：管理员指定 > 用户之前填过的那份
  const preferred = configuredId ?? previousQuestionnaireId;

  if (preferred) {
    const found = await prisma.questionnaire.findFirst({
      where: { id: preferred, status: "PUBLISHED" },
      select: { id: true },
    });
    if (found) return found.id;
  }

  // 指定/历史的都失效了：退回最新发布的
  const latest = await prisma.questionnaire.findFirst({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return latest?.id ?? null;
}
