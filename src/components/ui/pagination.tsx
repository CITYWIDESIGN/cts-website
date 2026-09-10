import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 分页控件（服务端组件，纯链接，不需要 JS）。
 *
 * 用 `<Link>` 而不是按钮 + onClick：翻页会改 URL 查询参数，服务端组件
 * 直接重新渲染，浏览器还能正常前进/后退、能收藏某一页、能分享链接。
 *
 * 之前后台几处各写了一份几乎一样的分页（admin/users、admin/stats），
 * 这里统一成一个 —— 顺手把"当前页高亮"和"省略号"补上。
 */
export function Pagination({
  page,
  totalPages,
  /** 生成第 n 页的链接（保留其它查询参数由调用方负责） */
  hrefFor,
  /** 紧凑模式：只显示上一页/下一页，适合空间小的地方 */
  compact = false,
  labels,
  className,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
  compact?: boolean;
  labels?: { prev?: string; next?: string };
  className?: string;
}) {
  if (totalPages <= 1) return null;

  const prevLabel = labels?.prev ?? "Previous";
  const nextLabel = labels?.next ?? "Next";

  const linkCls =
    "inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm transition-colors duration-200 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none";
  const disabledCls =
    "inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm opacity-40";

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex items-center gap-1.5", className)}
    >
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} aria-label={prevLabel} className={linkCls}>
          <ChevronLeft className="size-4" />
        </Link>
      ) : (
        <span aria-hidden className={disabledCls}>
          <ChevronLeft className="size-4" />
        </span>
      )}

      {compact ? (
        <span className="px-2 text-sm tabular-nums text-muted-foreground">
          {page} / {totalPages}
        </span>
      ) : (
        pageNumbers(page, totalPages).map((n, i) =>
          n === null ? (
            <span key={`gap-${i}`} className="px-1 text-muted-foreground">
              …
            </span>
          ) : (
            <Link
              key={n}
              href={hrefFor(n)}
              aria-current={n === page ? "page" : undefined}
              className={cn(
                linkCls,
                "tabular-nums",
                n === page &&
                  "border-primary bg-primary/10 font-medium text-primary"
              )}
            >
              {n}
            </Link>
          )
        )
      )}

      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} aria-label={nextLabel} className={linkCls}>
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        <span aria-hidden className={disabledCls}>
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}

/**
 * 页码列表，页数多时用省略号收缩：
 * 首页 … 当前±1 … 末页。`null` 表示省略号。
 */
export function pageNumbers(
  page: number,
  totalPages: number,
  span = 1
): Array<number | null> {
  const pages = new Set<number>([1, totalPages]);
  for (let i = page - span; i <= page + span; i++) {
    if (i >= 1 && i <= totalPages) pages.add(i);
  }
  const sorted = [...pages].sort((a, b) => a - b);

  const out: Array<number | null> = [];
  let prev = 0;
  for (const n of sorted) {
    if (prev && n - prev > 1) out.push(null);
    out.push(n);
    prev = n;
  }
  return out;
}
