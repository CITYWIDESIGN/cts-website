import * as React from "react";

/**
 * 占位二维码。
 *
 * 用固定种子的伪随机模块 + 三个定位角，渲染成一个"看起来就是二维码"的 SVG，
 * 而不是一个灰色方块（灰方块容易让人以为是图裂了）。
 *
 * 它是**纯装饰、不可扫描**。换成真实二维码时：
 *   把真图放到 public/community/qq-qr.png，然后在
 *   src/config/site.ts 里把 `qqQrImage` 指向它即可（组件会自动改用图片）。
 */
function pseudoRandom(seed: number) {
  // 简单的线性同余，保证每次渲染图案一致（SSR 与客户端相同，不会水合不一致）
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

const SIZE = 25; // 模块数
const CELL = 8; // 每个模块的像素

export function PseudoQr({ className }: { className?: string }) {
  const rand = pseudoRandom(0x5eed1a);

  const cells: React.ReactNode[] = [];

  /** 是否为定位角（左上/右上/左下三个 7×7 回字） */
  function finderOwner(r: number, c: number): { ring: number; dc: number; dr: number } | null {
    const origins = [
      { r: 0, c: 0 },
      { r: 0, c: SIZE - 7 },
      { r: SIZE - 7, c: 0 },
    ];
    for (const o of origins) {
      const dr = r - o.r;
      const dc = c - o.c;
      if (dr >= 0 && dr < 7 && dc >= 0 && dc < 7) {
        const ring = Math.max(Math.abs(dr - 3), Math.abs(dc - 3));
        return { ring, dc, dr };
      }
    }
    return null;
  }

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const finder = finderOwner(r, c);
      let filled: boolean;

      if (finder) {
        // 回字：外框(ring=3)与中心(ring<=1)实心，中间留白
        filled = finder.ring === 3 || finder.ring <= 1;
      } else {
        // 定位角周围留一圈静区，其余按伪随机填充
        const nearFinder = [
          { r: 0, c: 0 },
          { r: 0, c: SIZE - 7 },
          { r: SIZE - 7, c: 0 },
        ].some(
          (o) =>
            r >= o.r - 1 && r < o.r + 8 && c >= o.c - 1 && c < o.c + 8
        );
        filled = nearFinder ? false : rand() > 0.52;
      }

      if (filled) {
        cells.push(
          <rect
            key={`${r}-${c}`}
            x={c * CELL}
            y={r * CELL}
            width={CELL}
            height={CELL}
            rx={1.5}
          />
        );
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${SIZE * CELL} ${SIZE * CELL}`}
      className={className}
      role="img"
      aria-label="QR code placeholder"
      fill="currentColor"
      shapeRendering="crispEdges"
    >
      <rect width={SIZE * CELL} height={SIZE * CELL} fill="transparent" />
      {cells}
    </svg>
  );
}
