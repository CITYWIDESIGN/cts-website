/**
 * QQ 群二维码。
 *
 * 这张图**不是** QQ 导出的那张卡片截图 —— 那是深底蓝点、带企鹅 logo 的样式，
 * 和本站克制的单色风格不搭。这里是把它还原成模块矩阵之后，用站点自己的配色
 * 重画的矢量图：单色、跟随主题（currentColor），深浅色下都能扫。
 *
 * 重新生成：见 CLAUDE.md 里的说明（需要那张截图 + `scripts` 下的提取脚本）。
 *
 * 两个容易踩的点，改这个文件前先读：
 *  1. 三个定位图案与校正图案是**按 QR 规范写死**的。QQ 把它们画成了圆形，
 *     照抄像素会得到角格为空的坏定位图案，扫不出来。
 *  2. 中间的留空与品牌标记**尺寸必须一致**，且不能比原图的 logo 更大 ——
 *     那块区域靠纠错码兜底，挖大了就超出纠错能力。
 */

/** 模块数（29 = QR 版本 3） */
const MODULES = 29;
/** 四周安静区宽度（模块） */
const QUIET = 4;

/** 深色模块的路径，坐标已含安静区偏移 */
const PATH =
  "M4 4h1v1h-1zM5 4h1v1h-1zM6 4h1v1h-1zM7 4h1v1h-1zM8 4h1v1h-1zM9 4h1v1h-1zM10 4h1v1h-1zM12 4h1v1h-1zM13 4h1v1h-1zM14 4h1v1h-1zM15 4h1v1h-1zM23 4h1v1h-1zM26 4h1v1h-1zM27 4h1v1h-1zM28 4h1v1h-1zM29 4h1v1h-1zM30 4h1v1h-1zM31 4h1v1h-1zM32 4h1v1h-1zM4 5h1v1h-1zM10 5h1v1h-1zM14 5h1v1h-1zM15 5h1v1h-1zM16 5h1v1h-1zM20 5h1v1h-1zM23 5h1v1h-1zM26 5h1v1h-1zM32 5h1v1h-1zM4 6h1v1h-1zM6 6h1v1h-1zM7 6h1v1h-1zM8 6h1v1h-1zM10 6h1v1h-1zM13 6h1v1h-1zM14 6h1v1h-1zM17 6h1v1h-1zM19 6h1v1h-1zM20 6h1v1h-1zM21 6h1v1h-1zM22 6h1v1h-1zM24 6h1v1h-1zM26 6h1v1h-1zM28 6h1v1h-1zM29 6h1v1h-1zM30 6h1v1h-1zM32 6h1v1h-1zM4 7h1v1h-1zM6 7h1v1h-1zM7 7h1v1h-1zM8 7h1v1h-1zM10 7h1v1h-1zM12 7h1v1h-1zM15 7h1v1h-1zM16 7h1v1h-1zM18 7h1v1h-1zM19 7h1v1h-1zM20 7h1v1h-1zM21 7h1v1h-1zM22 7h1v1h-1zM23 7h1v1h-1zM26 7h1v1h-1zM28 7h1v1h-1zM29 7h1v1h-1zM30 7h1v1h-1zM32 7h1v1h-1zM4 8h1v1h-1zM6 8h1v1h-1zM7 8h1v1h-1zM8 8h1v1h-1zM10 8h1v1h-1zM12 8h1v1h-1zM14 8h1v1h-1zM17 8h1v1h-1zM18 8h1v1h-1zM20 8h1v1h-1zM23 8h1v1h-1zM26 8h1v1h-1zM28 8h1v1h-1zM29 8h1v1h-1zM30 8h1v1h-1zM32 8h1v1h-1zM4 9h1v1h-1zM10 9h1v1h-1zM12 9h1v1h-1zM14 9h1v1h-1zM16 9h1v1h-1zM17 9h1v1h-1zM18 9h1v1h-1zM19 9h1v1h-1zM23 9h1v1h-1zM24 9h1v1h-1zM26 9h1v1h-1zM32 9h1v1h-1zM4 10h1v1h-1zM5 10h1v1h-1zM6 10h1v1h-1zM7 10h1v1h-1zM8 10h1v1h-1zM9 10h1v1h-1zM10 10h1v1h-1zM12 10h1v1h-1zM14 10h1v1h-1zM16 10h1v1h-1zM18 10h1v1h-1zM20 10h1v1h-1zM22 10h1v1h-1zM24 10h1v1h-1zM26 10h1v1h-1zM27 10h1v1h-1zM28 10h1v1h-1zM29 10h1v1h-1zM30 10h1v1h-1zM31 10h1v1h-1zM32 10h1v1h-1zM12 11h1v1h-1zM14 11h1v1h-1zM16 11h1v1h-1zM18 11h1v1h-1zM21 11h1v1h-1zM22 11h1v1h-1zM23 11h1v1h-1zM24 11h1v1h-1zM4 12h1v1h-1zM8 12h1v1h-1zM10 12h1v1h-1zM11 12h1v1h-1zM12 12h1v1h-1zM14 12h1v1h-1zM16 12h1v1h-1zM17 12h1v1h-1zM18 12h1v1h-1zM19 12h1v1h-1zM20 12h1v1h-1zM21 12h1v1h-1zM23 12h1v1h-1zM25 12h1v1h-1zM26 12h1v1h-1zM27 12h1v1h-1zM28 12h1v1h-1zM29 12h1v1h-1zM32 12h1v1h-1zM4 13h1v1h-1zM5 13h1v1h-1zM7 13h1v1h-1zM8 13h1v1h-1zM11 13h1v1h-1zM12 13h1v1h-1zM13 13h1v1h-1zM15 13h1v1h-1zM21 13h1v1h-1zM22 13h1v1h-1zM25 13h1v1h-1zM26 13h1v1h-1zM27 13h1v1h-1zM28 13h1v1h-1zM29 13h1v1h-1zM30 13h1v1h-1zM31 13h1v1h-1zM32 13h1v1h-1zM6 14h1v1h-1zM7 14h1v1h-1zM8 14h1v1h-1zM10 14h1v1h-1zM11 14h1v1h-1zM17 14h1v1h-1zM18 14h1v1h-1zM19 14h1v1h-1zM21 14h1v1h-1zM24 14h1v1h-1zM25 14h1v1h-1zM26 14h1v1h-1zM32 14h1v1h-1zM4 15h1v1h-1zM5 15h1v1h-1zM7 15h1v1h-1zM12 15h1v1h-1zM13 15h1v1h-1zM14 15h1v1h-1zM22 15h1v1h-1zM23 15h1v1h-1zM24 15h1v1h-1zM26 15h1v1h-1zM27 15h1v1h-1zM29 15h1v1h-1zM31 15h1v1h-1zM32 15h1v1h-1zM6 16h1v1h-1zM9 16h1v1h-1zM10 16h1v1h-1zM22 16h1v1h-1zM24 16h1v1h-1zM27 16h1v1h-1zM31 16h1v1h-1zM7 17h1v1h-1zM11 17h1v1h-1zM13 17h1v1h-1zM21 17h1v1h-1zM24 17h1v1h-1zM26 17h1v1h-1zM27 17h1v1h-1zM28 17h1v1h-1zM29 17h1v1h-1zM30 17h1v1h-1zM31 17h1v1h-1zM32 17h1v1h-1zM4 18h1v1h-1zM6 18h1v1h-1zM7 18h1v1h-1zM10 18h1v1h-1zM11 18h1v1h-1zM13 18h1v1h-1zM14 18h1v1h-1zM21 18h1v1h-1zM24 18h1v1h-1zM27 18h1v1h-1zM28 18h1v1h-1zM29 18h1v1h-1zM30 18h1v1h-1zM32 18h1v1h-1zM4 19h1v1h-1zM6 19h1v1h-1zM7 19h1v1h-1zM8 19h1v1h-1zM9 19h1v1h-1zM13 19h1v1h-1zM14 19h1v1h-1zM21 19h1v1h-1zM22 19h1v1h-1zM25 19h1v1h-1zM28 19h1v1h-1zM31 19h1v1h-1zM32 19h1v1h-1zM4 20h1v1h-1zM6 20h1v1h-1zM8 20h1v1h-1zM10 20h1v1h-1zM12 20h1v1h-1zM13 20h1v1h-1zM23 20h1v1h-1zM25 20h1v1h-1zM31 20h1v1h-1zM4 21h1v1h-1zM5 21h1v1h-1zM7 21h1v1h-1zM12 21h1v1h-1zM14 21h1v1h-1zM17 21h1v1h-1zM18 21h1v1h-1zM19 21h1v1h-1zM22 21h1v1h-1zM26 21h1v1h-1zM28 21h1v1h-1zM29 21h1v1h-1zM31 21h1v1h-1zM32 21h1v1h-1zM8 22h1v1h-1zM9 22h1v1h-1zM10 22h1v1h-1zM11 22h1v1h-1zM12 22h1v1h-1zM13 22h1v1h-1zM15 22h1v1h-1zM17 22h1v1h-1zM18 22h1v1h-1zM19 22h1v1h-1zM24 22h1v1h-1zM25 22h1v1h-1zM26 22h1v1h-1zM30 22h1v1h-1zM32 22h1v1h-1zM7 23h1v1h-1zM9 23h1v1h-1zM13 23h1v1h-1zM17 23h1v1h-1zM19 23h1v1h-1zM20 23h1v1h-1zM21 23h1v1h-1zM22 23h1v1h-1zM23 23h1v1h-1zM24 23h1v1h-1zM28 23h1v1h-1zM31 23h1v1h-1zM32 23h1v1h-1zM4 24h1v1h-1zM5 24h1v1h-1zM6 24h1v1h-1zM9 24h1v1h-1zM10 24h1v1h-1zM13 24h1v1h-1zM14 24h1v1h-1zM15 24h1v1h-1zM17 24h1v1h-1zM24 24h1v1h-1zM25 24h1v1h-1zM26 24h1v1h-1zM27 24h1v1h-1zM28 24h1v1h-1zM29 24h1v1h-1zM32 24h1v1h-1zM12 25h1v1h-1zM13 25h1v1h-1zM14 25h1v1h-1zM15 25h1v1h-1zM17 25h1v1h-1zM18 25h1v1h-1zM20 25h1v1h-1zM22 25h1v1h-1zM23 25h1v1h-1zM24 25h1v1h-1zM28 25h1v1h-1zM32 25h1v1h-1zM4 26h1v1h-1zM5 26h1v1h-1zM6 26h1v1h-1zM7 26h1v1h-1zM8 26h1v1h-1zM9 26h1v1h-1zM10 26h1v1h-1zM12 26h1v1h-1zM15 26h1v1h-1zM16 26h1v1h-1zM20 26h1v1h-1zM22 26h1v1h-1zM23 26h1v1h-1zM24 26h1v1h-1zM26 26h1v1h-1zM28 26h1v1h-1zM29 26h1v1h-1zM30 26h1v1h-1zM32 26h1v1h-1zM4 27h1v1h-1zM10 27h1v1h-1zM13 27h1v1h-1zM14 27h1v1h-1zM18 27h1v1h-1zM21 27h1v1h-1zM24 27h1v1h-1zM28 27h1v1h-1zM31 27h1v1h-1zM4 28h1v1h-1zM6 28h1v1h-1zM7 28h1v1h-1zM8 28h1v1h-1zM10 28h1v1h-1zM12 28h1v1h-1zM13 28h1v1h-1zM15 28h1v1h-1zM17 28h1v1h-1zM18 28h1v1h-1zM19 28h1v1h-1zM23 28h1v1h-1zM24 28h1v1h-1zM25 28h1v1h-1zM26 28h1v1h-1zM27 28h1v1h-1zM28 28h1v1h-1zM29 28h1v1h-1zM31 28h1v1h-1zM32 28h1v1h-1zM4 29h1v1h-1zM6 29h1v1h-1zM7 29h1v1h-1zM8 29h1v1h-1zM10 29h1v1h-1zM13 29h1v1h-1zM14 29h1v1h-1zM16 29h1v1h-1zM21 29h1v1h-1zM22 29h1v1h-1zM24 29h1v1h-1zM25 29h1v1h-1zM31 29h1v1h-1zM4 30h1v1h-1zM6 30h1v1h-1zM7 30h1v1h-1zM8 30h1v1h-1zM10 30h1v1h-1zM14 30h1v1h-1zM15 30h1v1h-1zM17 30h1v1h-1zM19 30h1v1h-1zM22 30h1v1h-1zM23 30h1v1h-1zM24 30h1v1h-1zM25 30h1v1h-1zM29 30h1v1h-1zM30 30h1v1h-1zM31 30h1v1h-1zM32 30h1v1h-1zM4 31h1v1h-1zM10 31h1v1h-1zM14 31h1v1h-1zM15 31h1v1h-1zM16 31h1v1h-1zM19 31h1v1h-1zM20 31h1v1h-1zM21 31h1v1h-1zM24 31h1v1h-1zM29 31h1v1h-1zM31 31h1v1h-1zM32 31h1v1h-1zM4 32h1v1h-1zM5 32h1v1h-1zM6 32h1v1h-1zM7 32h1v1h-1zM8 32h1v1h-1zM9 32h1v1h-1zM10 32h1v1h-1zM12 32h1v1h-1zM14 32h1v1h-1zM15 32h1v1h-1zM16 32h1v1h-1zM19 32h1v1h-1zM24 32h1v1h-1zM25 32h1v1h-1zM26 32h1v1h-1zM28 32h1v1h-1zM31 32h1v1h-1z";

export function QqQrCode({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${MODULES + QUIET * 2} ${MODULES + QUIET * 2}`}
      className={className}
      role="img"
      aria-label="QQ 群二维码"
    >
      {/* 模块用 crispEdges，避免缩放时边缘发虚；品牌标记不套，圆角要平滑 */}
      <path d={PATH} fill="currentColor" shapeRendering="crispEdges" />

      {/* 与页头 Logo 同款：primary 圆角方块 + Box 图标 */}
      <rect
        x="16"
        y="16"
        width="5"
        height="5"
        rx="1.15"
        fill="var(--primary)"
      />
      <g
        transform="translate(16.400 16.400) scale(0.175)"
        fill="none"
        stroke="var(--primary-foreground)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </g>
    </svg>
  );
}
