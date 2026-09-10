import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Stagger, StaggerItem, PageEnter } from "@/components/motion/stagger";
import { SplitHeading } from "@/components/motion/split-heading";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("rules");
  return { title: t("title"), description: t("description") };
}

const ruleSections = [
  "behavior",
  "gameplay",
  "building",
  "economy",
  "punishment",
] as const;

export default async function RulesPage() {
  const t = await getTranslations("rules");

  return (
    <PageEnter className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      {/*
        页头结构与 /server、/community 保持一致：同样的 PageEnter、同样的
        gap 值与眉标样式。之前这里用了不同的 gap / tracking / 动画参数，
        标题的垂直位置就与其他页面错开了。
      */}
      <Stagger inView={false} stagger={0.11} gap={30} className="flex flex-col">
        <StaggerItem index={0}>
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <span aria-hidden className="size-1.5 rounded-[2px] bg-primary" />
            {t("eyebrow")}
          </span>
        </StaggerItem>
        <StaggerItem index={1}>
          <SplitHeading
            text={t("title")}
            className="tracking-display text-3xl font-semibold sm:text-4xl"
          />
        </StaggerItem>
        <StaggerItem index={2}>
          <p className="text-muted-foreground">{t("description")}</p>
        </StaggerItem>
      </Stagger>

      {/* 每条规则逐项展开入场 */}
      <Stagger inView stagger={0.08} className="mt-8 flex flex-col">
        <Accordion type="single" collapsible className="w-full">
          {ruleSections.map((section, i) => (
            <StaggerItem key={section} index={i}>
              <AccordionItem value={section}>
                <AccordionTrigger className="text-base transition-colors duration-200 hover:text-primary">
                  <span className="flex items-center gap-3">
                    <span className="font-mono text-sm text-muted-foreground transition-colors duration-200">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {t(`${section}.title`)}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pl-10 text-muted-foreground">
                  {t(`${section}.content`)}
                </AccordionContent>
              </AccordionItem>
            </StaggerItem>
          ))}
        </Accordion>
      </Stagger>
    </PageEnter>
  );
}
