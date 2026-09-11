import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/server/auth";
import { listAllAnnouncements } from "@/server/announcement";
import {
  AnnouncementManager,
  type AnnouncementRow,
} from "@/components/admin/announcement-manager";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { PageEnter, Stagger, StaggerItem } from "@/components/motion/stagger";

/**
 * 后台：公告管理。
 *
 * 首页「最新公告」那一块读的就是这里 —— 已发布、按日期倒序的前三条。
 * 表单里带草稿开关，可以先把内容写好再发。
 */
export default async function AdminAnnouncementsPage() {
  await requireAdmin();
  const t = await getTranslations("admin.announcements");

  const rows = await listAllAnnouncements();

  // 日期在服务端转成 YYYY-MM-DD 再交给客户端：<input type="date"> 只认这个格式，
  // 而在客户端 toISOString() 会按 UTC 截断，前后端来回转容易差一天
  const items: AnnouncementRow[] = rows.map((r) => ({
    id: r.id,
    titleZh: r.titleZh,
    titleEn: r.titleEn,
    bodyZh: r.bodyZh,
    bodyEn: r.bodyEn,
    tagZh: r.tagZh,
    tagEn: r.tagEn,
    published: r.published,
    publishedAt: r.publishedAt.toISOString().slice(0, 10),
  }));

  return (
    <PageEnter className="flex flex-col gap-6">
      <Stagger inView={false} stagger={0.08} className="flex flex-col gap-6">
        <StaggerItem index={0}>
          <AdminPageHeader
            title={t("title")}
            description={t("description")}
            badge={
              items.length > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {t("count", { count: items.length })}
                </span>
              ) : undefined
            }
          />
        </StaggerItem>

        <StaggerItem index={1} className="flex flex-col gap-3">
          <AnnouncementManager items={items} />
        </StaggerItem>
      </Stagger>
    </PageEnter>
  );
}
