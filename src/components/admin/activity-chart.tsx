"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { UserAvatarLink } from "@/components/user/user-avatar-link";
import { EASE_OUT } from "@/components/motion/transitions";
import { cn } from "@/lib/utils";

export type ActivitySeries = {
  /** 评论 */
  comments: number;
  /** 资源 */
  resources: number;
  /** 下载 */
  downloads: number;
};

export type ActivityBarRow = ActivitySeries & {
  /** 排序/展示用的稳定 key */
  key: string;
  label: string;
  /** 有 user 时渲染可点头像 */
  user?: { id: string; uuid: string | null };
};

const SERIES = [
  { key: "comments", cls: "bg-chart-1" },
  { key: "resources", cls: "bg-chart-2" },
  { key: "downloads", cls: "bg-chart-3" },
] as const;

/**
 * 横向堆叠条形图（纯 CSS，无图表库）。
 *
 * 为什么自己写：项目里没有图表依赖，为了一个后台页面引入 recharts 不划算；
 * 这里只需要"每行按比例堆三段 + 入场增长"，用 flex + 百分比宽度就够了，
 * 还能直接复用站点的 motion 曲线和 oklch 图表色。
 *
 * 宽度按**全局最大值**归一化（而不是每行自身总量），这样行与行之间可以直接比长短。
 */
export function ActivityBarChart({
  rows,
  className,
}: {
  rows: ActivityBarRow[];
  className?: string;
}) {
  const t = useTranslations("admin.stats");
  const reduce = useReducedMotion();

  const max = React.useMemo(
    () => Math.max(1, ...rows.map((r) => r.comments + r.resources + r.downloads)),
    [rows]
  );

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* 图例 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-[3px]", s.cls)} />
            {t(s.key)}
          </span>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("noData")}
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {rows.map((row, i) => {
            const total = row.comments + row.resources + row.downloads;
            // 轨道始终占满，条的宽度 = 该行总量 / 全局最大值
            const width = (total / max) * 100;

            return (
              <motion.li
                key={row.key}
                initial={reduce ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.4,
                  ease: EASE_OUT,
                  delay: reduce ? 0 : Math.min(i, 10) * 0.05,
                }}
                className="flex items-center gap-3"
              >
                {/* 名次 */}
                <span className="w-5 shrink-0 text-right text-xs font-medium tabular-nums text-muted-foreground">
                  {i + 1}
                </span>

                {/* 头像 / 标识 */}
                {row.user ? (
                  <UserAvatarLink
                    userId={row.user.id}
                    name={row.label}
                    uuid={row.user.uuid}
                    size={26}
                  />
                ) : (
                  <span className="flex size-[26px] shrink-0 items-center justify-center rounded-md bg-muted text-[10px] text-muted-foreground">
                    IP
                  </span>
                )}

                {/* 名字 */}
                <span
                  className={cn(
                    "w-24 shrink-0 truncate text-sm",
                    row.user ? "font-medium" : "font-mono text-xs text-muted-foreground"
                  )}
                  title={row.label}
                >
                  {row.label}
                </span>

                {/* 条 + 数值 */}
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="relative h-5 min-w-0 flex-1 overflow-hidden rounded-md bg-muted/60">
                    <motion.span
                      className="absolute inset-y-0 left-0 flex overflow-hidden rounded-md"
                      initial={reduce ? { width: `${width}%` } : { width: 0 }}
                      animate={{ width: `${width}%` }}
                      transition={{
                        duration: 0.7,
                        ease: EASE_OUT,
                        delay: reduce ? 0 : Math.min(i, 10) * 0.05 + 0.1,
                      }}
                    >
                      {SERIES.map((s) => {
                        const v = row[s.key];
                        if (v <= 0) return null;
                        return (
                          <span
                            key={s.key}
                            className={cn("h-full", s.cls)}
                            // 段宽按"占这一行总量的比例"
                            style={{ width: `${(v / total) * 100}%` }}
                            title={`${t(s.key)}：${v}`}
                          />
                        );
                      })}
                    </motion.span>
                  </span>

                  <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">
                    {total}
                  </span>
                </span>
              </motion.li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
