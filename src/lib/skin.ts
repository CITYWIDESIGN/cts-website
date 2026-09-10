import { formatUuid } from "./format";

/**
 * Minecraft 皮肤相关 URL。
 *
 * 全部直连 mc-heads.net（已验证可用）：
 *   - head：已合成好的头部头像（含帽子/头发外层），小尺寸用
 *   - body：全身渲染图
 *   - skin：原始 64×64 纹理（`<SkinHead>` 的纹理拼贴用）
 */

const SKIN_HEAD_BASE = "https://mc-heads.net/avatar";
const SKIN_BODY_BASE = "https://mc-heads.net/body";
const SKIN_RAW_BASE = "https://mc-heads.net/skin";

export type SkinSize = 32 | 48 | 64 | 96 | 128;

/** 只接受标准 36 位 UUID，避免把非法值拼进 URL */
function normalizeUuid(uuid: string | null | undefined): string | null {
  if (!uuid) return null;
  const normalized = formatUuid(uuid);
  if (!normalized || normalized === "—") return null;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      normalized
    )
  ) {
    return null;
  }
  return normalized;
}

/** 头部贴图（用于小尺寸头像） */
export function skinHeadUrl(
  uuid: string | null | undefined,
  size: SkinSize = 64
): string | null {
  const id = normalizeUuid(uuid);
  return id ? `${SKIN_HEAD_BASE}/${id}/${size}` : null;
}

/** 全身渲染图（2D，用于卡片预览） */
export function skinBodyUrl(
  uuid: string | null | undefined,
  size: 64 | 128 | 256 = 128
): string | null {
  const id = normalizeUuid(uuid);
  return id ? `${SKIN_BODY_BASE}/${id}/${size}` : null;
}

/** 原始 64×64 皮肤纹理（`<SkinHead>` 用它做双层拼贴） */
export function skinRawUrl(uuid: string | null | undefined): string | null {
  const id = normalizeUuid(uuid);
  return id ? `${SKIN_RAW_BASE}/${id}` : null;
}

export const DEFAULT_SKIN_PATH = "/skins/default.png";
