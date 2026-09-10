import { getTranslations } from "next-intl/server";
import { CalendarDays, ArrowRight } from "lucide-react";
import { SectionHeading } from "./section-heading";
import { Reveal } from "@/components/motion/reveal";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export async function News() {
  const t = await getTranslations("home.news");

  const items = ["item1", "item2", "item3"] as const;

  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow={t("eyebrow")} title={t("title")} />

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {items.map((key, i) => (
            <Reveal key={key} delay={i * 0.08} className="h-full">
              <Card className="group h-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex h-full flex-col gap-4 px-6 py-6">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">{t(`${key}.tag`)}</Badge>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarDays className="size-3.5" />
                      {t(`${key}.date`)}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold">{t(`${key}.title`)}</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {t(`${key}.description`)}
                    </p>
                  </div>
                  <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    {t("readMore")}
                    <ArrowRight className="size-3.5" />
                  </span>
                </div>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
