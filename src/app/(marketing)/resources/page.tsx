import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LogIn } from "lucide-react";
import { getCurrentUser } from "@/server/auth";
import { ResourceGrid, ResourceViewerProvider } from "@/components/resources/resource-grid";
import { listResources } from "@/server/resource";
import { getViewerState } from "@/server/social";
import { UploadResourceDialog } from "@/components/resources/upload-resource-dialog";
import { Button } from "@/components/ui/button";
import { Stagger, StaggerItem, PageEnter } from "@/components/motion/stagger";
import { SplitHeading } from "@/components/motion/split-heading";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("resources");
  return { title: t("title"), description: t("description") };
}

/**
 * 资源分享（类似 MCBBS 的资源板块）。
 *
 * 权限规则：
 * - 浏览 / 下载：所有人（不需要登录）
 * - 上传：只要登录即可，**不要求通过入服审核**
 * - 管理（改/删）：仅管理员，入口在后台 /admin/resources
 */
export default async function ResourcesPage() {
  const t = await getTranslations("resources");

  // 用 getCurrentUser 而不是 requireUser：游客也要能看列表、下载，
  // 不能被弹到登录页
  const [user, resources] = await Promise.all([
    getCurrentUser(),
    listResources(),
  ]);

  // 当前用户对这批资源的点赞 / 转发状态，一次查出，避免每条动态各查一次
  const viewerState = await getViewerState(
    resources.map((r) => r.id),
    user?.id ?? null
  );

  return (
    <PageEnter className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <Stagger inView={false} stagger={0.11} gap={18} className="flex flex-col">
          <StaggerItem index={0}>
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              <span aria-hidden className="size-1.5 rounded-[2px] bg-primary" />
              {t("eyebrow")}
            </span>
          </StaggerItem>
          <StaggerItem index={1}>
            <SplitHeading
              text={t("title")}
              className="tracking-display text-3xl font-semibold sm:text-4xl"
            />
          </StaggerItem>
          <StaggerItem index={2}>
            <p className="max-w-2xl text-muted-foreground">{t("description")}</p>
          </StaggerItem>
        </Stagger>

        <div className="shrink-0">
          {user ? (
            <UploadResourceDialog />
          ) : (
            <Button asChild variant="outline" className="group">
              <Link href="/login">
                <LogIn className="size-4" />
                {t("loginToUpload")}
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="mt-10">
        <ResourceViewerProvider viewerId={user?.id ?? null}>
          <ResourceGrid
            items={resources.map((r) => ({
              id: r.id,
              title: r.title,
              description: r.description,
              fileName: r.fileName,
              fileSize: r.fileSize,
              downloads: r.downloads,
              version: r.version,
              createdAt: r.createdAt.toISOString(),
              hasImage: r.hasImage,
              uploaderName: r.uploaderName,
              uploaderId: r.uploaderId,
              uploaderUuid: r.uploaderUuid,
              uploaderFramed: r.uploaderFramed,
              likeCount: r.likeCount,
              commentCount: r.commentCount,
              liked: viewerState.liked.has(r.id),
            }))}
          />
        </ResourceViewerProvider>
      </div>
    </PageEnter>
  );
}
