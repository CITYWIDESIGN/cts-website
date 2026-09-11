import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRows } from "@/components/ui/page-skeleton";

/**
 * 个人中心通用骨架。容器跟 `dashboard/page.tsx` 的 `max-w-5xl` 对齐，
 * 后面的子页面（设置、问卷…）宽度不同，但差别不大，不会跳得明显。
 */
export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-6 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center sm:p-6">
        <Skeleton className="size-16 shrink-0 rounded-2xl" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="grid flex-1 grid-cols-3 gap-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-56 rounded-xl lg:col-span-2" />
        <Skeleton className="h-56 rounded-xl" />
      </div>

      <div className="mt-10 space-y-4">
        <Skeleton className="h-5 w-32" />
        <SkeletonRows rows={3} />
      </div>
    </div>
  );
}
