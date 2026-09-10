"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Check, Clock, Loader2, Mail, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { messageFor } from "@/components/auth/error-messages";
import { sendEmailCodeAction } from "@/lib/actions/auth/email-code";
import {
  CODE_RESEND_COOLDOWN_SECONDS,
  CODE_TTL_MINUTES,
} from "@/lib/code";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------ 步骤指示 */

/**
 * 两步流程的指示器（① 填写资料 → ② 验证邮箱）。
 * 用线条把两个点连起来，当前步高亮，已完成的打勾。
 */
export function StepIndicator({
  current,
  steps,
  className,
}: {
  /** 1-based */
  current: number;
  steps: string[];
  className?: string;
}) {
  return (
    <ol className={cn("flex items-center justify-center gap-2", className)}>
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <React.Fragment key={label}>
            {i > 0 && (
              <li
                aria-hidden
                className={cn(
                  "h-px w-8 rounded-full transition-colors duration-500",
                  done || active ? "bg-primary/60" : "bg-border"
                )}
              />
            )}
            <li className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-all duration-300",
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : active
                      ? "border-primary bg-primary/10 text-primary shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_12%,transparent)]"
                      : "border-border text-muted-foreground"
                )}
              >
                {done ? <Check className="size-3.5" /> : n}
              </span>
              <span
                className={cn(
                  "text-xs transition-colors duration-300",
                  active ? "font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </li>
          </React.Fragment>
        );
      })}
    </ol>
  );
}

/* -------------------------------------------------------------- 邮箱 */

/** 显示"验证码发到哪个邮箱了"，比干巴巴一句"已发送"有用得多 */
export function SentToEmail({
  email,
  className,
}: {
  email: string;
  className?: string;
}) {
  const t = useTranslations("auth");
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl border bg-muted/40 px-3.5 py-2.5",
        className
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
        <Mail className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{t("codeSentTo")}</p>
        <p className="truncate text-sm font-medium" title={email}>
          {email}
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- 有效期倒计时 */

/** mm:ss */
function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * 验证码剩余有效期。
 * 从"发送成功的时刻"开始算，所以刷新页面前后不会跳。
 */
export function ExpiryCountdown({
  sentAt,
  className,
}: {
  /** 发送成功时的 Date.now() */
  sentAt: number;
  className?: string;
}) {
  const t = useTranslations("auth");
  const total = CODE_TTL_MINUTES * 60;
  const [left, setLeft] = React.useState(() =>
    Math.max(0, total - Math.floor((Date.now() - sentAt) / 1000))
  );

  React.useEffect(() => {
    if (left <= 0) return;
    const id = window.setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => window.clearTimeout(id);
  }, [left]);

  const expired = left <= 0;
  const urgent = left > 0 && left <= 60;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs tabular-nums",
        expired
          ? "text-destructive"
          : urgent
            ? "text-warning"
            : "text-muted-foreground",
        className
      )}
    >
      <Clock className="size-3.5" />
      {expired ? t("codeExpired") : t("codeValidFor", { time: mmss(left) })}
    </span>
  );
}

/* -------------------------------------------------------------- 重发 */

/**
 * 「重新发送」按钮 + 60 秒冷却倒计时。
 *
 * 冷却时间必须和服务端一致（@/lib/code），否则用户点了却收到 TOO_SOON，
 * 体验上就是"这按钮坏了"。
 */
export function ResendButton({
  email,
  purpose,
  disabled = false,
  onSent,
  className,
}: {
  email: string;
  purpose: "register" | "bind" | "reset";
  disabled?: boolean;
  /** 发送成功回调：把新的 devCode / 发送时刻交给父组件 */
  onSent?: (info: { devCode?: string; sentAt: number }) => void;
  className?: string;
}) {
  const t = useTranslations("auth");
  const [left, setLeft] = React.useState(0);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (left <= 0) return;
    const id = window.setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => window.clearTimeout(id);
  }, [left]);

  async function send() {
    if (busy || left > 0) return;
    setBusy(true);
    const res = await sendEmailCodeAction({ email, purpose });
    setBusy(false);

    if (!res.ok) {
      toast.error(messageFor(t, res.error));
      return;
    }
    toast.success(t("codeSent"));
    setLeft(CODE_RESEND_COOLDOWN_SECONDS);
    onSent?.({ devCode: res.devCode, sentAt: Date.now() });
  }

  const blocked = busy || left > 0 || disabled;

  return (
    <Button
      type="button"
      variant="outline"
      onClick={send}
      disabled={blocked}
      className={cn("gap-2", className)}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <RefreshCw
          className={cn(
            "size-4 transition-transform duration-500",
            left <= 0 && "group-hover:rotate-180"
          )}
        />
      )}
      {left > 0 ? t("resendIn", { seconds: left }) : t("resend")}
    </Button>
  );
}

/* ------------------------------------------------------------ 提示清单 */

/** "没收到？"的排查清单 —— 用户八成是掉这里了 */
export function MailHints({ email }: { email: string }) {
  const t = useTranslations("auth");
  const hints = [
    t("hintSpam"),
    t("hintWhitelist", { email }),
    t("hintCooldown"),
  ];
  return (
    <div className="rounded-xl border border-dashed p-3.5">
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        {t("hintsTitle")}
      </p>
      <ul className="flex flex-col gap-1.5">
        {hints.map((h) => (
          <li key={h} className="flex items-start gap-2 text-xs text-muted-foreground">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/50" />
            <span>{h}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------ 开发模式验证码 */

/** 未配置 SMTP 时把验证码直接显示出来，方便本地联调 */
export function DevCodeNotice({ code }: { code: string }) {
  const t = useTranslations("auth");
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-warning/50 bg-warning/10 px-3 py-2">
      <Sparkles className="size-3.5 shrink-0 text-warning" />
      <span className="text-xs text-muted-foreground">{t("devCodeNotice")}</span>
      <span className="font-mono text-base font-semibold tracking-[0.25em]">
        {code}
      </span>
    </div>
  );
}
