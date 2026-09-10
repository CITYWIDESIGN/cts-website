"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, ClipboardList, LayoutDashboard, Server } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { EASE_OUT } from "@/components/motion/transitions";
import { useJoinState } from "./join-state-context";

/**
 * 是否有可展示的"加入服务器/查询审核结果"入口。
 * 审核通过或没有可填问卷时返回 false —— 调用方据此让整行按钮居中，
 * 而不是留一个隐形占位（那样会让旁边的按钮歪在一边）。
 */
export function useHasJoinAction(): boolean {
  const state = useJoinState();
  if (!state) return true;
  return state.action.kind === "pending" || state.action.kind === "questionnaire";
}

/**
 * 感知登录与审核状态的 CTA 按钮（首页三处 CTA 共用）。
 *
 * 状态 → 行为：
 *   未登录              → 「加入服务器」→ /login
 *   已提交、审核中       → 「查询审核结果」→ /dashboard
 *   审核通过            → 不渲染（调用方负责居中其余按钮）
 *   未提交 / 被拒       → 「加入服务器」→ 问卷页
 *   无可填写问卷         → 不渲染
 *
 * 数据来自上层 JoinStateProvider（服务端查一次库），客户端不能伪造。
 */
export function JoinButton({
  className,
  size = "lg",
  variant = "default",
  /** 传入时覆盖默认文案 */
  label,
}: {
  className?: string;
  size?: "default" | "sm" | "lg";
  variant?: "default" | "outline" | "secondary" | "ghost";
  label?: string;
}) {
  const state = useJoinState();
  const cta = useTranslations("home.cta");
  const dashboard = useTranslations("dashboard");
  const reduce = useReducedMotion();

  const action = state?.action;

  // 无入口时直接不渲染，交给父级居中其余元素
  if (!action || action.kind === "approved" || action.kind === "empty") {
    return null;
  }

  let href: string;
  let text: string;
  let Icon: React.ComponentType<{ className?: string }>;

  if (action.kind === "pending") {
    href = "/dashboard";
    text = label ?? dashboard("checkResult");
    Icon = LayoutDashboard;
  } else if (action.requiresLogin) {
    href = "/login";
    text = label ?? cta("apply");
    Icon = ArrowRight;
  } else {
    href = `/questionnaires/${action.questionnaireId}`;
    text = label ?? cta("apply");
    Icon = ClipboardList;
  }

  const content = (
    <>
      {text}
      <Icon className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
    </>
  );

  // 状态变化时（例如登录态从服务端刷新回来）做一次交叉淡入
  if (reduce) {
    return (
      <Button asChild size={size} variant={variant} className={className}>
        <Link href={href}>{content}</Link>
      </Button>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={`${action.kind}-${href}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.25, ease: EASE_OUT }}
        className="inline-flex"
      >
        <Button
          asChild
          size={size}
          variant={variant}
          className={`group ${className ?? ""}`}
        >
          <Link href={href}>{content}</Link>
        </Button>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * 首页 Hero 的次要按钮（了解服务器）。
 * 当主 CTA 不存在时，自己移动到中间，避免歪在一侧。
 */
export function HeroSecondaryButton({ label }: { label: string }) {
  const hasJoin = useHasJoinAction();
  const reduce = useReducedMotion();

  return (
    <motion.div
      layout={!reduce}
      transition={{ type: "spring", stiffness: 400, damping: 34 }}
      className="inline-flex"
    >
      <Button
        asChild
        size="lg"
        variant={hasJoin ? "outline" : "default"}
        className="group transition-transform duration-300 hover:-translate-y-0.5"
      >
        <Link href="/server">
          {!hasJoin && <Server className="size-4" />}
          {label}
          {hasJoin && (
            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          )}
        </Link>
      </Button>
    </motion.div>
  );
}

/**
 * Hero 底部按钮行。
 *
 * 主 CTA 与次要按钮必须在同一个客户端组件里决定（服务端渲染时无法知道
 * 主 CTA 是否存在）。
 *
 * 对齐：首屏是居中版式，按钮也**居中**。之前左对齐是因为外面多套了一层
 * 带 px 的容器，导致按钮的可用宽度比标题容器窄 32–48px、左边缘对不上；
 * 现在 `w-fit` 让外层贴合内容，由页面容器统一控制左右边距。
 *
 * 另外不做 layout 动画、不按 hasJoin 改对齐 —— 否则服务端首帧与客户端
 * 水合后布局不一致，按钮会"歪"一下再归位。
 */
export function HeroActions({ secondaryLabel }: { secondaryLabel: string }) {
  return (
    <div className="flex w-fit flex-col gap-3 sm:flex-row sm:items-center">
      <JoinButton />
      <HeroSecondaryButton label={secondaryLabel} />
    </div>
  );
}
