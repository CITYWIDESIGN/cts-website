import { randomBytes } from "node:crypto";

export type StageStatus = "START" | "OK" | "FAILED" | "SKIPPED";

const isDev = process.env.NODE_ENV !== "production";

export interface AuthLogger {
  attemptId: string;
  stage: (name: string, status: StageStatus, detail?: string) => void;
}

/** 为一次登录生成唯一 attemptId（短、可读、用于关联日志） */
export function generateAttemptId(): string {
  return randomBytes(6).toString("hex");
}

/**
 * 认证专用 logger：
 * - 开发环境：输出所有阶段（START/OK/FAILED）
 * - 生产环境：只输出 FAILED，避免噪音
 * - 每条日志带 [auth:<attemptId>] 前缀，方便关联一次完整登录
 * - 绝不输出 token / Authorization / OAuth code 等敏感信息
 */
export function createAuthLogger(attemptId?: string): AuthLogger {
  const id = attemptId ?? generateAttemptId();

  return {
    attemptId: id,
    stage(name, status, detail) {
      if (status === "FAILED") {
        console.error(
          detail ? `[auth:${id}] ${name} ${status} — ${detail}` : `[auth:${id}] ${name} ${status}`
        );
      } else if (isDev) {
        console.log(
          detail ? `[auth:${id}] ${name} ${status} — ${detail}` : `[auth:${id}] ${name} ${status}`
        );
      }
    },
  };
}
