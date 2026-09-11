/**
 * 把 .litematic 的字节变成 lodestone 的 `Structure`。预览图和 3D 查看器共用。
 *
 * 多区域合并是这里的核心（两边都需要，所以抽出来）：
 *
 * `LitematicLoader.load(bytes, name)` 只加载**一个区域**，且坐标以该区域自己
 * 为原点。而真实文件（实测服务器上 252 个）常常把一栋建筑切成好几块分别存放 ——
 * 只画第一块会得到一个几乎空白的预览。所以按 `Metadata.EnclosingSize` 建一张
 * 大网格，逐区域读出来、按 `Position` 偏移后填进去。
 *
 * `Position` 可能是负数，所以先求所有区域的最小角，整体平移到 0 起点。
 */

/** 只导入类型（编译后擦掉） */
type Structure = import("@mattzh72/lodestone").Structure;

export interface LitematicPreviewMeta {
  name: string;
  author: string;
  size: { x: number; y: number; z: number };
  totalBlocks: number;
  regionCount: number;
}

export interface BuiltStructure {
  structure: Structure;
  meta: LitematicPreviewMeta;
}

/** 体积上限，和服务端 `@/server/litematic` 的常量保持一致 */
export const MAX_BUILD_VOLUME = 32_000_000;

/**
 * @returns 构建好的结构；文件不合法、或体积超限时返回 null（不抛）
 */
export async function buildStructureFromLitematic(
  bytes: Uint8Array
): Promise<BuiltStructure | null> {
  try {
    const { LitematicLoader, Structure } = await import("@mattzh72/lodestone");
    const { NbtFile } = await import("@mattzh72/lodestone/nbt");

    const raw = LitematicLoader.getMetadata(bytes);
    const size = {
      x: Math.abs(Number(raw.size?.x ?? 0)),
      y: Math.abs(Number(raw.size?.y ?? 0)),
      z: Math.abs(Number(raw.size?.z ?? 0)),
    };
    if (!size.x || !size.y || !size.z) return null;
    if (size.x * size.y * size.z > MAX_BUILD_VOLUME) return null;

    const meta: LitematicPreviewMeta = {
      name: String(raw.name ?? "").slice(0, 200),
      author: String(raw.author ?? "").slice(0, 100),
      size,
      totalBlocks: Math.max(0, Number(raw.totalBlocks ?? 0)),
      regionCount: Math.max(1, Number(raw.regionCount ?? 1)),
    };

    const nbt = NbtFile.read(bytes);
    const regionsTag = nbt.root.getCompound("Regions");

    const regionNames: string[] = [];
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    regionsTag.forEach((name, tag) => {
      regionNames.push(name);
      const pos = (tag as import("@mattzh72/lodestone/nbt").NbtCompound).getCompound("Position");
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
      const tag = (regionsTag as import("@mattzh72/lodestone/nbt").NbtCompound).getCompound(name);
      const pos = tag.getCompound("Position");
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

    return { structure: merged, meta };
  } catch (err) {
    console.warn("[litematic] 构建结构失败：", err);
    return null;
  }
}

/**
 * 等轴测取景。
 *
 * 不用 lodestone 的 `resetCamera()`：它把相机放在 +Z 轴上、距离取
 * `最长边 * 1.8`。对"又长又扁"的建筑（例如 106×32×404 的机器）那意味着
 * 正对着 106×32 那一面、还退到 727 格外 —— 整个建筑在画面里只有一小条。
 *
 * 这里改成：方向用**方位角 + 固定俯仰角**表示，距离按**包围球**算
 * （`radius / sin(fov/2)`），任何长宽比都恰好入镜。方位角可调，
 * 所以同一个函数能生成多个方向的视图。
 *
 * @param yawDeg 方位角偏移（度）。0 = 默认的右上前方视角。
 */
export function frameCamera(
  size: { x: number; y: number; z: number },
  fov = 45,
  yawDeg = 0
): {
  position: [number, number, number];
  target: [number, number, number];
  radius: number;
  distance: number;
} {
  const center: [number, number, number] = [size.x / 2, size.y / 2, size.z / 2];
  const radius = 0.5 * Math.hypot(size.x, size.y, size.z);
  const distance = (radius / Math.sin(((fov / 2) * Math.PI) / 180)) * 1.08;

  // 默认方向的水平分量是 (1, 1) → 方位角 45°；俯仰角由 0.72 这个高度比定
  const baseYaw = Math.PI / 4;
  const elevation = Math.atan2(0.72, Math.hypot(1, 1));
  const yaw = baseYaw + (yawDeg * Math.PI) / 180;

  const horizontal = Math.cos(elevation);
  const vertical = Math.sin(elevation);
  return {
    position: [
      center[0] + Math.cos(yaw) * horizontal * distance,
      center[1] + vertical * distance,
      center[2] + Math.sin(yaw) * horizontal * distance,
    ],
    target: center,
    radius,
    distance,
  };
}

/**
 * 三个方向上的等轴测视图。
 *
 * 取 120° 一档：三张图拼起来正好把建筑看一圈，不会有哪一面完全没拍到。
 * （90° 一档要四张才闭环，45° 那套是八个方向，都太多。）
 *
 * 卡片缩略图用**第一张**，所以第一张的方位角保持 0（原来的默认视角），
 * 老缩略图的观感不变。
 */
export const PREVIEW_VIEWS: { key: string; yawDeg: number }[] = [
  { key: "viewFront", yawDeg: 0 },
  { key: "viewSide", yawDeg: 120 },
  { key: "viewBack", yawDeg: 240 },
];
