/**
 * 封面图允许的类型。
 *
 * ⚠️ **故意不含 SVG**。
 *
 * 原来只校验 `startsWith("data:image/")`，而 `data:image/svg+xml` 正好满足 ——
 * 但 SVG 是可以内嵌 `<script>` 的。封面接口是**同源内联返回**的，
 * 于是攻击者上传一张带脚本的 SVG，再把 `/api/resources/<id>/image` 发给别人，
 * 对方一打开就在本站源下执行了任意脚本（存储型 XSS / 会话劫持）。
 *
 * 在 `<img>` 标签里 SVG 脚本不会跑，所以这个洞平时看不出来 ——
 * 但只要有人直接点开那个链接就中招。所以**从根上不接受矢量图**，
 * 并且服务端返回时再加一层 CSP 兜底（见 image/route.ts）。
 *
 * 用 raster 格式（PNG / JPEG / GIF / WebP / AVIF）完全够封面用。
 */
export const ALLOWED_COVER_MIME = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/avif",
] as const;

/** 给 `<input accept>` 用的字符串 */
export const COVER_ACCEPT_ATTR = ALLOWED_COVER_MIME.join(",");

export interface ParsedDataUrl {
  mime: string;
  isBase64: boolean;
  payload: string;
}

/**
 * 拆解 data URL。格式不合法返回 null。
 * 形如：`data:image/png;base64,iVBORw0...`
 */
export function parseDataUrl(value: unknown): ParsedDataUrl | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("data:")) return null;

  const comma = value.indexOf(",");
  if (comma === -1) return null;

  const meta = value.slice(5, comma);
  const payload = value.slice(comma + 1);
  if (!meta || !payload) return null;

  const [mime, ...params] = meta.split(";");
  const normalized = (mime ?? "").trim().toLowerCase();
  if (!normalized) return null;

  return {
    mime: normalized,
    isBase64: params.some((p) => p.trim().toLowerCase() === "base64"),
    payload,
  };
}

/** 是不是允许的封面图（类型安全的那几种） */
export function isAllowedCoverDataUrl(value: unknown): boolean {
  const parsed = parseDataUrl(value);
  if (!parsed) return false;
  return (ALLOWED_COVER_MIME as readonly string[]).includes(parsed.mime);
}
