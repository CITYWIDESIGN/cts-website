import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MinecraftNameSchema,
  MinecraftUuidSchema,
  UsernameSchema,
} from "./auth";

/**
 * 名字类字段的白名单。
 *
 * 这一组用例的由来：有人把名字填成 `曲奇§▼v▼§`，把界面搞花了。
 * `§` 是 Minecraft 的颜色代码前缀，它后面那一段在客户端会被当成格式码
 * 吃掉/变色。所以规则必须是**白名单**（只放行明确安全的字符），
 * 而不是"屏蔽几个坏字符"—— 控制符、零宽字符、双向文本控制符列不完。
 */

test("正常的账号名通过，大小写原样保留", () => {
  assert.equal(UsernameSchema.parse("Ciiity"), "Ciiity");
  assert.equal(UsernameSchema.parse("alice"), "alice");
  assert.equal(UsernameSchema.parse("  Bob_99  "), "Bob_99");
  assert.equal(UsernameSchema.parse("张三丰"), "张三丰");
});

test("账号名不再被转成小写（大小写敏感）", () => {
  // 曾经 `.transform(v => v.toLowerCase())` —— 那样 Alice 和 alice 会撞成一个账号
  assert.notEqual(UsernameSchema.parse("Alice"), UsernameSchema.parse("alice"));
});

test("拒绝把界面搞花的那类字符", () => {
  for (const bad of [
    "曲奇§▼v▼§", // 实际搞炸过站点的那个
    "§cRed",
    "a\u0000b", // 控制符
    "a\u200bb", // 零宽空格
    "a\u202eb", // 双向文本控制符（能把后面的文字整个倒过来）
    "user name", // 空格
    "user!", // 其它符号
    "user@host",
    "user/../x",
  ]) {
    assert.equal(UsernameSchema.safeParse(bad).success, false, `应当拒绝：${JSON.stringify(bad)}`);
  }
});

test("账号名的长度边界", () => {
  assert.equal(UsernameSchema.safeParse("ab").success, false);
  assert.equal(UsernameSchema.safeParse("abc").success, true);
  assert.equal(UsernameSchema.safeParse("a".repeat(20)).success, true);
  assert.equal(UsernameSchema.safeParse("a".repeat(21)).success, false);
});

test("玩家名同样过滤，且保留大小写", () => {
  assert.equal(MinecraftNameSchema.parse("Steve"), "Steve");
  assert.equal(MinecraftNameSchema.parse("曲奇饼"), "曲奇饼");
  assert.equal(MinecraftNameSchema.safeParse("曲奇§▼v▼§").success, false);
  assert.equal(MinecraftNameSchema.safeParse("a\u202eb").success, false);
  // 正版 ID 最长 16
  assert.equal(MinecraftNameSchema.safeParse("a".repeat(16)).success, true);
  assert.equal(MinecraftNameSchema.safeParse("a".repeat(17)).success, false);
});

test("UUID 只收十六进制，连字符可有可无，统一成小写 32 位", () => {
  assert.equal(
    MinecraftUuidSchema.parse("4CE43162-7985-4FB9-833F-0A2424E8AFBF"),
    "4ce4316279854fb9833f0a2424e8afbf"
  );
  assert.equal(
    MinecraftUuidSchema.parse("4ce4316279854fb9833f0a2424e8afbf"),
    "4ce4316279854fb9833f0a2424e8afbf"
  );
  // 空 = 只填 ID 不填 UUID
  assert.equal(MinecraftUuidSchema.parse(""), "");
});

test("UUID 挡掉注入和畸形值", () => {
  for (const bad of [
    "4ce4316279854fb9833f0a2424e8afb", // 31 位
    "4ce4316279854fb9833f0a2424e8afbfa", // 33 位
    "zzzz316279854fb9833f0a2424e8afbf", // 非十六进制
    "../../etc/passwd",
    "4ce43162-7985-4fb9-833f-0a2424e8afbf'; DROP TABLE users--",
    "<script>alert(1)</script>",
    "曲奇饼",
  ]) {
    assert.equal(MinecraftUuidSchema.safeParse(bad).success, false, `应当拒绝：${bad}`);
  }
});
