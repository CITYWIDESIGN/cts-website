#!/usr/bin/env node
/**
 * 用户管理 / 强制登录调试脚本（交互式）
 *
 * 用法：
 *   node scripts/users.mjs            # 交互式菜单（推荐）
 *   debug.bat users:manage            # 经 dev.mjs 转调，等价
 *
 * 能力：
 *   - 列出 / 搜索用户
 *   - 新建用户（可指定 UUID、角色）
 *   - 编辑用户（玩家名 / UUID / Microsoft 账号 ID / 角色）
 *   - 提升 / 降级角色
 *   - 删除用户（连带问卷提交）
 *   - 生成问卷提交（用于测试审核流程）
 *   - 一键强制登录：生成会话 cookie 并直接写入浏览器地址
 *
 * 为什么单独一个脚本：用户管理是"反复用、带交互"的操作，
 * 塞进 dev.mjs 的扁平菜单会越来越长；这里做成独立的循环菜单，
 * dev.mjs 只保留一个入口转调过来。
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const DB_CONTAINER = "mcserver-db";

// ---------------------------------------------------------------------------
// 彩色输出
// ---------------------------------------------------------------------------
const useColor = process.stdout.isTTY || process.env.FORCE_COLOR === "1";
const color = (code) => (useColor ? (s) => `\x1b[${code}m${s}\x1b[0m` : (s) => s);

const c = {
  bold: color(1),
  dim: color(2),
  red: color(31),
  green: color(32),
  yellow: color(33),
  blue: color(34),
  magenta: color(35),
  cyan: color(36),
  invert: color(7),
};

const log = {
  info: (m) => console.log(`${c.blue("ℹ")} ${m}`),
  ok: (m) => console.log(`${c.green("✔")} ${m}`),
  warn: (m) => console.log(`${c.yellow("⚠")} ${m}`),
  err: (m) => console.log(`${c.red("✖")} ${m}`),
  dim: (m) => console.log(c.dim(m)),
};

function hr() {
  console.log(c.dim("─".repeat(64)));
}

// ---------------------------------------------------------------------------
// 环境 / 基础工具
// ---------------------------------------------------------------------------
function loadEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][\w.]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let val = m[2];
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}

const envValue = (k) => process.env[k] || "";

/** 从 NEXT_PUBLIC_SITE_URL 推出站点地址与端口 */
function siteUrl() {
  return (envValue("NEXT_PUBLIC_SITE_URL") || "http://localhost:3000").replace(
    /\/$/,
    ""
  );
}

function siteOrigin() {
  try {
    return new URL(siteUrl()).origin;
  } catch {
    return "http://localhost:3000";
  }
}

async function loadPrisma() {
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

let rl = null;
/** 输入流是否已结束（管道输入 / Ctrl+D 时会置位，用于优雅退出） */
let inputEnded = false;

function getRl() {
  if (!rl) {
    rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.on("close", () => {
      inputEnded = true;
    });
  }
  return rl;
}

async function ask(question) {
  if (inputEnded) return "";
  try {
    return await new Promise((resolve) =>
      getRl().question(question, (a) => resolve(a.trim()))
    );
  } catch {
    // readline 已关闭（管道输入耗尽）时不要让脚本崩掉
    inputEnded = true;
    return "";
  }
}

async function askDefault(question, current) {
  const v = await ask(`${question} ${c.dim(`[${current ?? "空"}]`)} > `);
  return v === "" ? undefined : v;
}

async function pause() {
  await ask(c.dim("\n按回车返回菜单…"));
}

// ---------------------------------------------------------------------------
// 数据辅助
// ---------------------------------------------------------------------------
/** 补齐 UUID 标准格式（也接受 32 位无连字符写法）；非法返回 null */
function normalizeUuid(uuid) {
  const hex = String(uuid).replace(/[^0-9a-fA-F]/g, "");
  if (hex.length !== 32) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`.toLowerCase();
}

function roleBadge(role) {
  return role === "ADMIN" ? c.magenta("ADMIN") : c.dim("USER ");
}

const statusColor = {
  PENDING: c.yellow,
  APPROVED: c.green,
  REJECTED: c.red,
};

/** 按玩家名或用户 ID 找用户（先按名，再按 ID） */
async function findUser(prisma, key) {
  if (!key) return null;
  const byName = await prisma.user.findFirst({
    where: { minecraftUsername: key },
  });
  if (byName) return byName;
  return prisma.user.findUnique({ where: { id: key } });
}

/** 选择一个用户：列出候选让人输编号，或直接输名字/ID */
async function pickUser(prisma, { title = "选择用户" } = {}) {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      minecraftUsername: true,
      minecraftUuid: true,
      role: true,
      _count: { select: { submissions: true } },
    },
  });

  if (users.length === 0) {
    log.warn("数据库里还没有任何用户。");
    return null;
  }

  console.log(`\n${c.bold(title)}：`);
  users.forEach((u, i) => {
    console.log(
      `  ${c.bold(String(i + 1).padStart(2))}) ${roleBadge(u.role)} ${
        u.minecraftUsername ?? c.dim("(无玩家名)")
      } ${c.dim(u.id)}${u._count.submissions ? c.dim(` · ${u._count.submissions} 份提交`) : ""}`
    );
  });
  console.log(c.dim("  也可直接输入玩家名或用户 ID"));

  const input = await ask("\n> ");
  if (!input) return null;

  const n = Number(input);
  if (Number.isInteger(n) && n >= 1 && n <= users.length) {
    return prisma.user.findUnique({ where: { id: users[n - 1].id } });
  }
  const found = await findUser(prisma, input);
  if (!found) log.err(`未找到用户「${input}」`);
  return found;
}

// ---------------------------------------------------------------------------
// 会话 cookie（强制登录的核心）
// ---------------------------------------------------------------------------
async function sealSession(userId) {
  const secret = envValue("SESSION_SECRET");
  if (!secret) return null;
  const { sealData } = await import("iron-session");
  return sealData({ userId }, { password: secret, ttl: 60 * 60 * 24 * 30 });
}

/** 把 cookie 写进本机 Chrome/Edge 的 cookies SQLite 太脆弱，这里只做地址生成 + 指引 */
async function forceLogin(prisma) {
  const user = await pickUser(prisma, { title: "为哪个用户强制登录" });
  if (!user) return;

  const sealed = await sealSession(user.id);
  if (!sealed) {
    log.err("SESSION_SECRET 未配置，无法签发会话。请检查 .env。");
    return;
  }

  const origin = siteOrigin();
  const cookieName = "mc_session";

  hr();
  log.ok(
    `已为 ${c.bold(user.minecraftUsername ?? user.id)} 签发 30 天会话（role=${user.role}）`
  );
  console.log("");
  console.log(c.bold("  方式 1 · 浏览器（推荐）"));
  console.log("    1. 打开 " + c.cyan(`${origin}/login`));
  console.log("    2. F12 → Application → Cookies → " + c.cyan(origin));
  console.log(`    3. 新建一条：Name = ${c.bold(cookieName)}，Value 粘贴下面那串`);
  console.log("");
  console.log("    会话值：");
  console.log(c.green(`    ${sealed}`));
  console.log("");
  console.log(c.bold("  方式 2 · 命令行验证（不用浏览器）"));
  console.log(
    c.dim(
      `    curl -i -H "Cookie: ${cookieName}=${sealed}" ${origin}/admin`
    )
  );
  console.log("");
  log.dim(
    "提示：cookie 用 SESSION_SECRET 签名，改了 .env 里的密钥就要重新签发。"
  );
  hr();
}

// ---------------------------------------------------------------------------
// 各功能
// ---------------------------------------------------------------------------
async function listUsers(prisma) {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      minecraftUsername: true,
      minecraftUuid: true,
      microsoftAccountId: true,
      role: true,
      createdAt: true,
      _count: { select: { submissions: true } },
    },
  });

  if (users.length === 0) {
    log.warn("数据库里还没有任何用户。");
    return;
  }

  console.log("");
  users.forEach((u, i) => {
    console.log(
      `${c.bold(String(i + 1).padStart(2))}) ${roleBadge(u.role)} ${c.bold(
        u.minecraftUsername ?? "(无玩家名)"
      )}`
    );
    console.log(`    id        ${c.dim(u.id)}`);
    console.log(`    uuid      ${u.minecraftUuid ?? c.dim("—")}`);
    console.log(`    ms-account${u.microsoftAccountId ? ` ${c.dim(u.microsoftAccountId)}` : ` ${c.dim("—")}`}`);
    console.log(
      `    提交      ${u._count.submissions} 份  ·  注册于 ${u.createdAt.toISOString().slice(0, 10)}`
    );
  });
  console.log("");
}

async function searchUsers(prisma) {
  const q = await ask("搜索（玩家名 / UUID / 用户 ID 片段）> ");
  if (!q) return;
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { minecraftUsername: { contains: q, mode: "insensitive" } },
        { minecraftUuid: { contains: q, mode: "insensitive" } },
        { id: { contains: q, mode: "insensitive" } },
        { microsoftAccountId: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  if (users.length === 0) {
    log.warn(`没有匹配「${q}」的用户。`);
    return;
  }
  console.log("");
  users.forEach((u) => {
    console.log(
      `  ${roleBadge(u.role)} ${u.minecraftUsername ?? "(无玩家名)"} ${c.dim(u.id)} ${
        u.minecraftUuid ? c.dim(u.minecraftUuid) : ""
      }`
    );
  });
  console.log("");
}

async function createUser(prisma) {
  const username = await ask("玩家名 > ");
  if (!username) {
    log.warn("已取消。");
    return;
  }
  if (await findUser(prisma, username)) {
    log.err(`用户「${username}」已存在。`);
    return;
  }

  const uuidInput = await ask("Minecraft UUID（可留空，用于皮肤）> ");
  let uuid = null;
  if (uuidInput) {
    uuid = normalizeUuid(uuidInput);
    if (!uuid) {
      log.err("UUID 格式不正确，应为标准 36 位（或 32 位无连字符）。");
      return;
    }
    const taken = await prisma.user.findUnique({ where: { minecraftUuid: uuid } });
    if (taken) {
      log.err(`该 UUID 已被「${taken.minecraftUsername ?? taken.id}」占用。`);
      return;
    }
  }

  const msId = await ask("Microsoft 账号 ID（可留空）> ");
  const admin = await ask("给管理员权限？(y/N) > ");

  const created = await prisma.user.create({
    data: {
      minecraftUsername: username,
      minecraftUuid: uuid,
      microsoftAccountId: msId || null,
      role: admin.toLowerCase() === "y" ? "ADMIN" : "USER",
    },
  });
  log.ok(
    `已创建 ${created.minecraftUsername} (${created.id}, role=${created.role})` +
      (created.minecraftUuid ? ` uuid=${created.minecraftUuid}` : "")
  );
  log.dim("如需登录：主菜单选「强制登录」");
}

async function editUser(prisma) {
  const user = await pickUser(prisma, { title: "编辑哪个用户" });
  if (!user) return;

  console.log(c.dim("\n直接回车 = 保持原值\n"));

  const name = await askDefault("玩家名", user.minecraftUsername);
  const uuidInput = await askDefault("Minecraft UUID", user.minecraftUuid);
  const msId = await askDefault("Microsoft 账号 ID", user.microsoftAccountId);
  const roleInput = await askDefault("角色 (ADMIN/USER)", user.role);

  const data = {};

  if (name !== undefined) {
    const dup = await prisma.user.findFirst({
      where: { minecraftUsername: name, NOT: { id: user.id } },
    });
    if (dup) {
      log.err(`玩家名「${name}」已被占用。`);
      return;
    }
    data.minecraftUsername = name;
  }

  if (uuidInput !== undefined) {
    if (uuidInput === "" || uuidInput === "-") {
      data.minecraftUuid = null;
    } else {
      const uuid = normalizeUuid(uuidInput);
      if (!uuid) {
        log.err("UUID 格式不正确。");
        return;
      }
      const dup = await prisma.user.findFirst({
        where: { minecraftUuid: uuid, NOT: { id: user.id } },
      });
      if (dup) {
        log.err(`该 UUID 已被「${dup.minecraftUsername ?? dup.id}」占用。`);
        return;
      }
      data.minecraftUuid = uuid;
    }
  }

  if (msId !== undefined) {
    data.microsoftAccountId = msId === "" || msId === "-" ? null : msId;
  }

  if (roleInput !== undefined) {
    const upper = roleInput.toUpperCase();
    if (upper !== "ADMIN" && upper !== "USER") {
      log.err("角色只能是 ADMIN 或 USER。");
      return;
    }
    data.role = upper;
  }

  if (Object.keys(data).length === 0) {
    log.warn("没有修改任何字段。");
    return;
  }

  const updated = await prisma.user.update({ where: { id: user.id }, data });
  log.ok(
    `已更新 ${updated.minecraftUsername ?? updated.id}：role=${updated.role}` +
      ` uuid=${updated.minecraftUuid ?? "—"}`
  );
}

async function toggleRole(prisma) {
  const user = await pickUser(prisma, { title: "切换谁的角色" });
  if (!user) return;
  const next = user.role === "ADMIN" ? "USER" : "ADMIN";
  await prisma.user.update({ where: { id: user.id }, data: { role: next } });
  log.ok(
    `${user.minecraftUsername ?? user.id}：${user.role} → ${c.bold(next)}`
  );
}

/**
 * 彻底删除一个用户。
 *
 * ⚠️ `prisma.user.delete()` **只**会级联掉有外键的东西（资源、问卷提交），
 * 评论 / 点赞 / 消息 / 举报 / 编辑记录 / 各种计数表都没有外键，会留下孤儿行 ——
 * 之前这里就是裸删，结果库里出现了 `daily_actions` 指向一个不存在的用户、
 * `email_codes` 残留这类垃圾。
 *
 * 清理口径与 src/server/user-deletion.ts 的 `purgeUser` 保持一致：
 *   - 属于他自己的：评论、点赞、评论点赞、消息、举报、问卷提交、资源 → 删
 *   - 挂在**别人**数据上的：资源编辑记录、别人评论里的"回复 xxx"
 *     → 只抹名字（删掉会破坏无关内容）
 */
async function deleteUser(prisma) {
  const user = await pickUser(prisma, { title: "删除哪个用户" });
  if (!user) return;

  const [subs, resources, comments] = await Promise.all([
    prisma.submission.count({ where: { userId: user.id } }),
    prisma.resource.count({ where: { uploaderId: user.id } }),
    prisma.resourceComment.count({ where: { userId: user.id } }),
  ]);

  const name = user.minecraftUsername ?? user.id;
  log.warn(`将**彻底删除** ${name} (${user.id})，包括：`);
  log.dim(`  资源 ${resources} 个、评论 ${comments} 条、问卷提交 ${subs} 份、`);
  log.dim("  以及他的点赞 / 消息 / 举报 / 下载与配额计数。");
  log.dim("  想保留内容请改用网页版的「注销账号」，而不是删除。");
  const confirm = await ask("确认删除？输入 yes > ");
  if (confirm.toLowerCase() !== "yes") {
    log.dim("已取消。");
    return;
  }

  const oldName = user.minecraftUsername ?? null;

  await prisma.$transaction(async (tx) => {
    // 有外键的：资源 / 问卷提交由 user.delete 级联
    // 没外键的：必须手动清，否则就是孤儿行
    await tx.resourceComment.deleteMany({ where: { userId: user.id } });
    await tx.commentLike.deleteMany({ where: { userId: user.id } });
    await tx.resourceLike.deleteMany({ where: { userId: user.id } });
    await tx.notification.deleteMany({
      where: { OR: [{ userId: user.id }, { actorId: user.id }] },
    });
    await tx.report.deleteMany({ where: { reporterId: user.id } });

    // 挂在别人数据上的，只抹名字
    await tx.resourceRevision.updateMany({
      where: { editorId: user.id },
      data: { editorName: "已注销用户" },
    });
    if (oldName) {
      await tx.resourceComment.updateMany({
        where: { replyToName: oldName },
        data: { replyToName: "已注销用户" },
      });
    }

    // 配额 / 验证码这些"按主体 id 计数的表"也要清
    await tx.dailyAction.deleteMany({ where: { subjectKey: user.id } });
    await tx.transferUsage.deleteMany({ where: { subjectKey: user.id } });
    await tx.resourceDownload.deleteMany({
      where: { subjectType: "user", subjectKey: user.id },
    });
    await tx.emailCode.deleteMany({ where: { userId: user.id } });

    await tx.user.delete({ where: { id: user.id } });
  });

  log.ok(`已彻底删除 ${name} 及其全部内容`);
}

/** 造一份问卷提交，便于测试后台审核流程 */
async function createSubmission(prisma) {
  const user = await pickUser(prisma, { title: "为哪个用户造提交" });
  if (!user) return;

  const questionnaires = await prisma.questionnaire.findMany({
    orderBy: { createdAt: "desc" },
    include: { questions: { orderBy: { sortOrder: "asc" }, include: { options: true } } },
  });

  if (questionnaires.length === 0) {
    log.warn("还没有问卷。先在后台创建一份，或运行 `node scripts/dev.mjs db:seed`。");
    return;
  }

  console.log(`\n${c.bold("选择问卷")}：`);
  questionnaires.forEach((q, i) => {
    console.log(
      `  ${c.bold(String(i + 1))}) ${q.title} ${c.dim(`[${q.status}] ${q.questions.length} 题`)}`
    );
  });
  const pick = await ask("\n> ");
  const q = questionnaires[Number(pick) - 1];
  if (!q) {
    log.err("无效选择。");
    return;
  }

  const existing = await prisma.submission.findUnique({
    where: {
      questionnaireId_userId: { questionnaireId: q.id, userId: user.id },
    },
  });
  if (existing) {
    log.warn(
      `该用户已提交过这份问卷 (${existing.id}, ${existing.status})。可先删除该提交再重造。`
    );
    const del = await ask("删除现有提交并重建？(y/N) > ");
    if (del.toLowerCase() !== "y") return;
    await prisma.submission.delete({ where: { id: existing.id } });
  }

  // 按题型自动填一个合法答案
  const answers = q.questions.map((question) => {
    let value = "（调试数据）";
    if (question.type === "SINGLE_CHOICE" && question.options[0]) {
      value = question.options[0].text;
    } else if (question.type === "MULTIPLE_CHOICE") {
      value = JSON.stringify(question.options.slice(0, 2).map((o) => o.text));
    }
    return { questionId: question.id, value };
  });

  const created = await prisma.submission.create({
    data: {
      questionnaireId: q.id,
      userId: user.id,
      status: "PENDING",
      answers: { create: answers },
    },
  });
  log.ok(
    `已为 ${user.minecraftUsername ?? user.id} 创建提交 ${created.id}（PENDING，${answers.length} 条答案）`
  );
  log.dim("可在后台「最近提交问卷」里点进去审核。");
}

async function listSubmissions(prisma) {
  const subs = await prisma.submission.findMany({
    orderBy: { submittedAt: "desc" },
    take: 20,
    include: {
      user: { select: { minecraftUsername: true } },
      questionnaire: { select: { title: true } },
      _count: { select: { answers: true } },
    },
  });

  if (subs.length === 0) {
    log.warn("还没有任何提交。");
    return;
  }
  console.log("");
  for (const s of subs) {
    const paint = statusColor[s.status] ?? ((x) => x);
    console.log(
      `  ${paint(s.status.padEnd(8))} ${c.bold(s.user.minecraftUsername ?? "—")} ${
        c.dim("·")
      } ${s.questionnaire.title} ${c.dim(`${s._count.answers} 答 · ${s.submittedAt.toISOString().slice(0, 16).replace("T", " ")}`)}`
    );
    console.log(`    ${c.dim(s.id)}`);
  }
  console.log("");
}

/** 改提交审核状态（等价于后台点通过/拒绝） */
async function setSubmissionStatus(prisma) {
  const subs = await prisma.submission.findMany({
    orderBy: { submittedAt: "desc" },
    take: 20,
    include: {
      user: { select: { minecraftUsername: true } },
      questionnaire: { select: { title: true } },
    },
  });
  if (subs.length === 0) {
    log.warn("还没有任何提交。");
    return;
  }

  console.log(`\n${c.bold("选择提交")}：`);
  subs.forEach((s, i) => {
    const paint = statusColor[s.status] ?? ((x) => x);
    console.log(
      `  ${c.bold(String(i + 1).padStart(2))}) ${paint(s.status.padEnd(8))} ${
        s.user.minecraftUsername ?? "—"
      } · ${s.questionnaire.title}`
    );
  });
  const pick = await ask("\n> ");
  const sub = subs[Number(pick) - 1];
  if (!sub) {
    log.err("无效选择。");
    return;
  }

  console.log(`  ${c.bold("1")}) PENDING   2) APPROVED   3) REJECTED`);
  const st = await ask("新状态 > ");
  const map = { 1: "PENDING", 2: "APPROVED", 3: "REJECTED" };
  const status = map[st];
  if (!status) {
    log.err("无效选择。");
    return;
  }
  await prisma.submission.update({ where: { id: sub.id }, data: { status } });
  log.ok(`提交 ${sub.id} 状态 → ${status}`);
}

async function dbInfo(prisma) {
  const [users, admins, bound, submissions, questionnaires] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.user.count({ where: { minecraftUuid: { not: null } } }),
    prisma.submission.count(),
    prisma.questionnaire.count(),
  ]);
  const byStatus = await prisma.submission.groupBy({
    by: ["status"],
    _count: { status: true },
  });
  const statusMap = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
  for (const g of byStatus) statusMap[g.status] = g._count.status;

  const secret = envValue("SESSION_SECRET");
  const origin = siteOrigin();

  console.log("");
  console.log(`  数据库        ${c.dim(envValue("DATABASE_URL").replace(/:[^:@]*@/, ":****@"))}`);
  console.log(`  站点地址      ${origin} ${c.dim("(用于强制登录)")}`);
  console.log(`  SESSION_SECRET ${secret ? c.green("已配置") : c.red("缺失")}`);
  console.log("");
  console.log(`  用户          ${users} 个（管理员 ${admins}，已绑 UUID ${bound}）`);
  console.log(`  问卷          ${questionnaires} 份`);
  console.log(
    `  提交          ${submissions} 份 ${c.dim(
      `(待审 ${statusMap.PENDING} / 通过 ${statusMap.APPROVED} / 拒绝 ${statusMap.REJECTED})`
    )}`
  );

  // 顺手报一下 Docker 容器与站点可达性，方便排查"为什么强制登录后打不开"
  const docker = (() => {
    try {
      const out = execSync(`docker inspect -f "{{.State.Running}}" ${DB_CONTAINER}`, {
        stdio: "pipe",
        encoding: "utf8",
      }).trim();
      return out === "true" ? c.green("运行中") : c.yellow("未运行");
    } catch {
      return c.dim("不可用");
    }
  })();
  console.log(`  数据库容器    ${docker}`);
  console.log("");
}

// ---------------------------------------------------------------------------
// 菜单
// ---------------------------------------------------------------------------
const MENU = [
  { key: "1", label: "列出全部用户", fn: listUsers },
  { key: "2", label: "搜索用户", fn: searchUsers },
  { key: "3", label: "新建用户", fn: createUser, needsPrisma: true },
  { key: "4", label: "编辑用户（名字 / UUID / MS 账号 / 角色）", fn: editUser },
  { key: "5", label: "切换角色（USER ⇄ ADMIN）", fn: toggleRole },
  { key: "6", label: "删除用户", fn: deleteUser },
  { group: "强制登录 / 测试数据" },
  { key: "l", label: "强制登录（签发会话 cookie）", fn: forceLogin },
  { key: "n", label: "为用户造一份问卷提交", fn: createSubmission },
  { key: "v", label: "查看最近的提交", fn: listSubmissions },
  { key: "x", label: "修改提交审核状态", fn: setSubmissionStatus },
  { group: "环境" },
  { key: "i", label: "数据库 / 站点概览", fn: dbInfo },
  { group: "" },
  { key: "0", label: "退出", fn: null },
];

function banner() {
  console.log("");
  console.log(c.bold(c.cyan("  用户管理 · 强制登录")));
  console.log(c.dim("  Minecraft Server · 调试工具"));
  console.log("");
}

async function menu() {
  const prisma = await loadPrisma();

  const cleanup = async () => {
    await prisma.$disconnect();
    if (rl) rl.close();
  };

  try {
    for (;;) {
      banner();
      for (const item of MENU) {
        if (item.group !== undefined) {
          if (item.group) console.log(`  ${c.dim(item.group)}`);
          continue;
        }
        console.log(`  ${c.bold(item.key)}) ${item.label}`);
      }
      console.log("");

      const answer = (await ask("输入编号并回车 > ")).toLowerCase();
      const item = MENU.find((m) => m.group === undefined && m.key === answer);

      if (answer === "0" || inputEnded) {
        log.dim("已退出。");
        break;
      }
      if (!item || !item.fn) {
        log.warn("无效的选项。");
        continue;
      }

      console.log("");
      try {
        await item.fn(prisma);
      } catch (err) {
        log.err(err?.message ?? String(err));
      }
      await pause();
    }
  } finally {
    await cleanup();
  }
}

async function main() {
  loadEnv();
  if (!existsSync(path.join(ROOT, "node_modules"))) {
    log.err("未安装依赖，请先运行 npm install。");
    process.exit(1);
  }
  await menu();
}

main().catch((err) => {
  log.err(err?.message ?? String(err));
  process.exit(1);
});
