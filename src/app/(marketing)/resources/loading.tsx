import { Skeleton } from "@/components/ui/skeleton";
import {
  SkeletonCardGrid,
  SkeletonHeading,
} from "@/components/ui/page-skeleton";

/** 资源列表：标题区 + 6 张卡片。容器与 padding 必须和 page.tsx 一致 */
export default function ResourcesLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <SkeletonHeading />
        <Skeleton className="h-9 w-32 shrink-0" />
      </div>
      <SkeletonCardGrid count={6} className="mt-10" />
      <div className="mt-10 flex flex-col items-center gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  );
}
