import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/server/auth";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { SplitHeading } from "@/components/motion/split-heading";
import { AuthForm } from "@/components/auth/auth-form";

/**
 * 注册页。
 *
 * 只需要**用户名 + 邮箱 + 密码**，不要求绑定 Minecraft —— 游戏 ID / UUID
 * 之后可以在个人中心自己填。Microsoft 绑定是完全可选的加分项
 * （绑了才有头像框）。
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("registerTitle") };
}

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const t = await getTranslations("auth");

  const notes = [t("registerNote1"), t("registerNote2"), t("registerNote3")];

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
            text={t("registerTitle")}
            className="text-3xl font-semibold tracking-tight"
            mode="words"
          />
        </StaggerItem>

        <StaggerItem index={1} className="w-full text-center">
          <p className="mx-auto mt-3 max-w-sm text-balance text-muted-foreground">
            {t("registerSubtitle")}
          </p>
        </StaggerItem>

        <StaggerItem index={2} className="mt-8 w-full">
          <Card className="w-full shadow-sm">
            <CardContent className="p-6">
              <AuthForm mode="register" />
            </CardContent>
          </Card>
        </StaggerItem>

        <StaggerItem index={3} className="mt-8 w-full">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t("registerNotesTitle")}
          </h2>
        </StaggerItem>

        <Stagger
          inView={false}
          stagger={0.09}
          delay={0.12}
          className="mt-4 flex w-full flex-col gap-3"
        >
          {notes.map((note, i) => (
            <StaggerItem
              key={note}
              index={i}
              className="group flex items-start gap-2.5 text-sm"
            >
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary transition-transform duration-300 group-hover:scale-110">
                <Check className="size-3" />
              </span>
              <span>{note}</span>
            </StaggerItem>
          ))}
        </Stagger>

        <StaggerItem index={4} className="mt-8">
          <Link
            href="/"
            className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5 transition-transform duration-300 group-hover:-translate-x-0.5" />
            {t("backHome")}
          </Link>
        </StaggerItem>
      </Stagger>
    </div>
  );
}
