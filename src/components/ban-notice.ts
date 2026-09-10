"use client";

import { useTranslations } from "next-intl";
import { formatDateTime } from "@/lib/format";

/** Server Action / route 返回的封禁信息 */
export type BanPayload = {
  bannedForever?: boolean;
  bannedUntil?: string | null;
};

/** 封禁影响到的操作类型，对应 messages 里 ban.<scope>Forever / ban.<scope>Until */
export type BanScope = "social" | "upload" | "download";

/**
 * 把服务端返回的封禁信息变成一句人话。
 *
 * 文案按"操作类型"分开写而不是把动词插进模板句里 —— 中英文的语序不一样，
 * 拼句子在两种语言里总有一种会别扭。
 */
export function useBanNotice(): (scope: BanScope, payload: BanPayload) => string {
  const t = useTranslations("ban");
  return (scope, payload) =>
    payload.bannedForever || !payload.bannedUntil
      ? t(`${scope}Forever`)
      : t(`${scope}Until`, { date: formatDateTime(payload.bannedUntil) });
}
