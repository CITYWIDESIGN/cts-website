import { getSlideImage } from "@/server/carousel";

/**
 * 轮播图图片。
 *
 * 和资源封面一样：图片存在数据库里，不依赖共享文件系统或对象存储。
 * 响应头按"用户上传的二进制"加固 —— 声明真实类型、禁止嗅探、限制来源，
 * 避免被当成脚本同源执行。
 */
export const runtime = "nodejs";

const HARDENED_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const row = await getSlideImage(id);
  if (!row) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(row.data), {
    status: 200,
    headers: {
      "Content-Type": row.mimeType,
      "Content-Length": String(row.data.byteLength),
      // 内容按 slideId 不变；换图时 id 不变，所以给一个短缓存 + 允许过期复用
      "Cache-Control": "public, max-age=300, must-revalidate",
      ...HARDENED_HEADERS,
    },
  });
}
