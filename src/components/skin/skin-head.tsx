"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * 皮肤头部方头像（双层）。
 *
 * Minecraft 皮肤是分层的：
 *   - 内层（base）：头部正面在纹理 (8,8)–(16,16)，尺寸 8×8
 *   - 外层（overlay / 帽子）：头部正面在 (40,8)–(48,16)，同样 8×8
 * 两层在游戏里是贴合的，所以这里把外层用 1px 内缩叠在内层之上 ——
 * 帽子/头发这类像素就会**露在内层轮廓之外**，形成真实的双层观感。
 *
 * 形状按需求用方形（不做圆形裁切），像素保持硬边。
 */

/** 单个皮肤像素显示的尺寸：8px 的头部 × cell = 头像边长 */
const CELL = 5;

export function SkinHead({
  skinUrl,
  alt,
  size,
  className,
}: {
  /** 原始皮肤纹理地址（同源 /api/skin/<uuid> 或直链） */
  skinUrl: string | null;
  alt: string;
  /** 显示边长（px） */
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = React.useState(false);
  const cell = size ? size / 8 : CELL;

  if (!skinUrl) return null;

  return (
    <span
      className={cn(
        "relative block overflow-hidden rounded-md bg-muted",
        className
      )}
      style={{
        width: `calc(8 * ${cell}px)`,
        height: `calc(8 * ${cell}px)`,
      }}
    >
      {!failed ? (
        <>
          {/* 内层：头部正面 */}
          <Image
            src={skinUrl}
            alt={alt}
            width={Math.round(cell * 8)}
            height={Math.round(cell * 8)}
            unoptimized
            priority
            onError={() => setFailed(true)}
            referrerPolicy="no-referrer"
            className="absolute left-0 top-0"
            style={{
              width: `calc(64 * ${cell}px)`,
              height: `calc(64 * ${cell}px)`,
              maxWidth: "none",
              marginLeft: `calc(-8 * ${cell}px)`,
              marginTop: `calc(-8 * ${cell}px)`,
              imageRendering: "pixelated",
            }}
          />
          {/* 外层（帽子/头发）：同样 8×8，整体内缩 1px 让超出内层的像素露出来 */}
          <Image
            src={skinUrl}
            alt=""
            aria-hidden
            width={Math.round(cell * 8)}
            height={Math.round(cell * 8)}
            unoptimized
            referrerPolicy="no-referrer"
            className="absolute left-0 top-0 drop-shadow-[0_0_1px_rgba(0,0,0,0.18)]"
            style={{
              width: `calc(64 * ${cell}px)`,
              height: `calc(64 * ${cell}px)`,
              maxWidth: "none",
              marginLeft: `calc(-40 * ${cell}px)`,
              marginTop: `calc(-8 * ${cell}px)`,
              imageRendering: "pixelated",
            }}
          />
        </>
      ) : (
        <span className="flex size-full items-center justify-center text-sm font-semibold text-primary">
          {(alt.charAt(0) || "?").toUpperCase()}
        </span>
      )}
    </span>
  );
}
