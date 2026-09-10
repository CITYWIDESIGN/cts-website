"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 「返回」按钮。
 *
 * 优先 `router.back()` —— 回到**用户实际来的那个页面**（统计页、评论区、
 * 资源列表……都可能是入口）。只有当前没有可回退的历史（比如直接粘链接打开）
 * 才跳到 fallback。
 *
 * 为什么不用 `<Link href={fallback}>`：那会固定跳到一个页面，
 * 从后台统计点进资料页再点返回就跑到资源列表去了，很跳。
 */
export function BackLink({
  fallback,
  label,
  className,
}: {
  /** 没有历史可回退时的兜底去处 */
  fallback: string;
  label: string;
  className?: string;
}) {
  const router = useRouter();

  function go() {
    // history.length > 1 说明这个标签页里还有上一页可退
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }

  return (
    <button
      type="button"
      onClick={go}
      className={cn(
        "group inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
        className
      )}
    >
      <ArrowLeft className="size-3.5 transition-transform duration-300 group-hover:-translate-x-0.5" />
      {label}
    </button>
  );
}
