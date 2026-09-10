import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  CalendarDays,
  FileArchive,
  ImageOff,
  User,
} from "lucide-react";
import { getCurrentUser } from "@/server/auth";
import {
  canManageResource,
  getResource,
  listResourceRevisions,
} from "@/server/resource";
import { getViewerState, getLikedCommentIds, listComments } from "@/server/social";
import { getMyPendingReports } from "@/server/report";
import { InteractionBar } from "@/components/resources/interaction-bar";
import { DownloadButton } from "@/components/resources/download-button";
import {
  CommentSection,
  type CommentItem,
} from "@/components/resources/comment-section";
import { ReportButton } from "@/components/resources/report-button";
import { BackLink } from "@/components/back-link";
import { UserAvatarLink } from "@/components/user/user-avatar-link";
import { getUserBasics } from "@/server/users";
import { hasAvatarFrame } from "@/lib/frame";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageEnter, Stagger, StaggerItem } from "@/components/motion/stagger";
import { ResourceEditActions } from "@/components/resources/resource-edit-actions";
import { RevisionHistory } from "@/components/resources/revision-history";
import { formatBytes, formatDateTime } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const resource = await getResource(id);
  return {
    title: resource?.title ?? "Resource",
    description: resource?.description.slice(0, 150),
  };
}

export default async function ResourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("resources");

  const [user, resource] = await Promise.all([getCurrentUser(), getResource(id)]);
  if (!resource) notFound();

  const [revisions, comments, viewerState] = await Promise.all([
    listResourceRevisions(id),
    listComments(id),
    getViewerState([id], user?.id ?? null),
  ]);
  const canManage = canManageResource(resource, user);

  // 当前用户点过赞的评论 & 待处理的举报（用于渲染正确状态）
  const allCommentIds = comments.flatMap((c) => [
    c.id,
    ...c.replies.map((r) => r.id),
  ]);
  const [likedComments, myReports, authors] = await Promise.all([
    getLikedCommentIds(allCommentIds, user?.id ?? null),
    getMyPendingReports(
      [
        { targetType: "RESOURCE", targetId: id },
        ...allCommentIds.map((cid) => ({
          targetType: "COMMENT" as const,
          targetId: cid,
        })),
      ],
      user?.id ?? null
    ),
    // 社交表只有 userId 没有外键，头像要单独补一次查询
    getUserBasics(comments.flatMap((c) => [c.userId, ...c.replies.map((r) => r.userId)])),
  ]);

  /** 把服务端评论映射成组件需要的形状（含回复、点赞态、举报态） */
  const toItem = (c: {
    id: string;
    userId: string;
    authorName: string | null;
    content: string;
    parentId: string | null;
    replyToName: string | null;
    likeCount: number;
    replyCount: number;
    createdAt: Date;
  }): CommentItem => ({
    id: c.id,
    userId: c.userId,
    authorName: c.authorName,
    authorUuid: authors.get(c.userId)?.uuid ?? null,
    authorFramed: authors.get(c.userId)?.framed ?? false,
    content: c.content,
    parentId: c.parentId,
    replyToName: c.replyToName,
    likeCount: c.likeCount,
    replyCount: c.replyCount,
    liked: likedComments.has(c.id),
    reported: myReports.has(`COMMENT:${c.id}`),
    createdAt: c.createdAt.toISOString(),
  });

  const commentItems: CommentItem[] = comments.map((c) => ({
    ...toItem(c),
    replies: c.replies.map((r) => toItem(r)),
  }));

  const meta = [
    {
      icon: User,
      label: t("uploader"),
      value: resource.uploader.minecraftUsername ?? "—",
      // 头像与名字都可点，进公开资料页
      href: `/u/${resource.uploader.id}`,
      avatar: {
        id: resource.uploader.id,
        name: resource.uploader.minecraftUsername,
        uuid: resource.uploader.minecraftUuid,
        framed: hasAvatarFrame(resource.uploader),
      },
    },
    {
      icon: CalendarDays,
      label: t("uploadedAt"),
      value: formatDateTime(resource.createdAt),
    },
    {
      icon: FileArchive,
      label: t("fileSize"),
      value: `${formatBytes(resource.fileSize)} · ${resource.fileName}`,
    },
  ];

  return (
    <PageEnter className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <Stagger inView={false} stagger={0.08} gap={22} className="flex flex-col">
        {/* 返回：回到来的那一页，没有历史才回资源列表 */}
        <StaggerItem index={0}>
          <BackLink fallback="/resources" label={t("backToList")} />
        </StaggerItem>

        {/* 标题 + 操作 */}
        <StaggerItem index={1}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="tracking-display text-2xl font-semibold sm:text-3xl">
                {resource.title}
              </h1>
              {resource.version > 1 && (
                <Badge variant="outline">v{resource.version}</Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{formatBytes(resource.fileSize)}</Badge>
              <Badge variant="secondary">
                {t("downloads", { count: resource.downloads })}
              </Badge>
              {/* 下载不需要登录；被封禁的用户会被拦下来并给出提示 */}
              <DownloadButton
                resourceId={resource.id}
                variant="button"
                className="ml-auto"
              />
            </div>

            {/* 互动栏：点赞 / 评论 / 分享（复制链接） */}
            <InteractionBar
              resourceId={resource.id}
              likeCount={resource.likeCount}
              commentCount={resource.commentCount}
              liked={viewerState.liked.has(resource.id)}
              authed={Boolean(user)}
              commentInputId="comment-input"
              className="-ml-2.5"
            />

            {/* 举报资源 */}
            <div className="-ml-2.5">
              <ReportButton
                targetType="RESOURCE"
                targetId={resource.id}
                authed={Boolean(user)}
                reported={myReports.has(`RESOURCE:${resource.id}`)}
              />
            </div>
          </div>
        </StaggerItem>

        {/* 上传者/管理员操作：编辑 + 删除 */}
        {canManage && (
          <StaggerItem index={2}>
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed px-4 py-3">
              <p className="text-sm text-muted-foreground">
                {user?.role === "ADMIN" && user.id !== resource.uploaderId
                  ? t("adminManageHint")
                  : t("ownerManageHint")}
              </p>
              <div className="ml-auto">
                <ResourceEditActions
                  id={resource.id}
                  title={resource.title}
                  description={resource.description}
                  hasImage={Boolean(resource.image)}
                />
              </div>
            </div>
          </StaggerItem>
        )}

        {/* 封面 */}
        <StaggerItem index={3}>
          <div className="overflow-hidden rounded-xl border bg-muted">
            {resource.image ? (
              // 封面来自本站接口，尺寸由容器控制
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/resources/${resource.id}/image`}
                alt={resource.title}
                className="max-h-[420px] w-full object-contain"
              />
            ) : (
              <div className="flex aspect-video items-center justify-center text-muted-foreground/50">
                <ImageOff className="size-8" />
              </div>
            )}
          </div>
        </StaggerItem>

        {/* 介绍 */}
        <StaggerItem index={4}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("descriptionLabel")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {resource.description}
              </p>
            </CardContent>
          </Card>
        </StaggerItem>

        {/* 修改记录（类似 git log） */}
        {revisions.length > 0 && (
          <StaggerItem index={5}>
            <RevisionHistory
              revisions={revisions.map((r) => ({
                id: r.id,
                version: r.version,
                changes: r.changes as Array<{
                  field: string;
                  before: string | null;
                  after: string | null;
                }>,
                note: r.note,
                editorName: r.editorName,
                createdAt: r.createdAt.toISOString(),
              }))}
            />
          </StaggerItem>
        )}

        {/* 元信息 */}
        <StaggerItem index={6}>
          <Card>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
              {meta.map((row) => {
                const Icon = row.icon;
                return (
                  <div key={row.label} className="flex items-start gap-3">
                    {row.avatar ? (
                      // 用皮肤头像代替图标，点它进资料页
                      <UserAvatarLink
                        userId={row.avatar.id}
                        name={row.avatar.name}
                        uuid={row.avatar.uuid}
                        framed={row.avatar.framed}
                        size={36}
                      />
                    ) : (
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                        <Icon className="size-4" />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{row.label}</p>
                      {row.href ? (
                        <Link
                          href={row.href}
                          className="break-all text-sm font-medium hover:underline"
                        >
                          {row.value}
                        </Link>
                      ) : (
                        <p className="break-all text-sm font-medium">{row.value}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </StaggerItem>

        {/* 评论区：登录即可评论（不要求过审） */}
        <StaggerItem index={7}>
          <Card>
            <CardContent className="pt-6">
              <CommentSection
                resourceId={resource.id}
                comments={commentItems}
                viewerId={user?.id ?? null}
                viewerUuid={user?.minecraftUuid ?? null}
                viewerFramed={hasAvatarFrame(user)}
                isAdmin={user?.role === "ADMIN"}
                authed={Boolean(user)}
                inputId="comment-input"
              />
            </CardContent>
          </Card>
        </StaggerItem>
      </Stagger>
    </PageEnter>
  );
}
