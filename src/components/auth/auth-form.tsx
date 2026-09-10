"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Loader2, LogIn, ShieldCheck, UserPlus } from "lucide-react";
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
import {
  completeRegistrationAction,
  loginAction,
  registerAction,
} from "@/lib/actions/auth";
import { CODE_LENGTH } from "@/lib/code";

type Step = "form" | "verify";

/**
 * 登录 / 注册表单。
 *
 * 本地账号是主入口（Microsoft OAuth 目前被 Mojang 的 AppID 白名单卡着），
 * Microsoft 按钮作为可选方式留在登录页。
 *
 * 注册是**两步**：填资料 → 收邮箱验证码。第二步故意做得"啰嗦"一点：
 * 步骤条、发到哪个邮箱、剩余有效期、没收到怎么办、多久能重发 ——
 * 验证码环节用户最容易卡住，信息给足比界面干净更重要。
 *
 * 验证码只是把邮箱"绑定"下来（用于以后找回密码），不验证也能正常用站内
 * 功能，所以第二步可以跳过。
 */
export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const t = useTranslations("auth");
  const router = useRouter();

  const [step, setStep] = React.useState<Step>("form");
  const [identifier, setIdentifier] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [code, setCode] = React.useState("");
  const [pending, setPending] = React.useState(false);
  /** 未配置 SMTP 的开发环境下，服务端把验证码回传过来 */
  const [devCode, setDevCode] = React.useState<string | null>(null);
  const [sentAt, setSentAt] = React.useState(() => Date.now());
  const [invalid, setInvalid] = React.useState(false);
  const [verifying, setVerifying] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);

    if (mode === "login") {
      const res = await loginAction({ identifier, password });
      setPending(false);
      if (!res.ok) {
        toast.error(messageFor(t, res.error));
        return;
      }
      toast.success(t("loginSuccess"));
      router.push(res.redirectTo ?? "/dashboard");
      router.refresh();
      return;
    }

    // 注册第一步：只校验 + 发验证码，**账号还没建**
    const res = await registerAction({ username, email, password, confirm });
    setPending(false);

    if (!res.ok) {
      toast.error(messageFor(t, res.error));
      return;
    }

    setDevCode(res.devCode ?? null);
    setSentAt(Date.now());
    setCode("");
    toast.success(t("codeSent"));
    setStep("verify");
  }

  /** 填满 6 位自动提交。用 ref 防重入，同时**不 disable 输入框** ——
      禁用会丢掉焦点，校验失败后用户得再点一次才能改。 */
  const verifyingRef = React.useRef(false);
  const verify = React.useCallback(
    async (value: string) => {
      if (verifyingRef.current) return;
      verifyingRef.current = true;
      setVerifying(true);
      // 验证码通过才会真正建账号并登录
      const res = await completeRegistrationAction({
        username,
        email,
        password,
        code: value,
      });
      setVerifying(false);
      verifyingRef.current = false;

      if (!res.ok) {
        setInvalid(true);
        window.setTimeout(() => setInvalid(false), 600);
        toast.error(messageFor(t, res.error));
        return;
      }
      toast.success(t("registerSuccess"));
      router.push(res.redirectTo ?? "/dashboard/settings");
      router.refresh();
    },
    [username, email, password, router, t]
  );

  /* ------------------------------------------------ 注册第二步：填验证码 */
  if (mode === "register" && step === "verify") {
    return (
      <div className="flex flex-col gap-5">
        <StepIndicator current={2} steps={[t("stepForm"), t("stepVerify")]} />

        <SentToEmail email={email} />

        {/* 说明为什么不能关页面：账号是验证通过才创建的 */}
        <p className="flex items-start gap-2 rounded-xl border border-primary/25 bg-primary/5 px-3.5 py-2.5 text-xs leading-relaxed">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <span>{t("mustVerify")}</span>
        </p>

        {devCode && <DevCodeNotice code={devCode} />}

        <div className="flex flex-col items-center gap-3">
          <CodeInput
            length={CODE_LENGTH}
            value={code}
            onChange={setCode}
            onComplete={verify}
            invalid={invalid}
          />

          <div className="flex h-5 items-center gap-3">
            <ExpiryCountdown sentAt={sentAt} />
            {verifying && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                {t("verifying")}
              </span>
            )}
          </div>

          <Button
            type="button"
            onClick={() => verify(code)}
            disabled={verifying || code.length !== CODE_LENGTH}
            className="w-full"
          >
            {verifying ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
            {verifying ? t("verifying") : t("verifyButton")}
          </Button>
        </div>

        <ResendButton
          email={email}
          purpose="register"
          disabled={verifying}
          onSent={(info) => {
            setDevCode(info.devCode ?? null);
            setSentAt(info.sentAt);
            setCode("");
          }}
          className="w-full"
        />

        <MailHints email={email} />

        {/* 注意：这里**没有"跳过"** —— 注册必须绑定邮箱，
            不验证就进不去，所以只留一个回上一步改邮箱的出口 */}
        <div className="flex items-center justify-center border-t pt-4 text-xs">
          <button
            type="button"
            onClick={() => {
              setStep("form");
              setCode("");
              setDevCode(null);
            }}
            className="group inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3 transition-transform duration-300 group-hover:-translate-x-0.5" />
            {t("changeEmail")}
          </button>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------ 表单主体 */
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {mode === "register" && (
        <StepIndicator
          current={1}
          steps={[t("stepForm"), t("stepVerify")]}
          className="mb-1"
        />
      )}

      {mode === "register" ? (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="username">{t("username")}</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t("usernameHint")}
              autoComplete="username"
              maxLength={20}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("emailHint")}
              autoComplete="email"
              maxLength={120}
              required
            />
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="identifier">{t("identifier")}</Label>
          <Input
            id="identifier"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={t("identifierHint")}
            autoComplete="username"
            maxLength={120}
            required
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{t("password")}</Label>
          {mode === "login" && (
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("forgotPassword")}
            </Link>
          )}
        </div>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("passwordHint")}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          maxLength={72}
          required
        />
      </div>

      {mode === "register" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm">{t("confirmPassword")}</Label>
          <Input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            maxLength={72}
            required
          />
        </div>
      )}

      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : mode === "login" ? (
          <LogIn className="size-4" />
        ) : (
          <UserPlus className="size-4" />
        )}
        {pending
          ? t("submitting")
          : mode === "login"
            ? t("loginButton")
            : t("registerButton")}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        {mode === "login" ? (
          <>
            {t("noAccount")}{" "}
            <Link href="/register" className="text-primary hover:underline">
              {t("goRegister")}
            </Link>
          </>
        ) : (
          <>
            {t("hasAccount")}{" "}
            <Link href="/login" className="text-primary hover:underline">
              {t("goLogin")}
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
