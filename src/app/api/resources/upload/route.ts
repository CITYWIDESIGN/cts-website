import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import {
  createResource,
  ResourceError,
  MAX_FILE_BYTES,
  MAX_IMAGE_BYTES,
} from "@/server/resource";
import { addUsage, checkQuota, clientIp } from "@/server/quota";
import { addDailyCount, checkDailyLimit } from "@/server/limit";
import { isBanned } from "@/server/ban";
import { isAllowedCoverDataUrl } from "@/lib/image-types";
import { ResourceMetaSchema } from "@/lib/validators/questionnaire";

/**
 * 上传资源。
 *
 * 权限：**只要登录即可上传**，不要求通过入服审核；**被封禁的用户不能上传**。
 * 配额：
 *   - 次数：**非管理员每天 50 个**（管理员不限），超限返回 429 + limit_exceeded
 *   - 流量：**非管理员每天 1GB**（管理员不限），超限返回 413 + quota_exceeded
 *   两者都不对外展示，由前端给出提示。
 *
 * 用 route handler 而不是 Server Action：Server Action 传二进制要做 base64
 * 编码（体积膨胀 33%），这里用 multipart 直传更直接。
 */
export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // 封禁：上传、下载、点赞、评论全部禁止
  if (isBanned(user)) {
    return NextResponse.json(
      {
        ok: false,
        error: "banned",
        bannedUntil: user.bannedUntil ? user.bannedUntil.toISOString() : null,
        banReason: user.banReason ?? null,
      },
      { status: 403 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_form" }, { status: 400 });
  }

  const parsed = ResourceMetaSchema.safeParse({
    title: form.get("title"),
    description: form.get("description"),
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_meta" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: "file_required" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { ok: false, error: "file_too_large", max: MAX_FILE_BYTES },
      { status: 413 }
    );
  }

  // 封面图：前端已转成 data URL；这里再校验一次大小
  const imageField = form.get("image");
  let imageUrl: string | null = null;
  if (typeof imageField === "string" && imageField.length > 0) {
    // 类型白名单：挡掉 SVG（能内嵌脚本，见 @/lib/image-types）
    if (!isAllowedCoverDataUrl(imageField)) {
      return NextResponse.json({ ok: false, error: "image_type" }, { status: 415 });
    }
    if (imageField.length > MAX_IMAGE_BYTES * 1.4) {
      return NextResponse.json(
        { ok: false, error: "image_too_large", max: MAX_IMAGE_BYTES },
        { status: 413 }
      );
    }
    imageUrl = imageField;
  }

  const isAdmin = user.role === "ADMIN";

  // 每日发布次数限制：管理员跳过
  const daily = await checkDailyLimit(user.id, "resource", isAdmin);
  if (!daily.allowed) {
    return NextResponse.json(
      { ok: false, error: "limit_exceeded", limit: daily.limit },
      { status: 429 }
    );
  }

  // 每日上传流量配额：管理员跳过
  const subject = {
    isAdmin,
    userId: user.id,
    ip: clientIp(request),
  };
  const quota = await checkQuota(subject, "upload", file.size);
  if (!quota.allowed) {
    return NextResponse.json(
      { ok: false, error: "quota_exceeded", limit: quota.limit },
      { status: 413 }
    );
  }

  try {
    const data = Buffer.from(await file.arrayBuffer());
    const created = await createResource({
      title: parsed.data.title,
      description: parsed.data.description,
      imageUrl,
      fileName: file.name,
      fileType: file.type,
      data,
      uploaderId: user.id,
    });
    // 成功后才记账
    await addDailyCount(user.id, "resource", isAdmin);
    await addUsage(subject, "upload", file.size);
    return NextResponse.json({ ok: true, id: created.id });
  } catch (err) {
    if (err instanceof ResourceError) {
      return NextResponse.json(
        { ok: false, error: err.code },
        { status: err.code === "FILE_TOO_LARGE" ? 413 : 400 }
      );
    }
    console.error("[resources/upload]", err);
    return NextResponse.json({ ok: false, error: "unknown" }, { status: 500 });
  }
}
