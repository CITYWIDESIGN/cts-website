import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/motion/reveal";
import { JoinButton } from "./join-button";

export async function CTA() {
  const t = await getTranslations("home.cta");

  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-accent to-accent/40 px-6 py-16 text-center sm:px-16">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_80%_at_50%_100%,color-mix(in_oklab,var(--primary)_14%,transparent),transparent)]"
            />
            {/* 顶边一道渐隐细线，与页脚呼应 */}
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
            />
            <h2 className="tracking-display text-balance text-3xl font-semibold sm:text-4xl">
              {t("title")}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-balance text-muted-foreground">
              {t("subtitle")}
            </p>
            <div className="mt-8 flex justify-center">
              <JoinButton />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
