import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  authenticateWithMicrosoft,
  verifyOAuthState,
  AuthError,
  describe,
} from "@/lib/auth/microsoft";
import { generateAttemptId } from "@/lib/auth/logger";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { recordAudit } from "@/server/audit";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  // 纵深防御：cookie 是 /api/auth/login 写的，那边已经校验过；
  // 但旧版本写下的 cookie 可能还在浏览器里，这里再挡一次。
  const redirectTo = safeRedirectPath(
    cookieStore.get("oauth_redirect")?.value,
    "/dashboard"
  );

  /*
    CSRF 防护：签名有效 **且** 与 cookie 里那份一致。
    单看签名是不够的 —— 那是无状态的，任何人自己走一遍授权流程就能拿到一个
    合法 state，再把它塞进链接诱导别人点（login CSRF）。
  */
  const stateCookie = cookieStore.get("oauth_state")?.value ?? null;
  if (!state || !verifyOAuthState(state, stateCookie)) {
    console.error("[auth] invalid_state");
    return redirectError(url, "invalid_state");
  }

  // state 一次性：用过就清掉，重放同一条链接不会再通过
  cookieStore.delete("oauth_state");

  if (!code) {
    return redirectError(url, "no_code");
  }

  const attemptId = generateAttemptId();

  try {
    const redirectUri = `${url.origin}/api/auth/callback`;
    const profile = await authenticateWithMicrosoft(code, redirectUri, attemptId);

    // 以 Microsoft 账号为登录身份，更新 / 关联 Minecraft 身份
    const user = await upsertUser(profile, attemptId);

    const session = await getSession();
    session.userId = user.id;
    // cookie 是无状态的，版本号是服务端唯一能"作废"它的手段（改密时 +1）
    session.sessionVersion = user.sessionVersion;
    await session.save();

    // 清除临时 OAuth cookie
    cookieStore.delete("oauth_redirect");

    return NextResponse.redirect(new URL(redirectTo, url.origin));
  } catch (err) {
    const codeName = err instanceof AuthError ? err.code : "unknown";
    console.error(`[auth:${attemptId}] ${codeName} — ${describe(err)}`);
    return redirectError(url, codeName);
  }
}

/** Prisma 唯一约束冲突（并发下先查后写会落空） */
function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

/**
 * 按 Microsoft 账号 / Minecraft UUID 找人或建人。
 *
 * ⚠️ 这里的第 2 步（按 UUID 关联已有账号）曾经是可以被**抢注**的：
 * `minecraftUuid` 允许用户自己手填、无人审核，于是攻击者可以先注册一个本地
 * 账号、把 UUID 填成受害者的，等受害者用 Microsoft 登录时就会被关联到
 * **攻击者那个账号**上（受害者的 MS 身份绑死了攻击者的账号，而攻击者还知道
 * 自己的密码）。现在补了三道：
 *   - 目标账号已经绑了**另一个** Microsoft 账号 → 直接拒绝，不覆盖
 *   - 关联写一条审计日志，事后查得到
 *   - 唯一键冲突翻译成可读错误，而不是 500
 */
async function upsertUser(
  profile: {
    uuid: string;
    username: string;
    microsoftAccountId: string;
  },
  attemptId: string
) {
  // 1. 已存在相同 Microsoft 账号 → 更新 Minecraft 身份
  const byMicrosoft = await prisma.user.findUnique({
    where: { microsoftAccountId: profile.microsoftAccountId },
  });

  if (byMicrosoft) {
    // 同一个 MS 账号换了 MC 角色：新 UUID 不能是别人的
    if (byMicrosoft.minecraftUuid !== profile.uuid) {
      const clash = await prisma.user.findUnique({
        where: { minecraftUuid: profile.uuid },
        select: { id: true },
      });
      if (clash && clash.id !== byMicrosoft.id) {
        throw new AuthError(
          "ACCOUNT_CONFLICT",
          "That Minecraft profile is bound to another account."
        );
      }
    }
    try {
      return await prisma.user.update({
        where: { id: byMicrosoft.id },
        data: {
          minecraftUuid: profile.uuid,
          minecraftUsername: profile.username,
        },
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new AuthError(
          "ACCOUNT_CONFLICT",
          "That Minecraft profile is bound to another account."
        );
      }
      throw err;
    }
  }

  // 2. 已存在相同 Minecraft UUID → 关联该 Microsoft 账号
  const byUuid = await prisma.user.findUnique({
    where: { minecraftUuid: profile.uuid },
  });

  if (byUuid) {
    // 已经绑着另一个 Microsoft 账号：这家 UUID 不属于当前这个人，拒绝
    if (byUuid.microsoftAccountId) {
      console.error(
        `[auth:${attemptId}] account_conflict — uuid already bound to another microsoft account`
      );
      throw new AuthError(
        "ACCOUNT_CONFLICT",
        "That Minecraft profile is bound to another account."
      );
    }

    const linked = await prisma.user.update({
      where: { id: byUuid.id },
      data: {
        microsoftAccountId: profile.microsoftAccountId,
        minecraftUsername: profile.username,
      },
    });

    // 自填 UUID 无人审核，这个关联动作必须留痕
    await recordAudit({
      action: "user.link_microsoft",
      actorId: linked.id,
      actorName: profile.username,
      targetType: "user",
      targetId: linked.id,
      targetLabel: profile.username,
      detail: { via: "minecraft_uuid", attemptId },
    });

    return linked;
  }

  // 3. 新用户
  try {
    return await prisma.user.create({
      data: {
        microsoftAccountId: profile.microsoftAccountId,
        minecraftUuid: profile.uuid,
        minecraftUsername: profile.username,
      },
    });
  } catch (err) {
    // 并发下第 1、2 步可能都落空，最终由唯一索引兜底
    if (isUniqueViolation(err)) {
      throw new AuthError(
        "ACCOUNT_CONFLICT",
        "That account is already registered."
      );
    }
    throw err;
  }
}

function redirectError(url: URL, error: string) {
  const loginUrl = new URL("/login", url.origin);
  loginUrl.searchParams.set("error", error);
  return NextResponse.redirect(loginUrl);
}
