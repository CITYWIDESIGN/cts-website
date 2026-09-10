import { getResourceImage } from "@/server/resource";
import { parseDataUrl, ALLOWED_COVER_MIME } from "@/lib/image-types";

/**
 * 资源的封面图。
 *
 * 封面以 data URL 存在**独立的 `resource_images` 表**里。为什么不放在
 * `Resource` 行上：列表页只需要判断"有没有封面"，如果那列和封面同表，
 * 一次列表查询就会把每张最大 1.4MB 的 base64 全部捞出来（100 条 = 100MB+）。
 *
 * 所以列表只 select 关系主键，真正的字节由这个接口按需取，浏览器还能缓存。
 *
 * 安全：这是**同源内联返回**的内容，所以做了三层防护 ——
 *   1. 类型白名单（不含 SVG）
 *   2. `X-Content-Type-Options: nosniff`
 *   3. `Content-Security-Policy: default-src 'none'; sandbox` —— 万一有东西
 *      漏过白名单，浏览器也不让它在我们的源下跑脚本
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
  const row = await getResourceImage(id);

  const parsed = parseDataUrl(row?.data);
  if (!parsed) {
    return new Response("Not found", { status: 404, headers: HARDENED_HEADERS });
  }

  // 只放行栅格图。老数据里若混进 SVG，这里也不会把它当图片吐出去。
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
      "Cache-Control": "public, max-age=3600",
    },
  });
}
