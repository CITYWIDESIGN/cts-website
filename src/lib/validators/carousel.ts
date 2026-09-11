import { z } from "zod";

/**
 * 首页轮播图的表单校验。
 *
 * 图片本身不走这里 —— 它是二进制，由 Server Action 的 FormData 单独接收，
 * 大小与类型在服务端用 @/lib/image-types 的白名单照样校验一遍。
 */

export const CarouselSlideInputSchema = z.object({
  titleZh: z.string().trim().min(1, "required").max(120),
  titleEn: z.string().trim().max(120).default(""),
  subtitleZh: z.string().trim().min(1, "required").max(300),
  subtitleEn: z.string().trim().max(300).default(""),
  published: z.boolean(),
});

export type CarouselSlideInput = z.infer<typeof CarouselSlideInputSchema>;

/** 轮播图单独的大小上限。首页首屏要加载，不宜太大 */
export const MAX_CAROUSEL_IMAGE_BYTES = 8 * 1024 * 1024;
