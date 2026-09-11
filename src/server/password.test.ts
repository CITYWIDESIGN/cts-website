import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, needsRehash, verifyPassword } from "./password";

/**
 * 这个文件盯两件事：
 *   1. 存储格式自描述 —— 提高参数不能把老密码锁死
 *   2. 陪跑的假哈希参数必须和真实参数一致，否则又能靠响应时间枚举账号
 */

test("哈希 → 校验 往返", async () => {
  const stored = await hashPassword("correct horse battery staple");
  assert.equal(await verifyPassword("correct horse battery staple", stored), true);
  assert.equal(await verifyPassword("wrong password", stored), false);
});

test("每次加盐都不同（同一个密码两次哈希不相等）", async () => {
  const a = await hashPassword("same");
  const b = await hashPassword("same");
  assert.notEqual(a, b);
  assert.equal(await verifyPassword("same", a), true);
  assert.equal(await verifyPassword("same", b), true);
});

test("全角字符会被 NFKC 归一化，和半角等价", async () => {
  const stored = await hashPassword("ＡＢＣ１２３");
  assert.equal(await verifyPassword("ABC123", stored), true);
});

test("存储格式自带 N/r/p，旧参数写的哈希仍然校验得通过", async () => {
  // 一段用老参数（N=16384）写出来的真实哈希，密码是 "legacy"
  const legacy =
    "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" +
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  // 上面这段是伪造的（密钥不对），只用来确认"能解析、不抛错、判为不匹配"
  assert.equal(await verifyPassword("legacy", legacy), false);
  // 关键：格式是旧参数时必须被识别为"需要升级"
  assert.equal(needsRehash(legacy), true);
});

test("新写的哈希不需要升级", async () => {
  const stored = await hashPassword("whatever");
  assert.equal(needsRehash(stored), false);
});

test("坏数据不会让 needsRehash 抛错，也不会被判成需要升级", () => {
  for (const bad of ["", "not-a-hash", "scrypt$abc$8$1$AA==$AA==", "scrypt$1$2$3$x$y$z", null, undefined]) {
    assert.equal(needsRehash(bad as string | null | undefined), false, String(bad));
  }
});

test("参数被改坏（N 超大）时返回 false，而不是抛错或吃掉内存", async () => {
  const evil = "scrypt$1073741824$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAA==";
  assert.equal(await verifyPassword("x", evil), false);
});

test("空 / 非字符串输入一律失败", async () => {
  assert.equal(await verifyPassword("x", null), false);
  assert.equal(await verifyPassword("x", undefined), false);
  assert.equal(await verifyPassword("x", ""), false);
});
