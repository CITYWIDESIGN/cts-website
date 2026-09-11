import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  Download,
  FolderArchive,
  Heart,
  MessageSquare,
  ShieldOff,
  CalendarDays,
} from "lucide-react";
import { getCurrentUser } from "@/server/auth";
import { getUserProfile } from "@/server/stats";
import { isBanned } from "@/server/ban";
import { SkinHead } from "@/components/skin/skin-head";
import { AvatarFrame, avatarInnerSize } from "@/components/user/avatar-frame";
import { UserBanDialog } from "@/components/admin/user-ban-dialog";
import { BackLink } from "@/components/back-link";
import { Badge } from "@/components/ui/badge";
import { PageEnter, Stagger, StaggerItem } from "@/components/motion/stagger";
import { skinRawUrl } from "@/lib/skin";
import { formatBytes, formatDateTime, formatUuid } from "@/lib/format";

/**
 * 用户资料页 —— **公开页面**，任何访客都能打开（不要求登录，也不要求是管理员）。
 *
 * 因此这里**不展示**任何私密信息：不显示 microsoftAccountId、不显示邮箱。
 * 封禁状态对外可见（让其他人知道此人被禁），但**封禁理由只给管理员看**，
 * 避免把处罚细节公开成一堵墙。
 *
 * 封禁/解封操作按钮只对管理员渲染。
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const profile = await getUserProfile(id);
  const t = await getTranslations("profile");
  if (!profile) return { title: t("notFound") };
  return {
    title: `${profile.minecraftUsername ?? t("anonymous")} · ${t("title")}`,
  };
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [profile, viewer, t, common] = await Promise.all([
    getUserProfile(id),
    getCurrentUser(),
    getTranslations("profile"),
    getTranslations("common"),
  ]);

  if (!profile) notFound();

  const banned = isBanned(profile);
  const viewerIsAdmin = viewer?.role === "ADMIN";
  const name = profile.minecraftUsername ?? t("anonymous");

  const stats = [
    { key: "comments", icon: MessageSquare, value: profile.comments },
    { key: "resources", icon: FolderArchive, value: profile.resourceCount },
    { key: "downloads", icon: Download, value: profile.downloads },
  ] as const;

  return (
    <PageEnter className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
      <Stagger inView={false} stagger={0.09} className="flex flex-col gap-8">
        {/* 头部：头像 + 名字 + 状态 */}
        <StaggerItem index={0}>
          <div className="flex flex-col gap-5 rounded-2xl border bg-card p-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              {/* 绑定了 Microsoft 的人会戴着头像框 */}
              {profile.framed ? (
                <AvatarFrame size={96}>
                  {skinRawUrl(profile.minecraftUuid) ? (
                    <SkinHead
                      skinUrl={skinRawUrl(profile.minecraftUuid)}
                      alt={name}
                      size={avatarInnerSize(96)}
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center text-3xl font-semibold text-primary">
                      {name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </AvatarFrame>
              ) : (
                <span className="relative block size-24 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {skinRawUrl(profile.minecraftUuid) ? (
                    <SkinHead
                      skinUrl={skinRawUrl(profile.minecraftUuid)}
                      alt={name}
                      size={96}
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center text-3xl font-semibold text-primary">
                      {name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>
              )}

              <div className="min-w-0 sm:hidden">
                <ProfileTitle name={name} role={profile.role} />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="hidden sm:block">
                <ProfileTitle name={name} role={profile.role} />
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" />
                  {t("joined", { date: formatDateTime(profile.createdAt) })}
                </span>
                {/* 本地账号名：没填游戏 ID 时它就是唯一的身份显示 */}
                {profile.username && (
                  <span className="font-mono">@{profile.username}</span>
                )}
                {profile.minecraftUuid && (
                  <span className="font-mono">
                    {formatUuid(profile.minecraftUuid)}
                  </span>
                )}
              </div>

              {banned && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                    <ShieldOff className="size-3.5" />
                    {t("banned")}
                  </span>
                  {viewerIsAdmin && profile.banReason && (
                    <span className="text-xs text-muted-foreground">
                      {t("banReason", { reason: profile.banReason })}
                    </span>
                  )}
                </div>
              )}
            </div>

            {viewerIsAdmin && viewer?.id !== profile.id && (
              <div className="shrink-0">
                <UserBanDialog
                  userId={profile.id}
                  name={profile.minecraftUsername}
                  banned={banned}
                  bannedUntil={
                    profile.bannedUntil ? profile.bannedUntil.toISOString() : null
                  }
                  banReason={profile.banReason}
                />
              </div>
            )}
          </div>
        </StaggerItem>

        {/* 活跃度 */}
        <StaggerItem index={1}>
          <div className="grid gap-4 sm:grid-cols-3">
            {stats.map(({ key, icon: Icon, value }) => (
              <div
                key={key}
                className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-4.5" />
                </span>
                <div>
                  <p className="text-xl font-semibold tabular-nums">{value}</p>
                  <p className="text-xs text-muted-foreground">{t(key)}</p>
                </div>
              </div>
            ))}
          </div>
        </StaggerItem>

        {/* 发布的资源 */}
        <StaggerItem index={2} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">
            {t("published")}
            <span className="ml-2 text-muted-foreground tabular-nums">
              {profile.resourceCount}
            </span>
          </h2>

          {profile.resources.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              {t("noResources")}
            </p>
          ) : (
            <>
              <ul className="flex flex-col gap-2">
                {profile.resources.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/resources/${r.id}`}
                      className="group/row flex items-center gap-4 rounded-xl border px-4 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-accent/40"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{r.title}</span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {formatBytes(r.fileSize)} · {formatDateTime(r.createdAt)}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Heart className="size-3.5" />
                          <span className="tabular-nums">{r.likeCount}</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="size-3.5" />
                          <span className="tabular-nums">{r.commentCount}</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Download className="size-3.5" />
                          <span className="tabular-nums">{r.downloads}</span>
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {/* 只展示最近 N 条，剩下的给出入口 —— 不声不响地截断会让人以为"就这么多" */}
              {profile.truncated && (
                <Link
                  href="/resources"
                  className="self-start text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  {t("moreResources", { count: profile.resourceCount })}
                </Link>
              )}
            </>
          )}
        </StaggerItem>

        <StaggerItem index={3}>
          {/* 回到"来的那一页"（统计页 / 评论区 / 资源列表…），没有历史才退回资源列表 */}
          <BackLink fallback="/resources" label={common("back")} />
        </StaggerItem>
      </Stagger>
    </PageEnter>
  );
}

function ProfileTitle({
  name,
  role,
}: {
  name: string;
  role: "USER" | "ADMIN";
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <h1 className="truncate text-xl font-semibold tracking-tight">{name}</h1>
      {role === "ADMIN" && <Badge variant="default">ADMIN</Badge>}
    </div>
  );
}
