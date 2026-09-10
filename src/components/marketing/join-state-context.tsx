"use client";

import * as React from "react";
import type { JoinState } from "@/lib/join-state";

const JoinStateContext = React.createContext<JoinState | null>(null);

export function JoinStateProvider({
  value,
  children,
}: {
  value: JoinState;
  children: React.ReactNode;
}) {
  return (
    <JoinStateContext.Provider value={value}>
      {children}
    </JoinStateContext.Provider>
  );
}

/** 读取加入状态；不在 Provider 内时返回 null（组件需自行兜底） */
export function useJoinState(): JoinState | null {
  return React.useContext(JoinStateContext);
}
