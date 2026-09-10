import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/server/auth";
import { isMailConfigured } from "@/server/mailer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { SplitHeading } from "@/components/motion/split-heading";
import {
  BackToLogin,
  ForgotPasswordForm,
} from "@/components/auth/forgot-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.forgot");
  return { title: t("title") };
}

/**
 * 忘记密码。
 *
 * 走邮箱验证码：填邮箱 → 收码 → 设置新密码。
 * 没配 SMTP 时页面会明确提示"当前环境发不出邮件"，
 * 而不是让用户干等一封永远不会到的信。
 */
export default async function ForgotPasswordPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard/settings");

  const t = await getTranslations("auth.forgot");
  const mailReady = isMailConfigured();

  return (
    <div className="relative mx-auto flex max-w-md flex-col items-center px-4 py-16 sm:py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(ellipse_70%_100%_at_50%_0%,color-mix(in_oklab,var(--primary)_10%,transparent),transparent)]"
      />

      <Stagger
        inView={false}
        stagger={0.1}
        delay={0.05}
        className="flex w-full flex-col items-center"
      >
        <StaggerItem index={0} className="w-full text-center">
          <SplitHeading
            text={t("title")}
            className="text-3xl font-semibold tracking-tight"
            mode="words"
          />
        </StaggerItem>

        <StaggerItem index={1} className="mt-8 w-full">
          <Card className="w-full shadow-sm">
            <CardContent className="flex flex-col gap-4 p-6">
              {!mailReady && (
                <Alert>
                  <AlertTitle>{t("mailNotConfiguredTitle")}</AlertTitle>
                  <AlertDescription>
                    {t("mailNotConfiguredDescription")}
                  </AlertDescription>
                </Alert>
              )}
              <ForgotPasswordForm />
            </CardContent>
          </Card>
        </StaggerItem>

        <StaggerItem index={2} className="mt-8">
          <BackToLogin />
        </StaggerItem>
      </Stagger>
    </div>
  );
}
