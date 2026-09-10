import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { JoinStateLoader } from "@/components/marketing/join-state-loader";
import { LimitsLoader } from "@/components/limits-loader";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <JoinStateLoader>
      {/* 限额配置要给上传/编辑弹窗里的"最大 N MB"和大小预校验用 */}
      <LimitsLoader>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </LimitsLoader>
    </JoinStateLoader>
  );
}
