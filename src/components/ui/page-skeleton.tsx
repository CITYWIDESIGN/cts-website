import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * `loading.tsx` 用的骨架块。
 *
 * 为什么要有这些文件：App Router 里如果没有 `loading.tsx`，导航到一个
 * 服务端渲染的页面时**浏览器会一直停在旧页面上**，直到新页面的 RSC 数据
 * 全部就绪 —— 表现就是"点了没反应"。这些页面都要查数据库，所以每个都该有。
 *
 * 骨架不追求像素级还原，只求三件事：
 *   1. **外层容器和真实页面一致**（同样的 max-w / padding），
 *      否则数据到达时布局会整体跳一下
 *   2. 高度量级接近，避免滚动位置跳变
 *   3. 不带任何文案 —— 骨架屏不需要翻译，也就不该进 messages/*.json
 */

/** 页面标题区：小标签 + 大标题 + 描述 */
export function SkeletonHeading({
  align = "left",
}: {
  align?: "left" | "center";
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        align === "center" && "items-center"
      )}
    >
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-9 w-64 sm:w-80" />
      <Skeleton className="h-4 w-full max-w-xl" />
    </div>
  );
}

/** 资源卡片网格 */
export function SkeletonCardGrid({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-5 sm:grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-xl border p-4">
          <Skeleton className="aspect-16/9 w-full rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
          <div className="mt-1 flex items-center gap-3">
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** 一行行的列表（资源列表、评论、消息都用得上） */
export function SkeletonRows({
  rows = 5,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-xl border px-4 py-3"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

/** 一排统计卡 */
export function SkeletonStats({
  count = 3,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border p-4">
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** 表头 + 若干行，后台表格页用 */
export function SkeletonTable({
  rows = 8,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex gap-4 border-b bg-muted/40 px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b px-4 py-3.5 last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-3.5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
