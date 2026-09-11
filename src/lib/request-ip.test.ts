import { test } from "node:test";
import assert from "node:assert/strict";
import { clientIpFromHeaders, normalizeIp } from "./request-ip";

/**
 * 这个文件盯的是一个真实存在的漏洞：限流与配额原先取 `x-forwarded-for`
 * 的**第一个**值，而那是客户端自己写的 —— 换个随机值就能拿到全新的限流桶。
 * 下面这些用例都是"改回去就会红"的那种。
 */

const h = (init: Record<string, string>) => new Headers(init);

test("normalizeIp：合法地址规范化成同一个键", () => {
  assert.equal(normalizeIp("1.2.3.4"), "1.2.3.4");
  assert.equal(normalizeIp(" 1.2.3.4 "), "1.2.3.4");
  assert.equal(normalizeIp("1.2.3.4:5678"), "1.2.3.4");
  assert.equal(normalizeIp("[2001:db8::1]:443"), "2001:db8::1");
  assert.equal(normalizeIp("2001:DB8::1"), "2001:db8::1");
  assert.equal(normalizeIp("::1"), "::1");
});

test("normalizeIp：解析不出来的一律 null（否则能拿垃圾字符串当键刷行数）", () => {
  assert.equal(normalizeIp("256.1.1.1"), null);
  assert.equal(normalizeIp("1.2.3"), null);
  assert.equal(normalizeIp("not-an-ip"), null);
  assert.equal(normalizeIp(""), null);
  assert.equal(normalizeIp(null), null);
  assert.equal(normalizeIp(undefined), null);
  assert.equal(normalizeIp("a".repeat(200)), null);
});

test("clientIpFromHeaders：取最右边那个值，不是最左边", () => {
  // 客户端能控制的部分在左边，代理追加的在右边
  assert.equal(
    clientIpFromHeaders(h({ "x-forwarded-for": "9.9.9.9, 8.8.8.8, 1.2.3.4" })),
    "1.2.3.4"
  );
  assert.equal(clientIpFromHeaders(h({ "x-forwarded-for": "1.2.3.4" })), "1.2.3.4");
});

test("clientIpFromHeaders：伪造的垃圾值会被跳过", () => {
  assert.equal(
    clientIpFromHeaders(h({ "x-forwarded-for": "evil, 1.2.3.4" })),
    "1.2.3.4"
  );
  assert.equal(
    clientIpFromHeaders(h({ "x-forwarded-for": "1.2.3.4, garbage" })),
    "1.2.3.4"
  );
});

test("clientIpFromHeaders：完全不可信时回退 unknown（所有人共用一个桶）", () => {
  assert.equal(clientIpFromHeaders(h({ "x-forwarded-for": "garbage" })), "unknown");
  assert.equal(clientIpFromHeaders(h({})), "unknown");
});

test("clientIpFromHeaders：退而求其次用 x-real-ip", () => {
  assert.equal(clientIpFromHeaders(h({ "x-real-ip": "5.6.7.8" })), "5.6.7.8");
});

test("clientIpFromHeaders：TRUST_PROXY=0 时完全不看这些头", () => {
  const previous = process.env.TRUST_PROXY;
  process.env.TRUST_PROXY = "0";
  try {
    assert.equal(clientIpFromHeaders(h({ "x-forwarded-for": "1.2.3.4" })), "unknown");
    assert.equal(clientIpFromHeaders(h({ "x-real-ip": "1.2.3.4" })), "unknown");
  } finally {
    if (previous === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = previous;
  }
});

test("同一个来源的不同写法必须落成同一个键", () => {
  const keys = new Set([
    clientIpFromHeaders(h({ "x-forwarded-for": "8.8.8.8, 1.2.3.4" })),
    clientIpFromHeaders(h({ "x-forwarded-for": "1.2.3.4" })),
    clientIpFromHeaders(h({ "x-forwarded-for": "1.2.3.4:99" })),
  ]);
  assert.equal(keys.size, 1);
});
