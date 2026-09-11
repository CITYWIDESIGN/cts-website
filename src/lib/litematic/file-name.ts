/**
 * 判断一个文件是不是 Litematica 投影。
 *
 * 单独放一个文件（而不是写在 `@/server/litematic` 里）：**客户端也要用**这个
 * 判断来决定"要不要在上传前渲染预览"，而 `@/server/*` 带 `server-only`，
 * 客户端 import 会直接报错。
 *
 * 只看扩展名：浏览器给 .litematic 的 `File.type` 通常是空串，
 * 靠 MIME 判断会全部漏掉。
 */
const LITEMATIC_EXT = /\.litematic$/i;

export function isLitematicFileName(fileName: string): boolean {
  return LITEMATIC_EXT.test(fileName.trim());
}
