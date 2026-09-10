import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dummyVerify, hashPassword, verifyPassword } from "./password";

/**
 * 本地账号（用户名 + 邮箱 + 密码）。
 *
 * 为什么要有它：Microsoft OAuth 目前被 Mojang 的 AppID 白名单卡着
 * （MC_APP_NOT_APPROVED），一条路走不通整个站点就没人能登录。
 * 所以本地账号是**主入口**，Microsoft 变成可选的加分项。
 *
 * 安全要点：
 *   - 密码只存 scrypt 哈希（见 password.ts），不可逆
 *   - 登录失败时账号不存在也走一次假校验，避免用响应时间探测账号是否存在
 *   - 用户名统一小写，避免 "Alice"/"alice" 两个账号
 */

export class AccountError extends Error {
  constructor(
    message: string,
    readonly code:
      | "USERNAME_TAKEN"
      | "EMAIL_TAKEN"
      | "INVALID_CREDENTIALS"
      | "NOT_FOUND"
      | "UUID_TAKEN"
      | "UNKNOWN"
  ) {
    super(message);
    this.name = "AccountError";
  }
}
/* ------------------------------------------------------------------ 注册 */

/**
 * 创建本地账号。
 *
 * **调用方必须先验过邮箱验证码** —— 注册流程是"验证码通过才建号",
 * 所以这里直接把 `emailVerifiedAt` 打上，不存在"建了号但邮箱没验"的中间态。
 */
export async function registerLocalAccount(input: {
  username: string;
  email: string;
  password: string;
}): Promise<{ id: string }> {
  const username = input.username.trim().toLowerCase();
  const email = input.email.trim().toLowerCase();

  // 先查一遍，为了给用户"哪个字段重了"这种能看懂的提示
  const [byName, byEmail] = await Promise.all([
    prisma.user.findUnique({ where: { username }, select: { id: true } }),
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
  ]);
  if (byName) throw new AccountError("Username already taken.", "USERNAME_TAKEN");
  if (byEmail) throw new AccountError("Email already registered.", "EMAIL_TAKEN");

  const passwordHash = await hashPassword(input.password);

  try {
    return await prisma.user.create({
      data: {
        username,
        email,
        emailVerifiedAt: new Date(),
        passwordHash,
      },
      select: { id: true },
    });
  } catch (err) {
    // 并发下上面的检查可能落空，最终仍由唯一索引兜底
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const target = Array.isArray(err.meta?.target)
        ? (err.meta.target as string[])
        : [];
      if (target.includes("email")) {
        throw new AccountError("Email already registered.", "EMAIL_TAKEN");
      }
      throw new AccountError("Username already taken.", "USERNAME_TAKEN");
    }
    throw err;
  }
}

/* ------------------------------------------------------------------ 登录 */

/** 用账号名或邮箱 + 密码登录，成功返回 userId */
export async function authenticateLocal(
  identifier: string,
  password: string
): Promise<{ id: string }> {
  const raw = identifier.trim();
  const lower = raw.toLowerCase();

  const user = await prisma.user.findFirst({
    where: { OR: [{ username: lower }, { email: lower }] },
    select: { id: true, passwordHash: true },
  });

  if (!user) {
    // 陪跑：让"账号不存在"和"密码错误"耗时接近
    await dummyVerify(password);
    throw new AccountError("Invalid credentials.", "INVALID_CREDENTIALS");
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    throw new AccountError("Invalid credentials.", "INVALID_CREDENTIALS");
  }

  return { id: user.id };
}

/* -------------------------------------------------- 手动填 Minecraft 身份 */

/**
 * 把 UUID 规范成"无连字符小写"的存储形式。
 *
 * **必须在这一层也做**，不能只靠 zod 的 transform：唯一索引是按字符串比的，
 * `11111111-2222-…` 和 `111111112222…` 会被当成两个值，于是同一个人可以
 * 用两种写法各绑一次，唯一约束形同虚设。冒烟测试就是靠这个抓出来的。
 */
function normalizeUuid(raw: string): string | null {
  const stripped = raw.replace(/-/g, "").trim().toLowerCase();
  return stripped === "" ? null : stripped;
}

/**
 * 用户自己填写游戏 ID / UUID。
 * 不做审核（也审核不了），但 UUID 仍然保持全局唯一，避免两个人抢同一张皮肤。
 */
export async function setMinecraftIdentity(
  userId: string,
  input: { minecraftUsername: string; minecraftUuid: string }
): Promise<void> {
  const name = input.minecraftUsername.trim();
  const uuid = normalizeUuid(input.minecraftUuid);

  if (uuid) {
    const taken = await prisma.user.findUnique({
      where: { minecraftUuid: uuid },
      select: { id: true },
    });
    if (taken && taken.id !== userId) {
      throw new AccountError("UUID already bound.", "UUID_TAKEN");
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { minecraftUsername: name, minecraftUuid: uuid },
  });
}

/** 解除 Microsoft 绑定（Minecraft 身份保留，头像框会随之消失） */
export async function unbindMicrosoft(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { microsoftAccountId: null },
  });
}

/* -------------------------------------------------------------- 头像框 */

/** 设置是否佩戴头像框（只有绑定了 Microsoft 的账号才有框，这里只管"戴不戴"） */
export async function setWearFrame(
  userId: string,
  wear: boolean
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { wearFrame: wear },
  });
}

/* ------------------------------------------------------------ 改用户名 */

/**
 * 改用户名。
 * 频次限制（非管理员每天 1 次）由调用方用 @/server/limit 控制 ——
 * 这里只负责唯一性与写库。
 */
export async function changeUsername(
  userId: string,
  newUsername: string
): Promise<{ username: string }> {
  const username = newUsername.trim().toLowerCase();

  const taken = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (taken && taken.id !== userId) {
    throw new AccountError("Username already taken.", "USERNAME_TAKEN");
  }

  await prisma.user.update({ where: { id: userId }, data: { username } });
  return { username };
}

/* -------------------------------------------------------------- 邮箱 */

/**
 * 换绑邮箱。
 * **调用方必须先用 verifyEmailCode 校验过新邮箱的验证码** —— 这里只落库，
 * 顺手把 emailVerifiedAt 打上（刚验过就是已验证）。
 */
export async function changeEmail(
  userId: string,
  newEmail: string
): Promise<{ email: string }> {
  const email = newEmail.trim().toLowerCase();

  const taken = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (taken && taken.id !== userId) {
    throw new AccountError("Email already registered.", "EMAIL_TAKEN");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { email, emailVerifiedAt: new Date() },
  });
  return { email };
}

/** 按邮箱找人（忘记密码流程用）。找不到返回 null。 */
export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, username: true, email: true, passwordHash: true },
  });
}

/** 重置密码（调用方负责先验验证码） */
export async function setPassword(
  userId: string,
  newPassword: string
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });
}

/** 是否设置过密码。纯 Microsoft 账号没有密码，注销确认时不用填。 */
export async function hasPasswordSet(userId: string): Promise<boolean> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  return Boolean(row?.passwordHash);
}
