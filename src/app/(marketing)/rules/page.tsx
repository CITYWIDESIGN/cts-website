import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Stagger, StaggerItem, PageEnter } from "@/components/motion/stagger";
import { SplitHeading } from "@/components/motion/split-heading";
import { getRules } from "@/server/settings";
import { pickLocalized, localizedKey } from "@/lib/localized";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("rules");
  return { title: t("title"), description: t("description") };
}

/**
 * 服务器规则。
 *
 * 条目由管理员在后台 /admin/content 维护（`SiteSetting` 的 rules 键），
 * 不再是写死的五条 —— 规则会随运营调整，不该为改一条发一次版。
 */
export default async function RulesPage() {
  const t = await getTranslations("rules");
  const locale = await getLocale();
  const rules = await getRules();

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

      {rules.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        /* 每条规则逐项展开入场 */
        <Stagger inView stagger={0.08} className="mt-8 flex flex-col">
          <Accordion type="single" collapsible className="w-full">
            {rules.map((rule, i) => (
              <StaggerItem key={localizedKey(rule.title, i)} index={i}>
                <AccordionItem value={String(i)}>
                  <AccordionTrigger className="text-base transition-colors duration-200 hover:text-primary">
                    <span className="flex items-center gap-3">
                      <span className="font-mono text-sm text-muted-foreground transition-colors duration-200">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {pickLocalized(locale, rule.title)}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="whitespace-pre-wrap pl-10 text-muted-foreground">
                    {pickLocalized(locale, rule.content)}
                  </AccordionContent>
                </AccordionItem>
              </StaggerItem>
            ))}
          </Accordion>
        </Stagger>
      )}
    </PageEnter>
  );
}
