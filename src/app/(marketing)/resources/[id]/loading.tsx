import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRows } from "@/components/ui/page-skeleton";

/** 资源详情：容器与 page.tsx 一致（max-w-4xl） */
export default function ResourceDetailLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="flex flex-col gap-6">
        <Skeleton className="h-3 w-28" />

        {/* 头部卡片：标题 + 元信息 + 操作按钮 */}
        <div className="flex flex-col gap-4 rounded-2xl border bg-card p-6">
          <Skeleton className="h-7 w-3/5" />
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>

        {/* 封面 */}
        <Skeleton className="aspect-16/9 w-full rounded-xl" />

        {/* 正文若干段 */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-4/5" />
        </div>

        {/* 评论区 */}
        <div className="mt-4 space-y-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <SkeletonRows rows={3} />
        </div>
      </div>
    </div>
  );
}
