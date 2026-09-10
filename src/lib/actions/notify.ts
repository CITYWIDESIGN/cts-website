"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth";
import { deleteNotification, markAllRead } from "@/server/notify";

/**
 * 站内消息的 Server Actions。
 * 铃铛只展示：举报进度、被点赞、被回复（自己对自己的操作不产生消息）。
 */

export async function markAllReadAction(): Promise<{ ok: boolean }> {
  const user = await requireUser();
  await markAllRead(user.id);
  revalidatePath("/resources");
  return { ok: true };
}

export async function deleteNotificationAction(
  id: string
): Promise<{ ok: boolean }> {
  const user = await requireUser();
  await deleteNotification(id, user.id);
  revalidatePath("/resources");
  return { ok: true };
}
