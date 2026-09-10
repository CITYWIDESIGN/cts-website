import "server-only";

import { prisma } from "@/lib/prisma";
import { hasAvatarFrame } from "@/lib/frame";
import { displayName } from "@/lib/display-name";
import { isAllowedCoverDataUrl } from "@/lib/image-types";
import { getLimits } from "@/server/settings";
import { limitsToBytes } from "@/lib/validators/limits";
import { Prisma, type Resource } from "@prisma/client";

/**
 * 附件与封面图的大小上限由管理员在后台「限额设置」里调整
 * （见 @/lib/validators/limits 与 @/server/settings），这里只负责执行。
 * 前端也有一份同样的校验用于即时反馈，但**服务端这一份才是准的** ——
 * 客户端校验不可信，请求可以被伪造。
 */
/** 资源列表每页条数 */
export const RESOURCES_PAGE_SIZE = 12;

export class ResourceError extends Error {
  constructor(
    message: string,
    readonly code:
      | "TITLE_REQUIRED"
      | "DESCRIPTION_REQUIRED"
      | "FILE_REQUIRED"
      | "FILE_TOO_LARGE"
      | "IMAGE_TOO_LARGE"
      | "IMAGE_TYPE"
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

/**
 * 列表查询的 select。
 *
 * 集中在这里是有意的：**别让任何人在别处再写一份，然后把封面的 data URL
 * 加回来**（那是曾经让列表一次拖 100MB+ 的原因，详见 ResourceImage 注释）。
 *
 * `image` 与 `blob` 都只取关系主键 —— 判断"有没有"，不取内容。
 */
const RESOURCE_LIST_SELECT = {
  id: true,
  title: true,
  description: true,
  fileName: true,
  fileSize: true,
  fileType: true,
  downloads: true,
  version: true,
  likeCount: true,
  commentCount: true,
  createdAt: true,
  uploaderId: true,
  image: { select: { resourceId: true } },
  uploader: {
    select: {
      username: true,
      minecraftUsername: true,
      minecraftUuid: true,
      microsoftAccountId: true,
      wearFrame: true,
    },
  },
} satisfies Prisma.ResourceSelect;

type ResourceListRow = Prisma.ResourceGetPayload<{
  select: typeof RESOURCE_LIST_SELECT;
}>;

/** 行 → 列表项。description 可能很长，列表只取前 160 字 */
function toListItem(r: ResourceListRow): ResourceListItem {
  return {
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
    hasImage: Boolean(r.image),
    // 没填游戏 ID 就退回账号名，不然列表里一片「—」
    uploaderName: displayName(r.uploader),
    uploaderUuid: r.uploader.minecraftUuid,
    uploaderFramed: hasAvatarFrame(r.uploader),
  };
}

/** 列表 / 分页 / 计数共用的过滤条件，保证三者口径一致 */
function resourceWhere(options: {
  search?: string;
  uploaderId?: string;
}): Prisma.ResourceWhereInput {
  const where: Prisma.ResourceWhereInput = {};
  if (options.uploaderId) where.uploaderId = options.uploaderId;

  const q = options.search?.trim();
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { fileName: { contains: q, mode: "insensitive" } },
      { uploader: { username: { contains: q, mode: "insensitive" } } },
      { uploader: { minecraftUsername: { contains: q, mode: "insensitive" } } },
    ];
  }
  return where;
}

/**
 * 公开：列出资源（任何访客都能看 / 下载）。
 * 不分页的老接口，给"某个用户的全部资源"这类小集合用。
 */
export async function listResources(options: {
  search?: string;
  uploaderId?: string;
  take?: number;
} = {}): Promise<ResourceListItem[]> {
  const rows = await prisma.resource.findMany({
    where: resourceWhere(options),
    orderBy: { createdAt: "desc" },
    take: options.take ?? 100,
    select: RESOURCE_LIST_SELECT,
  });
  return rows.map(toListItem);
}

export interface ResourcePage {
  items: ResourceListItem[];
  /** 满足条件的总条数（不是本页条数） */
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 分页列出资源。
 *
 * 为什么要分页：原来固定 `take: 100`，第 101 条之后**静默消失** ——
 * 用户看到的列表是"全部"，其实已经被截断了，没有任何提示。
 *
 * 越界的 page 会被夹回有效范围，而不是返回空列表（否则用户点到第 999 页
 * 会以为站点坏了）。
 */
export async function listResourcesPaged(options: {
  search?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<ResourcePage> {
  const pageSize = Math.max(1, options.pageSize ?? RESOURCES_PAGE_SIZE);
  const where = resourceWhere(options);

  const total = await prisma.resource.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, options.page ?? 1), totalPages);

  const rows = await prisma.resource.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: RESOURCE_LIST_SELECT,
  });

  return { items: rows.map(toListItem), total, page, pageSize, totalPages };
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
      // 同样只取主键：详情页只需要知道"有没有封面"
      image: { select: { resourceId: true } },
    },
  });
}

/**
 * 只取封面图本体。
 * 列表 / 详情都**不该**顺带把它捞出来 —— 一张最大 1.4MB，见 ResourceImage 的注释。
 */
export async function getResourceImage(id: string) {
  return prisma.resourceImage.findUnique({
    where: { resourceId: id },
    select: { data: true },
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
  const { maxFileBytes, maxImageBytes } = limitsToBytes(await getLimits());

  if (!title) throw new ResourceError("Title is required.", "TITLE_REQUIRED");
  if (!description)
    throw new ResourceError("Description is required.", "DESCRIPTION_REQUIRED");
  if (input.data.byteLength === 0)
    throw new ResourceError("File is required.", "FILE_REQUIRED");
  if (input.data.byteLength > maxFileBytes)
    throw new ResourceError(
      `File exceeds ${Math.round(maxFileBytes / 1024 / 1024)}MB.`,
      "FILE_TOO_LARGE"
    );
  if (input.imageUrl) {
    // 类型必须在白名单里 —— 挡掉 SVG（能内嵌脚本，见 @/lib/image-types）
    if (!isAllowedCoverDataUrl(input.imageUrl)) {
      throw new ResourceError("Unsupported cover image type.", "IMAGE_TYPE");
    }
    // data URL 是 base64，长度约为原文件的 1.37 倍
    if (input.imageUrl.length > maxImageBytes * 1.4) {
      throw new ResourceError("Cover image is too large.", "IMAGE_TOO_LARGE");
    }
  }

  return prisma.resource.create({
    data: {
      title: title.slice(0, 120),
      description: description.slice(0, 5000),
      fileName: input.fileName.slice(0, 200) || "download",
      fileType: input.fileType || "application/octet-stream",
      fileSize: input.data.byteLength,
      uploaderId: input.uploaderId,
      // Prisma 6 的 Bytes 字段是 Uint8Array<ArrayBuffer>，而 Node 的 Buffer
      // 底层是 ArrayBufferLike，直接传会类型不兼容；这里显式包一层
      // （会有一次拷贝，5MB 以内可接受）。
      blob: { create: { data: new Uint8Array(input.data) } },
      // 封面写进独立的表（有才建）
      ...(input.imageUrl
        ? { image: { create: { data: input.imageUrl } } }
        : {}),
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
  const { maxFileBytes, maxImageBytes } = limitsToBytes(await getLimits());
  const existing = await prisma.resource.findUnique({
    where: { id },
    // 只取"有没有封面"，不取 data URL 本体
    include: { image: { select: { resourceId: true } } },
  });
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

  /**
   * 封面是"写入/替换"还是"删除"。
   * 注意 `input.imageUrl === undefined` 表示**没动封面** —— 调用方只有
   * 用户真的改了才带上这个字段，避免每次保存都把整张图来回传。
   */
  let imageAction: "set" | "clear" | null = null;

  if (input.imageUrl !== undefined) {
    if (input.imageUrl) {
      // 类型白名单：挡掉 SVG（能内嵌脚本，见 @/lib/image-types）
      if (!isAllowedCoverDataUrl(input.imageUrl)) {
        throw new ResourceError("Unsupported cover image type.", "IMAGE_TYPE");
      }
      if (input.imageUrl.length > maxImageBytes * 1.4) {
        throw new ResourceError("Cover image is too large.", "IMAGE_TOO_LARGE");
      }
    }
    const next = input.imageUrl || null;
    const hadImage = Boolean(existing.image);

    if (next) imageAction = "set";
    else if (hadImage) imageAction = "clear";

    if (imageAction) {
      // 封面是超长 data URL，历史里只记录"有 / 无"
      changes.push({
        field: "image",
        before: hadImage ? "present" : null,
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
    if (bytes > maxFileBytes) {
      throw new ResourceError(
        `File exceeds ${Math.round(maxFileBytes / 1024 / 1024)}MB.`,
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

    // 封面走独立的表
    if (imageAction === "set" && input.imageUrl) {
      await tx.resourceImage.upsert({
        where: { resourceId: id },
        create: { resourceId: id, data: input.imageUrl },
        update: { data: input.imageUrl },
      });
    } else if (imageAction === "clear") {
      await tx.resourceImage.deleteMany({ where: { resourceId: id } });
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
