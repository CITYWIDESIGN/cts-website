/**
 * .litematic 投影的识别与元数据提取。
 *
 * 解析用 **lodestone**（`@mattzh72/lodestone`）—— 它是 deepslate（Misode）的
 * three.js 版，原生支持 .litematic，MIT，有 CI。不要自己解 NBT 和位打包：
 * 那套东西的正确性靠的是边界情况（多区域、负数尺寸、1.16 前后的打包差异），
 * 自己写只会写出一个在大多数文件上碰巧能跑、在少数文件上悄悄错的版本。
 *
 * **这个模块不碰 WebGL。** lodestone 的解析层是纯 JS，渲染层才需要 three.js ——
 * 预览图由浏览器在上传时渲染好再传上来，服务端只负责：
 *   1. 独立校验这个文件确实是合法的 .litematic
 *   2. 从文件里解出元数据（**不采信客户端提交的值**）
 *
 * 任何失败都返回 null / false，绝不抛异常 —— 预览是锦上添花，
 * 不能因为它让一次正常的上传失败。
 */
import { LitematicLoader } from "@mattzh72/lodestone";
import { isLitematicFileName } from "@/lib/litematic/file-name";

export { isLitematicFileName };

/** 投影元数据。字段与 lodestone 的 getMetadata 对齐。 */
export interface LitematicMeta {
  name: string;
  author: string;
  size: { x: number; y: number; z: number };
  totalBlocks: number;
  regionCount: number;
}

/**
 * 预览的总体积上限（三张图的 data URL 拼成 JSON 之后的字符数）。
 * 约合 3MB 的 PNG。渲染尺寸是 720×480，正常一张 100~300KB，够用。
 */
export const MAX_PREVIEW_CHARS = 4_000_000;

/**
 * 体积上限：超过就不生成预览。
 *
 * lodestone 的 `load()` 会把区域展开成完整的体素网格。实测：304×126×304
 * （1160 万格）在浏览器里能顺利出图；再往上内存和时间都会明显上升。
 * 32M 大致相当于 317³，能覆盖绝大多数建筑作品。
 *
 * 超限只是**不生成预览**，资源照样能正常上传和下载 —— 而且渲染失败是被
 * try/catch 兜住的（返回 null），最坏情况是用户等几秒然后没有预览图。
 *
 * 客户端 `src/lib/litematic/preview.ts` 里有一份同样的常量，改的时候一起改。
 */
export const MAX_PREVIEW_VOLUME = 32_000_000;

/**
 * 从文件内容解出元数据。
 *
 * @returns 元数据；不是合法 .litematic、或体积超限时返回 null
 */
export function describeLitematic(data: Uint8Array): LitematicMeta | null {
  try {
    const meta = LitematicLoader.getMetadata(data);
    const size = {
      x: Math.abs(Number(meta.size?.x ?? 0)),
      y: Math.abs(Number(meta.size?.y ?? 0)),
      z: Math.abs(Number(meta.size?.z ?? 0)),
    };
    // 三个维度都得有值，否则不是正经投影
    if (!size.x || !size.y || !size.z) return null;
    if (size.x * size.y * size.z > MAX_PREVIEW_VOLUME) return null;

    return {
      name: String(meta.name ?? "").slice(0, 200),
      author: String(meta.author ?? "").slice(0, 100),
      size,
      totalBlocks: Math.max(0, Number(meta.totalBlocks ?? 0)),
      regionCount: Math.max(1, Number(meta.regionCount ?? 1)),
    };
  } catch {
    return null;
  }
}
