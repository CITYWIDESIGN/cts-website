"use client";

import * as React from "react";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Save } from "lucide-react";
import {
  adminSaveRules,
  adminSaveServerInfo,
  adminSaveStats,
} from "@/lib/actions/admin-content";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocalizedField, RepeatableList, type LocalizedText } from "./content-fields";
import type {
  RulesConfig,
  ServerInfo,
  StatsConfig,
} from "@/lib/validators/content";

/** 每次都要造一个新的空对象：共用同一个引用会让几条规则串改 */
const emptyLocalized = (): LocalizedText => ({ zh: "", en: "" });

export function StatsForm({ initial }: { initial: StatsConfig }) {
  const t = useTranslations("admin.content");
  const [form, setForm] = React.useState(initial);
  const [pending, start] = useTransition();

  const fields: Array<{ key: keyof StatsConfig; label: string }> = [
    { key: "players", label: t("stats.players") },
    { key: "builds", label: t("stats.builds") },
    { key: "members", label: t("stats.members") },
    { key: "days", label: t("stats.days") },
  ];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await adminSaveStats(form);
      if (!res.ok) {
        toast.error(t(`errors.${res.error ?? "unknown"}`));
        return;
      }
      toast.success(t("saved"));
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {fields.map((f) => (
          <div key={f.key} className="flex flex-col gap-2">
            <Label htmlFor={`stat-${f.key}`}>{f.label}</Label>
            <Input
              id={`stat-${f.key}`}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={String(form[f.key])}
              onChange={(e) => {
                const n = e.target.value.trim() === "" ? 0 : Number(e.target.value);
                setForm((v) => ({ ...v, [f.key]: Number.isFinite(n) ? n : 0 }));
              }}
              className="tabular-nums"
            />
          </div>
        ))}
      </div>
      <SaveRow pending={pending} label={t("save")} saving={t("saving")} />
    </form>
  );
}

export function ServerInfoForm({ initial }: { initial: ServerInfo }) {
  const t = useTranslations("admin.content");
  const [form, setForm] = React.useState(initial);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.specs.some((s) => !s.label.zh.trim() || !s.value.trim())) {
      return toast.error(t("errors.specIncomplete"));
    }
    start(async () => {
      const res = await adminSaveServerInfo(form);
      if (!res.ok) {
        toast.error(t(`errors.${res.error ?? "unknown"}`));
        return;
      }
      toast.success(t("saved"));
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <LocalizedField
        idPrefix="server-intro"
        label={t("serverIntro")}
        value={form.intro}
        onChange={(intro) => setForm((v) => ({ ...v, intro }))}
        multiline
        rows={4}
      />

      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium">{t("specsTitle")}</h3>
        <p className="text-xs text-muted-foreground">{t("specsHint")}</p>
      </div>

      <RepeatableList
        items={form.specs}
        onChange={(specs) => setForm((v) => ({ ...v, specs }))}
        makeItem={() => ({ label: emptyLocalized(), value: "" })}
        addLabel={t("addSpec")}
        emptyLabel={t("specsEmpty")}
        renderItem={(spec, i, update) => (
          <div className="flex flex-col gap-3">
            <LocalizedField
              idPrefix={`spec-label-${i}`}
              label={t("specLabel")}
              value={spec.label}
              onChange={(label) => update({ ...spec, label })}
              maxLength={60}
            />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`spec-value-${i}`}>{t("specValue")}</Label>
              <Input
                id={`spec-value-${i}`}
                value={spec.value}
                onChange={(e) => update({ ...spec, value: e.target.value })}
                maxLength={120}
                placeholder="Debian 13"
              />
            </div>
          </div>
        )}
      />

      <SaveRow pending={pending} label={t("save")} saving={t("saving")} />
    </form>
  );
}

export function RulesForm({ initial }: { initial: RulesConfig }) {
  const t = useTranslations("admin.content");
  const [form, setForm] = React.useState(initial);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.length === 0) return toast.error(t("errors.rules_empty"));
    if (form.some((r) => !r.title.zh.trim() || !r.content.zh.trim())) {
      return toast.error(t("errors.ruleIncomplete"));
    }
    start(async () => {
      const res = await adminSaveRules(form);
      if (!res.ok) {
        toast.error(t(`errors.${res.error ?? "unknown"}`));
        return;
      }
      toast.success(t("saved"));
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <p className="text-xs text-muted-foreground">{t("rulesHint")}</p>

      <RepeatableList
        items={form}
        onChange={setForm}
        makeItem={() => ({ title: emptyLocalized(), content: emptyLocalized() })}
        addLabel={t("addRule")}
        emptyLabel={t("rulesEmpty")}
        renderItem={(rule, i, update) => (
          <div className="flex flex-col gap-4">
            <LocalizedField
              idPrefix={`rule-title-${i}`}
              label={t("ruleTitle")}
              value={rule.title}
              onChange={(title) => update({ ...rule, title })}
              maxLength={80}
            />
            <LocalizedField
              idPrefix={`rule-content-${i}`}
              label={t("ruleContent")}
              value={rule.content}
              onChange={(content) => update({ ...rule, content })}
              multiline
              rows={3}
            />
          </div>
        )}
      />

      <SaveRow pending={pending} label={t("save")} saving={t("saving")} />
    </form>
  );
}

function SaveRow({
  pending,
  label,
  saving,
}: {
  pending: boolean;
  label: string;
  saving: string;
}) {
  return (
    <div className="flex">
      <Button type="submit" disabled={pending}>
        <Save className="size-4" />
        {pending ? saving : label}
      </Button>
    </div>
  );
}

/** 卡片外壳，三个表单共用，保证间距一致 */
export function ContentCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-5 pt-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
