import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Check } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { isMicrosoftConfigured } from "@/lib/auth/microsoft";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getCurrentUser } from "@/server/auth";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { SplitHeading } from "@/components/motion/split-heading";
import { MicrosoftLoginButton } from "@/components/marketing/microsoft-login-button";
import { AuthForm } from "@/components/auth/auth-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("title") };
}

// 已知的错误码，均有对应的友好文案；未知错误统一归为 generic
const KNOWN_ERRORS = new Set([
  "not_configured",
  "MICROSOFT_OAUTH_FAILED",
  "XBL_AUTH_FAILED",
  "XSTS_AUTH_FAILED",
  "NO_XBOX_ACCOUNT",
  "REGION_NOT_SUPPORTED",
  "MC_APP_NOT_APPROVED",
  "MC_LOGIN_FAILED",
  "NO_MINECRAFT_PROFILE",
  "MC_PROFILE_FAILED",
  "invalid_state",
  "no_code",
  "TIMEOUT",
]);

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirectTo?: string }>;
}) {
  const params = await searchParams;

  /*
    登录后要去哪。只接受站内路径 —— `?redirectTo=https://evil.com` 是经典的
    开放重定向（伪装成"登录过期，请重新输入密码"的钓鱼页）。safeRedirectPath
    在这里回退成空串，表示"没指定"，由 AuthForm 用角色默认值兜底。
  */
  const redirectTo = safeRedirectPath(params.redirectTo, "");

  // 已登录用户不需要再看到登录页（例如从首页 CTA 进来）
  const user = await getCurrentUser();
  if (user && !params.error) {
    redirect(redirectTo || "/dashboard");
  }

  const t = await getTranslations("auth");
  const configured = isMicrosoftConfigured();

  const rawError = params.error;
  const errKey = rawError
    ? KNOWN_ERRORS.has(rawError)
      ? rawError
      : "generic"
    : null;

  const reasons = [
    { key: "why1", title: t("why1") },
    { key: "why2", title: t("why2") },
    { key: "why3", title: t("why3") },
  ] as const;

  return (
    <div className="relative mx-auto flex max-w-md flex-col items-center px-4 py-16 sm:py-24">
      {/* 克制的背景光晕，与首页 Hero 呼应 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(ellipse_70%_100%_at_50%_0%,color-mix(in_oklab,var(--primary)_10%,transparent),transparent)]"
      />

      {/*
        每个元素独立成 StaggerItem，各自错开入场：
        标题（逐字）→ 副标题 → 表单 → Microsoft → 隐私说明 → 重试/返回 → 列表标题 → 逐条理由
      */}
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

        <StaggerItem index={1} className="w-full text-center">
          <p className="mx-auto mt-3 max-w-sm text-balance text-muted-foreground">
            {t("subtitle")}
          </p>
        </StaggerItem>

        <StaggerItem index={2} className="mt-8 w-full">
          <Card className="w-full shadow-sm">
            <CardContent className="flex flex-col gap-4 p-6">
              <Stagger
                inView={false}
                stagger={0.09}
                className="flex flex-col gap-4"
              >
                {errKey && (
                  <StaggerItem index={0}>
                    <Alert variant="destructive">
                      <AlertTitle>{t(`errors.${errKey}.title`)}</AlertTitle>
                      <AlertDescription>
                        {t(`errors.${errKey}.description`)}
                      </AlertDescription>
                    </Alert>
                  </StaggerItem>
                )}

                {/* 本地账号：主入口 */}
                <StaggerItem index={errKey ? 1 : 0}>
                  <AuthForm mode="login" redirectTo={redirectTo} />
                </StaggerItem>

                {/* Microsoft：可选方式 */}
                {configured && (
                  <StaggerItem index={errKey ? 2 : 1}>
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-3">
                        <span className="h-px flex-1 bg-border" />
                        <span className="text-xs text-muted-foreground">
                          {t("orUseMicrosoft")}
                        </span>
                        <span className="h-px flex-1 bg-border" />
                      </div>
                      <MicrosoftLoginButton
                        label={t("microsoftButton")}
                        redirectingLabel={t("redirecting")}
                        redirectTo={redirectTo}
                      />
                    </div>
                  </StaggerItem>
                )}

                <StaggerItem index={errKey ? 3 : 2}>
                  <p className="text-center text-xs text-muted-foreground">
                    {t("privacy")}
                  </p>
                </StaggerItem>
              </Stagger>
            </CardContent>
          </Card>
        </StaggerItem>

        {errKey && errKey !== "not_configured" && (
          <StaggerItem index={3} className="mt-6 flex w-full flex-col items-center gap-4">
            <a
              href="/api/auth/login"
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary/90 active:scale-[0.98]"
            >
              {t("retry")}
            </a>
            <Link
              href="/"
              className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5 transition-transform duration-300 group-hover:-translate-x-0.5" />
              {t("backHome")}
            </Link>
          </StaggerItem>
        )}

        <StaggerItem index={4} className="mt-10 w-full">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t("whyTitle")}
          </h2>
        </StaggerItem>

        <Stagger
          inView={false}
          stagger={0.09}
          delay={0.12}
          className="mt-4 flex w-full flex-col gap-3"
        >
          {reasons.map((reason, i) => (
            <StaggerItem
              key={reason.key}
              index={i}
              className="group flex items-start gap-2.5 text-sm"
            >
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary transition-transform duration-300 group-hover:scale-110">
                <Check className="size-3" />
              </span>
              <span>{reason.title}</span>
            </StaggerItem>
          ))}
        </Stagger>
      </Stagger>
    </div>
  );
}
