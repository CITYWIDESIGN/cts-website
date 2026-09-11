"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth";
import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncement,
  updateAnnouncement,
} from "@/server/announcement";
import { AnnouncementInputSchema } from "@/lib/validators/content";
import { recordAudit } from "@/server/audit";
import type { ActionState } from "./admin";

/** 新建时要把新 id 带回客户端（用来跳转或刷新列表） */
export type AnnouncementActionState = ActionState & { id?: string };

/** 把校验过的 `YYYY-MM-DD` 变成当天 UTC 零点的 Date */
function parseDay(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function adminCreateAnnouncement(
  input: unknown
): Promise<AnnouncementActionState> {
  await requireAdmin();

  const parsed = AnnouncementInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const created = await createAnnouncement({
      ...parsed.data,
      publishedAt: parseDay(parsed.data.publishedAt || today()),
    });
    revalidatePath("/admin/announcements");
    revalidatePath("/", "layout");
    return { ok: true, id: created.id };
  } catch (err) {
    console.error("[adminCreateAnnouncement]", err);
    return { ok: false, error: "unknown" };
  }
}

export async function adminUpdateAnnouncement(
  id: string,
  input: unknown
): Promise<ActionState> {
  await requireAdmin();

  const parsed = AnnouncementInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const existing = await getAnnouncement(id);
  if (!existing) return { ok: false, error: "not_found" };

  try {
    await updateAnnouncement(id, {
      ...parsed.data,
      publishedAt: parseDay(parsed.data.publishedAt || today()),
    });
    revalidatePath("/admin/announcements");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    console.error("[adminUpdateAnnouncement]", err);
    return { ok: false, error: "unknown" };
  }
}

export async function adminDeleteAnnouncement(id: string): Promise<ActionState> {
  const admin = await requireAdmin();

  const existing = await getAnnouncement(id);
  if (!existing) return { ok: false, error: "not_found" };

  try {
    await deleteAnnouncement(id);
  } catch (err) {
    console.error("[adminDeleteAnnouncement]", err);
    return { ok: false, error: "unknown" };
  }

  await recordAudit({
    action: "announcement.delete",
    actorId: admin.id,
    actorName: admin.minecraftUsername ?? admin.username ?? null,
    targetType: "announcement",
    targetId: id,
    // 标题照着存一份：删掉之后就查不到了
    targetLabel: existing.titleZh,
  });

  revalidatePath("/admin/announcements");
  revalidatePath("/admin/audit");
  revalidatePath("/", "layout");
  return { ok: true };
}
