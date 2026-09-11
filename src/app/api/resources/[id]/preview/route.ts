import { getResourcePreview } from "@/server/resource";
import { parseDataUrl, ALLOWED_COVER_MIME } from "@/lib/image-types";

/**
 * .litematic 投影的自动预览图。
 *
 * 和封面接口同一套路数，理由也一样（见 image/route.ts）：
 *   - 内容存独立的 `resource_previews` 表，列表页不捞字节
 *   - 同源内联返回，所以做三层防护：类型白名单、nosniff、CSP sandbox
 *   - 浏览器可以缓存（预览按资源 id 稳定，重建时会换 id 之外的内容，
 *     所以 max-age 给短一点，别让重传的文件一直显示旧图）
 *
 * 预览图**是客户端渲染后传上来的**：服务端不跑 WebGL，见 src/server/litematic.ts。
 */
export const runtime = "nodejs";

/** 这个响应永远不该执行任何东西，锁死 */
const HARDENED_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  "Cross-Origin-Resource-Policy": "same-origin",
} as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const row = await getResourcePreview(id);

  const parsed = parseDataUrl(row?.data);
  if (!parsed) {
    return new Response("Not found", { status: 404, headers: HARDENED_HEADERS });
  }

  // 预览只可能是 PNG（three.js 的 canvas.toDataURL 默认就这个），
  // 但历史上传进来的值不可信，照样过白名单
  if (!(ALLOWED_COVER_MIME as readonly string[]).includes(parsed.mime)) {
    return new Response("Unsupported image type", {
      status: 415,
      headers: HARDENED_HEADERS,
    });
  }

  let bytes: Buffer;
  try {
    bytes = parsed.isBase64
      ? Buffer.from(parsed.payload, "base64")
      : Buffer.from(decodeURIComponent(parsed.payload), "binary");
  } catch {
    return new Response("Bad image data", { status: 500, headers: HARDENED_HEADERS });
  }

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      ...HARDENED_HEADERS,
      "Content-Type": parsed.mime,
      "Content-Length": String(bytes.byteLength),
      // 比封面短：编辑资源换附件后预览会重建，别让旧图卡太久
      "Cache-Control": "public, max-age=300",
    },
  });
}
