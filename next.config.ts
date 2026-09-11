import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

/**
 * 全局安全响应头。
 *
 * 之前一条都没设。这几条都是"零成本、只可能帮忙"的类型 ——
 * 不影响功能，但能挡掉一整类低门槛攻击与浏览器误判：
 *
 *   - X-Content-Type-Options: nosniff
 *     禁止浏览器"猜"类型。少了它，一个被当成图片上传的文件可能被当脚本执行。
 *   - X-Frame-Options / frame-ancestors
 *     禁止本站被嵌进 iframe —— 否则可以做点击劫持（透明的 iframe 盖在
 *     诱饵页面上，骗用户点到"删除账号""封禁"这类按钮）。
 *   - Referrer-Policy
 *     跳到外站时不泄露完整 URL（本站的 URL 里含资源 id、用户 id）。
 *   - Permissions-Policy
 *     明确关掉用不到的摄像头/麦克风/定位，缩小攻击面。
 *
 * 注意**没有设严格的 CSP**：本项目用了 next-themes 与 Motion 的内联样式，
 * 一刀切的 `script-src 'self'` 会把页面打挂。封面接口那类高风险响应
 * 单独在路由里加 CSP（见 api/resources/[id]/image/route.ts）。
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1"],
  // 别在响应头里 advertise 用了什么框架
  poweredByHeader: false,
  experimental: {
    serverActions: {
      /**
       * Server Action 的请求体默认上限只有 **1MB**。
       *
       * 这个项目有两处会通过 Server Action 传二进制：
       *   - 资源编辑时替换附件（上限由后台的 maxFileMb 决定，默认 5MB）
       *   - 后台上传轮播图（上限 8MB）
       * 默认值下这两个功能在文件稍大时会被框架层直接拒掉，而且报错很含糊。
       *
       * 16MB 是给两边留了余量的统一上限（附件 5MB + base64 封面约 1.4MB
       * ≈ 6.4MB；轮播图 8MB）。**如果管理员把 maxFileMb 调到 14MB 以上，
       * 资源编辑会重新撞到这个上限** —— 那时要么继续调大，要么把编辑也
       * 改成上传接口那种 multipart 路由。
       */
      bodySizeLimit: "16mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
