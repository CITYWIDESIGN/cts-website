"use client";

import { Boxes, Layers, Ruler, User } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * 投影预览下方的那行元信息（名称 / 作者 / 尺寸 / 方块数 / 区域数）。
 *
 * 这些值**是服务端从文件里解出来的**，不是上传者填的 —— 见
 * `src/server/litematic.ts`。这里只负责把 Json 列里的值安全地读出来：
 * 它是数据库里的 `JsonValue`，形状不保证，缺字段就整行不显示，
 * 不要让一个坏值把详情页搞崩。
 */
interface LitematicMeta {
  name?: unknown;
  author?: unknown;
  size?: { x?: unknown; y?: unknown; z?: unknown };
  totalBlocks?: unknown;
  regionCount?: unknown;
}

function positiveInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function PreviewMetaList({ meta }: { meta: unknown }) {
  const t = useTranslations("resources");
  const m = (meta ?? {}) as LitematicMeta;

  const name = text(m.name);
  const author = text(m.author);
  const sx = positiveInt(m.size?.x);
  const sy = positiveInt(m.size?.y);
  const sz = positiveInt(m.size?.z);
  const blocks = positiveInt(m.totalBlocks);
  const regions = positiveInt(m.regionCount);

  const size = sx && sy && sz ? `${sx} × ${sy} × ${sz}` : null;

  const rows = [
    name && { icon: Boxes, label: t("previewName"), value: name },
    author && { icon: User, label: t("previewAuthor"), value: author },
    size && { icon: Ruler, label: t("previewSize"), value: size },
    blocks && {
      icon: Boxes,
      label: t("previewBlocks"),
      value: t("previewBlocksValue", { count: blocks }),
    },
    // 只有一个区域就不提了，"1 个区域"是噪音
    regions && regions > 1 && {
      icon: Layers,
      label: t("previewRegions"),
      value: t("previewRegionsValue", { count: regions }),
    },
  ].filter(Boolean) as {
    icon: typeof Boxes;
    label: string;
    value: string;
  }[];

  if (rows.length === 0) return null;

  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline gap-2">
          <dt className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
            <row.icon className="size-3.5" />
            {row.label}
          </dt>
          <dd className="min-w-0 truncate" title={row.value}>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
