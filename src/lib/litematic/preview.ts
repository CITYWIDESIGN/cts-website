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
  PREVIEW_THEMES,
  type LitematicPreviewMeta,
} from "./build-structure";
import { packBaseUrl } from "./pack-url";

/** 预览图默认尺寸。够看清形体，又不至于让 data URL 太大。 */
const DEFAULT_WIDTH = 720;
const DEFAULT_HEIGHT = 480;

export type PreviewStage = "parsing" | "loading-pack" | "merging" | "rendering";

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
export async function renderLitematicPreview(
  file: File,
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
    stage("parsing");
    const bytes = new Uint8Array(await file.arrayBuffer());

    // 动态引入：three.js 只在上传投影时才加载
    const { ThreeStructureRenderer, loadDefaultPackResources } = await import(
      "@mattzh72/lodestone"
    );

    // 解析 + 多区域合并（和 3D 查看器共用同一份实现）
    stage("merging");
    const built = await buildStructureFromLitematic(bytes);
    if (!built) return null;

    stage("loading-pack");
    const { resources } = await loadDefaultPackResources({ baseUrl: packBaseUrl() });

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
      4 个方向 × 2 套主题 = 8 帧。

      同一个 renderer、同一份网格，只换相机和天空颜色 —— 网格只在
      whenReady 里建一次，比建八次场景快得多。

      顺序必须是 `方向 * 2 + 主题`（和 previewIndex 一致）：
      前端按主题选图时直接 +1，不用再查表。
    */
    const images: string[] = [];
    for (const view of PREVIEW_VIEWS) {
      for (const theme of PREVIEW_THEMES) {
        // 背景色是按主题烤进图里的，所以每张都要重设
        three.setSunlight({ sky: theme.sky });
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
