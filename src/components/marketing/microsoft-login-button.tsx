"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Loader2 } from "lucide-react";
import { MicrosoftIcon } from "@/components/icons/microsoft";
import { Button } from "@/components/ui/button";
import { EASE_OUT } from "@/components/motion/transitions";

/**
 * 登录按钮：点击后进入"正在跳转"状态。
 *
 * 走的是整页跳转（/api/auth/login），浏览器在服务端响应期间会停留在原页面，
 * 没有反馈会让人以为没点到。这里补上 spinner + 文案切换，并在跳转前短暂
 * 展示成功态色彩，让过渡不突兀。
 */
export function MicrosoftLoginButton({
  label,
  redirectingLabel,
  /** 授权成功后回到这里（站内路径，服务端还会再过滤一次） */
  redirectTo = "",
}: {
  label: string;
  redirectingLabel: string;
  redirectTo?: string;
}) {
  const [pending, setPending] = React.useState(false);
  const reduce = useReducedMotion();

  /*
    和本地账号登录保持一致：登录前是从哪个页面被拦下来的，登录后回哪去。
    /api/auth/login 本身会用 safeRedirectPath 再校验一遍，这里不担心伪造。
  */
  const href = redirectTo
    ? `/api/auth/login?redirectTo=${encodeURIComponent(redirectTo)}`
    : "/api/auth/login";

  return (
    <Button
      asChild
      size="lg"
      className="group relative w-full overflow-hidden"
      aria-busy={pending}
      onClick={() => {
        // 跳转期间忽略重复点击，避免重复发起授权
        if (!pending) setPending(true);
      }}
    >
      <a href={href}>
        {/* 悬停时从左向右扫过的高光，克制、不抢眼 */}
        {!reduce && !pending && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/12 to-transparent"
            initial={{ x: 0, opacity: 0 }}
            whileHover={{ x: "300%", opacity: 1 }}
            transition={{ duration: 0.9, ease: EASE_OUT }}
          />
        )}

        <motion.span
          className="flex items-center gap-2"
          animate={pending ? { opacity: 0.85 } : { opacity: 1 }}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MicrosoftIcon className="size-4 transition-transform duration-300 group-hover:scale-110" />
          )}
          <span>{pending ? redirectingLabel : label}</span>
        </motion.span>
      </a>
    </Button>
  );
}
