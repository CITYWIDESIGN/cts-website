import { getResourcePreview } from "@/server/resource";
import { parseDataUrl, ALLOWED_COVER_MIME } from "@/lib/image-types";

/**
 * .litematic 投影的自动预览图（三个方向的等轴测）。
 *
 * 存的是**三张 data URL 的 JSON 数组**，用 `?i=` 选第几张：
 *   /preview      → 第 0 张（卡片缩略图用）
 *   /preview?i=2  → 第 2 张
 * 这样不用为每张图各开一个路由，卡片也只需要一次请求。
 *
 * 兼容：早期只有单张图的记录存的是裸 data URL，不是 JSON 数组 —— 解析失败时
 * 当成"只有一张"处理，不会 404。
 *
 * 其余防护同封面接口（见 image/route.ts）：类型白名单、nosniff、CSP sandbox、
 * 同源。预览图**是客户端渲染后传上来的**，服务端不跑 WebGL。
 */
export const runtime = "nodejs";

/** 这个响应永远不该执行任何东西，锁死 */
const HARDENED_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  "Cross-Origin-Resource-Policy": "same-origin",
} as const;

/** 把存储值解成 data URL 数组；坏数据返回空数组 */
function readViews(stored: string | undefined | null): string[] {
  if (typeof stored !== "string" || !stored) return [];
  try {
    const parsed = JSON.parse(stored) as unknown;
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    /* 不是 JSON —— 老格式，下面按单张处理 */
  }
  return [stored];
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const row = await getResourcePreview(id);
  const views = readViews(row?.data);

  const index = Math.max(0, Math.min(views.length - 1, Number(new URL(request.url).searchParams.get("i") ?? 0) || 0));
  const parsed = parseDataUrl(views[index]);
  if (!parsed) {
    return new Response("Not found", { status: 404, headers: HARDENED_HEADERS });
  }

  // 预览只可能是 PNG（canvas.toDataURL 的默认输出），但历史值不可信，照样过白名单
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
