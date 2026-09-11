"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * 表单里的双语文本。
 *
 * 比 @/lib/localized 的 `Localized` 更严：表单里 `en` 永远是字符串（空串表示
 * 没填），不会出现 undefined —— 受控 input 的 value 不接受 undefined。
 * zod schema 的推断结果正好就是这个形状。
 */
export interface LocalizedText {
  zh: string;
  en: string;
}

/**
 * 双语文案的编辑控件。
 *
 * 管理员填的内容不能放 `messages/*.json`（那是构建产物），所以中英各一个
 * 输入框，英文留空时前台回退中文（见 @/lib/localized）。
 *
 * 界面上把中文放主位、英文折叠成次要样式：中文必填，英文可以以后再补。
 */
export function LocalizedField({
  label,
  value,
  onChange,
  multiline = false,
  rows = 3,
  maxLength = 2000,
  placeholder,
  idPrefix,
}: {
  label: string;
  value: LocalizedText;
  onChange: (next: LocalizedText) => void;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
  idPrefix: string;
}) {
  const t = useTranslations("admin.contentEditor");
  const zhId = `${idPrefix}-zh`;
  const enId = `${idPrefix}-en`;

  return (
    <div className="flex flex-col gap-3">
      <Label htmlFor={zhId}>{label}</Label>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("langZh")}
        </span>
        {multiline ? (
          <Textarea
            id={zhId}
            value={value.zh}
            onChange={(e) => onChange({ ...value, zh: e.target.value })}
            rows={rows}
            maxLength={maxLength}
            placeholder={placeholder}
          />
        ) : (
          <Input
            id={zhId}
            value={value.zh}
            onChange={(e) => onChange({ ...value, zh: e.target.value })}
            maxLength={maxLength}
            placeholder={placeholder}
          />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("langEn")}
          <span className="ml-1.5 font-normal normal-case tracking-normal text-muted-foreground/70">
            {t("langEnOptional")}
          </span>
        </span>
        {multiline ? (
          <Textarea
            id={enId}
            value={value.en}
            onChange={(e) => onChange({ ...value, en: e.target.value })}
            rows={rows}
            maxLength={maxLength}
            className="text-sm"
          />
        ) : (
          <Input
            id={enId}
            value={value.en}
            onChange={(e) => onChange({ ...value, en: e.target.value })}
            maxLength={maxLength}
            className="text-sm"
          />
        )}
      </div>
    </div>
  );
}

/** 可增删排序的一列条目（规则、硬件配置都用它） */
export function RepeatableList<T>({
  items,
  onChange,
  renderItem,
  makeItem,
  addLabel,
  emptyLabel,
  max = 20,
  className,
}: {
  items: T[];
  onChange: (next: T[]) => void;
  renderItem: (item: T, index: number, update: (next: T) => void) => React.ReactNode;
  makeItem: () => T;
  addLabel: string;
  emptyLabel: string;
  max?: number;
  className?: string;
}) {
  const t = useTranslations("admin.contentEditor");

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {items.length === 0 && (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </p>
      )}

      {items.map((item, i) => (
        <div key={i} className="rounded-xl border bg-muted/20 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => move(i, i - 1)}
                disabled={i === 0}
                aria-label={t("moveUp")}
                className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, i + 1)}
                disabled={i === items.length - 1}
                aria-label={t("moveDown")}
                className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                aria-label={t("remove")}
                className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                {t("remove")}
              </button>
            </div>
          </div>
          {renderItem(item, i, (next) =>
            onChange(items.map((v, j) => (j === i ? next : v)))
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...items, makeItem()])}
        disabled={items.length >= max}
        className="self-start rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-40"
      >
        + {addLabel}
      </button>
    </div>
  );
}
