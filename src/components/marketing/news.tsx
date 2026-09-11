import { getLocale, getTranslations } from "next-intl/server";
import { Megaphone } from "lucide-react";
import { SectionHeading } from "./section-heading";
import { Reveal } from "@/components/motion/reveal";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  listPublishedAnnouncements,
  toAnnouncementView,
} from "@/server/announcement";
import { formatDate } from "@/lib/format";

/**
 * 首页公告。
 *
 * 内容来自 `Announcement` 表，管理员在后台 /admin/announcements 维护 ——
 * 这里只是渲染最近三条已发布的。没有公告时整块不渲染，而不是留一个空壳。
 */
export async function News() {
  const t = await getTranslations("home.news");
  const locale = await getLocale();

  const rows = await listPublishedAnnouncements();
  if (rows.length === 0) return null;

  const items = rows.map((row) => toAnnouncementView(locale, row));

  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow={t("eyebrow")} title={t("title")} />

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {items.map((item, i) => (
            <Reveal key={item.id} delay={i * 0.08} className="h-full">
              <Card className="h-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex h-full flex-col gap-4 px-6 py-6">
                  <div className="flex items-center justify-between gap-2">
                    {item.tag ? (
                      <Badge variant="secondary">{item.tag}</Badge>
                    ) : (
                      <Megaphone className="size-3.5 text-muted-foreground" />
                    )}
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(item.publishedAt)}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted-foreground">
                      {item.body}
                    </p>
                  </div>
                </div>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
