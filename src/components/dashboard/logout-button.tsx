"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { LogOut } from "lucide-react";
import { EASE_OUT, STAGGER } from "@/components/motion/transitions";

/**
 * 退出登录按钮。
 * 沿用原有的 POST /api/auth/logout（服务端清 cookie 后跳回首页），
 * 这里只补上动画与 pending 反馈。
 */
export function LogoutButton({
  index = 0,
  label,
}: {
  index?: number;
  label: string;
}) {
  const [pending, setPending] = React.useState(false);
  const reduce = useReducedMotion();

  return (
    <motion.form
      action="/api/auth/logout"
      method="post"
      onSubmit={() => setPending(true)}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: 0.45,
        ease: EASE_OUT,
        delay: Math.min(index, 12) * STAGGER,
      }}
      className="mt-6 flex justify-end"
    >
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-destructive/30 px-4 text-sm font-medium text-destructive transition-all duration-300 hover:bg-destructive/8 active:scale-[0.98] disabled:opacity-60"
      >
        <LogOut className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
        {label}
      </button>
    </motion.form>
  );
}
