import { getCurrentUser } from "@/server/auth";
import {
  getResourceBlobById,
  getResourceFileMeta,
} from "@/server/resource";
import { addUsage, checkQuota, clientIp } from "@/server/quota";
import { isBanned } from "@/server/ban";
import { isLitematicFileName } from "@/lib/litematic/file-name";

/**
 * 给「3D 预览」用的模型数据（就是 .litematic 本体）。
 *
 * 为什么不直接复用 `/download`：那个接口会**计下载次数**（`Resource.downloads`
 * + `ResourceDownload` 明细）。用户点一下"看看预览"就多一条下载记录、
 * 上传者的作品多一次下载 —— 那个数字是给人看的活跃度，不该被预览污染。
 *
 * 配额口径（和站长确认过）：**同一套流量配额，但不计下载次数** ——
 * 照样 `checkQuota` + `addUsage`，只是不碰下载计数。这样预览不会变成
 * 绕过下载配额的免费通道。
 *
 * 只对 .litematic 开放：别的文件没有查看器，也没必要多一个入口。
 */
export const runtime = "nodejs";

const HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; sandbox",
  "Cross-Origin-Resource-Policy": "same-origin",
} as const;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...HEADERS },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const meta = await getResourceFileMeta(id);
  if (!meta) return new Response("Not found", { status: 404, headers: HEADERS });

  // 只有投影有查看器
  if (!isLitematicFileName(meta.fileName)) {
    return new Response("Not a litematic", { status: 415, headers: HEADERS });
  }

  const user = await getCurrentUser();
  if (isBanned(user)) {
    return json(
      {
        error: "banned",
        bannedUntil: user?.bannedUntil ? user.bannedUntil.toISOString() : null,
        banReason: user?.banReason ?? null,
      },
      403
    );
  }

  const subject = {
    isAdmin: user?.role === "ADMIN",
    userId: user?.id ?? null,
    ip: clientIp(request),
  };

  const size = meta.fileSize;
  const quota = await checkQuota(subject, "download", size);
  if (!quota.allowed) {
    return json({ error: "quota_exceeded", limit: quota.limit }, 429);
  }

  const row = await getResourceBlobById(id);
  if (!row) return new Response("Not found", { status: 404, headers: HEADERS });
  const bytes = row.data;

  // 只记流量，不记下载次数（见文件头注释）
  try {
    await addUsage(subject, "download", size);
  } catch {
    /* 记账失败不影响预览 */
  }

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      ...HEADERS,
      "Content-Type": "application/octet-stream",
      "Content-Length": String(bytes.byteLength),
      // 同一个资源 id 的内容不会变（换附件会换 version），可以放心长缓存
      "Cache-Control": "private, max-age=600",
    },
  });
}
