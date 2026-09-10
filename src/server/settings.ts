import "server-only";

import { cache } from "react";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_JOIN_CONFIG,
  JoinConfigSchema,
  type JoinConfig,
} from "@/lib/validators/join-config";
import {
  DEFAULT_LIMITS,
  LimitsConfigSchema,
  type LimitsConfig,
} from "@/lib/validators/limits";

/**
 * 站点级配置的读写。
 *
 * 存储：`SiteSetting` 键值表（value 是 Json）。之所以不每种配置建一张表，
 * 是因为配置项会零散地增加；类型安全由这里的 zod 校验保证 —— 数据库
 * 只负责"存住"，不负责"存对"。
 */

/** 「加入我们」配置在 SiteSetting 里的键 */
export const JOIN_CONFIG_KEY = "join";
/** 用量限额配置在 SiteSetting 里的键 */
export const LIMITS_KEY = "limits";

/**
 * 读一条配置，用给定的 schema 校验。
 *
 * 三种情况都退回默认值，绝不让页面因为配置问题挂掉：
 *   1. 从没配置过（没有这一行）
 *   2. 库里存的是旧版本结构 / 被手改坏了（zod 解析失败）
 *   3. 数据库暂时连不上（catch）
 */
async function readSetting<T>(
  key: string,
  schema: z.ZodType<T>,
  fallback: T
): Promise<T> {
  try {
    const row = await prisma.siteSetting.findUnique({
      where: { key },
      select: { value: true },
    });
    if (!row) return fallback;

    const parsed = schema.safeParse(row.value);
    if (!parsed.success) {
      console.warn(`[settings] ${key} 配置结构不合法，已回退默认值`);
      return fallback;
    }
    return parsed.data;
  } catch (err) {
    console.error(`[settings] 读取 ${key} 失败`, err);
    return fallback;
  }
}

async function writeSetting(key: string, value: object): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

/** 读「加入我们」配置 */
export const getJoinConfig = cache(() =>
  readSetting<JoinConfig>(JOIN_CONFIG_KEY, JoinConfigSchema, DEFAULT_JOIN_CONFIG)
);

/** 写「加入我们」配置（管理员已校验过权限与内容） */
export async function setJoinConfig(config: JoinConfig): Promise<void> {
  await writeSetting(JOIN_CONFIG_KEY, config);
}

/**
 * 读用量限额配置。
 *
 * 用 React cache 包一层：一次请求里上传接口可能查好几次（文件大小、次数、
 * 配额各一次），没有这层就会重复打库。
 */
export const getLimits = cache(() =>
  readSetting<LimitsConfig>(LIMITS_KEY, LimitsConfigSchema, DEFAULT_LIMITS)
);

/** 写用量限额配置 */
export async function setLimits(config: LimitsConfig): Promise<void> {
  await writeSetting(LIMITS_KEY, config);
}

/**
 * 列出可作为「加入我们」目标的已发布问卷。
 * 后台下拉框和 join-state 的校验共用。
 */
export async function listJoinableQuestionnaires() {
  return prisma.questionnaire.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      _count: { select: { questions: true, submissions: true } },
    },
  });
}
