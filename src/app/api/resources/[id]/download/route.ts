import { getCurrentUser } from "@/server/auth";
import { getResourceBlob, incrementDownloads } from "@/server/resource";
import { addUsage, checkQuota, clientIp, DAILY_QUOTA_BYTES } from "@/server/quota";
import { isBanned } from "@/server/ban";
import { recordDownload } from "@/server/stats";

/**
 * 下载资源附件。
 *
 * 权限：**不需要登录**，任何访客都能下载；**被封禁的用户不能下载**。
 * 配额：**非管理员与未登录访客每天 1GB**（管理员不限）。
 *       配额不对外展示，超限时返回 429 + quota_exceeded。
 *
 * 计数口径用「记录里的 fileSize」而不是实际写出的字节数：
 * 响应可能因为客户端中断而少发，但按文件大小计更稳定、也更好解释。
 */
export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const row = await getResourceBlob(id);
  if (!row?.blob) {
    return new Response("Not found", { status: 404 });
  }

  // 配额检查：管理员跳过
  const user = await getCurrentUser();

  // 封禁：被禁用户不能下载
  if (isBanned(user)) {
    return new Response(
      JSON.stringify({
        error: "banned",
        bannedUntil: user?.bannedUntil ? user.bannedUntil.toISOString() : null,
        banReason: user?.banReason ?? null,
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  }

  const subject = {
    isAdmin: user?.role === "ADMIN",
    userId: user?.id ?? null,
    ip: clientIp(request),
  };

  const size = row.blob.data.byteLength;
  const quota = await checkQuota(subject, "download", size);
  if (!quota.allowed) {
    return new Response(
      JSON.stringify({
        error: "quota_exceeded",
        limit: DAILY_QUOTA_BYTES,
      }),
      {
        status: 429,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  }

  // 计数与用量失败都不应影响下载本身
  try {
    await incrementDownloads(id);
  } catch {
    /* ignore */
  }
  try {
    // 明细：登录用户记 userId，未登录记 IP —— 统计页据此算"下载次数"
    await recordDownload(id, subject);
  } catch {
    /* ignore */
  }
  try {
    await addUsage(subject, "download", size);
  } catch {
    /* ignore */
  }

  /**
   * 文件名可能含中文，而 HTTP 头只允许 ISO-8859-1（ByteString）：
   * 把中文直接放进 filename="..." 会抛
   * "Cannot convert argument to a ByteString because the character at index N ..."。
   *
   * 处理方式：
   * - filename*（RFC 5987）放完整 UTF-8 名，现代浏览器优先用它
   * - filename 只作 ASCII 回退：剔除非 ASCII；若正文被剔空，
   *   用 "resource" + 原扩展名兜底（避免出现只有 ".txt" 这种怪名字）
   */
  const asciiBody = row.fileName
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/["\\/\r\n]/g, "_")
    .replace(/\.[^.]*$/, "") // 去掉扩展名后判断主体是否为空
    .trim();
  const asciiExt = (row.fileName.match(/\.[0-9A-Za-z._-]{1,12}$/)?.[0] ?? "")
    .replace(/["\\/\r\n]/g, "");
  const asciiFallback = (asciiBody || "resource") + asciiExt;
  const encoded = encodeURIComponent(row.fileName);

  const body = new Uint8Array(row.blob.data);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": row.fileType || "application/octet-stream",
      "Content-Length": String(body.byteLength),
      "Content-Disposition": `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
