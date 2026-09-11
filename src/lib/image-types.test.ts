import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_COVER_MIME,
  isAllowedCoverDataUrl,
  parseDataUrl,
} from "./image-types";

/**
 * 封面接口是**同源内联返回**的，所以白名单漏一个能执行脚本的类型
 * 就是存储型 XSS。SVG 曾经漏进去过，这里把结论固化下来。
 */

test("SVG 必须被拒绝（能内嵌 script，同源返回即 XSS）", () => {
  assert.equal(isAllowedCoverDataUrl("data:image/svg+xml;base64,PHN2Zy8+"), false);
  assert.equal(isAllowedCoverDataUrl("data:image/svg+xml,<svg/>"), false);
  assert.equal(
    isAllowedCoverDataUrl("data:image/svg+xml;charset=utf-8;base64,PHN2Zy8+"),
    false
  );
  assert.ok(!(ALLOWED_COVER_MIME as readonly string[]).includes("image/svg+xml"));
});

test("栅格图放行", () => {
  for (const mime of ALLOWED_COVER_MIME) {
    assert.equal(isAllowedCoverDataUrl(`data:${mime};base64,AAAA`), true, mime);
  }
});

test("大小写与多余空格不影响判断", () => {
  assert.equal(isAllowedCoverDataUrl("data:IMAGE/PNG;base64,AAAA"), true);
  assert.equal(isAllowedCoverDataUrl("data: image/png ; base64 ,AAAA"), true);
});

test("非 data URL、缺 payload、空值一律拒绝", () => {
  assert.equal(isAllowedCoverDataUrl("https://evil.com/x.png"), false);
  assert.equal(isAllowedCoverDataUrl("data:image/png;base64"), false); // 没有逗号
  assert.equal(isAllowedCoverDataUrl("data:image/png;base64,"), false); // payload 为空
  assert.equal(isAllowedCoverDataUrl("data:"), false);
  assert.equal(isAllowedCoverDataUrl(""), false);
  assert.equal(isAllowedCoverDataUrl(null), false);
  assert.equal(isAllowedCoverDataUrl(undefined), false);
  assert.equal(isAllowedCoverDataUrl(123), false);
});

test("parseDataUrl 正确拆出 mime / base64 / payload", () => {
  assert.deepEqual(parseDataUrl("data:image/png;base64,AAAA"), {
    mime: "image/png",
    isBase64: true,
    payload: "AAAA",
  });
  assert.deepEqual(parseDataUrl("data:image/gif,ABC"), {
    mime: "image/gif",
    isBase64: false,
    payload: "ABC",
  });
});

test("payload 里的逗号不会被当成分隔符切错", () => {
  const parsed = parseDataUrl("data:image/png;base64,AA,BB");
  assert.equal(parsed?.payload, "AA,BB");
});
