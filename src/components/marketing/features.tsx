import { getTranslations } from "next-intl/server";
import { Trees, Users, Scale, ShieldCheck } from "lucide-react";
import { SectionHeading } from "./section-heading";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";

export async function Features() {
  const t = await getTranslations("home.features");

  const features = [
    {
      key: "survival",
      icon: Trees,
    },
    {
      key: "community",
      icon: Users,
    },
    {
      key: "fair",
      icon: Scale,
    },
    {
      key: "stable",
      icon: ShieldCheck,
    },
  ] as const;

  return (
    <section className="bg-muted/40 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow={t("eyebrow")} title={t("title")} />

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <Reveal key={feature.key} delay={i * 0.06} className="h-full">
                <Card className="group h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                  <div className="flex flex-col gap-4 px-6 py-6">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110">
                      <Icon className="size-5" />
                    </span>
                    <div>
                      <h3 className="font-semibold">
                        {t(`${feature.key}.title`)}
                      </h3>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        {t(`${feature.key}.description`)}
                      </p>
                    </div>
                  </div>
                </Card>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
