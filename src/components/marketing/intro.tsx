import { getTranslations } from "next-intl/server";
import { Globe, Gamepad2, Users, CalendarDays } from "lucide-react";
import { SectionHeading } from "./section-heading";
import { Reveal } from "@/components/motion/reveal";

export async function Intro() {
  const t = await getTranslations("home.intro");

  const blocks = [
    { key: "world", icon: Globe },
    { key: "gameplay", icon: Gamepad2 },
    { key: "community", icon: Users },
    { key: "events", icon: CalendarDays },
  ] as const;

  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow={t("eyebrow")} title={t("title")} />

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {blocks.map((block, i) => {
            const Icon = block.icon;
            return (
              <Reveal key={block.key} delay={(i % 2) * 0.08} className="h-full">
                <div className="flex h-full gap-4 rounded-xl border p-6 transition-colors hover:bg-accent/40">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background text-foreground">
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <h3 className="font-semibold">{t(`${block.key}.title`)}</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {t(`${block.key}.description`)}
                    </p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
