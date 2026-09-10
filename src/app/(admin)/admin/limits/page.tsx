import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/server/auth";
import { getLimits } from "@/server/settings";
import { LimitsConfigForm } from "@/components/admin/limits-config-form";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { PageEnter, Stagger, StaggerItem } from "@/components/motion/stagger";

/**
 * 后台：用量限额设置。
 *
 * 这些数字以前写死在 @/server/limit、@/server/quota 和 @/server/resource 里，
 * 改一次要发一次版。放到这里之后，开服初期收紧、活动期间放宽都能当场完成。
 *
 * 只对普通用户生效 —— 管理员在判定层直接跳过，也不记账。
 */
export default async function AdminLimitsPage() {
  await requireAdmin();
  const t = await getTranslations("admin.limits");

  const limits = await getLimits();

  return (
    <PageEnter className="flex flex-col gap-6">
      <Stagger inView={false} stagger={0.09} className="flex flex-col gap-6">
        <StaggerItem index={0}>
          <AdminPageHeader title={t("title")} description={t("description")} />
        </StaggerItem>

        <StaggerItem index={1}>
          <LimitsConfigForm initialConfig={limits} />
        </StaggerItem>
      </Stagger>
    </PageEnter>
  );
}
