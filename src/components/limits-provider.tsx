"use client";

import * as React from "react";
import { DEFAULT_LIMITS, type LimitsConfig } from "@/lib/validators/limits";

/**
 * 限额配置的客户端 Context。
 *
 * 服务端那一份（@/server/limit、@/server/quota、@/server/resource）才是
 * 权威判定；这里只解决"界面上要显示最大 5MB"和"选完文件先给个即时反馈"
 * 这两件事 —— 客户端校验不可信，绕过它也没用。
 *
 * 默认值是 DEFAULT_LIMITS，所以即使某个页面忘了套 LimitsLoader，
 * 组件退回到"可配置之前"的行为，而不是崩掉或显示 undefined。
 */
const LimitsContext = React.createContext<LimitsConfig>(DEFAULT_LIMITS);

export function LimitsProvider({
  value,
  children,
}: {
  value: LimitsConfig;
  children: React.ReactNode;
}) {
  return (
    <LimitsContext.Provider value={value}>{children}</LimitsContext.Provider>
  );
}

export function useLimits(): LimitsConfig {
  return React.useContext(LimitsContext);
}
