import { test } from "node:test";
import assert from "node:assert/strict";
import { formatBytes, formatDate, formatDateTime, formatUuid } from "./format";

/**
 * 这个文件盯的是**服务端和客户端必须渲染出同一个字符串**。
 *
 * 原来用的是 `getFullYear()` / `getHours()`，在容器（UTC）里 SSR、
 * 在 +0800 的浏览器里水合，两边差 8 小时 → hydration mismatch。
 * 现在固定成 Asia/Shanghai，下面的断言在**任何 TZ 下都该通过**。
 */

/** 2026-09-11T07:40:00Z = 北京时间 15:40 */
const INSTANT = new Date("2026-09-11T07:40:00.000Z");

test("formatDate 按北京时间取日期，与进程 TZ 无关", () => {
  assert.equal(formatDate(INSTANT), "2026-09-11");
});

test("formatDateTime 是北京时间，不是 UTC", () => {
  // UTC 会给出 07:40，那样水合时就和浏览器对不上了
  assert.equal(formatDateTime(INSTANT), "2026-09-11 15:40");
});

test("跨日边界：UTC 还在前一天，北京已经是新一天", () => {
  const lateUtc = new Date("2026-09-10T17:30:00.000Z"); // 北京 09-11 01:30
  assert.equal(formatDate(lateUtc), "2026-09-11");
  assert.equal(formatDateTime(lateUtc), "2026-09-11 01:30");
});

test("午夜是 00:00 而不是 24:00", () => {
  const midnight = new Date("2026-09-10T16:00:00.000Z"); // 北京 09-11 00:00
  assert.equal(formatDateTime(midnight), "2026-09-11 00:00");
});

test("同一时刻在任何进程时区下结果一致（模拟容器）", () => {
  const previous = process.env.TZ;
  const results = new Set<string>();
  for (const tz of ["UTC", "Asia/Shanghai", "America/New_York", "Europe/London"]) {
    process.env.TZ = tz;
    results.add(formatDateTime(INSTANT));
  }
  if (previous === undefined) delete process.env.TZ;
  else process.env.TZ = previous;
  assert.equal(results.size, 1, `不同 TZ 渲染不一致: ${[...results].join(" / ")}`);
});

test("接受 ISO 字符串", () => {
  assert.equal(formatDate("2026-09-11T07:40:00.000Z"), "2026-09-11");
});

test("非法日期退化成占位符，不抛错也不吐 Invalid Date", () => {
  assert.equal(formatDate("not a date"), "—");
  assert.equal(formatDateTime(new Date("nope")), "—");
});

test("formatUuid：补连字符 / 已带连字符 / 空值", () => {
  assert.equal(
    formatUuid("069a79f444e94726a5befca90e38aaf5"),
    "069a79f4-44e9-4726-a5be-fca90e38aaf5"
  );
  assert.equal(
    formatUuid("069a79f4-44e9-4726-a5be-fca90e38aaf5"),
    "069a79f4-44e9-4726-a5be-fca90e38aaf5"
  );
  assert.equal(formatUuid(null), "—");
  assert.equal(formatUuid(""), "—");
  assert.equal(formatUuid("太短"), "太短");
});

test("formatBytes", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(-1), "0 B");
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(1024), "1.0 KB");
  assert.equal(formatBytes(1536), "1.5 KB");
  assert.equal(formatBytes(5 * 1024 * 1024), "5.0 MB");
});
