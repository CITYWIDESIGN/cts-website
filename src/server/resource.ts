import "server-only";

import { prisma } from "@/lib/prisma";
import { hasAvatarFrame } from "@/lib/frame";
import { displayName } from "@/lib/display-name";
import type { Resource } from "@prisma/client";

/** 附件大小上限：5MB（与前端校验保持一致） */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
/** 封面图上限：1MB（存 data URL，避免列表查询变重） */
export const MAX_IMAGE_BYTES = 1024 * 1024;

export class ResourceError extends Error {
  constructor(
    message: string,
    readonly code:
      | "TITLE_REQUIRED"
      | "DESCRIPTION_REQUIRED"
      | "FILE_REQUIRED"
      | "FILE_TOO_LARGE"
      | "IMAGE_TOO_LARGE"
      | "NOT_FOUND"
      | "FORBIDDEN"
  ) {
    super(message);
    this.name = "ResourceError";
  }
}

/** 列表项：不包含 blob 与封面图，保持查询轻量 */
export type ResourceListItem = Pick<
  Resource,
  | "id"
  | "title"
  | "description"
  | "fileName"
  | "fileSize"
  | "fileType"
  | "downloads"
  | "version"
  | "createdAt"
  | "uploaderId"
  | "likeCount"
  | "commentCount"
> & {
  hasImage: boolean;
  uploaderName: string | null;
  /** 上传者的 Minecraft UUID（动态视图用它拉皮肤头像） */
  uploaderUuid: string | null;
  /** 上传者是否佩戴头像框（绑定 Microsoft 的奖励） */
  uploaderFramed: boolean;
};

/** 公开：列出全部资源（任何访客都能看 / 下载） */
export async function listResources(options: {
  search?: string;
  uploaderId?: string;
  take?: number;
} = {}): Promise<ResourceListItem[]> {
  const where: Record<string, unknown> = {};
  if (options.uploaderId) where.uploaderId = options.uploaderId;
  if (options.search) {
    where.OR = [
      { title: { contains: options.search, mode: "insensitive" } },
      { description: { contains: options.search, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.resource.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: options.take ?? 100,
    select: {
      id: true,
      title: true,
      description: true,
      imageUrl: true,
      fileName: true,
      fileSize: true,
      fileType: true,
      downloads: true,
      version: true,
      likeCount: true,
      commentCount: true,
      createdAt: true,
      uploaderId: true,
      uploader: {
        select: {
          username: true,
          minecraftUsername: true,
          minecraftUuid: true,
          microsoftAccountId: true,
          wearFrame: true,
        },
      },
    },
  });

  // description 可能很长，列表只取前 160 字；imageUrl 只暴露"有没有"
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description.slice(0, 160),
    fileName: r.fileName,
    fileSize: r.fileSize,
    fileType: r.fileType,
    downloads: r.downloads,
    version: r.version,
    likeCount: r.likeCount,
    commentCount: r.commentCount,
    createdAt: r.createdAt,
    uploaderId: r.uploaderId,
    hasImage: Boolean(r.imageUrl),
    // 没填游戏 ID 就退回账号名，不然列表里一片「—」
    uploaderName: displayName(r.uploader),
    uploaderUuid: r.uploader.minecraftUuid,
    uploaderFramed: hasAvatarFrame(r.uploader),
  }));
}

export async function getResource(id: string) {
  return prisma.resource.findUnique({
    where: { id },
    include: {
      uploader: {
        select: {
          id: true,
          username: true,
          minecraftUsername: true,
          minecraftUuid: true,
          microsoftAccountId: true,
          wearFrame: true,
        },
      },
      blob: { select: { resourceId: true } },
    },
  });
}

/** 只取封面图（列表/详情单独拉，避免把 data URL 混进主查询） */
export async function getResourceImage(id: string) {
  return prisma.resource.findUnique({
    where: { id },
    select: { imageUrl: true },
  });
}

/** 只取附件本体，用于下载接口 */
export async function getResourceBlob(id: string) {
  return prisma.resource.findUnique({
    where: { id },
    select: {
      id: true,
      fileName: true,
      fileType: true,
      blob: { select: { data: true } },
    },
  });
}

export async function createResource(input: {
  title: string;
  description: string;
  imageUrl?: string | null;
  fileName: string;
  fileType: string;
  data: Buffer;
  uploaderId: string;
}) {
  const title = input.title?.trim();
  const description = input.description?.trim();

  if (!title) throw new ResourceError("Title is required.", "TITLE_REQUIRED");
  if (!description)
    throw new ResourceError("Description is required.", "DESCRIPTION_REQUIRED");
  if (input.data.byteLength === 0)
    throw new ResourceError("File is required.", "FILE_REQUIRED");
  if (input.data.byteLength > MAX_FILE_BYTES)
    throw new ResourceError(
      `File exceeds ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB.`,
      "FILE_TOO_LARGE"
    );
  if (input.imageUrl && input.imageUrl.length > MAX_IMAGE_BYTES * 1.4) {
    // data URL 是 base64，长度约为原文件的 1.37 倍
    throw new ResourceError("Cover image is too large.", "IMAGE_TOO_LARGE");
  }

  return prisma.resource.create({
    data: {
      title: title.slice(0, 120),
      description: description.slice(0, 5000),
      imageUrl: input.imageUrl ?? null,
      fileName: input.fileName.slice(0, 200) || "download",
      fileType: input.fileType || "application/octet-stream",
      fileSize: input.data.byteLength,
      uploaderId: input.uploaderId,
      // Prisma 6 的 Bytes 字段是 Uint8Array<ArrayBuffer>，而 Node 的 Buffer
      // 底层是 ArrayBufferLike，直接传会类型不兼容；这里显式包一层
      // （会有一次拷贝，5MB 以内可接受）。
      blob: { create: { data: new Uint8Array(input.data) } },
    },
  });
}

/** 更新资源：标题 / 介绍 / 封面，可选**替换附件本体** */
export async function updateResource(
  id: string,
  input: {
    title?: string;
    description?: string;
    imageUrl?: string | null;
    /** 传入即替换附件（upsert 到 resource_blobs） */
    file?: { name: string; type: string; data: Buffer };
  },
  editor: { id: string; name: string | null; isAdmin: boolean }
) {
  const existing = await prisma.resource.findUnique({ where: { id } });
  if (!existing) throw new ResourceError("Resource not found.", "NOT_FOUND");

  const data: Record<string, unknown> = {};
  /** 字段级差异，写入 ResourceRevision.changes（类似 git 的 diff） */
  const changes: Array<{ field: string; before: string | null; after: string | null }> = [];

  if (input.title !== undefined) {
    const t = input.title.trim();
    if (!t) throw new ResourceError("Title is required.", "TITLE_REQUIRED");
    const next = t.slice(0, 120);
    if (next !== existing.title) {
      data.title = next;
      changes.push({ field: "title", before: existing.title, after: next });
    }
  }

  if (input.description !== undefined) {
    const d = input.description.trim();
    if (!d)
      throw new ResourceError("Description is required.", "DESCRIPTION_REQUIRED");
    const next = d.slice(0, 5000);
    if (next !== existing.description) {
      data.description = next;
      changes.push({
        field: "description",
        before: existing.description,
        after: next,
      });
    }
  }

  if (input.imageUrl !== undefined) {
    if (input.imageUrl && input.imageUrl.length > MAX_IMAGE_BYTES * 1.4) {
      throw new ResourceError("Cover image is too large.", "IMAGE_TOO_LARGE");
    }
    const next = input.imageUrl || null;
    if (next !== existing.imageUrl) {
      data.imageUrl = next;
      // 封面可能是很长的 data URL，历史里只记录"有/无/是否更换"
      changes.push({
        field: "image",
        before: existing.imageUrl ? "present" : null,
        after: next ? "present" : null,
      });
    }
  }

  // 替换附件：校验大小后更新元信息，并把二进制 upsert 进 blob 表
  if (input.file) {
    const bytes = input.file.data.byteLength;
    if (bytes === 0) {
      throw new ResourceError("File is required.", "FILE_REQUIRED");
    }
    if (bytes > MAX_FILE_BYTES) {
      throw new ResourceError(
        `File exceeds ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB.`,
        "FILE_TOO_LARGE"
      );
    }
    const nextName = input.file.name.slice(0, 200) || "download";
    const nextType = input.file.type || "application/octet-stream";

    data.fileName = nextName;
    data.fileType = nextType;
    data.fileSize = bytes;

    // 记录为 fileName 的变更（before/after 用文件名 + 大小，便于阅读）
    changes.push({
      field: "file",
      before: `${existing.fileName} (${formatBytesForNote(existing.fileSize)})`,
      after: `${nextName} (${formatBytesForNote(bytes)})`,
    });
  }

  // 没有任何实际变化就不写版本，避免刷出一堆空记录
  if (changes.length === 0) return existing;

  const nextVersion = existing.version + 1;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.resource.update({
      where: { id },
      data: { ...data, version: nextVersion },
    });

    if (input.file) {
      // upsert：既有 blob 就覆盖，没有就创建
      await tx.resourceBlob.upsert({
        where: { resourceId: id },
        create: { resourceId: id, data: new Uint8Array(input.file.data) },
        update: { data: new Uint8Array(input.file.data) },
      });
    }

    await tx.resourceRevision.create({
      data: {
        resourceId: id,
        editorId: editor.id,
        editorName: editor.name,
        version: nextVersion,
        changes,
        note: editor.isAdmin ? "admin" : "uploader",
      },
    });

    return updated;
  });
}

function formatBytesForNote(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** 修改记录（新→旧），用于详情页展示历史 */
export async function listResourceRevisions(resourceId: string) {
  return prisma.resourceRevision.findMany({
    where: { resourceId },
    orderBy: { version: "desc" },
    take: 50,
    select: {
      id: true,
      version: true,
      changes: true,
      note: true,
      editorName: true,
      createdAt: true,
    },
  });
}

/** 权限判定：上传者本人或管理员可以编辑/删除 */
export function canManageResource(
  resource: { uploaderId: string },
  user: { id: string; role: "USER" | "ADMIN" } | null
): boolean {
  if (!user) return false;
  return user.role === "ADMIN" || user.id === resource.uploaderId;
}

export async function deleteResource(id: string) {
  return prisma.resource.delete({ where: { id } });
}

export async function incrementDownloads(id: string) {
  return prisma.resource.update({
    where: { id },
    data: { downloads: { increment: 1 } },
    select: { downloads: true },
  });
}

/** 后台统计用 */
export async function countResources() {
  return prisma.resource.count();
}
