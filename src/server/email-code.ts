import "server-only";

import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "./password";
import { isMailConfigured, sendMail, verificationMail } from "./mailer";
import { CODE_LENGTH, CODE_TTL_MINUTES } from "@/lib/code";

/**
 * 邮箱验证码的签发与校验。
 *
 * 规则：
 *   - 6 位数字，10 分钟有效，单次消费
 *   - 同一个验证码最多校验 5 次（防止在一批码上撞库）
 *   - 同一邮箱 60 秒内只能发一次；每小时最多 5 封
 *   - 明文不落库，只存 scrypt 哈希
 *
 * 位数与有效期从 @/lib/code 读，客户端展示用的是同一份常量。
 */

const TTL_MINUTES = CODE_TTL_MINUTES;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60_000;
const MAX_PER_HOUR = 5;

/**
 * 验证码用途：
 *   - "register" 注册（邮箱**必须未被占用**；未登录可用）
 *   - "bind"     绑定 / 换绑邮箱（**要求登录**）
 *   - "reset"    忘记密码（邮箱已注册才发；未登录可用）
 */
export type CodePurpose = "register" | "bind" | "reset";

export const CODE_TTL = TTL_MINUTES;

export class EmailCodeError extends Error {
  constructor(
    message: string,
    readonly code:
      | "TOO_SOON"
      | "TOO_MANY"
      | "NOT_FOUND"
      | "EXPIRED"
      | "WRONG_CODE"
      | "MAIL_NOT_CONFIGURED"
      | "MAIL_FAILED"
  ) {
    super(message);
    this.name = "EmailCodeError";
  }
}

function generateCode(): string {
  // randomInt 是密码学安全的，不踩 Math.random
  const max = 10 ** CODE_LENGTH;
  return String(randomInt(0, max)).padStart(CODE_LENGTH, "0");
}

export interface IssuedCode {
  /** 仅开发环境（未配置 SMTP）时回传，方便本地联调 */
  devCode?: string;
}

/**
 * 发一个验证码到指定邮箱。
 * userId 只有 reset 流程需要（知道要改谁的密码）。
 */
export async function issueEmailCode(input: {
  email: string;
  purpose: CodePurpose;
  userId?: string | null;
  /** 请求来源 IP，写进邮件里让收件人判断"是不是我" */
  ip?: string | null;
}): Promise<IssuedCode> {
  const email = input.email.trim().toLowerCase();
  const now = Date.now();

  // 冷却：避免连点"发送验证码"
  const latest = await prisma.emailCode.findFirst({
    where: { email, purpose: input.purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (latest && now - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    throw new EmailCodeError("Please wait before requesting another code.", "TOO_SOON");
  }

  // 每小时上限：防止被当成邮件炸弹的跳板
  const lastHour = await prisma.emailCode.count({
    where: { email, purpose: input.purpose, createdAt: { gt: new Date(now - 3_600_000) } },
  });
  if (lastHour >= MAX_PER_HOUR) {
    throw new EmailCodeError("Too many codes requested.", "TOO_MANY");
  }

  const code = generateCode();
  const codeHash = await hashPassword(code);

  // 作废该邮箱此前未用的同类验证码：同时只有最新一个有效
  await prisma.emailCode.updateMany({
    where: { email, purpose: input.purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  await prisma.emailCode.create({
    data: {
      email,
      purpose: input.purpose,
      codeHash,
      userId: input.userId ?? null,
      expiresAt: new Date(now + TTL_MINUTES * 60_000),
    },
  });

  const mail = verificationMail(code, TTL_MINUTES, input.purpose, {
    ip: input.ip ?? null,
    requestedAt: new Date(),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() || undefined,
  });
  const result = await sendMail({
    to: email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    devCode: code,
  });

  return { devCode: result.devCode };
}

export interface VerifiedCode {
  /** reset 流程里验证码对应的人 */
  userId: string | null;
}

/**
 * 校验验证码。成功即标记为已消费（单次使用）。
 * 校验通过后由调用方决定干什么（绑定邮箱 / 改密码）。
 */
export async function verifyEmailCode(input: {
  email: string;
  purpose: CodePurpose;
  code: string;
}): Promise<VerifiedCode> {
  const email = input.email.trim().toLowerCase();
  const code = input.code.trim();

  const row = await prisma.emailCode.findFirst({
    where: { email, purpose: input.purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      codeHash: true,
      attempts: true,
      expiresAt: true,
      userId: true,
    },
  });

  if (!row) throw new EmailCodeError("No pending code.", "NOT_FOUND");
  if (row.expiresAt.getTime() < Date.now()) {
    await prisma.emailCode.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    });
    throw new EmailCodeError("Code expired.", "EXPIRED");
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    throw new EmailCodeError("Too many attempts.", "TOO_MANY");
  }

  const ok = await verifyPassword(code, row.codeHash);
  if (!ok) {
    await prisma.emailCode.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } },
    });
    throw new EmailCodeError("Wrong code.", "WRONG_CODE");
  }

  await prisma.emailCode.update({
    where: { id: row.id },
    data: { consumedAt: new Date() },
  });

  return { userId: row.userId };
}

/** 是否存在一个还有效、还能试的验证码（前端据此决定显示哪一步） */
export async function hasPendingCode(
  email: string,
  purpose: CodePurpose
): Promise<boolean> {
  const row = await prisma.emailCode.findFirst({
    where: {
      email: email.trim().toLowerCase(),
      purpose,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  return Boolean(row);
}

/** 给前端提示用：SMTP 有没有配 */
export function mailReady(): boolean {
  return isMailConfigured();
}
