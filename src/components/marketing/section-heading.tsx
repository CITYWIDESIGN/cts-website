import * as React from "react";
import { cn } from "@/lib/utils";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { SplitHeading } from "@/components/motion/split-heading";

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
  /** 标题用逐字入场（默认开启，长标题更耐看） */
  split?: boolean;
}

/**
 * 区块标题。
 *
 * 设计上的几个"小心思"（都不增加元素数量）：
 * - 眉标前一个很小的实心方点，呼应 Minecraft 的像素语汇
 * - 标题用 tracking-display 收紧字距，中英混排更整齐
 * - 眉标 → 标题 → 描述 各自错开入场，而不是整块淡入
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  className,
  split = true,
}: SectionHeadingProps) {
  const centered = align === "center";

  return (
    <Stagger
      className={cn(
        "flex flex-col gap-3",
        centered && "items-center text-center",
        className
      )}
      stagger={0.09}
    >
      {eyebrow && (
        <StaggerItem index={0}>
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <span
              aria-hidden
              className="size-1.5 rounded-[2px] bg-primary"
            />
            {eyebrow}
          </span>
        </StaggerItem>
      )}

      <StaggerItem index={eyebrow ? 1 : 0} className="w-full">
        {split ? (
          <SplitHeading
            as="h2"
            text={title}
            mode="words"
            className={cn(
              "tracking-display text-balance text-2xl font-semibold sm:text-3xl",
              centered && "mx-auto"
            )}
          />
        ) : (
          <h2 className="tracking-display text-balance text-2xl font-semibold sm:text-3xl">
            {title}
          </h2>
        )}
      </StaggerItem>

      {description && (
        <StaggerItem index={eyebrow ? 2 : 1}>
          <p
            className={cn(
              "max-w-2xl text-balance text-muted-foreground",
              centered && "mx-auto"
            )}
          >
            {description}
          </p>
        </StaggerItem>
      )}
    </Stagger>
  );
}
