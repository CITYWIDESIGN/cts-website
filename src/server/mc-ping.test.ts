import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decodeString,
  decodeVarInt,
  encodeString,
  encodeVarInt,
} from "./mc-ping";

/**
 * 握手包是二进制协议，错一个字节服务端就静默不回。
 * 这几个编码函数是整段逻辑里最值得钉死的部分。
 */

test("VarInt：单字节", () => {
  assert.deepEqual([...encodeVarInt(0)], [0x00]);
  assert.deepEqual([...encodeVarInt(1)], [0x01]);
  assert.deepEqual([...encodeVarInt(127)], [0x7f]);
});

test("VarInt：多字节（协议里的经典样例）", () => {
  assert.deepEqual([...encodeVarInt(128)], [0x80, 0x01]);
  assert.deepEqual([...encodeVarInt(255)], [0xff, 0x01]);
  assert.deepEqual([...encodeVarInt(25565)], [0xdd, 0xc7, 0x01]);
  assert.deepEqual([...encodeVarInt(2097151)], [0xff, 0xff, 0x7f]);
});

test("VarInt：-1（协议版本传 -1 表示'只查状态'）是 5 字节", () => {
  assert.deepEqual([...encodeVarInt(-1)], [0xff, 0xff, 0xff, 0xff, 0x0f]);
});

test("VarInt：编解码往返", () => {
  for (const value of [0, 1, 127, 128, 255, 25565, 2097151, 2147483647]) {
    const encoded = encodeVarInt(value);
    const decoded = decodeVarInt(encoded, 0);
    assert.equal(decoded?.value, value, String(value));
    assert.equal(decoded?.bytes, encoded.length, String(value));
  }
});

test("VarInt：字节不够时返回 null（而不是瞎猜）", () => {
  assert.equal(decodeVarInt(Buffer.from([0x80]), 0), null);
  assert.equal(decodeVarInt(Buffer.alloc(0), 0), null);
  // 连续 5 个最高位为 1 → 超过协议上限
  assert.equal(decodeVarInt(Buffer.from([0x80, 0x80, 0x80, 0x80, 0x80]), 0), null);
});

test("字符串：长度前缀 + UTF-8", () => {
  const encoded = encodeString("127.0.0.1");
  assert.equal(encoded[0], 9); // 长度前缀
  const decoded = decodeString(encoded, 0);
  assert.equal(decoded?.value, "127.0.0.1");
  assert.equal(decoded?.bytes, encoded.length);
});

test("字符串：中文按 UTF-8 字节数算长度", () => {
  const encoded = encodeString("你好");
  assert.equal(encoded[0], 6); // 两个汉字 = 6 字节，不是 2
  assert.equal(decodeString(encoded, 0)?.value, "你好");
});

test("字符串：字节不够时返回 null", () => {
  const encoded = encodeString("hello");
  assert.equal(decodeString(encoded.subarray(0, 3), 0), null);
});
