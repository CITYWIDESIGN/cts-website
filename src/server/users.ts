import "server-only";

import { prisma } from "@/lib/prisma";
import { hasAvatarFrame } from "@/lib/frame";

export type UserBasic = {
  id: string;
  name: string | null;
  uuid: string | null;
  /** 是否佩戴头像框（绑定 Microsoft 的奖励） */
  framed: boolean;
};

/**
 * 批量取用户的**展示信息**（玩家名 + Minecraft UUID）。
 *
 * 为什么需要它：社交表（ResourceComment / ResourceLike / CommentLike）刻意
 * 只存 userId、不建到 User 的外键 —— 这样删用户不会连带删掉评论。
 * 代价是拿不到头像，需要像这样单独补一次查询。
 *
 * 返回 Map 而不是数组，调用方可以按 userId 直接取。
 */
export async function getUserBasics(
  ids: Array<string | null | undefined>
): Promise<Map<string, UserBasic>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();

  const rows = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: {
      id: true,
      minecraftUsername: true,
      minecraftUuid: true,
      microsoftAccountId: true,
      wearFrame: true,
    },
  });

  return new Map(
    rows.map((r) => [
      r.id,
      {
        id: r.id,
        name: r.minecraftUsername,
        uuid: r.minecraftUuid,
        framed: hasAvatarFrame(r),
      },
    ])
  );
}
