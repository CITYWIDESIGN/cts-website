/**
 * 首页图片轮播的幻灯片配置。
 *
 * 换图方式（两种任选）：
 *   1. 直接把图片文件放进 `public/carousel/`，然后把下面的 `src` 指向它，
 *      例如 src: "/carousel/my-screenshot.jpg"
 *   2. 想用远程图（图床/CDN）：直接写完整 URL，例如
 *      src: "https://cdn.example.com/1.webp"
 *
 * 标题/描述文案在 `messages/zh.json` 与 `messages/en.json` 的
 * `home.carousel.items.<key>` 下维护（双语同步）。
 *
 * 建议图片比例 16:9，宽度 ≥1600px；组件内按 16:9 容器 object-cover 裁切，
 * 所以比例不完全一致也不会变形。
 *
 * 说明：当前 4 张是纯色渐变占位 SVG（public/carousel/01..04.svg），
 * 直接替换文件即可，文件名相同则连这里都不用改。
 */

export type CarouselSlide = {
  /** 稳定的 key，同时用于关联文案 */
  key: string;
  /** 图片地址：本地 /carousel/xxx 或完整 URL */
  src: string;
  /** 是否在图片上方叠加轻微暗化（图片太亮时保持文字可读） */
  overlay?: boolean;
};

export const carouselSlides: CarouselSlide[] = [
  { key: "slide1", src: "/carousel/01.svg", overlay: true },
  { key: "slide2", src: "/carousel/02.svg", overlay: true },
  { key: "slide3", src: "/carousel/03.svg", overlay: true },
  { key: "slide4", src: "/carousel/04.svg", overlay: true },
  { key: "slide5", src: "/carousel/05.svg", overlay: true },
  { key: "slide6", src: "/carousel/06.svg", overlay: true },
  { key: "slide7", src: "/carousel/07.svg", overlay: true },
  { key: "slide8", src: "/carousel/08.svg", overlay: true },
  { key: "slide9", src: "/carousel/09.svg", overlay: true },
  { key: "slide10", src: "/carousel/10.svg", overlay: true },
];

/** 自动播放间隔（毫秒）；设为 0 关闭自动播放 */
export const carouselIntervalMs = 6000;
