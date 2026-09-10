"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  BadgeCheck,
  Loader2,
  MailCheck,
  MailWarning,
  PencilLine,
  Save,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { messageFor } from "@/components/auth/error-messages";
import { CodeInput } from "@/components/auth/code-input";
import {
  DevCodeNotice,
  ExpiryCountdown,
  MailHints,
  ResendButton,
  SentToEmail,
} from "@/components/auth/verify-bits";
import { CODE_LENGTH } from "@/lib/code";
import { changeUsernameAction } from "@/lib/actions/auth/account";
import {
  sendEmailCodeAction,
  verifyEmailAction,
} from "@/lib/actions/auth/email-code";

/* ------------------------------------------------------------ 改用户名 */

/**
 * 改用户名。
 *
 * 非管理员**每天只能改一次**（在 @/server/limit 里配），服务端强制；
 * 前端只在出错时把"今天改过了"说明白，不做本地倒计时（容易被绕过也无意义）。
 */
export function UsernameForm({
  current,
  isAdmin,
}: {
  current: string;
  isAdmin: boolean;
}) {
  const t = useTranslations("dashboard.accountForm");
  const ta = useTranslations("auth");
  const router = useRouter();

  const [value, setValue] = React.useState(current);
  const [pending, setPending] = React.useState(false);
  const dirty = value.trim().toLowerCase() !== current;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending || !dirty) return;
    setPending(true);

    const res = await changeUsernameAction({ username: value });
    setPending(false);

    if (!res.ok) {
      toast.error(
        res.error === "USERNAME_COOLDOWN"
          ? t("usernameCooldown", { count: res.limit ?? 1 })
          : messageFor(ta, res.error)
      );
      return;
    }
    toast.success(t("usernameSaved"));
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <Label htmlFor="account-username">{t("username")}</Label>
      <div className="flex gap-2">
        <Input
          id="account-username"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={20}
          autoComplete="username"
        />
        <Button type="submit" disabled={pending || !dirty} className="shrink-0">
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {t("save")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {isAdmin ? t("usernameAdminHint") : t("usernameLimitHint")}
      </p>
    </form>
  );
}

/* -------------------------------------------------------------- 邮箱 */

/**
 * 邮箱绑定 / 换绑。
 *
 * 必须收验证码才算绑定成功 —— 邮箱是找回密码的唯一凭据，
 * 不验证的话填错一个字母就永远找不回来了。
 */
export function EmailCard({
  current,
  verified,
}: {
  current: string;
  verified: boolean;
}) {
  const t = useTranslations("dashboard.accountForm");
  const ta = useTranslations("auth");
  const router = useRouter();

  const [editing, setEditing] = React.useState(!verified);
  const [email, setEmail] = React.useState(current);
  const [code, setCode] = React.useState("");
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [sentAt, setSentAt] = React.useState(() => Date.now());
  const [pending, setPending] = React.useState(false);
  const [invalid, setInvalid] = React.useState(false);
  const [devCode, setDevCode] = React.useState<string | null>(null);

  /** 第一步：把验证码发到填写的邮箱 */
  async function send() {
    if (pending || !email.includes("@")) return;
    setPending(true);
    const res = await sendEmailCodeAction({ email, purpose: "bind" });
    setPending(false);

    if (!res.ok) {
      toast.error(messageFor(ta, res.error));
      return;
    }
    setSentTo(email.trim().toLowerCase());
    setSentAt(Date.now());
    setDevCode(res.devCode ?? null);
    setCode("");
    toast.success(ta("codeSent"));
  }

  /** 第二步：填满 6 位自动校验（用 ref 防重入，不禁用输入框以免丢焦点） */
  const verifyingRef = React.useRef(false);
  const verify = React.useCallback(
    async (value: string) => {
      if (!sentTo || verifyingRef.current) return;
      verifyingRef.current = true;
      setPending(true);
      const res = await verifyEmailAction({ email: sentTo, code: value });
      setPending(false);
      verifyingRef.current = false;

      if (!res.ok) {
        setInvalid(true);
        window.setTimeout(() => setInvalid(false), 600);
        toast.error(messageFor(ta, res.error));
        return;
      }
      toast.success(ta("verified"));
      setEditing(false);
      setCode("");
      setSentTo(null);
      setDevCode(null);
      router.refresh();
    },
    [sentTo, router, ta]
  );

  const changed = email.trim().toLowerCase() !== current.toLowerCase();

  return (
    <div className="flex flex-col gap-4">
      {/* 状态行 */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">{t("email")}</span>
        <span className="font-medium">{current || t("noEmail")}</span>
        {current &&
          (verified ? (
            <Badge variant="success" className="gap-1">
              <BadgeCheck className="size-3" />
              {t("emailVerified")}
            </Badge>
          ) : (
            <Badge variant="warning" className="gap-1">
              <MailWarning className="size-3" />
              {t("emailUnverified")}
            </Badge>
          ))}
        {!editing && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => {
              setEditing(true);
              setEmail("");
            }}
          >
            <PencilLine className="size-3.5" />
            {verified ? t("rebind") : t("bind")}
          </Button>
        )}
      </div>

      {!verified && !editing && (
        <p className="text-xs text-muted-foreground">{t("emailUnverifiedHint")}</p>
      )}

      {editing && (
        <div className="flex flex-col gap-3 rounded-xl border border-dashed p-4">
          {!sentTo ? (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="account-email">
                  {verified ? t("newEmail") : t("email")}
                </Label>
                <Input
                  id="account-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={ta("emailHint")}
                  autoComplete="email"
                  maxLength={120}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={send}
                  disabled={pending || !email.includes("@")}
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <MailCheck className="size-4" />
                  )}
                  {t("sendCode")}
                </Button>
                {verified && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setEditing(false)}
                    disabled={pending}
                  >
                    {t("cancel")}
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              <SentToEmail email={sentTo} />

              {devCode && <DevCodeNotice code={devCode} />}

              <div className="flex flex-col items-center gap-3 py-1">
                <CodeInput
                  length={CODE_LENGTH}
                  value={code}
                  onChange={setCode}
                  onComplete={verify}
                  invalid={invalid}
                />
                <div className="flex h-5 items-center gap-3">
                  <ExpiryCountdown sentAt={sentAt} />
                  {pending && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" />
                      {ta("verifying")}
                    </span>
                  )}
                </div>
              </div>

              <Button
                type="button"
                onClick={() => verify(code)}
                disabled={pending || code.length !== CODE_LENGTH}
                className="w-full"
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <BadgeCheck className="size-4" />
                )}
                {ta("verifyButton")}
              </Button>

              <ResendButton
                email={sentTo}
                purpose="bind"
                disabled={pending}
                onSent={(info) => {
                  setDevCode(info.devCode ?? null);
                  setSentAt(info.sentAt);
                  setCode("");
                }}
                className="w-full"
              />

              <MailHints email={sentTo} />

              <button
                type="button"
                onClick={() => {
                  setSentTo(null);
                  setCode("");
                  setDevCode(null);
                  if (verified) setEditing(false);
                }}
                disabled={pending}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                {changed ? t("cancel") : ta("changeEmail")}
              </button>
            </>
          )}
        </div>
      )}

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
        {t("emailPurpose")}
      </p>
    </div>
  );
}
