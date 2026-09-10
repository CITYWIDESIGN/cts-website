import { NextResponse } from "next/server";
import { cookies } from "next/headers";
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

  // CSRF 防护：验证 state 签名（无状态，无需 cookie）
  if (!state || !verifyOAuthState(state)) {
    console.error("[auth] invalid_state");
    return redirectError(url, "invalid_state");
  }

  if (!code) {
    return redirectError(url, "no_code");
  }

  const attemptId = generateAttemptId();

  try {
    const redirectUri = `${url.origin}/api/auth/callback`;
    const profile = await authenticateWithMicrosoft(code, redirectUri, attemptId);

    // 以 Microsoft 账号为登录身份，更新 / 关联 Minecraft 身份
    const user = await upsertUser(profile);

    const session = await getSession();
    session.userId = user.id;
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

async function upsertUser(profile: {
  uuid: string;
  username: string;
  microsoftAccountId: string;
}) {
  // 1. 已存在相同 Microsoft 账号 → 更新 Minecraft 身份
  const byMicrosoft = await prisma.user.findUnique({
    where: { microsoftAccountId: profile.microsoftAccountId },
  });

  if (byMicrosoft) {
    return prisma.user.update({
      where: { id: byMicrosoft.id },
      data: {
        minecraftUuid: profile.uuid,
        minecraftUsername: profile.username,
      },
    });
  }

  // 2. 已存在相同 Minecraft UUID → 关联该 Microsoft 账号
  const byUuid = await prisma.user.findUnique({
    where: { minecraftUuid: profile.uuid },
  });

  if (byUuid) {
    return prisma.user.update({
      where: { id: byUuid.id },
      data: {
        microsoftAccountId: profile.microsoftAccountId,
        minecraftUsername: profile.username,
      },
    });
  }

  // 3. 新用户
  return prisma.user.create({
    data: {
      microsoftAccountId: profile.microsoftAccountId,
      minecraftUuid: profile.uuid,
      minecraftUsername: profile.username,
    },
  });
}

function redirectError(url: URL, error: string) {
  const loginUrl = new URL("/login", url.origin);
  loginUrl.searchParams.set("error", error);
  return NextResponse.redirect(loginUrl);
}
