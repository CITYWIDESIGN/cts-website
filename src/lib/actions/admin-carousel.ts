"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth";
import {
  countSlides,
  createSlide,
  deleteSlide,
  getSlide,
  reorderSlides,
  updateSlide,
  type SlideImageInput,
} from "@/server/carousel";
import {
  CarouselSlideInputSchema,
  MAX_CAROUSEL_IMAGE_BYTES,
} from "@/lib/validators/carousel";
import { ALLOWED_COVER_MIME } from "@/lib/image-types";
import { recordAudit } from "@/server/audit";
import type { ActionState } from "./admin";

/**
 * Admin：首页轮播图的增删改与排序。
 *
 * 图片随 FormData 一起传（Server Action 支持 File）。上限与类型在服务端
 * **照样校验一遍** —— 客户端校验只是即时反馈，请求可以被伪造。
 *
 * 上限见 next.config.ts 的 serverActions.bodySizeLimit：8MB 的图在 16MB 的
 * 请求体上限内。
 */

const MAX_SLIDES = 20;

function parseText(form: FormData) {
  return CarouselSlideInputSchema.safeParse({
    titleZh: form.get("titleZh"),
    titleEn: form.get("titleEn") ?? "",
    subtitleZh: form.get("subtitleZh"),
    subtitleEn: form.get("subtitleEn") ?? "",
    // 复选框没勾时不会出现在 FormData 里
    published: form.get("published") === "on",
  });
}

export async function adminCreateSlide(form: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = parseText(form);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "image_required" };
  }
  if (!(ALLOWED_COVER_MIME as readonly string[]).includes(file.type)) {
    return { ok: false, error: "image_type" };
  }
  if (file.size > MAX_CAROUSEL_IMAGE_BYTES) {
    return { ok: false, error: "image_too_large" };
  }

  if ((await countSlides()) >= MAX_SLIDES) {
    return { ok: false, error: "too_many" };
  }

  try {
    await createSlide(parsed.data, {
      data: new Uint8Array(await file.arrayBuffer()),
      mimeType: file.type,
    });
  } catch (err) {
    console.error("[adminCreateSlide]", err);
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/admin/carousel");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function adminUpdateSlide(
  id: string,
  form: FormData
): Promise<ActionState> {
  await requireAdmin();

  const parsed = parseText(form);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const existing = await getSlide(id);
  if (!existing) return { ok: false, error: "not_found" };

  // 没选新文件 = 保留原图；选了就校验并替换
  let image: SlideImageInput | null = null;
  const file = form.get("image");
  if (file instanceof File && file.size > 0) {
    if (!(ALLOWED_COVER_MIME as readonly string[]).includes(file.type)) {
      return { ok: false, error: "image_type" };
    }
    if (file.size > MAX_CAROUSEL_IMAGE_BYTES) {
      return { ok: false, error: "image_too_large" };
    }
    image = {
      data: new Uint8Array(await file.arrayBuffer()),
      mimeType: file.type,
    };
  }

  try {
    await updateSlide(id, parsed.data, image);
  } catch (err) {
    console.error("[adminUpdateSlide]", err);
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/admin/carousel");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function adminDeleteSlide(id: string): Promise<ActionState> {
  const admin = await requireAdmin();

  const existing = await getSlide(id);
  if (!existing) return { ok: false, error: "not_found" };

  try {
    await deleteSlide(id);
  } catch (err) {
    console.error("[adminDeleteSlide]", err);
    return { ok: false, error: "unknown" };
  }

  await recordAudit({
    action: "carousel.delete",
    actorId: admin.id,
    actorName: admin.minecraftUsername ?? admin.username ?? null,
    targetType: "carousel",
    targetId: id,
    // 标题照着存一份：删掉之后就查不到了
    targetLabel: existing.titleZh,
  });

  revalidatePath("/admin/carousel");
  revalidatePath("/admin/audit");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** 重排：前端把完整的 id 顺序传上来 */
export async function adminReorderSlides(ids: string[]): Promise<ActionState> {
  await requireAdmin();

  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_SLIDES) {
    return { ok: false, error: "invalid" };
  }

  try {
    await reorderSlides(ids);
  } catch (err) {
    console.error("[adminReorderSlides]", err);
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/admin/carousel");
  revalidatePath("/", "layout");
  return { ok: true };
}
