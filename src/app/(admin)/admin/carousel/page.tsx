import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/server/auth";
import { listAllSlides } from "@/server/carousel";
import { CarouselManager, type SlideRow } from "@/components/admin/carousel-manager";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { PageEnter, Stagger, StaggerItem } from "@/components/motion/stagger";

/**
 * 后台：首页轮播图管理。
 *
 * 图片存在数据库里（`carousel_images`），不依赖共享文件系统 —— 和资源附件
 * 一个思路，本地 / Docker / 多实例部署行为一致。
 *
 * 一条都没有时首页会回退到内置的占位图，所以清空这里不会让首屏开天窗。
 */
export default async function AdminCarouselPage() {
  await requireAdmin();
  const t = await getTranslations("admin.carousel");

  const rows = await listAllSlides();

  const items: SlideRow[] = rows.map((r) => ({
    id: r.id,
    titleZh: r.titleZh,
    titleEn: r.titleEn,
    subtitleZh: r.subtitleZh,
    subtitleEn: r.subtitleEn,
    sortOrder: r.sortOrder,
    published: r.published,
    hasImage: Boolean(r.image),
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
          <CarouselManager items={items} />
        </StaggerItem>
      </Stagger>
    </PageEnter>
  );
}
