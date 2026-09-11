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

/** 预览图默认尺寸。够看清形体，又不至于让 data URL 太大。 */
const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 640;

/**
 * 只导入**类型**（编译后会被擦掉，不会把 nbt 模块拉进产物）。
 * NbtFile 本体在函数里动态 import。
 */
type NbtCompound = import("@mattzh72/lodestone/nbt").NbtCompound;

/**
 * 原版材质包的位置。
 *
 * **必须显式给 baseUrl**：不传的话 lodestone 会按 `import.meta.url` 相对找，
 * 打包后那个路径下没有资源，会 404。见 scripts/copy-lodestone-pack.mjs。
 */
const PACK_BASE_URL = "/lodestone-pack/";

/** 和服务端 MAX_PREVIEW_VOLUME 保持一致：超了就不生成，别把浏览器卡死 */
const MAX_VOLUME = 20_000_000;

export interface PreviewMeta {
  name: string;
  author: string;
  size: { x: number; y: number; z: number };
  totalBlocks: number;
  regionCount: number;
}

export interface PreviewResult {
  dataUrl: string;
  meta: PreviewMeta;
}

export type PreviewStage = "parsing" | "loading-pack" | "merging" | "rendering";

/** 把向量归一化 */
function normalize(v: [number, number, number]): [number, number, number] {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
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
    const { LitematicLoader, Structure, ThreeStructureRenderer, loadDefaultPackResources } =
      await import("@mattzh72/lodestone");
    const { NbtFile } = await import("@mattzh72/lodestone/nbt");

    const raw = LitematicLoader.getMetadata(bytes);
    const size = {
      x: Math.abs(Number(raw.size?.x ?? 0)),
      y: Math.abs(Number(raw.size?.y ?? 0)),
      z: Math.abs(Number(raw.size?.z ?? 0)),
    };
    if (!size.x || !size.y || !size.z) return null;
    if (size.x * size.y * size.z > MAX_VOLUME) return null;

    const meta: PreviewMeta = {
      name: String(raw.name ?? "").slice(0, 200),
      author: String(raw.author ?? "").slice(0, 100),
      size,
      totalBlocks: Math.max(0, Number(raw.totalBlocks ?? 0)),
      regionCount: Math.max(1, Number(raw.regionCount ?? 1)),
    };

    stage("merging");
    /*
      多区域合并。

      lodestone 的 `LitematicLoader.load(bytes, name)` 只加载**一个区域**，
      且坐标是以该区域自己为原点的。而真实文件（尤其 RedenMC 生成的那些）
      常常把一栋建筑切成好几块分别存放 —— 只画第一块会得到一个几乎空白
      的预览。所以这里按 Metadata.EnclosingSize 建一张大网格，
      逐区域读出来、按 Position 偏移后填进去。

      Position 可能是负数，所以先求所有区域的最小角，整体平移到 0 起点。
    */
    const nbt = NbtFile.read(bytes);
    const regionsTag = nbt.root.getCompound("Regions");

    const regionNames: string[] = [];
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    regionsTag.forEach((name, tag) => {
      regionNames.push(name);
      const pos = (tag as NbtCompound).getCompound("Position");
      minX = Math.min(minX, pos.getNumber("x"));
      minY = Math.min(minY, pos.getNumber("y"));
      minZ = Math.min(minZ, pos.getNumber("z"));
    });
    if (regionNames.length === 0) return null;
    if (!Number.isFinite(minX)) {
      minX = 0;
      minY = 0;
      minZ = 0;
    }

    const merged = new Structure([size.x, size.y, size.z]);
    for (const name of regionNames) {
      const tag = regionsTag.getCompound(name);
      const pos = (tag as NbtCompound).getCompound("Position");
      const ox = pos.getNumber("x") - minX;
      const oy = pos.getNumber("y") - minY;
      const oz = pos.getNumber("z") - minZ;

      const region = LitematicLoader.load(bytes, name);
      for (const placed of region.getBlocks()) {
        merged.addBlock(
          [placed.pos[0] + ox, placed.pos[1] + oy, placed.pos[2] + oz],
          placed.state.getName(),
          placed.state.getProperties()
        );
      }
    }

    stage("loading-pack");
    const { resources } = await loadDefaultPackResources({ baseUrl: PACK_BASE_URL });

    stage("rendering");
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const three = new ThreeStructureRenderer(canvas, merged, resources, {
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

      这里改成从**右上前方**看，距离按**包围球**算：
        distance = radius / sin(fov/2)
      这样不管建筑是方是长，整个结构都恰好落在视锥里。
    */
    const [sx, sy, sz] = [size.x, size.y, size.z];
    const center: [number, number, number] = [sx / 2, sy / 2, sz / 2];
    const radius = 0.5 * Math.hypot(sx, sy, sz);
    const fov = 45;
    const distance = (radius / Math.sin(((fov / 2) * Math.PI) / 180)) * 1.08;
    const dir = normalize([1, 0.72, 1]);
    three.setCamera({
      position: [
        center[0] + dir[0] * distance,
        center[1] + dir[1] * distance,
        center[2] + dir[2] * distance,
      ],
      target: center,
      up: [0, 1, 0],
      fov,
    });

    // 分块网格是异步建的，不等它画出来是空的
    await three.whenReady();
    three.drawStructure();

    const dataUrl = canvas.toDataURL("image/png");
    return { dataUrl, meta };
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
