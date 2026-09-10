"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { getCurrentUser, requireUser } from "@/server/auth";
import {
  AccountError,
  authenticateLocal,
  changeEmail,
  changeUsername,
  findUserByEmail,
  registerLocalAccount,
  setMinecraftIdentity,
  setPassword,
  setWearFrame,
  unbindMicrosoft,
} from "@/server/account";
import {
  EmailCodeError,
  issueEmailCode,
  verifyEmailCode,
  type CodePurpose,
} from "@/server/email-code";
import { addDailyCount, checkDailyLimit } from "@/server/limit";
import { anonymizeAccount, isLastAdmin } from "@/server/user-deletion";
import { recordAudit } from "@/server/audit";
import { verifyPassword } from "@/server/password";
import { prisma } from "@/lib/prisma";
import {
  ChangeUsernameSchema,
  CodeSchema,
  EmailSchema,
  LoginSchema,
  MinecraftIdentitySchema,
  PasswordResetSchema,
  RegisterSchema,
} from "@/lib/validators/auth";

/**
 * 账号相关的 Server Actions。
 *
 * 分工：action 只做「校验 + 调 server + 设置会话 + revalidate」，
 * 真正的业务在 @/server/account 与 @/server/email-code。
 *
 * 登录/注册都带一个**进程内的失败计数**：同一 IP 10 分钟内失败 8 次就拒绝。
 * 这只是挡住最粗糙的暴力破解 —— 进程重启会清零，多实例也不共享；
 * 要真正可靠得换成 Redis 或数据库计数。够这个规模用。
 *
 * 验证码的冷却与配额在 @/server/email-code 里（按邮箱算，落库）。
 */

export type AuthState = {
  ok: boolean;
  /** 机器可读的错误码，前端映射成本地化文案 */
  error?: string;
  /** 成功时给前端做跳转用 */
  redirectTo?: string;
  /** 需要用户去填验证码（注册 / 换绑 / 重置的第一步） */
  needsCode?: boolean;
  /** 该邮箱是否已有待验证的码 */
  codeSent?: boolean;
  /** 未配置 SMTP 的开发环境下把验证码带回来，方便本地联调 */
  devCode?: string;
  /** 账号已建好但邮件没发出去，前端据此提示"重新发送" */
  mailFailed?: boolean;
  /** 频次限制类错误带回的额度（例如每天能改几次用户名） */
  limit?: number;
};

/* ------------------------------------------------------------ 失败限流 */

const WINDOW_MS = 10 * 60_000;
const MAX_FAILS = 8;
const fails = new Map<string, { count: number; resetAt: number }>();

async function throttleKey(scope: string): Promise<string> {
  return `${scope}:${await requestIp()}`;
}

/** 请求来源 IP（用于限流 + 写进验证码邮件里） */
async function requestIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip")?.trim() || "unknown";
}

function isThrottled(key: string): boolean {
  const row = fails.get(key);
  if (!row) return false;
  if (row.resetAt < Date.now()) {
    fails.delete(key);
    return false;
  }
  return row.count >= MAX_FAILS;
}

function noteFail(key: string): void {
  const now = Date.now();
  const row = fails.get(key);
  if (!row || row.resetAt < now) {
    fails.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  row.count += 1;
}

function clearFails(key: string): void {
  fails.delete(key);
}

/** 定期清掉过期条目，避免 Map 无上限增长 */
function sweep(): void {
  const now = Date.now();
  for (const [key, row] of fails) {
    if (row.resetAt < now) fails.delete(key);
  }
}

/* ---------------------------------------------------------------- 注册 */

/**
 * 注册第一步：**只校验 + 发验证码，不建账号**。
 *
 * 账号在第二步（验证码通过）才创建。这样有两个好处：
 *   - 邮箱没验证就**不可能**有账号 —— 满足"注册必须绑定邮箱"
 *   - 别人拿你的邮箱也没法抢注：未验证的邮箱不占唯一索引，
 *     你自己随时还能用同一个邮箱注册
 *
 * 用户名 / 邮箱的占用情况在这里先查一次给即时反馈，
 * 第二步建号前会再查一次（防并发抢注）。
 */
export async function registerAction(input: {
  username: string;
  email: string;
  password: string;
  confirm: string;
}): Promise<AuthState> {
  sweep();
  const key = await throttleKey("register");
  if (isThrottled(key)) return { ok: false, error: "TOO_MANY" };

  if (input.password !== input.confirm) {
    return { ok: false, error: "PASSWORD_MISMATCH" };
  }

  const parsed = RegisterSchema.safeParse({
    username: input.username,
    email: input.email,
    password: input.password,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path?.[0];
    const code = issue?.message;
    // 把「哪个字段 + 什么错」拼成错误码，前端据此挑文案
    if (field === "email") return { ok: false, error: "EMAIL_INVALID" };
    if (field === "password") {
      return { ok: false, error: `PASSWORD_${code ?? "INVALID"}` };
    }
    return { ok: false, error: `USERNAME_${code ?? "INVALID"}` };
  }

  // 先查占用，给"用户名/邮箱已被使用"这种能看懂的即时反馈
  const [byName, byEmail] = await Promise.all([
    prisma.user.findUnique({
      where: { username: parsed.data.username },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    }),
  ]);
  if (byName) return { ok: false, error: "USERNAME_TAKEN" };
  if (byEmail) return { ok: false, error: "EMAIL_TAKEN" };

  try {
    const res = await issueEmailCode({
      email: parsed.data.email,
      purpose: "register",
      ip: await requestIp(),
    });
    return { ok: true, needsCode: true, codeSent: true, devCode: res.devCode };
  } catch (err) {
    if (err instanceof EmailCodeError) return { ok: false, error: err.code };
    console.error("[registerAction]", err);
    return { ok: false, error: "UNKNOWN" };
  }
}

/**
 * 注册第二步：**验证码通过才建账号**，建完直接登录。
 *
 * 密码在两步之间放在客户端内存里（同一次填写，没有再存一份到服务端），
 * 所以这里要重新完整校验一遍 —— 客户端传回来的东西一律不可信。
 */
export async function completeRegistrationAction(input: {
  username: string;
  email: string;
  password: string;
  code: string;
}): Promise<AuthState> {
  const key = await throttleKey("register");
  if (isThrottled(key)) return { ok: false, error: "TOO_MANY" };

  const parsed = RegisterSchema.safeParse({
    username: input.username,
    email: input.email,
    password: input.password,
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path?.[0];
    if (field === "email") return { ok: false, error: "EMAIL_INVALID" };
    return { ok: false, error: "UNKNOWN" };
  }

  const code = CodeSchema.safeParse(input.code);
  if (!code.success) return { ok: false, error: "CODE_INVALID_CODE" };

  // 1. 验证码必须对（这一步没过就绝对不会建号）
  try {
    await verifyEmailCode({
      email: parsed.data.email,
      purpose: "register",
      code: code.data,
    });
  } catch (err) {
    if (err instanceof EmailCodeError) {
      noteFail(key);
      return { ok: false, error: `CODE_${err.code}` };
    }
    console.error("[completeRegistrationAction:verify]", err);
    return { ok: false, error: "UNKNOWN" };
  }

  // 2. 再查一次占用（第一步到现在可能被别人抢先）
  try {
    const { id } = await registerLocalAccount(parsed.data);
    const session = await getSession();
    session.userId = id;
    await session.save();
    clearFails(key);
    return { ok: true, redirectTo: "/dashboard/settings" };
  } catch (err) {
    if (err instanceof AccountError) return { ok: false, error: err.code };
    console.error("[completeRegistrationAction]", err);
    return { ok: false, error: "UNKNOWN" };
  }
}

/* ------------------------------------------------------- 邮箱验证码 */

/**
 * 发送验证码。
 *   - purpose="bind"：注册后验证邮箱 / 个人中心换绑新邮箱
 *   - purpose="reset"：忘记密码
 *
 * 注意 bind 的两种场景目标邮箱不同：注册后验的是**当前账号的邮箱**，
 * 换绑验的是**新邮箱**。所以这里显式接收 email，只做格式校验，
 * 归属由后面的 verifyEmailCode + changeEmail 保证。
 */
export async function sendEmailCodeAction(input: {
  email: string;
  purpose: CodePurpose;
}): Promise<AuthState> {
  const parsedEmail = EmailSchema.safeParse(input.email);
  if (!parsedEmail.success) return { ok: false, error: "EMAIL_INVALID" };
  if (!["register", "bind", "reset"].includes(input.purpose)) {
    return { ok: false, error: "UNKNOWN" };
  }

  const email = parsedEmail.data;
  const user = await getCurrentUser();

  // register：未登录也能发，但**邮箱必须还没被占用**
  if (input.purpose === "register") {
    const taken = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (taken) return { ok: false, error: "EMAIL_TAKEN" };

    try {
      const res = await issueEmailCode({
        email,
        purpose: "register",
        ip: await requestIp(),
      });
      return { ok: true, codeSent: true, devCode: res.devCode };
    } catch (err) {
      if (err instanceof EmailCodeError) return { ok: false, error: err.code };
      console.error("[sendEmailCodeAction:register]", err);
      return { ok: false, error: "UNKNOWN" };
    }
  }

  // reset：无论邮箱是否存在都回 ok，避免被用来枚举账号
  if (input.purpose === "reset") {
    const target = await findUserByEmail(email);
    if (!target) return { ok: true, codeSent: true };

    try {
      const res = await issueEmailCode({
        email,
        purpose: "reset",
        userId: target.id,
        ip: await requestIp(),
      });
      return { ok: true, codeSent: true, devCode: res.devCode };
    } catch (err) {
      if (err instanceof EmailCodeError) return { ok: false, error: err.code };
      console.error("[sendEmailCodeAction:reset]", err);
      return { ok: false, error: "UNKNOWN" };
    }
  }

  // bind：必须登录
  if (!user) return { ok: false, error: "UNAUTHORIZED" };
  // 验证自己的当前邮箱时直接放行；换绑则校验新邮箱没被别人占用
  if (email !== (user.email ?? "").toLowerCase()) {
    const taken = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (taken && taken.id !== user.id) {
      return { ok: false, error: "EMAIL_TAKEN" };
    }
  }

  try {
    const res = await issueEmailCode({
      email,
      purpose: "bind",
      userId: user.id,
      ip: await requestIp(),
    });
    return { ok: true, codeSent: true, devCode: res.devCode };
  } catch (err) {
    if (err instanceof EmailCodeError) return { ok: false, error: err.code };
    console.error("[sendEmailCodeAction:bind]", err);
    return { ok: false, error: "UNKNOWN" };
  }
}

/** 用验证码验证并绑定新邮箱（注册后验证 / 换绑都走这里） */
export async function verifyEmailAction(input: {
  email: string;
  code: string;
}): Promise<AuthState> {
  const user = await requireUser();

  const parsedEmail = EmailSchema.safeParse(input.email);
  const parsedCode = CodeSchema.safeParse(input.code);
  if (!parsedEmail.success) return { ok: false, error: "EMAIL_INVALID" };
  if (!parsedCode.success) return { ok: false, error: "CODE_INVALID_CODE" };

  try {
    const verified = await verifyEmailCode({
      email: parsedEmail.data,
      purpose: "bind",
      code: parsedCode.data,
    });
    // 验证码必须属于当前登录的人，否则 A 可以用 B 的邮箱验证码
    if (verified.userId && verified.userId !== user.id) {
      return { ok: false, error: "CODE_NOT_FOUND" };
    }
    await changeEmail(user.id, parsedEmail.data);
  } catch (err) {
    if (err instanceof EmailCodeError) return { ok: false, error: `CODE_${err.code}` };
    if (err instanceof AccountError) return { ok: false, error: err.code };
    console.error("[verifyEmailAction]", err);
    return { ok: false, error: "UNKNOWN" };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath(`/u/${user.id}`);
  return { ok: true };
}

/* ------------------------------------------------------------ 改用户名 */

/** 改用户名。非管理员每天只能改一次。 */
export async function changeUsernameAction(input: {
  username: string;
}): Promise<AuthState> {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  const parsed = ChangeUsernameSchema.safeParse(input);
  if (!parsed.success) {
    const code = parsed.error.issues[0]?.message;
    return { ok: false, error: `USERNAME_${code ?? "INVALID"}` };
  }

  // 没变就直接成功，不消耗当天额度
  if (parsed.data.username === user.username) return { ok: true };

  const limit = await checkDailyLimit(user.id, "username", isAdmin);
  if (!limit.allowed) {
    return { ok: false, error: "USERNAME_COOLDOWN", limit: limit.limit };
  }

  try {
    await changeUsername(user.id, parsed.data.username);
    await addDailyCount(user.id, "username", isAdmin);
  } catch (err) {
    if (err instanceof AccountError) return { ok: false, error: err.code };
    console.error("[changeUsernameAction]", err);
    return { ok: false, error: "UNKNOWN" };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  revalidatePath(`/u/${user.id}`);
  return { ok: true };
}

/* ---------------------------------------------------------- 忘记密码 */

/** 第二步：带验证码设置新密码。不需要登录。 */
export async function resetPasswordAction(input: {
  email: string;
  code: string;
  password: string;
}): Promise<AuthState> {
  const key = await throttleKey("reset");
  if (isThrottled(key)) return { ok: false, error: "TOO_MANY" };

  const parsed = PasswordResetSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path?.[0];
    if (field === "email") return { ok: false, error: "EMAIL_INVALID" };
    if (field === "code") return { ok: false, error: "CODE_INVALID_CODE" };
    return { ok: false, error: `PASSWORD_${issue?.message ?? "INVALID"}` };
  }

  const target = await findUserByEmail(parsed.data.email);
  if (!target) {
    noteFail(key);
    return { ok: false, error: "CODE_NOT_FOUND" };
  }

  try {
    const verified = await verifyEmailCode({
      email: parsed.data.email,
      purpose: "reset",
      code: parsed.data.code,
    });
    if (!verified.userId || verified.userId !== target.id) {
      noteFail(key);
      return { ok: false, error: "CODE_NOT_FOUND" };
    }
    await setPassword(target.id, parsed.data.password);
  } catch (err) {
    if (err instanceof EmailCodeError) {
      noteFail(key);
      return { ok: false, error: `CODE_${err.code}` };
    }
    console.error("[resetPasswordAction]", err);
    return { ok: false, error: "UNKNOWN" };
  }

  clearFails(key);
  return { ok: true, redirectTo: "/login" };
}

/* ---------------------------------------------------------------- 登录 */

export async function loginAction(input: {
  identifier: string;
  password: string;
}): Promise<AuthState> {
  sweep();
  const key = await throttleKey("login");
  if (isThrottled(key)) return { ok: false, error: "TOO_MANY" };

  const parsed = LoginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_CREDENTIALS" };

  try {
    const { id } = await authenticateLocal(
      parsed.data.identifier,
      parsed.data.password
    );
    const session = await getSession();
    session.userId = id;
    await session.save();
    clearFails(key);
    return { ok: true, redirectTo: "/dashboard" };
  } catch (err) {
    if (err instanceof AccountError) {
      noteFail(key);
      return { ok: false, error: err.code };
    }
    console.error("[loginAction]", err);
    return { ok: false, error: "UNKNOWN" };
  }
}

/* -------------------------------------------------- 个人中心：资料修改 */

export async function saveMinecraftIdentityAction(input: {
  minecraftUsername: string;
  minecraftUuid: string;
}): Promise<AuthState> {
  const user = await requireUser();

  const parsed = MinecraftIdentitySchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path?.[0];
    const code = issue?.message;
    return {
      ok: false,
      error: `${field === "minecraftUuid" ? "UUID" : "NAME"}_${code ?? "INVALID"}`,
    };
  }

  try {
    await setMinecraftIdentity(user.id, parsed.data);
  } catch (err) {
    if (err instanceof AccountError) return { ok: false, error: err.code };
    console.error("[saveMinecraftIdentityAction]", err);
    return { ok: false, error: "UNKNOWN" };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  revalidatePath(`/u/${user.id}`);
  revalidatePath("/resources");
  return { ok: true };
}

export async function setWearFrameAction(wear: boolean): Promise<AuthState> {
  const user = await requireUser();

  try {
    await setWearFrame(user.id, wear);
  } catch (err) {
    console.error("[setWearFrameAction]", err);
    return { ok: false, error: "UNKNOWN" };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  revalidatePath(`/u/${user.id}`);
  return { ok: true };
}

export async function unbindMicrosoftAction(): Promise<AuthState> {
  const user = await requireUser();

  try {
    await unbindMicrosoft(user.id);
  } catch (err) {
    console.error("[unbindMicrosoftAction]", err);
    return { ok: false, error: "UNKNOWN" };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath(`/u/${user.id}`);
  return { ok: true };
}

/* ---------------------------------------------------------------- 登出 */

export async function logoutAction(): Promise<AuthState> {
  const session = await getSession();
  session.destroy();
  return { ok: true, redirectTo: "/" };
}

/* ------------------------------------------------------------ 注销账号 */

/**
 * 用户自己注销账号。
 *
 * 二次确认要求**输入账号名 + 当前密码**（有密码的话）—— 这是不可逆操作，
 * 点错一次就回不来了，值得多打几个字。
 *
 * 注销后：身份信息全部抹除、永久无法登录，但**发过的资源与评论保留**，
 * 作者显示为「已注销用户」。问卷提交（含个人信息）会删掉。
 */
export async function deleteOwnAccountAction(input: {
  confirmName: string;
  password: string;
}): Promise<AuthState> {
  const user = await requireUser();

  // 最后一个管理员不能注销，否则后台彻底进不去
  if (await isLastAdmin(user.id)) {
    return { ok: false, error: "LAST_ADMIN" };
  }

  // 有密码就必须验密码；纯 Microsoft 账号没有密码，只靠名字确认
  if (user.username) {
    if (input.confirmName.trim().toLowerCase() !== user.username.toLowerCase()) {
      return { ok: false, error: "CONFIRM_MISMATCH" };
    }
  } else if (!input.confirmName.trim()) {
    return { ok: false, error: "CONFIRM_MISMATCH" };
  }

  // CurrentUser 不带 hash（没必要到处传），单独取一次
  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (record?.passwordHash) {
    const ok = await verifyPassword(input.password, record.passwordHash);
    if (!ok) return { ok: false, error: "INVALID_CREDENTIALS" };
  }
  try {
    await anonymizeAccount(user.id);
  } catch (err) {
    console.error("[deleteOwnAccountAction]", err);
    return { ok: false, error: "UNKNOWN" };
  }

  await recordAudit({
    action: "user.anonymize",
    actorId: user.id,
    actorName: user.minecraftUsername ?? user.username ?? null,
    targetType: "user",
    targetId: user.id,
    targetLabel: user.minecraftUsername ?? user.username ?? user.id,
    detail: { self: true },
  });

  // 注销完会话也一起销毁
  const session = await getSession();
  session.destroy();
  return { ok: true, redirectTo: "/" };
}
