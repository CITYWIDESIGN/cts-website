/**
 * 建「CTS 服务器成员审核」问卷。
 *
 * 为什么要脚本而不是在后台手输：15 道题（含 11 + 7 + 6 + 4 个选项）手输
 * 一次要十几分钟，而且生产、本地两个库要各输一遍，很容易两边不一致。
 * 这个脚本**幂等**，可以反复跑；改题目就改这里再跑一次。
 *
 * 用法：
 *   node --import tsx scripts/seed-join-form.mts
 *
 * ⚠️ 它会**删掉这份问卷下已有的全部题目**再重建。题目 id 会变，
 * 所以**如果已经有人提交过**，那些答案会跟着题目一起被级联删除。
 * 目前两份库的提交数都是 0，安全；以后有提交了就改成"增量更新"。
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** 保持原来的 id：外部链接和"哪份是入服问卷"的判断都按它来 */
const QUESTIONNAIRE_ID = "qst_join_application";

const DESCRIPTION = `欢迎参加 CTS 服务器成员审核。为了确保服务器拥有良好的交流氛围和稳定的游玩环境，申请成员需满足以下基本条件：

1. 对 Minecraft 生电玩法具备一定的了解与兴趣；
2. 拥有 Minecraft Java Edition 正版账号；
3. 能够进行语音交流，并愿意积极融入集体环境。

本次审核以主观题为主，旨在帮助我们更全面地了解您的游戏经验、技术水平以及团队协作能力。请根据自身实际情况认真作答。感谢您的配合，祝您审核顺利！`;

type Seed =
  | { type: "TEXT" | "TEXTAREA"; title: string; required?: boolean }
  | { type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE"; title: string; options: string[]; required?: boolean };

const QUESTIONS: Seed[] = [
  { type: "TEXT", title: "您的 Minecraft Java ID 是？" },
  {
    type: "MULTIPLE_CHOICE",
    title: "请勾选您熟练掌握的辅助模组、工具",
    options: [
      "Tweakeroo",
      "Litematica",
      "Syncmatica",
      "Item Scroller",
      "MiniHUD",
      "WorldEdit",
      "Carpet",
      "Replay Mod",
      "FlashBack Mod",
      "MCDReForged",
      "小地图类模组",
    ],
  },
  { type: "SINGLE_CHOICE", title: "您目前是否常驻于其他生存服务器？", options: ["是", "否"] },
  {
    type: "MULTIPLE_CHOICE",
    title: `您认为自己能够提供哪些方面的帮助？

红石工程与后勤保障通常需要较高的在线时长和较稳定的上线频率，以便参与长期工程建设与维护工作。宣传推广与建筑设计对在线时长要求相对较低，但希望您能够保持一定活跃度，与服务器成员进行交流和协作，及时了解进展与需求。本题仅用于了解您的兴趣方向与参与意愿，不会作为审核通过与否的唯一依据。`,
    options: ["红石工程", "后勤保障", "宣传推广", "建筑设计", "技术支持", "社区管理", "其他"],
  },
  {
    type: "SINGLE_CHOICE",
    title: "最近半年内，您平均每天游玩 Minecraft 的时间大约为？",
    options: [
      "1 小时以内",
      "1～3 小时（含 3 小时）",
      "3～5 小时（含 5 小时）",
      "5～8 小时（含 8 小时）",
      "8～10 小时（含 10 小时）",
      "10 小时以上",
    ],
  },
  {
    type: "MULTIPLE_CHOICE",
    title: "您通常会在以下哪些时间段上线？",
    options: ["凌晨（00:00～07:00）", "上午（07:00～12:00）", "下午（13:00～18:00）", "晚上（19:00～24:00）"],
  },
  {
    type: "TEXTAREA",
    title:
      "您已经在 Litematica 的帮助下完成了一台机器的搭建，现在需要确认机器中不存在错误方块。您会如何进行检查？",
  },
  { type: "TEXTAREA", title: "如果您不小心损坏了服务器内的重要机器，您会如何处理？" },
  { type: "TEXTAREA", title: "如果上线时发现服务器内除了您之外没有其他玩家在线，您通常会做些什么？" },
  {
    type: "TEXTAREA",
    title: "如果您在工程建设过程中与其他成员产生意见分歧甚至争执，您会如何处理？",
  },
  { type: "TEXT", title: "您如何评价自己的「肝度」？" },
  { type: "TEXT", title: "您的年龄是？" },
  // QQ 昵称和号码拆成两题：合并成一题的话审核员要自己从一段文字里
  // 分辨哪个是昵称、哪个是号码，而号码是要用来拉群/加好友的，不能有歧义
  { type: "TEXT", title: "您的 QQ 昵称是？" },
  { type: "TEXT", title: "您的 QQ 号码是？" },
  {
    type: "TEXTAREA",
    title: `请简单介绍一下自己

字数不限（审核员通常会很乐意阅读认真撰写的长篇回答）。您可以分享：学习红石或生电的经历；您是如何了解到 CTS 服务器的；您希望加入服务器的原因；您的兴趣爱好、性格特点以及团队协作习惯等。`,
  },
  {
    type: "TEXTAREA",
    required: false,
    title: `我有特殊的入服理由（选填）

如果您认为自己拥有某些特别的能力、经验或优势，能够在众多申请者中脱颖而出，欢迎在此补充说明。（例如：技术能力、工程经验、服务器管理经验、社区贡献经历等）`,
  },
];

async function main() {
  const existing = await prisma.questionnaire.findUnique({
    where: { id: QUESTIONNAIRE_ID },
    include: { _count: { select: { submissions: true } } },
  });

  if (existing && existing._count.submissions > 0) {
    console.error(
      `✖ 这份问卷已经有 ${existing._count.submissions} 份提交，重建会连答案一起删掉。`
    );
    console.error("  要改题目请改成增量更新，别直接删。");
    process.exit(1);
  }

  await prisma.$transaction(async (tx) => {
    await tx.questionnaire.upsert({
      where: { id: QUESTIONNAIRE_ID },
      create: {
        id: QUESTIONNAIRE_ID,
        title: "CTS 服务器成员审核",
        description: DESCRIPTION,
        status: "PUBLISHED",
      },
      update: {
        title: "CTS 服务器成员审核",
        description: DESCRIPTION,
        status: "PUBLISHED",
      },
    });

    // 先清空再重建：题目顺序就是数组顺序，不靠手工维护 sortOrder
    await tx.question.deleteMany({ where: { questionnaireId: QUESTIONNAIRE_ID } });

    for (const [index, q] of QUESTIONS.entries()) {
      await tx.question.create({
        data: {
          questionnaireId: QUESTIONNAIRE_ID,
          type: q.type,
          title: q.title,
          // 只有明确写了 required: false 的才是选填（目前只有最后一题）
          required: q.required ?? true,
          sortOrder: index,
          ...("options" in q
            ? {
                options: {
                  create: q.options.map((text, i) => ({ text, sortOrder: i })),
                },
              }
            : {}),
        },
      });
    }
  });

  const check = await prisma.questionnaire.findUnique({
    where: { id: QUESTIONNAIRE_ID },
    include: {
      questions: { orderBy: { sortOrder: "asc" }, include: { _count: { select: { options: true } } } },
    },
  });

  console.log(`✔ ${check?.title}（${check?.status}）`);
  console.log(`  题目 ${check?.questions.length} 道：`);
  for (const [i, q] of (check?.questions ?? []).entries()) {
    const opt = q._count.options > 0 ? `  选项 ${q._count.options}` : "";
    const req = q.required ? "" : "  [选填]";
    console.log(`    ${String(i + 1).padStart(2)}. [${q.type}]${req} ${q.title.split("\n")[0].slice(0, 34)}${opt}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
