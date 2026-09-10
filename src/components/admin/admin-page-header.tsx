import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * 后台页面标题区（标题 + 描述 + 徽章 + 右侧动作）。
 *
 * 为什么值得单独抽一个组件：这九张表/页面原来各自写了一遍 h1 和描述，
 * 写着写着就散了 —— 描述有的 `mt-1` 有的紧贴标题（间距 0），字号有的继承
 * 正文 16px、有的 `text-sm`，右侧动作有的用外层 `justify-between`、有的靠
 * `flex-wrap`。单看每一页都说得过去，连起来翻就显得"间距随机"。
 *
 * 统一到这里之后，间距只有一处定义：
 *   - 标题 24px semibold，`tracking-tight`
 *   - 描述距标题 6px（`mt-1.5`），`text-sm`，muted
 *   - 徽章与标题同排、垂直居中，间距 10px
 *   - 右侧动作固定右对齐，`shrink-0`，窄屏时整块换行到标题下方
 *
 * 用 `gap-x` / `gap-y` 分开写，是为了换行时标题和动作之间仍有呼吸，
 * 而不是贴在一起。
 */
export function AdminPageHeader({
  title,
  description,
  /** 标题右侧的小徽章，例如「3 条待处理」 */
  badge,
  /** 右侧动作区，例如「返回」「新建问卷」 */
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-x-4 gap-y-3",
        className
      )}
    >
      <div className="min-w-0">
        {/* items-center 而不是 items-baseline：徽章比标题矮，按基线对会显得偏下。
            break-words 是为了很长的问卷标题 / 玩家名不会撑破容器。 */}
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <h1 className="min-w-0 text-2xl font-semibold tracking-tight break-words">
            {title}
          </h1>
          {badge}
        </div>
        {description != null && (
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {actions != null && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
