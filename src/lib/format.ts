/**
 * 站点统一时区。
 *
 * ⚠️ **必须显式指定，不能用 `getFullYear()` / `getHours()` 这类本地时区方法。**
 *
 * 踩过的坑：这两个函数既在服务端组件里用，也在**客户端组件**里用
 * （评论、资源卡、通知铃铛、封禁提示）。本地开发时服务端和浏览器都是 +0800，
 * 一切正常；但生产容器默认 UTC —— 服务端把 `2026-09-11T07:40Z` 渲染成
 * "07:40"，浏览器水合成 "15:40"，两边字符串不一样，React 直接报
 * hydration mismatch（文本还会闪一下）。
 *
 * 固定成北京时间同时也**更符合产品预期**：站点的所有时间都按站点所在时区
 * 展示，不管访客在哪个时区 —— 否则境外审核员看到的时间和公告里写的对不上。
 */
const SITE_TIME_ZONE = "Asia/Shanghai";

/** en-CA 的短日期正好是 YYYY-MM-DD */
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SITE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** hourCycle 用 h23 才是 00:00 而不是 24:00 */
const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: SITE_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return dateFormatter.format(d);
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return `${dateFormatter.format(d)} ${timeFormatter.format(d)}`;
}

const yearFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SITE_TIME_ZONE,
  year: "numeric",
});

/**
 * 站点时区下的"今天"，格式 YYYY-MM-DD。
 *
 * 日期输入框的默认值要用它，**不要用 `new Date().toISOString().slice(0, 10)`** ——
 * 那是 UTC 日期，北京时间 0:00–8:00 之间会填成"昨天"。
 */
export function siteToday(now: Date = new Date()): string {
  return dateFormatter.format(now);
}

/**
 * 站点时区下的年份。
 *
 * 页脚的版权年份用 `new Date().getFullYear()` 也是本地时区：容器跑 UTC 时，
 * 元旦当天的北京时间（还在 12 月 31 日 UTC）会显示成去年。
 */
export function siteYear(now: Date = new Date()): string {
  return yearFormatter.format(now);
}

/** UUID 不带连字符时补上标准格式 */
export function formatUuid(uuid: string | null | undefined): string {
  if (!uuid) return "—";
  if (uuid.includes("-")) return uuid;
  const hex = uuid.replace(/[^0-9a-fA-F]/g, "");
  if (hex.length !== 32) return uuid;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** 字节数转可读大小（用于资源附件展示，最多一位小数） */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  );
  const value = bytes / Math.pow(1024, i);
  return `${i === 0 ? value : value.toFixed(1)} ${units[i]}`;
}
