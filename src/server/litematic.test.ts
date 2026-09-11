import { test } from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { describeLitematic, MAX_PREVIEW_VOLUME } from "./litematic";
import { isLitematicFileName } from "@/lib/litematic/file-name";

/**
 * 这些用例盯的是**失败路径**。
 *
 * 成功路径（真的解出一个投影）不在这里测：那需要一份合法的 .litematic 夹具，
 * 而造夹具要么引一个 NBT 写入器、要么把玩家作品提交进仓库 —— 两条都不划算。
 * 真机验证用的是服务器上真实的 337 个投影文件（见 CLAUDE.md）。
 *
 * 这里要保证的是：**预览永远不能把上传搞挂**。
 */

test("识别 .litematic 扩展名", () => {
  assert.equal(isLitematicFileName("build.litematic"), true);
  assert.equal(isLitematicFileName("BUILD.LITEMATIC"), true);
  assert.equal(isLitematicFileName("  空格.litematic  "), true);

  assert.equal(isLitematicFileName("build.schem"), false);
  assert.equal(isLitematicFileName("build.litematic.zip"), false);
  assert.equal(isLitematicFileName("litematic"), false);
  assert.equal(isLitematicFileName(""), false);
});

test("非 gzip 内容返回 null 而不是抛异常", () => {
  assert.equal(describeLitematic(Buffer.from("这不是投影")), null);
  assert.equal(describeLitematic(Buffer.from([0x00, 0x01, 0x02, 0x03])), null);
});

test("空的 gzip 流返回 null", () => {
  assert.equal(describeLitematic(gzipSync(Buffer.from(""))), null);
});

test("gzip 里包的不是 NBT 也返回 null", () => {
  assert.equal(describeLitematic(gzipSync(Buffer.from("hello world"))), null);
});

test("只有 gzip 头、内容被截断时返回 null", () => {
  const full = gzipSync(Buffer.from([0x0a, 0x00, 0x00, 0x03]));
  assert.equal(describeLitematic(full.subarray(0, Math.floor(full.length / 2))), null);
});

test("全零缓冲区不会让解析器崩掉", () => {
  assert.equal(describeLitematic(new Uint8Array(4096)), null);
});

test("体积上限是个正数，且比典型建筑大得多", () => {
  assert.ok(MAX_PREVIEW_VOLUME > 0);
  // 至少能装下 300×300×300，不然正常建筑都会被跳过
  assert.ok(MAX_PREVIEW_VOLUME >= 300 * 300 * 300);
  // 但也不能无限大：浏览器里渲染不动就是白等
  assert.ok(MAX_PREVIEW_VOLUME <= 100 * 1000 * 1000);
});
