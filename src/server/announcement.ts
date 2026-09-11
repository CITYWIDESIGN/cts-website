import "server-only";

import { prisma } from "@/lib/prisma";
import { pickLocalized } from "@/lib/localized";

/**
 * 首页公告的数据访问。
 *
 * 内容由管理员在后台维护，所以这里的读写都不涉及 i18n 消息文件 ——
 * 中英分列存在 `Announcement` 上，英文留空时回退中文（见 @/lib/localized）。
 */

/** 首页最多展示几条 */
export const HOME_ANNOUNCEMENT_LIMIT = 3;

/** 后台列表最多取多少条 —— 公告量级不大，一次取完够用 */
export const ADMIN_ANNOUNCEMENT_LIMIT = 200;

/** 后台：全部公告（含草稿），按发布日期倒序 */
export async function listAllAnnouncements() {
  return prisma.announcement.findMany({
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: ADMIN_ANNOUNCEMENT_LIMIT,
  });
}

/** 前台：已发布的公告 */
export async function listPublishedAnnouncements(take = HOME_ANNOUNCEMENT_LIMIT) {
  return prisma.announcement.findMany({
    where: { published: true },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take,
  });
}

export async function getAnnouncement(id: string) {
  return prisma.announcement.findUnique({ where: { id } });
}

export interface AnnouncementInput {
  titleZh: string;
  titleEn: string;
  bodyZh: string;
  bodyEn: string;
  tagZh: string;
  tagEn: string;
  published: boolean;
  publishedAt: Date;
}

export async function createAnnouncement(input: AnnouncementInput) {
  return prisma.announcement.create({ data: normalize(input) });
}

export async function updateAnnouncement(id: string, input: AnnouncementInput) {
  return prisma.announcement.update({ where: { id }, data: normalize(input) });
}

export async function deleteAnnouncement(id: string) {
  return prisma.announcement.delete({ where: { id } });
}

/** 空字符串统一存 null：省得区分"没填"和"填了个空串" */
function normalize(input: AnnouncementInput) {
  const blankToNull = (v: string) => (v.trim() ? v.trim() : null);
  return {
    titleZh: input.titleZh.trim(),
    titleEn: blankToNull(input.titleEn),
    bodyZh: input.bodyZh.trim(),
    bodyEn: blankToNull(input.bodyEn),
    tagZh: blankToNull(input.tagZh),
    tagEn: blankToNull(input.tagEn),
    published: input.published,
    publishedAt: input.publishedAt,
  };
}

/**
 * 把数据库行转成前台要的形状：按当前语言取好文本。
 * 放在服务端做，客户端组件就不必知道双列的存在。
 */
export function toAnnouncementView(
  locale: string,
  row: {
    id: string;
    titleZh: string;
    titleEn: string | null;
    bodyZh: string;
    bodyEn: string | null;
    tagZh: string | null;
    tagEn: string | null;
    publishedAt: Date;
  }
) {
  const tag = pickLocalized(locale, { zh: row.tagZh ?? "", en: row.tagEn });
  return {
    id: row.id,
    title: pickLocalized(locale, { zh: row.titleZh, en: row.titleEn }),
    body: pickLocalized(locale, { zh: row.bodyZh, en: row.bodyEn }),
    tag: tag.trim() || null,
    publishedAt: row.publishedAt,
  };
}
