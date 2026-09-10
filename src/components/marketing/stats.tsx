import { getTranslations } from "next-intl/server";
import { SectionHeading } from "./section-heading";
import { CountUp } from "@/components/motion/count-up";
import { Reveal } from "@/components/motion/reveal";
import { siteConfig } from "@/config/site";

export async function Stats() {
  const t = await getTranslations("home.stats");

  const stats = [
    { label: t("players"), value: siteConfig.stats.players },
    { label: t("builds"), value: siteConfig.stats.builds },
    { label: t("members"), value: siteConfig.stats.members },
    { label: t("days"), value: siteConfig.stats.days },
  ];

  return (
    // mt 较大：确保服务器数据落在第二屏，首屏看不到
    <section className="mt-14 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow={t("eyebrow")} title={t("title")} />
        <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <Reveal key={stat.label} delay={i * 0.06}>
              <div className="group relative flex flex-col items-center overflow-hidden rounded-xl border bg-card px-4 py-8 text-center shadow-sm transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-md">
                {/* 底部一道极淡的品牌色，悬停时变亮：不加元素也能有细节 */}
                <span
                  aria-hidden
                  className="absolute inset-x-6 bottom-0 h-px bg-primary/20 transition-colors duration-300 group-hover:bg-primary/50"
                />
                <CountUp
                  value={stat.value}
                  className="tracking-display text-3xl font-semibold tabular-nums sm:text-4xl"
                />
                <span className="mt-2 text-sm text-muted-foreground">
                  {stat.label}
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
