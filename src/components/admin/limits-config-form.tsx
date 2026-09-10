"use client";

import * as React from "react";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { MessageSquare, FileUp, ArrowUpToLine, ArrowDownToLine, Paperclip, Image } from "lucide-react";
import { adminSaveLimits } from "@/lib/actions/admin-limits";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_LIMITS,
  type LimitsConfig,
} from "@/lib/validators/limits";

/**
 * 一个数字输入字段（标签 + 单位后缀 + 可选换算提示）。
 *
 * 定义在组件**外面**：`react-hooks/static-components` 会拒绝在 render 期间
 * 新建组件 —— 那样每次渲染都是一个新的组件类型，React 会把整棵子树卸载重建，
 * 输入框会丢焦点。这里所有需要的东西都走 props，本来也不需要闭包。
 */
function Field({
  id,
  icon: Icon,
  label,
  hint,
  value,
  unit,
  min,
  max,
  onChange,
}: {
  id: keyof LimitsConfig;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  onChange: (raw: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`limit-${id}`} className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <Input
          id={`limit-${id}`}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="w-32 tabular-nums"
        />
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * 后台：普通用户的用量限额配置。
 *
 * 表单是纯受控的，保存前能看出"这套配置会变成什么样" —— 尤其是 MB / GB
 * 的换算，光看 1024 这个数字不容易意识到那是 1GB，所以每个流量字段下面
 * 都跟一行实时换算的提示。
 */
export function LimitsConfigForm({
  initialConfig,
}: {
  initialConfig: LimitsConfig;
}) {
  const t = useTranslations("admin.limits");
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = React.useState<LimitsConfig>(initialConfig);

  function set<K extends keyof LimitsConfig>(key: K, raw: string) {
    // 空串按 0 处理：让用户能删光重填，而不是卡在 NaN
    const n = raw.trim() === "" ? 0 : Number(raw);
    setForm((f) => ({ ...f, [key]: Number.isFinite(n) ? n : 0 }));
  }

  /** MB → 人类可读，用于输入框下面的实时换算提示 */
  function human(mb: number): string {
    if (!Number.isFinite(mb) || mb <= 0) return "—";
    if (mb >= 1024) {
      const gb = mb / 1024;
      return `${Number.isInteger(gb) ? gb : gb.toFixed(2)} GB`;
    }
    return `${mb} MB`;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    // 前端先给出即时的越界提示；服务端会用同一套规则再校验一次
    if (form.maxFileMb > form.uploadQuotaMb) {
      toast.error(t("errors.file_over_quota"));
      return;
    }
    if (form.maxImageMb > form.uploadQuotaMb) {
      toast.error(t("errors.image_over_quota"));
      return;
    }

    startTransition(async () => {
      const res = await adminSaveLimits(form);
      if (!res.ok) {
        const key = `errors.${res.error ?? "unknown"}`;
        toast.error(t.has(key) ? t(key) : t("errors.unknown"));
        return;
      }
      toast.success(t("saved"));
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-5 pt-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium">{t("countTitle")}</h2>
            <p className="text-xs text-muted-foreground">{t("countHint")}</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="commentsPerDay"
              icon={MessageSquare}
              label={t("commentsPerDay")}
              hint={t("commentsPerDayHint")}
              value={form.commentsPerDay}
              unit={t("unitComments")}
              min={1}
              max={10000}
              onChange={(v) => set("commentsPerDay", v)}
            />
            <Field
              id="resourcesPerDay"
              icon={FileUp}
              label={t("resourcesPerDay")}
              hint={t("resourcesPerDayHint")}
              value={form.resourcesPerDay}
              unit={t("unitResources")}
              min={1}
              max={1000}
              onChange={(v) => set("resourcesPerDay", v)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-5 pt-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium">{t("transferTitle")}</h2>
            <p className="text-xs text-muted-foreground">{t("transferHint")}</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="uploadQuotaMb"
              icon={ArrowUpToLine}
              label={t("uploadQuota")}
              hint={t("equals", { value: human(form.uploadQuotaMb) })}
              value={form.uploadQuotaMb}
              unit="MB"
              min={1}
              max={1048576}
              onChange={(v) => set("uploadQuotaMb", v)}
            />
            <Field
              id="downloadQuotaMb"
              icon={ArrowDownToLine}
              label={t("downloadQuota")}
              hint={t("equals", { value: human(form.downloadQuotaMb) })}
              value={form.downloadQuotaMb}
              unit="MB"
              min={1}
              max={1048576}
              onChange={(v) => set("downloadQuotaMb", v)}
            />
            <Field
              id="maxFileMb"
              icon={Paperclip}
              label={t("maxFile")}
              hint={t("equals", { value: human(form.maxFileMb) })}
              value={form.maxFileMb}
              unit="MB"
              min={1}
              max={1024}
              onChange={(v) => set("maxFileMb", v)}
            />
            <Field
              id="maxImageMb"
              icon={Image}
              label={t("maxImage")}
              hint={t("equals", { value: human(form.maxImageMb) })}
              value={form.maxImageMb}
              unit="MB"
              min={1}
              max={100}
              onChange={(v) => set("maxImageMb", v)}
            />
          </div>

          {/* 超过额度时给个明确警告，而不是等保存被拒 */}
          {form.maxFileMb > form.uploadQuotaMb && (
            <p className="text-xs text-warning">{t("errors.file_over_quota")}</p>
          )}
          {form.maxImageMb > form.uploadQuotaMb && (
            <p className="text-xs text-warning">{t("errors.image_over_quota")}</p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("adminExemptNote")}
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? t("saving") : t("save")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => setForm(DEFAULT_LIMITS)}
        >
          {t("resetDefaults")}
        </Button>
        <p className="text-xs text-muted-foreground">{t("applyHint")}</p>
      </div>
    </form>
  );
}
