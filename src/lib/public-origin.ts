/**
 * 对外可见的站点地址。
 *
 * ⚠️ **容器里绝对不能直接用 `new URL(request.url).origin`。**
 *
 * 踩过的坑：Dockerfile 里设了 `HOSTNAME=0.0.0.0`、`PORT=3000`，
 * 于是容器内算出来的 origin 是 `https://0.0.0.0:3000`。后果不只是"看着难看"：
 *   - OAuth 的 `redirect_uri` 变成 `https://0.0.0.0:3000/api/auth/callback`，
 *     微软直接回 `invalid_request: redirect_uri 不匹配`，**登录根本发不出去**
 *   - 登出、以及登录失败后的错误跳转也会把人送到 `0.0.0.0:3000` 这个死地址
 *
 * 本地开发（`next dev` 直连）时 `request.url` 是对的，所以这个坑**只在
 * 反向代理/容器后面才暴露** —— 属于"上生产才会炸"的那一类。
 *
 * 解析优先级（越靠前越可信）：
 *   1. `NEXT_PUBLIC_SITE_URL`：站点自己的公开地址，生产和本地都配了，最稳
 *   2. 代理/CDN 传的 `x-forwarded-proto` + `x-forwarded-host`
 *   3. `request.url` 的 origin（没有代理的裸跑场景才正确）
 */

/** 取逗号分隔头里的第一个值（代理链会把多跳拼在一起） */
function firstHeader(request: Request, name: string): string | null {
  const raw = request.headers.get(name);
  if (!raw) return null;
  const first = raw.split(",")[0]?.trim();
  return first || null;
}

/** 站点对外 origin，形如 `https://web.ctserver.top`（结尾无斜杠） */
export function publicOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const proto = firstHeader(request, "x-forwarded-proto");
  const host = firstHeader(request, "x-forwarded-host") ?? firstHeader(request, "host");
  if (host) return `${proto ?? "http"}://${host}`;

  return new URL(request.url).origin;
}

/** 把站内路径拼成对外绝对地址 */
export function absoluteUrl(request: Request, path: string): URL {
  return new URL(path, publicOrigin(request));
}

/**
 * OAuth 的 `redirect_uri`。
 *
 * `MICROSOFT_REDIRECT_URI` 优先：它必须和 Azure 应用注册里登记的**逐字符相同**，
 * 显式配置比推导可靠（比如站点同时挂在多个域名下时）。
 * 授权请求和换 token 两处都调这个函数，保证两边一致 —— 不一致同样会被拒。
 */
export function oauthRedirectUri(request: Request): string {
  const explicit = process.env.MICROSOFT_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  return `${publicOrigin(request)}/api/auth/callback`;
}
