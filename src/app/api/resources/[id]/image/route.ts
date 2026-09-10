import { getResourceImage } from "@/server/resource";

/**
 * 资源的封面图。
 *
 * 封面以 data URL 存在 Resource.imageUrl 里；列表页如果直接把整段
 * data URL 内联进 HTML，会让页面体积暴涨（每张最大 1MB）。
 * 所以列表只请求这个接口，由浏览器自己缓存图片。
 */
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const row = await getResourceImage(id);
  const dataUrl = row?.imageUrl;

  if (!dataUrl || !dataUrl.startsWith("data:")) {
    return new Response("Not found", { status: 404 });
  }

  const comma = dataUrl.indexOf(",");
  if (comma === -1) return new Response("Bad data URL", { status: 500 });

  const meta = dataUrl.slice(5, comma); // 例如 image/png;base64
  const isBase64 = meta.includes("base64");
  const mime = meta.split(";")[0] || "image/png";
  const payload = dataUrl.slice(comma + 1);

  const bytes = isBase64
    ? Buffer.from(payload, "base64")
    : Buffer.from(decodeURIComponent(payload), "binary");

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
