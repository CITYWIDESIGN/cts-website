import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * 破坏性操作审计。
 *
 * 为什么要有：曾经库里 13 个资源全被删掉，`pg_stat_user_tables` 只能告诉我
 * "删过 13 行"，说不出**是谁、什么时候、删的哪个**。事后完全无法复盘。
 *
 * 原则：
 *   - 每次不可逆操作写一条，**失败也不影响主流程**（审计不该成为故障点）
 *   - 字段冗余存名字/标题，因为目标之后很可能就查不到了
 *   - 不记隐私内容，只记"谁、何时、对什么、做了什么"
 */

export type AuditAction =
  | "resource.delete"
  | "user.purge"
  | "user.anonymize"
  | "report.remove_content"
  | "join_config.update";

export interface AuditInput {
  action: AuditAction;
  actorId?: string | null;
  actorName?: string | null;
  targetType: "resource" | "user" | "comment" | "setting";
  targetId: string;
  targetLabel?: string | null;
  detail?: Record<string, unknown> | null;
}

/** 写一条审计。**绝不抛错** —— 审计失败不能连累正事。 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        actorId: input.actorId ?? null,
        actorName: input.actorName ?? null,
        targetType: input.targetType,
        targetId: input.targetId,
        targetLabel: input.targetLabel ?? null,
        // Prisma 的 Json 字段不接受宽泛的 Record<string, unknown>，得显式转一下
        detail: (input.detail ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
      },
    });
  } catch (err) {
    console.error("[audit] 写入失败（已忽略）", err);
  }
}

/** 后台审计列表 */
export async function listAuditLogs(take = 100) {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take,
  });
}
