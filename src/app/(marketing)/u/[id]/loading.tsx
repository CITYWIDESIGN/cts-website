import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRows, SkeletonStats } from "@/components/ui/page-skeleton";

/** 玩家资料页：容器与 page.tsx 一致（max-w-4xl） */
export default function UserProfileLoading() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
      {/* 头部：头像 + 名字 + 加入时间 */}
      <div className="flex flex-col gap-5 rounded-2xl border bg-card p-6 sm:flex-row sm:items-center">
        <Skeleton className="size-24 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-3 w-56" />
          <Skeleton className="h-3 w-72" />
        </div>
      </div>

      {/* 活跃度三张卡 */}
      <SkeletonStats count={3} />

      {/* 发布的资源 */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-32" />
        <SkeletonRows rows={4} />
      </div>
    </div>
  );
}
