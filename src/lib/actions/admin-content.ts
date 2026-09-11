"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth";
import { setRules, setServerInfo, setStats } from "@/server/settings";
import {
  RulesConfigSchema,
  ServerInfoSchema,
  StatsConfigSchema,
} from "@/lib/validators/content";
import { recordAudit } from "@/server/audit";
import type { ActionState } from "./admin";

/**
 * Admin：保存管理员可编辑的站点内容（统计数字 / 服务器介绍与配置 / 规则）。
 *
 * 和 join / limits 一样，入参走 zod 而不是信任客户端 —— 这些 action 可以被
 * 任意请求伪造调用。写完 revalidatePath("/", "layout")：首页与 /server、
 * /rules 都要跟着变。
 *
 * 审计只记"改了什么"，不记全文（内容可能很长，而且不是破坏性操作）。
 */

async function auditAndRevalidate(
  adminId: string,
  adminName: string | null,
  key: string,
  detail: Record<string, unknown>,
  paths: string[]
) {
  await recordAudit({
    action: "site_content.update",
    actorId: adminId,
    actorName: adminName,
    targetType: "setting",
    targetId: key,
    // 存英文键而不是中文标题：审计是历史记录，不该在写入时被本地化
    targetLabel: key,
    detail,
  });
  for (const p of paths) revalidatePath(p);
  revalidatePath("/", "layout");
}

export async function adminSaveStats(input: unknown): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = StatsConfigSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    await setStats(parsed.data);
  } catch (err) {
    console.error("[adminSaveStats]", err);
    return { ok: false, error: "unknown" };
  }

  await auditAndRevalidate(
    admin.id,
    admin.minecraftUsername ?? admin.username ?? null,
    "stats",
    { ...parsed.data },
    ["/admin/content", "/"]
  );
  return { ok: true };
}

export async function adminSaveServerInfo(input: unknown): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = ServerInfoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    await setServerInfo(parsed.data);
  } catch (err) {
    console.error("[adminSaveServerInfo]", err);
    return { ok: false, error: "unknown" };
  }

  await auditAndRevalidate(
    admin.id,
    admin.minecraftUsername ?? admin.username ?? null,
    "server-info",
    { specs: parsed.data.specs.length },
    ["/admin/content", "/server"]
  );
  return { ok: true };
}

export async function adminSaveRules(input: unknown): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = RulesConfigSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  if (parsed.data.length === 0) return { ok: false, error: "rules_empty" };

  try {
    await setRules(parsed.data);
  } catch (err) {
    console.error("[adminSaveRules]", err);
    return { ok: false, error: "unknown" };
  }

  await auditAndRevalidate(
    admin.id,
    admin.minecraftUsername ?? admin.username ?? null,
    "rules",
    { count: parsed.data.length },
    ["/admin/content", "/rules", "/server"]
  );
  return { ok: true };
}
