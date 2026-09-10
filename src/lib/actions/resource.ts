"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth";
import {
  deleteResource,
  getResource,
  updateResource,
  canManageResource,
  ResourceError,
  MAX_FILE_BYTES,
} from "@/server/resource";
import { ResourceMetaSchema } from "@/lib/validators/questionnaire";
import { recordAudit } from "@/server/audit";
import { isAllowedCoverDataUrl } from "@/lib/image-types";

export type ResourceActionState = {
  ok: boolean;
  error?: string;
  /** 本次修改是否替换了附件 */
  fileReplaced?: boolean;
};

/** 把 ResourceError.code 映射成前端可直接用的错误 key */
function toErrorKey(code: string): string {
  switch (code) {
    case "TITLE_REQUIRED":
      return "titleRequired";
    case "DESCRIPTION_REQUIRED":
      return "descriptionRequired";
    case "FILE_REQUIRED":
      return "fileRequired";
    case "FILE_TOO_LARGE":
      return "fileTooLarge";
    case "IMAGE_TOO_LARGE":
      return "imageTooLarge";
    case "IMAGE_TYPE":
      return "imageType";
    case "FORBIDDEN":
      return "forbidden";
    case "NOT_FOUND":
      return "notFound";
    default:
      return "unknown";
  }
}

/**
 * 更新资源（标题 / 介绍 / 封面，可选替换附件）。
 *
 * 权限：**上传者本人或管理员**（对齐 git 的"作者可改、维护者也能改"）。
 * 用 FormData 接收，这样替换文件时可以直接带二进制，不必先 base64。
 * 每次成功修改都会写一条 ResourceRevision，记录谁在什么时候改了什么。
 */
export async function updateResourceAction(
  id: string,
  formData: FormData
): Promise<ResourceActionState> {
  const user = await requireUser();

  const existing = await getResource(id);
  if (!existing) return { ok: false, error: "notFound" };
  if (!canManageResource(existing, user)) {
    return { ok: false, error: "forbidden" };
  }

  const parsed = ResourceMetaSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { ok: false, error: "titleRequired" };
  }

  // 封面：可能是新选的 data URL，也可能是空字符串（表示移除）
  const imageField = formData.get("image");
  let imageUrl: string | null | undefined;
  if (typeof imageField === "string") {
    if (imageField === "") imageUrl = null;
    // 类型白名单：挡掉 SVG（能内嵌脚本，见 @/lib/image-types）
    else if (isAllowedCoverDataUrl(imageField)) imageUrl = imageField;
    else return { ok: false, error: "imageType" };
  }

  // 附件：有就替换
  let file: { name: string; type: string; data: Buffer } | undefined;
  const fileField = formData.get("file");
  if (fileField instanceof File && fileField.size > 0) {
    if (fileField.size > MAX_FILE_BYTES) {
      return { ok: false, error: "fileTooLarge" };
    }
    file = {
      name: fileField.name,
      type: fileField.type,
      data: Buffer.from(await fileField.arrayBuffer()),
    };
  }

  try {
    await updateResource(
      id,
      { title: parsed.data.title, description: parsed.data.description, imageUrl, file },
      {
        id: user.id,
        name: user.minecraftUsername ?? null,
        isAdmin: user.role === "ADMIN",
      }
    );
  } catch (err) {
    if (err instanceof ResourceError) {
      return { ok: false, error: toErrorKey(err.code) };
    }
    console.error("[updateResourceAction]", err);
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/resources");
  revalidatePath(`/resources/${id}`);
  revalidatePath("/admin/resources");
  return { ok: true, fileReplaced: Boolean(file) };
}

/** 删除资源：上传者本人或管理员 */
export async function deleteResourceAction(
  id: string
): Promise<ResourceActionState> {
  const user = await requireUser();

  const existing = await getResource(id);
  if (!existing) return { ok: false, error: "notFound" };
  if (!canManageResource(existing, user)) {
    return { ok: false, error: "forbidden" };
  }

  try {
    await deleteResource(id);
  } catch (err) {
    console.error("[deleteResourceAction]", err);
    return { ok: false, error: "unknown" };
  }

  // 不可逆操作：留一条审计，事后能查到是谁删的
  await recordAudit({
    action: "resource.delete",
    actorId: user.id,
    actorName: user.minecraftUsername ?? user.username ?? null,
    targetType: "resource",
    targetId: id,
    targetLabel: existing.title,
    detail: {
      // 记下连带删掉多少东西，免得事后对不上账
      comments: existing.commentCount,
      likes: existing.likeCount,
      downloads: existing.downloads,
      version: existing.version,
      byAdmin: user.role === "ADMIN" && existing.uploaderId !== user.id,
    },
  });

  revalidatePath("/resources");
  revalidatePath("/admin/resources");
  revalidatePath("/admin/audit");
  return { ok: true };
}
