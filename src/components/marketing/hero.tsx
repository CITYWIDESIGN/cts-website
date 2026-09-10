import { getTranslations } from "next-intl/server";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { SplitHeading } from "@/components/motion/split-heading";
import { Carousel } from "./carousel";
import { ServerStatus } from "./server-status";
import { HeroActions } from "./join-button";
import { carouselSlides, carouselIntervalMs } from "@/config/carousel";

/**
 * 首页首屏。
 *
 * 顺序（按需求调整）：
 *   服务器名 → 标题 → 副标题 → 图片轮播 → 服务器状态 → 行动按钮
 * 每个区块是独立的 StaggerItem，依次错开入场。
 */
export async function Hero() {
  const t = await getTranslations("home.hero");

  return (
    <section className="relative overflow-hidden">
      {/* 克制的背景：微弱网格 + 柔和光晕 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:64px_64px] opacity-[0.25] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,black,transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent)]"
      />

      {/* 克制的漂浮方块装饰 */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-[8%] top-1/3 -z-10 hidden lg:block"
      >
        <div className="animate-float size-20 rounded-lg border border-primary/20 bg-primary/5 [animation-delay:1s]" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute right-[9%] top-1/4 -z-10 hidden lg:block"
      >
        <div className="animate-float size-14 rounded-lg border border-primary/15 bg-primary/5 [animation-delay:0.4s]" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[15%] right-[15%] -z-10 hidden xl:block"
      >
        <div className="animate-float size-8 rounded-md border border-primary/10 bg-primary/5 [animation-delay:2s]" />
      </div>

      <Stagger
        inView={false}
        delay={0.06}
        stagger={0.12}
        gap={30}
        className="relative flex flex-col pb-12 pt-24 sm:pb-14 sm:pt-32"
      >
        <div className="mx-auto flex max-w-4xl flex-col items-center px-4 text-center sm:px-6">
          <StaggerItem index={0} className="w-full">
            <SplitHeading
              text={t("title")}
              className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl"
            />
          </StaggerItem>

          <StaggerItem index={1}>
            <p className="mt-5 max-w-2xl text-balance text-lg text-muted-foreground">
              {t("subtitle")}
            </p>
          </StaggerItem>
        </div>

        {/* 图片轮播（封面流 + 鼠标倾斜） */}
        <StaggerItem index={2}>
          <Carousel slides={carouselSlides} intervalMs={carouselIntervalMs} />
        </StaggerItem>

        {/* 服务器状态 */}
        <StaggerItem index={3}>
          <ServerStatus />
        </StaggerItem>

        {/* 行动按钮（首屏为居中版式，按钮同样居中于页面容器） */}
        <StaggerItem index={4} className="w-full">
          <div className="mx-auto flex max-w-4xl justify-center px-4 sm:px-6">
            <HeroActions secondaryLabel={t("ctaSecondary")} />
          </div>
        </StaggerItem>

        {/* 首屏底部收尾：细线放在更靠下的位置，明确区隔下一屏 */}
        <StaggerItem index={5}>
          <div className="mx-auto mt-10 w-full max-w-6xl px-4 sm:mt-16 sm:px-6">
            <span
              aria-hidden
              className="block h-px bg-gradient-to-r from-transparent via-border to-transparent"
            />
          </div>
        </StaggerItem>
      </Stagger>
    </section>
  );
}
