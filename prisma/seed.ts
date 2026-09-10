import { PrismaClient, QuestionType } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * SEED_SKIP_USERS=1 → 只建问卷，不建演示用户/提交。
 *
 * 用途：清库之后只想把**内容**（问卷）恢复回来，不想要 Steve / Alex / Notch_Fan
 * 这几个演示账号。演示用户是给后台审核流程做样本的，正式环境不需要。
 */
const skipUsers = process.env.SEED_SKIP_USERS === "1";

async function main() {
  // ------------------------------------------------------------------
  // 1. Demo questionnaire — "入服申请" (Join application)
  // ------------------------------------------------------------------
  const questionnaire = await prisma.questionnaire.upsert({
    where: { id: "qst_join_application" },
    update: {},
    create: {
      id: "qst_join_application",
      title: "入服申请",
      description: "请如实填写以下内容，我们会尽快审核你的申请。",
      status: "PUBLISHED",
      questions: {
        create: [
          {
            id: "q_1",
            type: QuestionType.SINGLE_CHOICE,
            title: "你是否了解服务器规则？",
            required: true,
            sortOrder: 0,
            options: {
              create: [
                { text: "非常了解", sortOrder: 0 },
                { text: "大致了解", sortOrder: 1 },
                { text: "不太了解", sortOrder: 2 },
              ],
            },
          },
          {
            id: "q_2",
            type: QuestionType.MULTIPLE_CHOICE,
            title: "你喜欢哪些玩法？",
            required: true,
            sortOrder: 1,
            options: {
              create: [
                { text: "生存", sortOrder: 0 },
                { text: "建筑", sortOrder: 1 },
                { text: "PVP", sortOrder: 2 },
                { text: "红石", sortOrder: 3 },
                { text: "探索", sortOrder: 4 },
              ],
            },
          },
          {
            id: "q_3",
            type: QuestionType.TEXT,
            title: "请简单介绍一下你自己",
            required: true,
            sortOrder: 2,
          },
          {
            id: "q_4",
            type: QuestionType.TEXTAREA,
            title: "为什么想加入本服务器？",
            required: true,
            sortOrder: 3,
          },
        ],
      },
    },
  });

  console.log("Seeded questionnaire:", questionnaire.title);

  // ------------------------------------------------------------------
  // 1b. Test template questionnaire — covers every question type,
  //     plus required/optional, so the fill + review flow can be exercised
  //     without hand-building a questionnaire first.
  // ------------------------------------------------------------------
  const testQuestionnaire = await prisma.questionnaire.upsert({
    where: { id: "qst_test_template" },
    update: {},
    create: {
      id: "qst_test_template",
      title: "测试问卷（模板）",
      description:
        "一份用来测试的问卷，覆盖全部四种题型、必填与选填。可以直接改，也可以删掉后自己新建。",
      status: "PUBLISHED",
      questions: {
        create: [
          {
            id: "qt_1",
            type: QuestionType.SINGLE_CHOICE,
            title: "单选题：你平时最常玩哪个版本？",
            required: true,
            sortOrder: 0,
            options: {
              create: [
                { text: "1.20 或更新", sortOrder: 0 },
                { text: "1.16 – 1.19", sortOrder: 1 },
                { text: "1.12 或更早", sortOrder: 2 },
                { text: "模组整合包", sortOrder: 3 },
              ],
            },
          },
          {
            id: "qt_2",
            type: QuestionType.MULTIPLE_CHOICE,
            title: "多选题：你希望在服务器里做哪些事？",
            required: true,
            sortOrder: 1,
            options: {
              create: [
                { text: "原版生存", sortOrder: 0 },
                { text: "大型建筑", sortOrder: 1 },
                { text: "红石机器", sortOrder: 2 },
                { text: "PVP 竞技", sortOrder: 3 },
                { text: "探索地图", sortOrder: 4 },
                { text: "挂机养老", sortOrder: 5 },
              ],
            },
          },
          {
            id: "qt_3",
            type: QuestionType.TEXT,
            title: "单行文本：你的游戏 ID 是？",
            required: true,
            sortOrder: 2,
          },
          {
            id: "qt_4",
            type: QuestionType.TEXTAREA,
            title: "多行文本：简单介绍一下你自己（必填）",
            required: true,
            sortOrder: 3,
          },
          {
            id: "qt_5",
            type: QuestionType.SINGLE_CHOICE,
            title: "选填单选：你是怎么知道这个服务器的？（可以跳过）",
            required: false,
            sortOrder: 4,
            options: {
              create: [
                { text: "朋友推荐", sortOrder: 0 },
                { text: "视频 / 直播", sortOrder: 1 },
                { text: "搜索引擎", sortOrder: 2 },
                { text: "其他", sortOrder: 3 },
              ],
            },
          },
          {
            id: "qt_6",
            type: QuestionType.TEXTAREA,
            title: "选填多行文本：还有什么想说的？（可以跳过）",
            required: false,
            sortOrder: 5,
          },
        ],
      },
    },
  });

  console.log("Seeded test questionnaire:", testQuestionnaire.title);

  if (skipUsers) {
    console.log("SEED_SKIP_USERS=1 → 跳过演示用户与提交。");
    return;
  }

  // ------------------------------------------------------------------
  // 2. Demo users + submissions (for the admin dashboard to be populated)
  //    These are clearly demo accounts. Remove or ignore in production.
  // ------------------------------------------------------------------
  const demoUsers = [
    {
      id: "user_demo_1",
      minecraftUuid: "069a79f4-44e9-4726-a5be-fca90e38aaf5",
      minecraftUsername: "Steve",
      microsoftAccountId: "demo-ms-account-1",
      answers: {
        q_1: "大致了解",
        q_2: JSON.stringify(["生存", "建筑", "探索"]),
        q_3: "大家好，我是 Steve，喜欢和朋友一起生存。",
        q_4: "朋友推荐了这个服务器，想来体验一下。",
      },
    },
    {
      id: "user_demo_2",
      minecraftUuid: "d8f2b1a3-7c6e-4f5a-9b8d-1a2b3c4d5e6f",
      minecraftUsername: "Alex",
      microsoftAccountId: "demo-ms-account-2",
      answers: {
        q_1: "非常了解",
        q_2: JSON.stringify(["建筑", "红石"]),
        q_3: "我是建筑玩家，喜欢大型工程。",
        q_4: "希望能找到一个长期稳定的服务器。",
      },
    },
    {
      id: "user_demo_3",
      minecraftUuid: "e1a2b3c4-d5e6-f7a8-b9c0-1d2e3f4a5b6c",
      minecraftUsername: "Notch_Fan",
      microsoftAccountId: "demo-ms-account-3",
      answers: {
        q_1: "不太了解",
        q_2: JSON.stringify(["生存", "PVP", "探索"]),
        q_3: "新手玩家，多多关照。",
        q_4: "第一次玩服务器，想找个友好的社区。",
      },
    },
  ];

  for (const u of demoUsers) {
    const user = await prisma.user.upsert({
      where: { id: u.id },
      update: {},
      create: {
        id: u.id,
        minecraftUuid: u.minecraftUuid,
        minecraftUsername: u.minecraftUsername,
        microsoftAccountId: u.microsoftAccountId,
      },
    });

    const existing = await prisma.submission.findUnique({
      where: {
        questionnaireId_userId: {
          questionnaireId: questionnaire.id,
          userId: user.id,
        },
      },
    });

    if (existing) continue;

    const submission = await prisma.submission.create({
      data: {
        questionnaireId: questionnaire.id,
        userId: user.id,
        status: "PENDING",
      },
    });

    for (const [questionId, value] of Object.entries(u.answers)) {
      await prisma.answer.create({
        data: {
          submissionId: submission.id,
          questionId,
          value,
        },
      });
    }
  }

  console.log("Seeded demo users and submissions.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
