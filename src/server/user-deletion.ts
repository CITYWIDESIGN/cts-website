import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * 用户注销 / 删除。
 *
 * 两种语义**故意不一样**：
 *
 * | | 触发者 | 账号 | 内容 |
 * |---|---|---|---|
 * | `anonymizeAccount` | 用户自己在个人中心注销 | 抹掉全部可识别信息，永久无法登录 | **保留**，作者显示为「已注销用户」 |
 * | `purgeUser` | 管理员在用户列表删除 | 整行删除 | **一并删除**（资源、评论、提交、点赞、消息） |
 *
 * 为什么注销不真删：
 *   - `Resource.uploaderId`、`Submission.userId` 有外键，真删会级联带走内容；
 *   - 评论 / 点赞 / 消息只有 `userId` 字符串、没有外键，真删会留下悬空引用。
 * 与其在删除时到处补洞，不如把「注销」实现成**抹除身份**：
 * 所有能指向真人的字段清空，账号永久封禁（无法再登录），内容原地保留。
 *
 * 表名 `bannedReason` 用一句固定标记，方便日后在库里分辨"注销"和"被封"。
 */

/** 注销后显示的作者名（写进库，所以是固定字符串而不是 i18n key） */
export const DELETED_DISPLAY_NAME = "已注销用户";

/** 写进 banReason 的标记，用来区分「注销」与管理员封禁 */
export const ANONYMIZED_MARK = "__account_deleted__";

/**
 * 注销：抹掉身份，保留内容。
 *
 * ⚠️ 匿名化不只是"把 User 那行清空"。库里有**五个冗余存了名字的字段**，
 * 它们不跟着 User 走，漏掉任何一个都会让人从内容里被认出来：
 *
 *   ResourceComment.authorName   —— 评论作者
 *   ResourceComment.replyToName  —— "回复 xxx" 里的 xxx
 *   ResourceRevision.editorName  —— 资源编辑记录
 *   Report.reporterName          —— 举报人
 *   Notification.actorName       —— 消息的触发者
 *
 * 处理原则：
 *   - **这个人自己的东西**（收件箱、点赞、问卷提交）→ 直接删
 *   - **别人那里留下的痕迹**（别人收到的消息、别人看到的举报、
 *     别人评论里的"回复 xxx"）→ 保留行，只把名字换掉，
 *     这样别人的历史不会莫名其妙少一块
 */
export async function anonymizeAccount(userId: string): Promise<void> {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { minecraftUsername: true, username: true },
  });
  if (!target) return;

  /** 内容里出现的旧名字（评论作者名用的是 minecraftUsername） */
  const oldName = target.minecraftUsername ?? null;

  await prisma.$transaction(async (tx) => {
    // ---- 直接删：只属于他、对别人没有意义的记录 ----

    // 问卷提交里含个人信息，注销时一并删除
    await tx.submission.deleteMany({ where: { userId } });

    // 他自己的收件箱
    await tx.notification.deleteMany({ where: { userId } });

    // 点赞：留着会让计数对不上一个不存在的人
    await tx.resourceLike.deleteMany({ where: { userId } });
    await tx.commentLike.deleteMany({ where: { userId } });

    // ---- 改名保留：别人那里留下的痕迹 ----

    // 评论本体保留，换掉冗余的作者名
    await tx.resourceComment.updateMany({
      where: { userId },
      data: { authorName: DELETED_DISPLAY_NAME },
    });

    // "回复 xxx"：这个字段只存名字没有 id，所以只能按名字匹配。
    // 重名会误伤，但结果只是把另一个同名的人显示成"已注销用户"，无害。
    if (oldName) {
      await tx.resourceComment.updateMany({
        where: { replyToName: oldName },
        data: { replyToName: DELETED_DISPLAY_NAME },
      });
    }

    // 资源编辑记录
    await tx.resourceRevision.updateMany({
      where: { editorId: userId },
      data: { editorName: DELETED_DISPLAY_NAME },
    });

    // 举报：保留（是管理记录），只抹掉举报人名字
    await tx.report.updateMany({
      where: { reporterId: userId },
      data: { reporterName: DELETED_DISPLAY_NAME },
    });

    // 别人收到的、由他触发的消息：保留，抹名字
    await tx.notification.updateMany({
      where: { actorId: userId },
      data: { actorName: DELETED_DISPLAY_NAME },
    });

    // ---- 用户本体：清空所有可识别信息 ----
    // email / username / minecraftUuid 都是可空唯一列，
    // 多个 NULL 在 Postgres 的唯一索引里是允许的。
    await tx.user.update({
      where: { id: userId },
      data: {
        username: null,
        email: null,
        emailVerifiedAt: null,
        passwordHash: null,
        microsoftAccountId: null,
        minecraftUuid: null,
        minecraftUsername: DELETED_DISPLAY_NAME,
        wearFrame: false,
        // 永久封禁：没有账号名也没有密码，本来也登不进来，
        // 这一条是兜底，顺便让后台一眼看出这是注销号
        bannedAt: new Date(),
        bannedUntil: null,
        banReason: ANONYMIZED_MARK,
      },
    });
  });
}

/**
 * 彻底删除：管理员用。
 *
 * 资源与问卷提交靠外键级联（`onDelete: Cascade`）自动清掉；
 * 评论 / 点赞 / 消息 / 举报没有外键，要手动删干净，否则会留下孤儿行。
 */
export async function purgeUser(userId: string): Promise<void> {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { minecraftUsername: true },
  });
  if (!target) return;
  const oldName = target.minecraftUsername ?? null;

  await prisma.$transaction(async (tx) => {
    // 评论：parentId 是自引用级联，删顶层会连带它的回复
    await tx.resourceComment.deleteMany({ where: { userId } });
    await tx.commentLike.deleteMany({ where: { userId } });
    await tx.resourceLike.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({
      where: { OR: [{ userId }, { actorId: userId }] },
    });
    // 他发出的举报也删掉，避免 reporterId 指向一个不存在的用户；
    // 举报**他**的内容由 targetId 兜底，资源删掉后后台会显示"该内容已被删除"
    await tx.report.deleteMany({ where: { reporterId: userId } });

    // 下面两处是**别人名下的数据**，删掉会破坏无关内容，所以只抹名字：
    //   - 他编辑过的资源（历史记录属于那个资源，不属于他）
    //   - 别人评论里的"回复 xxx"
    await tx.resourceRevision.updateMany({
      where: { editorId: userId },
      data: { editorName: DELETED_DISPLAY_NAME },
    });
    if (oldName) {
      await tx.resourceComment.updateMany({
        where: { replyToName: oldName },
        data: { replyToName: DELETED_DISPLAY_NAME },
      });
    }

    // 资源 + 问卷提交由外键级联删除
    await tx.user.delete({ where: { id: userId } });
  });
}

/** 是否最后一个管理员（删掉就没人能进后台了） */
export async function isLastAdmin(userId: string): Promise<boolean> {
  const [target, adminCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    }),
    prisma.user.count({ where: { role: "ADMIN" } }),
  ]);
  return target?.role === "ADMIN" && adminCount <= 1;
}
