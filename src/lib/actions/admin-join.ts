"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { setJoinConfig } from "@/server/settings";
import {
  JoinConfigSchema,
  validateJoinConfig,
  type JoinConfig,
} from "@/lib/validators/join-config";
import { recordAudit } from "@/server/audit";
import type { ActionState } from "./admin";

/**
 * Admin：保存「加入我们」的行为配置。
 *
 * 校验分三层，任何一层不过都不落库：
 *   1. zod —— 结构、类型、长度（url 必须是外部链接、path 必须以 / 开头等）
 *   2. validateJoinConfig —— 业务规则（挡掉 `javascript:` 伪协议、`//evil.com`）
 *   3. 指定问卷时必须**仍然存在且已发布**，否则首页会指向一份下线了的问卷
 *
 * 写完 revalidatePath("/", "layout")：首页/页头/页脚的 CTA 都要跟着变。
 * 入参走 zod 而不是直接信任客户端 —— 这个 action 可以被任意请求伪造调用。
 */
export async function adminSaveJoinConfig(input: unknown): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = JoinConfigSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const config: JoinConfig = parsed.data;

  const invalid = validateJoinConfig(config);
  if (invalid) return { ok: false, error: invalid };

  if (config.action.kind === "questionnaire" && config.action.questionnaireId) {
    const exists = await prisma.questionnaire.findFirst({
      where: { id: config.action.questionnaireId, status: "PUBLISHED" },
      select: { id: true },
    });
    if (!exists) return { ok: false, error: "questionnaire_not_found" };
  }

  try {
    await setJoinConfig(config);
  } catch (err) {
    console.error("[adminSaveJoinConfig]", err);
    return { ok: false, error: "unknown" };
  }

  await recordAudit({
    action: "join_config.update",
    actorId: admin.id,
    actorName: admin.minecraftUsername ?? admin.username ?? null,
    targetType: "setting",
    targetId: "join",
    // 存 action 类型而不是中文标题：审计是历史记录，不该在写入时被本地化，
    // 否则英文界面的管理员会看到一条中文条目。完整配置在 detail 里。
    targetLabel: config.action.kind,
    detail: { ...config },
  });

  revalidatePath("/admin/join");
  revalidatePath("/admin/audit");
  revalidatePath("/", "layout");
  return { ok: true };
}
