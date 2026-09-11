/**
 * 原版材质包的地址。
 *
 * ⚠️ **必须是绝对地址。** lodestone 内部是 `new URL('assets.json', base)`，
 * 而 URL 构造器**不接受相对路径当 base** —— 传 `/lodestone-pack/` 会抛
 * `Failed to construct 'URL': Invalid base URL`。所以补上 origin。
 *
 * 放在函数里算：模块顶层在 SSR 阶段也会被求值，那时没有 window。
 *
 * 材质包由 `scripts/copy-lodestone-pack.mjs` 在构建前从 node_modules
 * 拷到 `public/lodestone-pack/`（原版素材版权归 Mojang，不进仓库）。
 */
export function packBaseUrl(): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/lodestone-pack/`;
}
