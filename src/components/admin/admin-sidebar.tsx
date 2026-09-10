"use client";

import * as React from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "admin-sidebar-collapsed";

/** 让 AdminNav 等子组件共享收起状态（避免把状态提升到 layout 层） */
const SidebarContext = React.createContext(false);

export function useSidebarCollapsed() {
  return React.useContext(SidebarContext);
}

/* ---------------------------------------------------------------------------
 * localStorage 作为外部数据源，用 useSyncExternalStore 读取。
 *
 * 为什么不用 useState + useEffect：
 * 1. effect 里直接 setState 会引发级联渲染（react-hooks/set-state-in-effect），
 *    而且服务端渲染(展开)与客户端首帧(收起)不一致会造成 hydration 不匹配，
 *    React 因此重渲染整棵子树 —— 这就是之前"收起/展开鬼畜"的根因。
 * 2. useSyncExternalStore 有独立的 server snapshot，天然避免不匹配。
 * ------------------------------------------------------------------------- */

let listeners: Array<() => void> = [];

function subscribe(onChange: () => void) {
  listeners.push(onChange);
  // 多标签页同步
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) listeners.forEach((fn) => fn());
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners = listeners.filter((fn) => fn !== onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function emit() {
  listeners.forEach((fn) => fn());
}

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** 服务端与客户端首帧都返回 false（展开），保证 hydration 一致 */
const serverSnapshot = () => false;

/**
 * 后台侧边栏外壳：负责展开/收起。
 *
 * 宽度用 CSS transition 而不是 JS 逐帧动画：逐帧改 width 会让内部每个元素
 * 每帧重排，配合文字褪色就会出现抖动；交给合成器只跑一次。
 */
export function AdminSidebar({
  brand,
  children,
  footer,
}: {
  brand: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const collapsed = React.useSyncExternalStore(
    subscribe,
    readCollapsed,
    serverSnapshot
  );
  const mounted = React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );

  function toggle() {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? "0" : "1");
    } catch {
      /* 忽略写入失败 */
    }
    emit();
  }

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col overflow-hidden border-r bg-muted/20 motion-reduce:transition-none lg:flex",
        // 挂载前不加过渡：避免"服务端渲染展开 → 客户端恢复为收起"这一步被动画播放
        mounted && "transition-[width] duration-300 ease-out",
        // 64px 是算出来的：nav 容器 p-3(12) + Link pl-3(12) + 图标 16/2 = 32
        // 正好是 64 的一半，所以收起时图标天然居中，不需要 justify-center
        // —— 也正因如此，图标在收起过程中不会横向移动。
        collapsed ? "w-16" : "w-[240px]"
      )}
    >
      {/*
        头部：按钮**永远靠右**。
        靠右 = 按钮贴着正在动画的右侧边，跟着一起滑，看起来是连续的；
        如果按收起状态切 justify-center，按钮会瞬间从右端跳到中间。
        收起时 pr 从 12px 微调到 16px，让 32px 的按钮在 64px 栏里居中。
      */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center justify-end border-b pl-3",
          mounted && "transition-[padding] duration-300 ease-out",
          collapsed ? "pr-4" : "pr-3"
        )}
      >
        <div className={cn("min-w-0 flex-1", collapsed && "sr-only")}>{brand}</div>

        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground active:scale-95"
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3">
        <AnimateInContext.Provider value={mounted}>
          <SidebarContext.Provider value={collapsed}>
            {children}
          </SidebarContext.Provider>
        </AnimateInContext.Provider>
      </div>

      {footer && <div className="shrink-0 border-t p-3">{footer}</div>}
    </aside>
  );
}

/**
 * 把 "是否允许播放入场动画" 放进 context：
 * AdminNav 据此决定 initial 是 hidden 还是直接显示，
 * 保证入场动画最多播放一次，切换收起状态不会重播。
 */
const AnimateInContext = React.createContext(false);

export function useSidebarAnimateIn() {
  return React.useContext(AnimateInContext);
}
