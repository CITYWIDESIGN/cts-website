"use client";

import { useEffect } from "react";

/**
 * 根级错误边界。
 *
 * 为什么 `app/error.tsx` 不够：那个文件只包住 `app/layout.tsx` **里面**的东西。
 * 一旦错误发生在根布局自身（读取 locale cookie、`SiteSetting`、主题脚本……
 * 任何在最外层抛出的东西），Next 会回退到它自带的英文错误页 —— 对本站来说
 * 就是用户看到一屏 "Application error: a client-side exception has occurred"。
 *
 * `global-error.tsx` 会**替换整个根布局**，所以这里：
 *   - 不能依赖任何 Provider（next-intl 的翻译在这里拿不到）
 *   - 不能依赖 Tailwind 之外的项目组件（也可能正是它们炸了）
 *   - 必须自带 <html> / <body>
 *
 * 中英各写一份，不用翻译框架 —— 这个页面本身的优先级是"能看懂、能重试"，
 * 不是"跟着语言设置走"。样式一律内联，避免再依赖一层构建产物。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 根布局挂了的话服务端日志可能不完整，浏览器这一侧留一份
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7f7f8",
          color: "#15171b",
          fontFamily:
            "Segoe UI, Microsoft YaHei, Helvetica Neue, Arial, sans-serif",
        }}
      >
        <main style={{ maxWidth: 420, padding: "0 24px", textAlign: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 12px" }}>
            页面出错了 / Something went wrong
          </h1>
          <p style={{ margin: "0 0 8px", lineHeight: 1.7, color: "#52525b" }}>
            页面没能正常加载。可以重试一次，如果一直这样请联系管理员。
          </p>
          <p style={{ margin: "0 0 24px", lineHeight: 1.7, color: "#52525b" }}>
            The page failed to load. Try again, or contact an administrator if
            it keeps happening.
          </p>
          <button
            onClick={reset}
            style={{
              border: "1px solid #d4d4d8",
              borderRadius: 10,
              background: "#ffffff",
              color: "inherit",
              padding: "10px 20px",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            重试 / Retry
          </button>
          {error.digest ? (
            <p style={{ marginTop: 20, fontSize: 12, color: "#a1a1aa" }}>
              {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
