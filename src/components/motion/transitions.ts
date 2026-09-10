/**
 * 全站动效参数（单一来源，避免各页面各写一套曲线导致风格漂移）。
 *
 * 设计原则：
 * 1. 只用 opacity / transform / filter 做动画，避免触发布局重排（保证丝滑）。
 * 2. 时长集中在 0.4–0.6s，缓动统一为 ease-out 风格，不弹跳、不夸张。
 * 3. 位移幅度克制（8–16px），配合轻微 blur，营造"细腻"而非"跳跃"的观感。
 * 4. 所有入场动画都必须尊重 prefers-reduced-motion（在组件里统一处理）。
 */

/** 主缓动：起步快、收尾稳，用于绝大多数入场动画 */
export const EASE_OUT = [0.21, 0.47, 0.32, 0.98] as const;

/** 次缓动：更柔和，用于大块内容（卡片、区块） */
export const EASE_SOFT = [0.16, 1, 0.3, 1] as const;

/** 默认入场时长 */
export const DURATION = 0.5;

/** 列表逐项出现的间隔 */
export const STAGGER = 0.075;

/** 入场位移距离 */
export const OFFSET_Y = 12;

/** 入场模糊强度（px） */
export const BLUR = 6;

/** 进场视口判定：元素露出约 80px 时触发，只触发一次 */
export const VIEWPORT = { once: true, margin: "-80px" } as const;

/** 列表项进场视口判定：更早触发，避免长列表末尾"卡着不动" */
export const VIEWPORT_LIST = { once: true, margin: "-40px" } as const;
