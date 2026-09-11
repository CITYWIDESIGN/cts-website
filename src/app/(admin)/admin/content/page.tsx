import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/server/auth";
import { getRules, getServerInfo, getStats } from "@/server/settings";
import {
  ContentCard,
  RulesForm,
  ServerInfoForm,
  StatsForm,
} from "@/components/admin/content-forms";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { PageEnter, Stagger, StaggerItem } from "@/components/motion/stagger";

/**
 * 后台：站点内容。
 *
 * 这三块（数据数字 / 服务器介绍与配置 / 规则）以前写死在代码或消息文件里，
 * 改一次要发一次版。现在都存进 `SiteSetting`，管理员随时可改。
 *
 * 中英文分开填，英文留空时前台回退中文 —— 允许先用中文把内容写起来。
 */
export default async function AdminContentPage() {
  await requireAdmin();
  const t = await getTranslations("admin.content");

  const [stats, serverInfo, rules] = await Promise.all([
    getStats(),
    getServerInfo(),
    getRules(),
  ]);

  return (
    <PageEnter className="flex flex-col gap-6">
      <Stagger inView={false} stagger={0.08} className="flex flex-col gap-6">
        <StaggerItem index={0}>
          <AdminPageHeader title={t("title")} description={t("description")} />
        </StaggerItem>

        <StaggerItem index={1}>
          <ContentCard title={t("statsTitle")} description={t("statsHint")}>
            <StatsForm initial={stats} />
          </ContentCard>
        </StaggerItem>

        <StaggerItem index={2}>
          <ContentCard title={t("serverTitle")} description={t("serverHint")}>
            <ServerInfoForm initial={serverInfo} />
          </ContentCard>
        </StaggerItem>

        <StaggerItem index={3}>
          <ContentCard title={t("rulesTitle")} description={t("rulesSectionHint")}>
            <RulesForm initial={rules} />
          </ContentCard>
        </StaggerItem>
      </Stagger>
    </PageEnter>
  );
}
