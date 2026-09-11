import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonTable } from "@/components/ui/page-skeleton";

/**
 * 后台通用骨架。
 *
 * 放在 `(admin)` 这一层，所有没有单独写 loading.tsx 的后台页面都会用它。
 * 后台页面几乎都是"标题 + 描述 + 一张表/一组表单"，所以这个兜底足够贴切。
 *
 * 注意外层**不需要**再套 max-w 或 padding —— `(admin)/layout.tsx` 的
 * `<main className="flex-1 p-4 sm:p-6 lg:p-8">` 已经提供了。
 */
export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <SkeletonTable rows={8} cols={5} />
    </div>
  );
}
