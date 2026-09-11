import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { SplitHeading } from "@/components/motion/split-heading";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Carousel, type CarouselItem } from "./carousel";
import { ServerStatus } from "./server-status";
import { HeroActions } from "./join-button";
import { carouselSlides, carouselIntervalMs } from "@/config/carousel";
import { listPublishedSlides, toSlideView } from "@/server/carousel";

/** 服务器状态卡片的占位。高度与真实卡片一致，数据到达时不会跳 */
function ServerStatusFallback() {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <Card className="mx-auto max-w-3xl">
        <CardContent className="grid gap-5 p-5 sm:grid-cols-3 sm:p-6">
          <div className="flex flex-col gap-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-4 w-16" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-4 w-24" />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

/**
 * 首页首屏。
 *
 * 顺序（按需求调整）：
 *   服务器名 → 标题 → 副标题 → 图片轮播 → 服务器状态 → 行动按钮
 * 每个区块是独立的 StaggerItem，依次错开入场。
 */
export async function Hero() {
  const t = await getTranslations("home.hero");
  const tc = await getTranslations("home.carousel");
  const locale = await getLocale();

  /*
    轮播图优先用管理员在后台传的（/admin/carousel）。一条都没有时回退到
    src/config/carousel.ts 里那组内置占位图 —— 这样全新部署也不会出现
    一块空白，管理员上传第一张之后自动切成真实内容。
  */
  const rows = await listPublishedSlides();
  const items: CarouselItem[] =
    rows.length > 0
      ? rows.map((row) => {
          const v = toSlideView(locale, row);
          return { key: v.id, src: v.src, title: v.title, subtitle: v.subtitle };
        })
      : carouselSlides.map((slide) => ({
          key: slide.key,
          src: slide.src,
          title: tc(`items.${slide.key}.title`),
          subtitle: tc(`items.${slide.key}.description`),
          overlay: slide.overlay,
        }));

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
        <div className="mx-auto flex max-w-5xl flex-col items-center px-4 text-center sm:px-6">
          <StaggerItem index={0} className="w-full">
            {/*
              主标题**保持单行**：字号按断点阶梯放大，而不是一上来就给
              text-6xl —— 之前 6xl 从 sm 就开始用，标题在 640–1024px 之间
              必然折成两行。max-w-5xl 是配合英文版（比中文长）给的余量。
              文案本身也控制在 ~13em 以内，超出这个宽度任何字号都排不下。
              基准用 1.75rem 而不是 text-3xl(1.875rem)：英文版在 375px 宽
              的手机上正好差几个像素，会掉到第二行。
            */}
            <SplitHeading
              text={t("title")}
              className="text-balance text-[1.75rem] font-semibold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl"
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
          <Carousel items={items} intervalMs={carouselIntervalMs} />
        </StaggerItem>

        {/* 服务器状态。
            包一层 Suspense：探测要连一次 TCP，正常情况下是缓存命中（0ms），
            但服务器那边如果是"丢包"而不是"拒绝连接"，冷缓存时就得等满超时。
            那样也不该把整个首屏卡住 —— 先流式送出其余部分。 */}
        <StaggerItem index={3}>
          <Suspense fallback={<ServerStatusFallback />}>
            <ServerStatus />
          </Suspense>
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
