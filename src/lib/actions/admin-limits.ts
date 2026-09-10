"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth";
import { setLimits } from "@/server/settings";
import {
  LimitsConfigSchema,
  validateLimits,
  type LimitsConfig,
} from "@/lib/validators/limits";
import { recordAudit } from "@/server/audit";
import type { ActionState } from "./admin";

/**
 * Admin：保存普通用户的用量限额。
 *
 * 校验分两层，任何一层不过都不落库：
 *   1. zod —— 每个字段的类型与取值范围（见 @/lib/validators/limits）
 *   2. validateLimits —— 字段之间的关系。单文件上限高于每日总额度的话，
 *      用户永远传不完一个文件就被额度挡住，表面合法实际不可用
 *
 * 入参走 zod 而不是直接信任客户端 —— 这个 action 可以被任意请求伪造调用。
 * 保存后 revalidatePath("/", "layout")：所有页面上的"最大 N MB"文案、
 * 上传弹窗的大小预校验都要跟着变。
 */
export async function adminSaveLimits(input: unknown): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = LimitsConfigSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const config: LimitsConfig = parsed.data;

  const invalid = validateLimits(config);
  if (invalid) return { ok: false, error: invalid };

  try {
    await setLimits(config);
  } catch (err) {
    console.error("[adminSaveLimits]", err);
    return { ok: false, error: "unknown" };
  }

  await recordAudit({
    action: "limits.update",
    actorId: admin.id,
    actorName: admin.minecraftUsername ?? admin.username ?? null,
    targetType: "setting",
    targetId: "limits",
    // 存英文键而不是中文标题：审计是历史记录，不该在写入时被本地化
    targetLabel: "limits",
    detail: { ...config },
  });

  revalidatePath("/admin/limits");
  revalidatePath("/admin/audit");
  revalidatePath("/", "layout");
  return { ok: true };
}
