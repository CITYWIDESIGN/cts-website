import { Hero } from "@/components/marketing/hero";
import { Stats } from "@/components/marketing/stats";
import { Features } from "@/components/marketing/features";
import { Intro } from "@/components/marketing/intro";
import { HowToJoin } from "@/components/marketing/how-to-join";
import { News } from "@/components/marketing/news";
import { FAQ } from "@/components/marketing/faq";
import { CTA } from "@/components/marketing/cta";

/**
 * 首页。
 * 首屏（Hero）内部已包含：标题 → 副标题 → 图片轮播 → 服务器状态 → 行动按钮。
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <Stats />
      <Features />
      <Intro />
      <HowToJoin />
      <News />
      <FAQ />
      <CTA />
    </>
  );
}
