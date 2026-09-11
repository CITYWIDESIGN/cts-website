import "server-only";

import { prisma } from "@/lib/prisma";
import { pickLocalized } from "@/lib/localized";
import type { CarouselSlideInput } from "@/lib/validators/carousel";

/**
 * 首页轮播图的数据访问。
 *
 * 文案中英分列存（英文留空回退中文），图片二进制在 `carousel_images`。
 * 列表一律 `select` 掉 image.data —— 那是几百 KB 到几 MB 的字节，
 * 只有图片接口才该读。
 */

/** 列表用的字段：**不含图片本体**，只带"有没有图" */
const LIST_SELECT = {
  id: true,
  titleZh: true,
  titleEn: true,
  subtitleZh: true,
  subtitleEn: true,
  sortOrder: true,
  published: true,
  image: { select: { slideId: true } },
} as const;

/** 后台：全部轮播图，按 sortOrder */
export async function listAllSlides() {
  return prisma.carouselSlide.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: LIST_SELECT,
  });
}

/** 前台：已发布的轮播图 */
export async function listPublishedSlides() {
  return prisma.carouselSlide.findMany({
    where: { published: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: LIST_SELECT,
  });
}

export async function getSlide(id: string) {
  return prisma.carouselSlide.findUnique({
    where: { id },
    select: { ...LIST_SELECT, createdAt: true },
  });
}

/** 图片接口用：只取二进制与类型 */
export async function getSlideImage(id: string) {
  return prisma.carouselImage.findUnique({
    where: { slideId: id },
    select: { data: true, mimeType: true },
  });
}

export async function countSlides() {
  return prisma.carouselSlide.count();
}

/** 新增时排在最后 */
async function nextSortOrder(): Promise<number> {
  const last = await prisma.carouselSlide.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  return (last?.sortOrder ?? -1) + 1;
}

export interface SlideImageInput {
  data: Uint8Array;
  mimeType: string;
}

export async function createSlide(
  input: CarouselSlideInput,
  image: SlideImageInput
) {
  return prisma.carouselSlide.create({
    data: {
      ...normalizeText(input),
      sortOrder: await nextSortOrder(),
      /*
        Prisma 6 的 Bytes 字段要的是 `Uint8Array<ArrayBuffer>`，而 `Buffer` /
        从 File 读出来的字节底层是 `ArrayBufferLike`，直接传类型不兼容。
        再包一层拿到的就是全新的 ArrayBuffer 版本（有一次拷贝，图片量级可接受）。
        和 @/server/resource 里写资源附件时是同一个坑。
      */
      image: {
        create: { data: new Uint8Array(image.data), mimeType: image.mimeType },
      },
    },
    select: { id: true },
  });
}

/**
 * 更新。
 *
 * `image` 传 null 表示**不动原图**（而不是删掉）—— 改个标题不该被迫重传图。
 * 想换图就传新的；目前不提供"删掉图但留着条目"，没有图的轮播项没有意义。
 */
export async function updateSlide(
  id: string,
  input: CarouselSlideInput,
  image: SlideImageInput | null
) {
  return prisma.$transaction(async (tx) => {
    await tx.carouselSlide.update({
      where: { id },
      data: normalizeText(input),
    });

    if (image) {
      const data = new Uint8Array(image.data);
      await tx.carouselImage.upsert({
        where: { slideId: id },
        create: { slideId: id, data, mimeType: image.mimeType },
        update: { data, mimeType: image.mimeType },
      });
    }
  });
}

export async function deleteSlide(id: string) {
  // 图片靠外键级联删除
  return prisma.carouselSlide.delete({ where: { id } });
}

/** 按给定顺序重排（后台只做"上移/下移"，前端把整个顺序传上来） */
export async function reorderSlides(ids: string[]) {
  await prisma.$transaction(
    ids.map((id, i) =>
      prisma.carouselSlide.update({ where: { id }, data: { sortOrder: i } })
    )
  );
}

function normalizeText(input: CarouselSlideInput) {
  const blankToNull = (v: string) => (v.trim() ? v.trim() : null);
  return {
    titleZh: input.titleZh.trim(),
    titleEn: blankToNull(input.titleEn),
    subtitleZh: input.subtitleZh.trim(),
    subtitleEn: blankToNull(input.subtitleEn),
    published: input.published,
  };
}

/** 数据库行 → 前台要的形状：按当前语言取好文案，图片走接口 */
export function toSlideView(
  locale: string,
  row: {
    id: string;
    titleZh: string;
    titleEn: string | null;
    subtitleZh: string;
    subtitleEn: string | null;
    image: { slideId: string } | null;
  }
) {
  return {
    id: row.id,
    src: `/api/carousel/${row.id}/image`,
    title: pickLocalized(locale, { zh: row.titleZh, en: row.titleEn }),
    subtitle: pickLocalized(locale, { zh: row.subtitleZh, en: row.subtitleEn }),
    hasImage: Boolean(row.image),
  };
}
