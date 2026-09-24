"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

/**
 * 主题切换：**从点击位置向外扩散的圆形揭示**。
 *
 * 之前是硬切换（类名一换整页瞬间变色）。现在用 View Transitions API：
 * 新主题以触点为中心、以覆盖到**最远屏幕角落**的半径展开成一个圆。
 *
 * 几个必须做对的地方：
 *
 * 1. **圆心取真实的点击/触摸位置**，不是屏幕中心 —— 这是这个交互的全部意义：
 *    变化看起来"从你手指的地方长出来"。
 *
 * 2. **半径按到最远的那个角算**。四个角取离触点最远的，否则圆盖不满，
 *    屏幕边缘会留一条还没换色的地带。
 *
 * 3. **两层主题同尺寸同位置，只裁切上层**。不要缩放页面内容 ——
 *    那会让整页文字"抽动"一下，比硬切换更难受。
 *
 * 4. **`flushSync` 是必须的**。next-themes 是在 effect 里改 `<html>` 的 class，
 *    而 View Transition 只对**回调执行期间**发生的 DOM 变动作快照。
 *    不强制同步刷新，快照拍完类名才变，动画就是空的。
 *
 * 5. **降级**：不支持 View Transitions 的浏览器、以及开了 reduced-motion 的用户，
 *    都直接走原来的硬切换 —— 功能完全不受影响。
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  function toggle(event: React.MouseEvent<HTMLButtonElement>) {
    const next = resolvedTheme === "dark" ? "light" : "dark";

    // 降级一：浏览器不支持
    if (typeof document.startViewTransition !== "function") {
      setTheme(next);
      return;
    }
    // 降级二：用户要求减少动态效果
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTheme(next);
      return;
    }

    // 触点。键盘触发时 clientX/Y 是 0，退回按钮自身的中心
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX || rect.left + rect.width / 2;
    const y = event.clientY || rect.top + rect.height / 2;

    const transition = document.startViewTransition(() => {
      flushSync(() => setTheme(next));
    });

    transition.ready
      .then(() => {
        const radius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y)
        );
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${radius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 520,
            easing: "cubic-bezier(0.4, 0, 0.2, 1)",
            pseudoElement: "::view-transition-new(root)",
          }
        );
      })
      .catch(() => {
        /* 动画没跑起来无所谓，主题已经切了 */
      });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label="Toggle theme"
      className="text-muted-foreground hover:text-foreground"
    >
      <span className="relative flex size-4 items-center justify-center">
        <Sun className="absolute size-4 scale-0 -rotate-90 opacity-0 transition-all duration-300 dark:scale-100 dark:rotate-0 dark:opacity-100" />
        <Moon className="absolute size-4 scale-100 rotate-0 opacity-100 transition-all duration-300 dark:scale-0 dark:rotate-90 dark:opacity-0" />
      </span>
    </Button>
  );
}
