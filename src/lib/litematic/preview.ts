/**
 * 在**浏览器里**把 .litematic 渲染成一张预览图。
 *
 * 为什么放在客户端：lodestone 的渲染层要 WebGL。服务端要跑就得装
 * headless WebGL（`gl` 原生模块或 headless Chrome），在我们的 alpine 容器里
 * 编译 `gl` 非常折腾，还有搞坏现有部署的风险。而用户**本来就在浏览器里**
 * 上传文件 —— 顺手渲染一帧传给服务端，零额外基础设施。
 *
 * 分工（重要）：
 *   - **图**由客户端渲染（这个文件）
 *   - **元数据**由服务端自己从文件里解（src/server/litematic.ts）
 * 客户端提交的任何数值都不可信，所以尺寸/方块数一律以服务端解出来的为准。
 *
 * ⚠️ 这个模块只能在浏览器里 import —— 它碰 document / canvas / WebGL。
 * 所以调用方（上传对话框）必须用 `await import(...)` 动态加载，
 * 别让 three.js 进首页的包。
 */
import {
  buildStructureFromLitematic,
  frameCamera,
  PREVIEW_VIEWS,
  type LitematicPreviewMeta,
} from "./build-structure";
import { packBaseUrl } from "./pack-url";

/**
 * 预览图尺寸。
 *
 * 从 720×480 提到 1080×720：这张图现在会被点开铺满整个屏幕，
 * 720 宽放大到 1080 以上就糊了。平面配色的体素图 PNG 压缩率很高，
 * 体积增长可以接受（上限相应放宽到 6MB）。
 */
const DEFAULT_WIDTH = 1080;
const DEFAULT_HEIGHT = 720;

export type PreviewStage = "parsing" | "loading-pack" | "merging" | "rendering";

/**
 * 材质包缓存。
 *
 * 一次要拉 1.5MB 的 assets.json + 1.4MB 的 atlas.png，还得解码成 ImageData ——
 * 走 Cloudflare 隧道要好几秒。同一个页面里连着传第二个投影时不该再拉一遍。
 * 存 Promise 而不是结果：并发调用也只会发一次请求。
 */
let packPromise: Promise<Awaited<ReturnType<typeof loadPack>>> | null = null;

async function loadPack() {
  const { loadDefaultPackResources } = await import("@mattzh72/lodestone");
  return loadDefaultPackResources({ baseUrl: packBaseUrl() });
}

function getPack() {
  packPromise ??= loadPack().catch((err) => {
    // 失败不要缓存住，下次还能重试
    packPromise = null;
    throw err;
  });
  return packPromise;
}

export type PreviewMeta = LitematicPreviewMeta;

/**
 * 8 张等轴测图：4 个方向 × 白天/黑夜，顺序是 `方向 * 2 + 主题`
 * （见 build-structure.ts 的 previewIndex）。
 *
 * **背景是烤进图里的**（渲染出来的天空，不是 CSS 能改的），所以两套主题
 * 必须在上传时都渲染好 —— 前端按当前主题选对应的那张。
 * 第 0 张当卡片缩略图。
 */
export interface PreviewResult {
  /** 长度 = PREVIEW_COUNT（= 8）的 data URL 数组 */
  images: string[];
  meta: PreviewMeta;
}

/**
 * 渲染预览。
 *
 * 任何失败都返回 null（不抛）—— 预览是附加品，不能因为它让上传失败。
 * 调用方拿到 null 就当"这个文件没有预览"，照常上传。
 */
export async function renderLitematicPreviews(
  bytes: Uint8Array,
  options: {
    width?: number;
    height?: number;
    onStage?: (stage: PreviewStage) => void;
  } = {}
): Promise<PreviewResult | null> {
  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;
  const stage = options.onStage ?? (() => {});

  let renderer: { dispose(): void } | null = null;

  try {
    // 动态引入：three.js 只在上传投影时才加载
    const { ThreeStructureRenderer, loadDefaultPackResources } = await import(
      "@mattzh72/lodestone"
    );

    // 解析 + 多区域合并（和 3D 查看器共用同一份实现）
    stage("merging");
    const built = await buildStructureFromLitematic(bytes);
    if (!built) return null;

    stage("loading-pack");
    const { resources } = await getPack();

    stage("rendering");
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const three = new ThreeStructureRenderer(canvas, built.structure, resources, {
      antialias: true,
      // 不设这个的话 drawStructure 之后读 canvas 可能是空白
      preserveDrawingBuffer: true,
    });
    renderer = three;

    three.setViewport(0, 0, width, height, 1);

    /*
      相机取景。

      不用 resetCamera()：它把相机放在 +Z 轴上、距离取 `最长边 * 1.8`。
      对"又长又扁"的建筑（例如 106×32×404 的机器）这意味着正对着 106×32
      那一面、而且退到 727 格外 —— 整个建筑在画面里只有一小条。

      改成从右上前方看、距离按包围球算，任何长宽比都恰好入镜。
    */
    const frame = frameCamera(built.meta.size, 45);
    three.setCamera({ position: frame.position, target: frame.target, up: [0, 1, 0], fov: 45 });

    // 分块网格是异步建的，不等它画出来是空的
    await three.whenReady();
    three.drawStructure();

    /*
      4 个方向各一帧。背景是透明的，所以不需要为明暗主题各渲一套
      —— 页面自己的底色会透过来。

      同一个 renderer、同一份网格，只换相机 —— 网格只在 whenReady 里建一次。
    */
    const images: string[] = [];
    for (const view of PREVIEW_VIEWS) {
      const frame = frameCamera(built.meta.size, 45, view.yawDeg);
      three.setCamera({
        position: frame.position,
        target: frame.target,
        up: [0, 1, 0],
        fov: 45,
      });
      three.drawStructure();
      images.push(canvas.toDataURL("image/png"));
    }
    return { images, meta: built.meta };
  } catch (err) {
    console.warn("[litematic] 预览生成失败，跳过：", err);
    return null;
  } finally {
    try {
      renderer?.dispose();
    } catch {
      /* 清理失败无所谓 */
    }
  }
}
