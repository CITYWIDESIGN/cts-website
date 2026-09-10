import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/server/auth";
import { getJoinConfig, listJoinableQuestionnaires } from "@/server/settings";
import { JoinConfigForm } from "@/components/admin/join-config-form";
import { PageEnter, Stagger, StaggerItem } from "@/components/motion/stagger";

/**
 * 后台：「加入我们」入口配置。
 *
 * 为什么做成配置而不是写死：不同阶段想让人做的事不一样 —— 开服前先加群，
 * 开服后填问卷，某段时间干脆关掉。每次都改代码发版不值当。
 */
export default async function AdminJoinPage() {
  await requireAdmin();
  const t = await getTranslations("admin.join");

  const [config, questionnaires] = await Promise.all([
    getJoinConfig(),
    listJoinableQuestionnaires(),
  ]);

  return (
    <PageEnter className="flex flex-col gap-6">
      <Stagger inView={false} stagger={0.09} className="flex flex-col gap-6">
        <StaggerItem index={0}>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </StaggerItem>

        <StaggerItem index={1}>
          <JoinConfigForm
            initialConfig={config}
            questionnaires={questionnaires.map((q) => ({
              id: q.id,
              title: q.title,
              submissions: q._count.submissions,
            }))}
          />
        </StaggerItem>
      </Stagger>
    </PageEnter>
  );
}
