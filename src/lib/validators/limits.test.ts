import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_LIMITS,
  LimitsConfigSchema,
  MAX_FILE_MB_CEILING,
  validateLimits,
  limitsToBytes,
  type LimitsConfig,
} from "./limits";

const base: LimitsConfig = { ...DEFAULT_LIMITS };

test("默认配置本身必须合法（否则管理后台一进去就报错）", () => {
  assert.equal(LimitsConfigSchema.safeParse(base).success, true);
  assert.equal(validateLimits(base), null);
});

test("单文件上限不能高于每日总额度，否则用户永远传不完一个文件", () => {
  assert.equal(validateLimits({ ...base, maxFileMb: 2000, uploadQuotaMb: 1000 }), "file_over_quota");
  assert.equal(validateLimits({ ...base, maxImageMb: 2000, uploadQuotaMb: 1000 }), "image_over_quota");
  // 相等是允许的：刚好传一个文件就把当天额度用光
  assert.equal(validateLimits({ ...base, maxFileMb: 1000, uploadQuotaMb: 1000 }), null);
});

test("zod 只管单字段范围", () => {
  assert.equal(LimitsConfigSchema.safeParse({ ...base, maxFileMb: 0 }).success, false);
  assert.equal(
    LimitsConfigSchema.safeParse({ ...base, maxFileMb: MAX_FILE_MB_CEILING + 1 }).success,
    false
  );
  assert.equal(
    LimitsConfigSchema.safeParse({ ...base, maxFileMb: MAX_FILE_MB_CEILING }).success,
    true
  );
  assert.equal(LimitsConfigSchema.safeParse({ ...base, commentsPerDay: 1.5 }).success, false);
  assert.equal(LimitsConfigSchema.safeParse({ ...base, resourcesPerDay: -1 }).success, false);
});

test("MB → 字节换算", () => {
  const bytes = limitsToBytes({ ...base, maxFileMb: 5, maxImageMb: 1, uploadQuotaMb: 1024 });
  assert.equal(bytes.maxFileBytes, 5 * 1024 * 1024);
  assert.equal(bytes.maxImageBytes, 1024 * 1024);
  assert.equal(bytes.uploadQuotaBytes, 1073741824);
});
