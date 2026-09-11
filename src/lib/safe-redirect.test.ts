import { test } from "node:test";
import assert from "node:assert/strict";
import { safeRedirectPath } from "./safe-redirect";

/** 开放重定向是钓鱼的标配（"刚登录完，请重新输入密码"），这里把口子钉死。 */

test("接受站内相对路径", () => {
  assert.equal(safeRedirectPath("/dashboard"), "/dashboard");
  assert.equal(safeRedirectPath("/resources/abc?x=1"), "/resources/abc?x=1");
  assert.equal(safeRedirectPath("  /rules  "), "/rules");
});

test("挡掉绝对地址", () => {
  assert.equal(safeRedirectPath("https://evil.com"), "/dashboard");
  assert.equal(safeRedirectPath("http://evil.com/x"), "/dashboard");
  assert.equal(safeRedirectPath("javascript:alert(1)"), "/dashboard");
});

test("挡掉协议相对与反斜杠变体", () => {
  // //evil.com 是协议相对 URL；有些浏览器把 \ 当成 /
  assert.equal(safeRedirectPath("//evil.com"), "/dashboard");
  assert.equal(safeRedirectPath("/\\evil.com"), "/dashboard");
  assert.equal(safeRedirectPath("/a\\b"), "/dashboard");
});

test("挡掉控制字符与空白（能骗过一部分解析器）", () => {
  assert.equal(safeRedirectPath("/a\nb"), "/dashboard");
  assert.equal(safeRedirectPath("/a\r\nSet-Cookie: x=1"), "/dashboard");
  assert.equal(safeRedirectPath("/a b"), "/dashboard");
  assert.equal(safeRedirectPath("/a\u0000b"), "/dashboard");
});

test("空值走 fallback，且 fallback 可定制", () => {
  assert.equal(safeRedirectPath(null), "/dashboard");
  assert.equal(safeRedirectPath(undefined), "/dashboard");
  assert.equal(safeRedirectPath(""), "/dashboard");
  assert.equal(safeRedirectPath("   "), "/dashboard");
  assert.equal(safeRedirectPath(null, ""), "");
  assert.equal(safeRedirectPath("https://evil.com", "/login"), "/login");
});
