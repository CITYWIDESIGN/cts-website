"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, KeyRound, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CodeInput } from "@/components/auth/code-input";
import {
  DevCodeNotice,
  ExpiryCountdown,
  MailHints,
  ResendButton,
  SentToEmail,
  StepIndicator,
} from "@/components/auth/verify-bits";
import { messageFor } from "@/components/auth/error-messages";
import { resetPasswordAction } from "@/lib/actions/auth/password-reset";
import { sendEmailCodeAction } from "@/lib/actions/auth/email-code";
import { CODE_LENGTH } from "@/lib/code";

/**
 * 忘记密码。
 *
 * 两步：填邮箱收验证码 → 填验证码 + 新密码。
 *
 * 这里**不用自动提交**：第二步除了验证码还要填两次新密码，
 * 填满 6 位就提交会打断输入。所以是一个正常的表单。
 *
 * 请求验证码时**无论邮箱是否存在都提示"已发送"** —— 否则这个页面会变成
 * 一个账号枚举接口。
 */
export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgot");
  const ta = useTranslations("auth");
  const router = useRouter();

  const [step, setStep] = React.useState<"email" | "reset" | "done">("email");
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [invalid, setInvalid] = React.useState(false);
  const [devCode, setDevCode] = React.useState<string | null>(null);
  const [sentAt, setSentAt] = React.useState(() => Date.now());

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    const res = await sendEmailCodeAction({ email, purpose: "reset" });
    setPending(false);

    if (!res.ok) {
      toast.error(messageFor(ta, res.error));
      return;
    }
    setDevCode(res.devCode ?? null);
    setSentAt(Date.now());
    setCode("");
    toast.success(ta("codeSent"));
    setStep("reset");
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (password !== confirm) {
      toast.error(ta("formErrors.PASSWORD_MISMATCH"));
      return;
    }
    setPending(true);
    const res = await resetPasswordAction({ email, code, password });
    setPending(false);

    if (!res.ok) {
      setInvalid(true);
      window.setTimeout(() => setInvalid(false), 600);
      toast.error(messageFor(ta, res.error));
      return;
    }
    toast.success(t("resetSuccess"));
    setStep("done");
  }

  /* ------------------------------------------------------ 第一步：邮箱 */
  if (step === "email") {
    return (
      <form onSubmit={sendCode} className="flex flex-col gap-4">
        <StepIndicator current={1} steps={[ta("stepForm"), ta("stepReset")]} />
        <p className="text-sm text-muted-foreground">{t("emailHint")}</p>
        <div className="flex flex-col gap-2">
          <Label htmlFor="forgot-email">{ta("email")}</Label>
          <Input
            id="forgot-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={ta("emailHint")}
            autoComplete="email"
            maxLength={120}
            required
          />
        </div>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MailCheck className="size-4" />
          )}
          {pending ? ta("submitting") : t("sendCode")}
        </Button>
      </form>
    );
  }

  /* ------------------------------------------------------ 完成 */
  if (step === "done") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-primary/12 text-primary">
          <KeyRound className="size-5" />
        </span>
        <p className="text-sm text-muted-foreground">{t("resetSuccess")}</p>
        <Button
          type="button"
          onClick={() => {
            router.push("/login");
            router.refresh();
          }}
        >
          {ta("goLogin")}
        </Button>
      </div>
    );
  }

  /* -------------------------------------------- 第二步：验证码 + 新密码 */
  return (
    <form onSubmit={reset} className="flex flex-col gap-5">
      <StepIndicator current={2} steps={[ta("stepForm"), ta("stepReset")]} />

      <SentToEmail email={email} />

      {devCode && <DevCodeNotice code={devCode} />}

      <div className="flex flex-col items-center gap-3">
        <CodeInput
          length={CODE_LENGTH}
          value={code}
          onChange={setCode}
          disabled={pending}
          invalid={invalid}
        />
        <ExpiryCountdown sentAt={sentAt} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="forgot-password">{t("newPassword")}</Label>
        <Input
          id="forgot-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={ta("passwordHint")}
          autoComplete="new-password"
          maxLength={72}
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="forgot-confirm">{ta("confirmPassword")}</Label>
        <Input
          id="forgot-confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          maxLength={72}
          required
        />
      </div>

      <Button
        type="submit"
        disabled={pending || code.length !== CODE_LENGTH || !password}
        className="w-full"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <KeyRound className="size-4" />
        )}
        {pending ? ta("submitting") : t("resetButton")}
      </Button>

      <ResendButton
        email={email}
        purpose="reset"
        disabled={pending}
        onSent={(info) => {
          setDevCode(info.devCode ?? null);
          setSentAt(info.sentAt);
          setCode("");
        }}
        className="w-full"
      />

      <MailHints email={email} />

      <div className="flex items-center justify-between border-t pt-4 text-xs">
        <button
          type="button"
          onClick={() => setStep("email")}
          className="group inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3 transition-transform duration-300 group-hover:-translate-x-0.5" />
          {ta("changeEmail")}
        </button>
      </div>
    </form>
  );
}

/** 底部返回登录（页面壳里复用） */
export function BackToLogin() {
  const ta = useTranslations("auth");
  return (
    <Link
      href="/login"
      className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-3.5 transition-transform duration-300 group-hover:-translate-x-0.5" />
      {ta("goLogin")}
    </Link>
  );
}
