import { getTranslations } from "next-intl/server";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SectionHeading } from "./section-heading";
import { Reveal } from "@/components/motion/reveal";

export async function FAQ() {
  const t = await getTranslations("home.faq");

  const items = ["item1", "item2", "item3", "item4", "item5"] as const;

  return (
    <section className="bg-muted/40 py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHeading eyebrow={t("eyebrow")} title={t("title")} />

        <Reveal className="mt-12">
          <Accordion type="single" collapsible className="w-full rounded-xl border bg-background px-6">
            {items.map((key) => (
              <AccordionItem key={key} value={key}>
                <AccordionTrigger className="text-base">
                  {t(`${key}.q`)}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {t(`${key}.a`)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
