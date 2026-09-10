import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CheckCircle2, Link2, ShieldAlert, Sparkles, UserRound } from "lucide-react";
import { requireUser } from "@/server/auth";
import { hasPasswordSet } from "@/server/account";
import { isMicrosoftConfigured } from "@/lib/auth/microsoft";
import { hasAvatarFrame } from "@/lib/frame";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Stagger, StaggerItem, PageEnter } from "@/components/motion/stagger";
import { MinecraftIdentityForm } from "@/components/dashboard/minecraft-identity-form";
import {
  EmailCard,
  UsernameForm,
} from "@/components/dashboard/account-forms";
import { DeleteAccountDialog } from "@/components/dashboard/delete-account-dialog";
import {
  FrameSettings,
  UnbindMicrosoftButton,
} from "@/components/dashboard/frame-settings";
import { formatDate, formatUuid } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return { title: t("account"), robots: { index: false, follow: false } };
}

/**
 * 个人中心。
 *
 * 三块：
 *   1. 本地账号信息（用户名 / 邮箱 / 注册时间）
 *   2. Minecraft 身份 —— **用户可以自己填 ID + UUID**，不要求绑定 Microsoft
 *   3. 头像框 —— 绑定 Microsoft 的奖励，可以随时选择戴不戴
 */
export default async function SettingsPage() {
  const user = await requireUser();
  const t = await getTranslations("dashboard");
  const ti = await getTranslations("dashboard.identity");

  const boundMicrosoft = Boolean(user.microsoftAccountId);
  const framed = hasAvatarFrame(user);
  const microsoftConfigured = isMicrosoftConfigured();
  const emailVerified = Boolean(user.emailVerifiedAt);
  const hasPassword = await hasPasswordSet(user.id);
  // 注销确认时照着输入的名字：优先本地账号名
  const accountName = user.username ?? user.minecraftUsername ?? "";

  return (
    <PageEnter className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("account")}</h1>

      <Stagger inView={false} stagger={0.09} delay={0.06} className="flex flex-col gap-6">
        {/* 1. 账号 */}
        <StaggerItem index={0}>
          <Card className="transition-all duration-300 hover:border-primary/25 hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserRound className="size-4" />
                {t("accountInfo")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {/* 用户名：非管理员每天只能改一次 */}
              <UsernameForm
                current={user.username ?? ""}
                isAdmin={user.role === "ADMIN"}
              />

              <Separator />

              {/* 邮箱：必须验证码才算绑定 */}
              <EmailCard
                current={user.email ?? ""}
                verified={emailVerified}
              />

              <Separator />

              <div>
                <p className="text-xs text-muted-foreground">{t("registered")}</p>
                <p className="font-medium">{formatDate(user.createdAt)}</p>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>

        {/* 2. Minecraft 身份 */}
        <StaggerItem index={1}>
          <Card className="transition-all duration-300 hover:border-primary/25 hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Link2 className="size-4" />
                {t("minecraftIdentity")}
              </CardTitle>
              <CardDescription>{ti("description")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">{ti("current")}</span>
                {user.minecraftUuid ? (
                  <>
                    <Badge variant="secondary">
                      {user.minecraftUsername ?? "—"}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatUuid(user.minecraftUuid)}
                    </span>
                  </>
                ) : (
                  <Badge variant="outline">{ti("notSet")}</Badge>
                )}
              </div>

              <Separator />

              {/* 手动填写：不需要 Microsoft，也不审核 */}
              <MinecraftIdentityForm
                initialName={user.minecraftUsername ?? ""}
                initialUuid={user.minecraftUuid ?? ""}
              />
            </CardContent>
          </Card>
        </StaggerItem>

        {/* 3. Microsoft 绑定 + 头像框 */}
        <StaggerItem index={2}>
          <Card className="transition-all duration-300 hover:border-primary/25 hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4" />
                {t("frame.title")}
              </CardTitle>
              <CardDescription>{t("frame.cardDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {boundMicrosoft ? (
                <>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-primary" />
                    <span className="font-medium">{t("frame.bound")}</span>
                    <Badge variant="default" className="gap-1">
                      <Sparkles className="size-3" />
                      {t("frame.granted")}
                    </Badge>
                    <span className="ml-auto">
                      <UnbindMicrosoftButton />
                    </span>
                  </div>

                  <Separator />

                  <FrameSettings
                    userId={user.id}
                    name={user.minecraftUsername ?? user.username}
                    uuid={user.minecraftUuid}
                    wearing={framed}
                  />
                </>
              ) : (
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-muted-foreground">
                    {t("frame.notBoundHint")}
                  </p>
                  {microsoftConfigured ? (
                    <Button asChild variant="outline" className="self-start">
                      <Link
                        href="/api/auth/login?redirectTo=/dashboard/settings"
                        prefetch={false}
                      >
                        <Sparkles className="size-4" />
                        {t("frame.bindNow")}
                      </Link>
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {t("frame.notConfigured")}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </StaggerItem>

        {/* 4. 危险操作 */}
        <StaggerItem index={3}>
          <Card className="border-destructive/30 transition-all duration-300 hover:border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-destructive">
                <ShieldAlert className="size-4" />
                {t("dangerZone.title")}
              </CardTitle>
              <CardDescription>{t("dangerZone.description")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {t("dangerZone.hint")}
              </p>
              <DeleteAccountDialog
                accountName={accountName}
                hasPassword={hasPassword}
              />
            </CardContent>
          </Card>
        </StaggerItem>
      </Stagger>
    </PageEnter>
  );
}
