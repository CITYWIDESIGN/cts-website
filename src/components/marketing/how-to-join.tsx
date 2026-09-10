import { getTranslations } from "next-intl/server";
import { ShieldCheck, ClipboardList, Rocket } from "lucide-react";
import { SectionHeading } from "./section-heading";
import { Reveal } from "@/components/motion/reveal";
import { Stagger, MotionCard } from "@/components/motion/stagger";
import { JoinButton } from "./join-button";

export async function HowToJoin() {
  const t = await getTranslations("home.howtojoin");

  const steps = [
    { icon: ShieldCheck, key: "step1" },
    { icon: ClipboardList, key: "step2" },
    { icon: Rocket, key: "step3" },
  ] as const;

  return (
    <section className="bg-muted/40 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
        />

        <Stagger className="mt-12 grid gap-6 md:grid-cols-3" stagger={0.09}>
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <MotionCard key={step.key} index={i} className="h-full">
                <div className="relative flex h-full flex-col gap-4 rounded-xl border bg-background p-6">
                  <div className="flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <Icon className="size-5" />
                    </span>
                    <span className="font-mono text-3xl font-semibold text-muted-foreground/30">
                      0{i + 1}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold">{t(`${step.key}.title`)}</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {t(`${step.key}.description`)}
                    </p>
                  </div>
                </div>
              </MotionCard>
            );
          })}
        </Stagger>

        <Reveal className="mt-10 text-center">
          <JoinButton />
        </Reveal>
      </div>
    </section>
  );
}
