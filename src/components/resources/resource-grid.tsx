"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import {
  Download,
  FileArchive,
  ImageOff,
  LayoutGrid,
  Rows3,
  Search,
  Sparkles,
  User,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { EASE_OUT } from "@/components/motion/transitions";
import { UserAvatarLink } from "@/components/user/user-avatar-link";
import { InteractionBar } from "./interaction-bar";
import { DownloadButton } from "./download-button";
import { formatBytes, formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ResourceCardItem = {
  id: string;
  title: string;
  description: string;
  fileName: string;
  fileSize: number;
  downloads: number;
  createdAt: string;
  version: number;
  hasImage: boolean;
  uploaderName: string | null;
  uploaderId: string;
  /** 上传者 Minecraft UUID（渲染可点进资料页的头像） */
  uploaderUuid: string | null;
  /** 上传者是否佩戴头像框 */
  uploaderFramed: boolean;
  /** 互动计数与当前用户状态 */
  likeCount: number;
  commentCount: number;
  liked: boolean;
};

type ViewMode = "grid" | "feed" | "list";

const VIEW_KEY = "resources-view";

/** 登录用户 id（为 null 表示未登录）—— 互动按钮据此提示登录 */
const ViewerIdContext = React.createContext<string | null>(null);
export function ResourceViewerProvider({
  viewerId,
  children,
}: {
  viewerId: string | null;
  children: React.ReactNode;
}) {
  return (
    <ViewerIdContext.Provider value={viewerId}>
      {children}
    </ViewerIdContext.Provider>
  );
}
function useViewerId() {
  return React.useContext(ViewerIdContext);
}

/* ---------------------------------------------------------------------------
 * 视图偏好存在 localStorage。
 * 用 useSyncExternalStore 读取：它带独立的 serverSnapshot，
 * 服务端与客户端首帧都返回 "grid"，避免 hydration 不匹配；
 * 也避免在 effect 里 setState（会触发级联渲染的 lint 规则）。
 * ------------------------------------------------------------------------- */

let viewListeners: Array<() => void> = [];

function subscribeView(onChange: () => void) {
  viewListeners.push(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === VIEW_KEY) viewListeners.forEach((fn) => fn());
  };
  window.addEventListener("storage", onStorage);
  return () => {
    viewListeners = viewListeners.filter((fn) => fn !== onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function readView(): ViewMode {
  try {
    const stored = window.localStorage.getItem(VIEW_KEY);
    if (stored === "feed" || stored === "list" || stored === "grid") return stored;
  } catch {
    /* 隐私模式不可用 */
  }
  return "grid";
}

const serverView = (): ViewMode => "grid";

/**
 * 资源列表，支持三种视图：
 *   - grid  卡片网格（默认）：封面为主，适合浏览
 *   - feed  动态：像发动态一样，带作者头像、时间、正文与附件，按时间倒序
 *   - list  列表：一行一条，信息密度最高
 *
 * 视图选择写入 localStorage；搜索在前端过滤（资源量不大，
 * 避免每敲一个字都请求服务端）。
 */
export function ResourceGrid({ items }: { items: ResourceCardItem[] }) {
  const t = useTranslations("resources");
  const reduce = useReducedMotion();
  const [query, setQuery] = React.useState("");
  const view = React.useSyncExternalStore(subscribeView, readView, serverView);

  function changeView(next: ViewMode) {
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* 忽略写入失败 */
    }
    // 通知所有订阅者（含本组件与其它标签页）
    viewListeners.forEach((fn) => fn());
  }

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        (r.uploaderName ?? "").toLowerCase().includes(q) ||
        r.fileName.toLowerCase().includes(q)
    );
  }, [items, query]);

  const views: Array<{ key: ViewMode; icon: typeof LayoutGrid; label: string }> = [
    { key: "grid", icon: LayoutGrid, label: t("viewGrid") },
    { key: "feed", icon: Sparkles, label: t("viewFeed") },
    { key: "list", icon: Rows3, label: t("viewList") },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* 搜索 + 视图切换 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-9"
            aria-label={t("searchPlaceholder")}
          />
        </div>

        <div
          role="tablist"
          aria-label={t("viewLabel")}
          className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border bg-muted/40 p-0.5"
        >
          {views.map((v) => {
            const Icon = v.icon;
            const active = view === v.key;
            return (
              <button
                key={v.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => changeView(v.key)}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors duration-200",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="resource-view-active"
                    aria-hidden
                    className="absolute inset-0 rounded-md bg-background shadow-xs"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <Icon className="relative z-10 size-3.5" />
                <span className="relative z-10">{v.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
            <FileArchive className="size-5 text-muted-foreground" />
          </span>
          <p className="text-muted-foreground">
            {query ? t("noMatch") : t("empty")}
          </p>
        </div>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
          >
            {view === "grid" && <GridView items={filtered} />}
            {view === "feed" && <FeedView items={filtered} />}
            {view === "list" && <ListView items={filtered} />}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ 网格 */

function GridView({ items }: { items: ResourceCardItem[] }) {
  const t = useTranslations("resources");
  const reduce = useReducedMotion();

  return (
    <Stagger
      inView={false}
      stagger={0.06}
      className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
    >
      {items.map((r, i) => (
        <StaggerItem key={r.id} index={i} className="h-full">
          <motion.div
            whileHover={reduce ? undefined : { y: -4 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="h-full"
          >
            <Card className="group h-full gap-0 overflow-hidden p-0 transition-[border-color,box-shadow] duration-300 hover:border-primary/25 hover:shadow-md">
              <Link
                href={`/resources/${r.id}`}
                className="relative block aspect-video w-full overflow-hidden bg-muted"
              >
                {r.hasImage ? (
                  // 封面走独立接口，避免 data URL 内联进列表
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/resources/${r.id}/image`}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center text-muted-foreground/50">
                    <ImageOff className="size-6" />
                  </span>
                )}
                {r.version > 1 && (
                  <Badge className="absolute right-2 top-2 bg-background/85 text-foreground backdrop-blur">
                    v{r.version}
                  </Badge>
                )}
              </Link>

              <div className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="line-clamp-1 font-semibold">{r.title}</h3>
                  <Badge variant="secondary" className="shrink-0">
                    {formatBytes(r.fileSize)}
                  </Badge>
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {r.description}
                </p>
                <div className="mt-auto flex items-center gap-3 text-xs text-muted-foreground">
                  {/* 作者名也可点，进资料页 */}
                  <Link
                    href={`/u/${r.uploaderId}`}
                    className="flex items-center gap-1 hover:text-foreground hover:underline"
                  >
                    <User className="size-3" />
                    {r.uploaderName ?? "—"}
                  </Link>
                  <span>{formatDate(r.createdAt)}</span>
                  <span className="ml-auto flex items-center gap-1">
                    <Download className="size-3" />
                    {r.downloads}
                  </span>
                </div>
                <Link
                  href={`/resources/${r.id}`}
                  className="text-sm font-medium text-primary transition-colors hover:text-primary/80"
                >
                  {t("viewDetail")} →
                </Link>
              </div>
            </Card>
          </motion.div>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

/* ------------------------------------------------------------------ 动态 */

/**
 * 动态视图：刻意**不用卡片**，改成 B 站 / QQ 空间那种连续时间线。
 *
 * 结构：
 *   作者行（皮肤头像 + 名字 + 时间 + 版本）
 *   正文（标题 + 介绍）
 *   封面图（通栏，圆角但不套卡片）
 *   附件条（文件名 + 大小 + 下载按钮）
 *   互动栏（点赞 / 评论 / 转发）
 *
 * 分隔靠一条极淡的横线，视觉上更像"信息流"而不是"卡片堆"。
 */
function FeedView({ items }: { items: ResourceCardItem[] }) {
  const t = useTranslations("resources");
  const viewerId = useViewerId();
  const authed = Boolean(viewerId);

  return (
    <Stagger
      inView={false}
      stagger={0.07}
      className="mx-auto flex max-w-2xl flex-col"
    >
      {items.map((r, i) => (
        <StaggerItem key={r.id} index={i}>
          <article className="group border-b border-border/60 py-6 first:pt-0 last:border-b-0">
            {/* 作者行 */}
            <div className="flex items-start gap-3">
              {/* 头像点进作者资料页（不是资源页） */}
              <UserAvatarLink
                userId={r.uploaderId}
                name={r.uploaderName}
                uuid={r.uploaderUuid}
                framed={r.uploaderFramed}
                size={40}
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link
                    href={`/u/${r.uploaderId}`}
                    className="font-medium hover:underline"
                  >
                    {r.uploaderName ?? "—"}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {t("sharedAt", { time: formatDateTime(r.createdAt) })}
                  </span>
                  {r.version > 1 && (
                    <Badge variant="outline" className="text-[10px]">
                      v{r.version}
                    </Badge>
                  )}
                </div>

                {/* 正文 */}
                <Link href={`/resources/${r.id}`} className="mt-2 block">
                  <h3 className="font-semibold transition-colors group-hover:text-primary">
                    {r.title}
                  </h3>
                </Link>
                <p className="mt-1 line-clamp-4 text-sm text-muted-foreground">
                  {r.description}
                </p>
              </div>
            </div>

            {/* 封面：通栏，不套卡片 */}
            {r.hasImage && (
              <Link
                href={`/resources/${r.id}`}
                className="mt-3 block overflow-hidden rounded-xl bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/resources/${r.id}/image`}
                  alt=""
                  loading="lazy"
                  className="max-h-96 w-full object-cover transition-transform duration-500 group-hover:scale-[1.01]"
                />
              </Link>
            )}

            {/* 附件条 */}
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-muted/50 px-3 py-2">
              <FileArchive className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {r.fileName} · {formatBytes(r.fileSize)}
              </span>
              <DownloadButton resourceId={r.id} />
            </div>

            {/* 互动栏：与动态左对齐（头像右侧），更像社交产品 */}
            <div className="mt-2 pl-[52px]">
              <InteractionBar
                resourceId={r.id}
                likeCount={r.likeCount}
                commentCount={r.commentCount}
                liked={r.liked}
                authed={authed}
              />
            </div>
          </article>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

/* ------------------------------------------------------------------ 列表 */

function ListView({ items }: { items: ResourceCardItem[] }) {
  return (
    <Stagger inView={false} stagger={0.05} className="flex flex-col gap-2">
      {items.map((r, i) => (
        <StaggerItem key={r.id} index={i}>
          <Link
            href={`/resources/${r.id}`}
            className="group flex items-center gap-4 rounded-xl border bg-card px-4 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md"
          >
            <span className="hidden size-12 shrink-0 overflow-hidden rounded-lg border bg-muted sm:block">
              {r.hasImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/resources/${r.id}/image`}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
              ) : (
                <span className="flex size-full items-center justify-center text-muted-foreground/50">
                  <ImageOff className="size-4" />
                </span>
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate font-medium transition-colors group-hover:text-primary">
                  {r.title}
                </span>
                {r.version > 1 && (
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    v{r.version}
                  </Badge>
                )}
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {r.fileName} · {formatBytes(r.fileSize)} · {r.uploaderName ?? "—"} ·{" "}
                {formatDate(r.createdAt)}
              </span>
            </span>

            <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              <Download className="size-3" />
              {r.downloads}
            </span>
          </Link>
        </StaggerItem>
      ))}
    </Stagger>
  );
}
