import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { createResource, ResourceError } from "@/server/resource";
import { addUsage, checkQuota, clientIp } from "@/server/quota";
import { addDailyCount, checkDailyLimit } from "@/server/limit";
import { getLimits } from "@/server/settings";
import { limitsToBytes } from "@/lib/validators/limits";
import { isBanned } from "@/server/ban";
import { isAllowedCoverDataUrl } from "@/lib/image-types";
import {
  describeLitematic,
  isLitematicFileName,
  MAX_PREVIEW_CHARS,
} from "@/server/litematic";
import { ResourceMetaSchema } from "@/lib/validators/questionnaire";

/**
 * 上传资源。
 *
 * 权限：**只要登录即可上传**，不要求通过入服审核；**被封禁的用户不能上传**。
 * 配额（数字由管理员在后台「限额设置」里调整，管理员不受限）：
 *   - 次数：每天 N 个，超限返回 429 + limit_exceeded
 *   - 流量：每天 N MB，超限返回 413 + quota_exceeded
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

  /*
    先看 Content-Length 再决定要不要解析。

    `request.formData()` 会把**整个请求体**收进内存才开始返回；route handler 又
    没有 Server Action 那种 bodySizeLimit。于是一个 2GB 的 POST 会让进程先把
    2GB 读进内存，之后我们才有机会说"文件太大了" —— 这是个能被打爆内存的入口。
    下面 `file.size > maxFileBytes` 那道检查发生在**解析之后**，拦不住它。

    所以这里按「附件上限 + 封面 base64 + multipart 边框」估一个上限，超了直接
    413，连 body 都不读。
  */
  const limits = await getLimits();
  const { maxFileBytes, maxImageBytes } = limitsToBytes(limits);
  // multipart 会带边界、字段名和一小段开销；封面是 data URL 文本（base64 约 1.37 倍）
  const roughLimit =
    maxFileBytes + Math.ceil(maxImageBytes * 1.4) + MAX_PREVIEW_CHARS + 64 * 1024;
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > roughLimit) {
    return NextResponse.json(
      { ok: false, error: "file_too_large", max: maxFileBytes },
      { status: 413 }
    );
  }

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
  if (file.size > maxFileBytes) {
    return NextResponse.json(
      { ok: false, error: "file_too_large", max: maxFileBytes },
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
    if (imageField.length > maxImageBytes * 1.4) {
      return NextResponse.json(
        { ok: false, error: "image_too_large", max: maxImageBytes },
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

    /*
      投影预览。

      图是**客户端**用 lodestone + three.js 渲染好、截成 PNG 传上来的 ——
      服务端不跑 WebGL（见 src/server/litematic.ts 的说明）。

      但元数据**必须服务端自己解**：客户端提交的东西一律不可信，
      它填个"尺寸 1×1×1"我们也没法分辨。所以这里重新解析一遍文件，
      顺便确认这个文件确实是合法的 .litematic —— 解不出来就不存预览，
      但**不影响资源本身**（投影预览是附加品，不能让它拖垮上传）。
    */
    let previewUrl: string | null = null;
    let previewMeta: ReturnType<typeof describeLitematic> = null;
    if (isLitematicFileName(file.name)) {
      previewMeta = describeLitematic(data);
      const previewField = form.get("preview");
      if (
        previewMeta &&
        typeof previewField === "string" &&
        previewField.length > 0 &&
        previewField.length <= MAX_PREVIEW_CHARS
      ) {
        // 三张等轴测图打包成 JSON 数组。逐张过类型白名单 ——
        // 挡掉 SVG 之类能内嵌脚本的矢量图（见 @/lib/image-types）
        try {
          const views = JSON.parse(previewField) as unknown;
          if (
            Array.isArray(views) &&
            views.length > 0 &&
            views.length <= 8 &&
            views.every((v) => isAllowedCoverDataUrl(v))
          ) {
            previewUrl = JSON.stringify(views);
          }
        } catch {
          /* 格式不对就当没有预览，不影响上传 */
        }
      }
    }

    const created = await createResource({
      title: parsed.data.title,
      description: parsed.data.description,
      imageUrl,
      previewUrl,
      previewMeta,
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
