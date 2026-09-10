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
  confirmEmailChangeAction,
  startEmailChangeAction,
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
 * **换绑必须同时验证旧邮箱和新邮箱。**
 *
 * 为什么旧的也要验：邮箱是找回密码的唯一凭据。会话被别人拿到时
 * （XSS、共用电脑没退出），只验新邮箱就够把找回渠道改到攻击者手里，
 * 原主人再也拿不回账号。要求同时证明「我控制当前邮箱」就堵死了这条路。
 *
 * 账号本来没有邮箱（纯 Microsoft 登录）时没有旧的可验，只验新的。
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
  const [stage, setStage] = React.useState<"input" | "verify">("input");
  const [newEmail, setNewEmail] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [sentAt, setSentAt] = React.useState(() => Date.now());

  const [oldCode, setOldCode] = React.useState("");
  const [newCode, setNewCode] = React.useState("");
  const [needsOld, setNeedsOld] = React.useState(Boolean(current));
  const [devNew, setDevNew] = React.useState<string | null>(null);
  const [devOld, setDevOld] = React.useState<string | null>(null);
  const [invalidOld, setInvalidOld] = React.useState(false);
  const [invalidNew, setInvalidNew] = React.useState(false);

  /** 第一步：给新旧邮箱各发一个验证码 */
  async function send() {
    if (pending || !newEmail.includes("@")) return;
    setPending(true);
    const res = await startEmailChangeAction({ newEmail });
    setPending(false);

    if (!res.ok) {
      toast.error(messageFor(ta, res.error));
      return;
    }
    setNeedsOld(Boolean(res.needsOldCode));
    setDevNew(res.devCode ?? null);
    setDevOld(res.oldDevCode ?? null);
    setSentAt(Date.now());
    setOldCode("");
    setNewCode("");
    toast.success(ta("codeSent"));
    setStage("verify");
  }

  const verifyingRef = React.useRef(false);

  /** 第二步：两个码都通过才换 */
  const confirm = React.useCallback(
    async (nextNewCode: string, nextOldCode: string) => {
      if (verifyingRef.current) return;
      verifyingRef.current = true;
      setPending(true);

      const res = await confirmEmailChangeAction({
        newEmail,
        oldCode: nextOldCode,
        newCode: nextNewCode,
      });

      setPending(false);
      verifyingRef.current = false;

      if (!res.ok) {
        // 把抖动打在对应那一步的输入框上，用户一眼知道该改哪个
        const whichOld = res.step === "old";
        if (whichOld) setInvalidOld(true);
        else setInvalidNew(true);
        window.setTimeout(() => {
          setInvalidOld(false);
          setInvalidNew(false);
        }, 600);
        toast.error(messageFor(ta, res.error));
        return;
      }

      toast.success(t("emailChanged"));
      setEditing(false);
      setStage("input");
      setNewEmail("");
      setOldCode("");
      setNewCode("");
      setDevNew(null);
      setDevOld(null);
      router.refresh();
    },
    [newEmail, router, t, ta]
  );

  /* 新邮箱填满 → 不需要旧码时直接提交；需要旧码时等两个都满 */
  function onNewComplete(value: string) {
    if (!needsOld) void confirm(value, "");
  }

  const ready =
    newCode.length === CODE_LENGTH &&
    (!needsOld || oldCode.length === CODE_LENGTH);

  // 两个都填满后自动提交一次
  React.useEffect(() => {
    if (stage !== "verify" || !needsOld || !ready) return;
    if (verifyingRef.current) return;
    void confirm(newCode, oldCode);
  }, [stage, needsOld, ready, newCode, oldCode, confirm]);

  const changed = newEmail.trim().toLowerCase() !== current.toLowerCase();

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
              setStage("input");
              setNewEmail("");
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
        <div className="flex flex-col gap-4 rounded-xl border border-dashed p-4">
          {stage === "input" ? (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="account-email">
                  {verified ? t("newEmail") : t("email")}
                </Label>
                <Input
                  id="account-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder={ta("emailHint")}
                  autoComplete="email"
                  maxLength={120}
                />
              </div>

              {/* 换绑时说明要验两个邮箱，别让用户收到两封邮件后一脸问号 */}
              {verified && (
                <p className="flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-xs leading-relaxed">
                  <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <span>{t("rebindNeedsBoth")}</span>
                </p>
              )}

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={send}
                  disabled={pending || !newEmail.includes("@") || !changed}
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
              <p className="text-xs text-muted-foreground">
                {needsOld ? t("verifyBothHint") : ta("verifySubtitle", { email: newEmail })}
              </p>

              {/* 旧邮箱 */}
              {needsOld && (
                <section className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
                  <SentToEmail email={current} />
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("verifyOld")}
                  </p>
                  {devOld && <DevCodeNotice code={devOld} />}
                  <CodeInput
                    length={CODE_LENGTH}
                    value={oldCode}
                    onChange={setOldCode}
                    invalid={invalidOld}
                  />
                </section>
              )}

              {/* 新邮箱 */}
              <section className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
                <SentToEmail email={newEmail} />
                <p className="text-xs font-medium text-muted-foreground">
                  {needsOld ? t("verifyNew") : t("bind")}
                </p>
                {devNew && <DevCodeNotice code={devNew} />}
                <CodeInput
                  length={CODE_LENGTH}
                  value={newCode}
                  onChange={setNewCode}
                  onComplete={onNewComplete}
                  invalid={invalidNew}
                />
              </section>

              <div className="flex h-5 items-center gap-3">
                <ExpiryCountdown sentAt={sentAt} />
                {pending && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    {ta("verifying")}
                  </span>
                )}
              </div>

              <Button
                type="button"
                onClick={() => confirm(newCode, oldCode)}
                disabled={pending || !ready}
                className="w-full"
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <BadgeCheck className="size-4" />
                )}
                {t("confirmChange")}
              </Button>

              <ResendButton
                email={newEmail}
                purpose="bind"
                disabled={pending}
                onSent={(info) => {
                  setDevNew(info.devCode ?? null);
                  setSentAt(info.sentAt);
                  setOldCode("");
                  setNewCode("");
                }}
                className="w-full"
              />

              <MailHints email={newEmail} />

              <button
                type="button"
                onClick={() => {
                  setStage("input");
                  setOldCode("");
                  setNewCode("");
                  setDevNew(null);
                  setDevOld(null);
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
