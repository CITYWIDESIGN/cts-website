#!/usr/bin/env node
/**
 * 开发 / 调试启动脚本（跨平台，Node 实现）
 *
 * 用法：
 *   node scripts/dev.mjs                  # 交互式菜单
 *   node scripts/dev.mjs up               # 一键启动（检查 → 数据库 → 迁移 → dev server）
 *   node scripts/dev.mjs up --seed        # 一键启动并填充种子数据
 *   node scripts/dev.mjs dev              # 仅启动 dev server
 *   node scripts/dev.mjs build            # 生产构建（next build）
 *   node scripts/dev.mjs start            # 启动生产服务器（需先 build）
 *   node scripts/dev.mjs db:up            # 启动数据库
 *   node scripts/dev.mjs db:down          # 停止数据库
 *   node scripts/dev.mjs db:reset         # 重置数据库（清空数据 + 迁移 + seed）
 *   node scripts/dev.mjs db:migrate       # 执行迁移
 *   node scripts/dev.mjs db:push          # 同步 schema（无迁移文件）
 *   node scripts/dev.mjs db:generate      # 重新生成 Prisma Client
 *   node scripts/dev.mjs db:seed          # 填充种子数据
 *   node scripts/dev.mjs db:studio        # 打开 Prisma Studio
 *   node scripts/dev.mjs check            # 环境检查（doctor）
 *   node scripts/dev.mjs preflight        # typecheck + eslint + i18n + 单元测试
 *   node scripts/dev.mjs test             # 只跑单元测试
 *   node scripts/dev.mjs backup           # 备份数据库（pg_dump，带轮转）
 *   node scripts/dev.mjs cleanup          # 清理过期数据（见 server/retention.ts）
 *   node scripts/dev.mjs info             # 显示项目 / 环境信息
 *   node scripts/dev.mjs mail:test [邮箱]  # SMTP 自检（不带邮箱只测连接）
 *   node scripts/dev.mjs mail:preview <邮箱>  # 发一封真实模板的验证码邮件预览
 *   node scripts/dev.mjs users            # 打开用户管理 / 强制登录（见 scripts/users.mjs）
 *   node scripts/dev.mjs users:list       # 列出全部用户（简表）
 *   node scripts/dev.mjs adduser <玩家名> [--admin] [--uuid <UUID>]  # 新建用户
 *   node scripts/dev.mjs updateuser <玩家名|ID> [--uuid <UUID>] [--name <玩家名>] [--role ADMIN|USER]
 *   node scripts/dev.mjs deleteuser <玩家名|ID>  # 删除用户（连带问卷提交）
 *   node scripts/dev.mjs admin <玩家名>   # 将用户提升为管理员
 *   node scripts/dev.mjs session <玩家名> # 生成调试用会话 cookie
 *   node scripts/dev.mjs makeadmin <玩家名> # 提升管理员 + 生成会话 cookie（一步到位）
 *
 * 调试辅助命令若省略 <玩家名>，会交互式提示输入（菜单中同样可用）
 * —— 审批期间无法走 Microsoft 登录时，用 adduser + makeadmin 组合即可登录后台。
 */

import { spawn, execSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const NODE = process.execPath;
const PRISMA_BIN = path.join(ROOT, "node_modules", "prisma", "build", "index.js");
const NEXT_BIN = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");

const DB_CONTAINER = "mcserver-db";

// ---------------------------------------------------------------------------
// 颜色输出
// ---------------------------------------------------------------------------
const useColor =
  process.stdout.isTTY || process.env.FORCE_COLOR === "1";
const color = (code) => (useColor ? (s) => `\x1b[${code}m${s}\x1b[0m` : (s) => s);

const c = {
  reset: color(0),
  bold: color(1),
  dim: color(2),
  red: color(31),
  green: color(32),
  yellow: color(33),
  blue: color(34),
  magenta: color(35),
  cyan: color(36),
};

const log = {
  info: (m) => console.log(`${c.blue("ℹ")} ${m}`),
  ok: (m) => console.log(`${c.green("✔")} ${m}`),
  warn: (m) => console.log(`${c.yellow("⚠")} ${m}`),
  err: (m) => console.log(`${c.red("✖")} ${m}`),
  step: (m) => console.log(`${c.magenta("→")} ${m}`),
  dim: (m) => console.log(c.dim(m)),
};

function hr() {
  console.log(c.dim("─".repeat(60)));
}

function banner() {
  console.log("");
  console.log(c.bold(c.cyan("  Minecraft Server · 开发调试脚本")));
  console.log(c.dim("  Next.js 16 · Prisma · PostgreSQL"));
  console.log("");
}

// ---------------------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------------------

/**
 * 检查 SESSION_SECRET 是否够格。
 * 返回 null 表示没问题，否则返回一句人话说明哪里不行。
 *
 * 与 src/lib/session-secret.ts 的规则保持一致：至少 32 字符、不能是示例值。
 */
const MIN_SECRET_LENGTH = 32;
const DEV_FALLBACK_SECRET = "insecure-development-secret-change-me";

function checkSessionSecret(raw) {
  const v = (raw ?? "").trim();
  if (!v) return "未配置（开发环境会用兜底值，生产环境会直接报错）";
  if (v === DEV_FALLBACK_SECRET || v.includes("replace-me")) {
    return "还是示例里的占位值，请换成随机字符串";
  }
  if (v.length < MIN_SECRET_LENGTH) {
    return `太短（${v.length} 字符，至少 ${MIN_SECRET_LENGTH}）`;
  }
  return null;
}

/** 生产构建 / 启动前拦一道：这类问题不该等到线上才发现 */
function assertSecretForProduction() {
  const issue = checkSessionSecret(envValue("SESSION_SECRET"));
  if (!issue) return true;
  log.err(`SESSION_SECRET ${issue}`);
  log.dim("  生成一个并写进 .env：");
  log.dim("    node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"");
  return false;
}

function loadEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
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

function exec(cmd, { silent = true } = {}) {
  try {
    return execSync(cmd, {
      cwd: ROOT,
      stdio: silent ? "pipe" : "inherit",
      encoding: "utf8",
    }).trim();
  } catch (e) {
    return null;
  }
}

function run(args, { stdio = "inherit", env } = {}) {
  const [bin, ...rest] = args;
  return new Promise((resolve) => {
    const child = spawn(bin, rest, {
      cwd: ROOT,
      stdio,
      shell: false,
      env: env ? { ...process.env, ...env } : process.env,
    });
    child.on("close", (code) => resolve(code ?? 0));
    child.on("error", (err) => {
      log.err(`无法执行 ${path.basename(bin)}: ${err.message}`);
      resolve(1);
    });
  });
}

// args 必须给默认值：runNode(script) 这种不传参数的调用会让 ...undefined 抛
// "args is not iterable"，而且会被上层 try/catch 吞成一句莫名其妙的提示。
const runNode = (jsPath, args = [], opts) => run([NODE, jsPath, ...args], opts);
const prisma = (...args) => runNode(PRISMA_BIN, args);
const nextCmd = (...args) => runNode(NEXT_BIN, args);

function nodeVersion() {
  return process.versions.node;
}

function isDockerAvailable() {
  return exec("docker info") !== null;
}

function isDbContainerRunning() {
  const out = exec(`docker inspect -f "{{.State.Running}}" ${DB_CONTAINER}`);
  return out === "true";
}

function isDbReady() {
  const out = exec(
    `docker exec ${DB_CONTAINER} pg_isready -U postgres -d mcserver`
  );
  return typeof out === "string" && out.includes("accepting connections");
}

function hasEnvFile() {
  return existsSync(path.join(ROOT, ".env"));
}

function envValue(key) {
  return process.env[key] || "";
}

function isOAuthConfigured() {
  return Boolean(
    envValue("MICROSOFT_CLIENT_ID") && envValue("MICROSOFT_CLIENT_SECRET")
  );
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForDb(timeoutMs = 45000) {
  log.step("等待数据库就绪…");
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (isDbReady()) {
      log.ok("数据库已就绪");
      return true;
    }
    await sleep(800);
  }
  log.err("等待数据库超时。请检查 Docker 与容器状态。");
  return false;
}

// ---------------------------------------------------------------------------
// 子命令
// ---------------------------------------------------------------------------
async function doCheck() {
  loadEnv();
  banner();
  log.info("环境检查 (doctor)");
  hr();

  const ver = nodeVersion();
  const [major] = ver.split(".").map(Number);
  if (major >= 20) log.ok(`Node.js ${ver}`);
  else log.err(`Node.js ${ver}（需要 >= 20.9）`);

  if (existsSync(path.join(ROOT, "node_modules"))) log.ok("node_modules 存在");
  else log.warn("未安装依赖，请运行 npm install");

  if (hasEnvFile()) log.ok(".env 存在");
  else log.warn(".env 不存在（将从 .env.example 复制）");

  const dbUrl = envValue("DATABASE_URL");
  if (dbUrl) log.ok("DATABASE_URL 已配置");
  else log.warn("DATABASE_URL 未配置");

  // SESSION_SECRET 是安全边界：泄露 = 可伪造登录态。
  // 开发环境缺失会自动兜底，所以这里只提示；构建 / 启动前会拦。
  const secret = envValue("SESSION_SECRET");
  const secretIssue = checkSessionSecret(secret);
  if (!secretIssue) log.ok(`SESSION_SECRET 已配置（${secret.trim().length} 字符）`);
  else log.warn(`SESSION_SECRET ${secretIssue}`);

  if (isOAuthConfigured()) log.ok("Microsoft OAuth 已配置");
  else log.dim("Microsoft OAuth 未配置（登录页将显示友好提示）");

  // SMTP：不配也能跑（开发环境把验证码打到控制台），所以只提示不报错
  const smtpHost = envValue("SMTP_HOST");
  const smtpUser = envValue("SMTP_USER");
  const smtpPass = envValue("SMTP_PASS");
  if (smtpHost && smtpUser && smtpPass) {
    log.ok(`SMTP 已配置（${smtpHost}，发件人 ${smtpUser}）`);
  } else if (process.env.NODE_ENV === "production") {
    log.warn("SMTP 未配置 —— 生产环境将无法发送验证码 / 找回密码邮件");
  } else {
    log.dim("SMTP 未配置（验证码会打印到控制台并显示在页面上）");
    log.dim("  配置方法：node scripts/dev.mjs mail:test");
  }

  if (isDockerAvailable()) {
    log.ok("Docker 可用");
    if (isDbContainerRunning()) log.ok("数据库容器运行中");
    else log.dim("数据库容器未启动");
  } else {
    log.warn("Docker 不可用，请启动 Docker Desktop 后重试");
  }

  hr();
  console.log("");
}

async function doInfo() {
  banner();
  loadEnv();
  const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
  log.info("项目 / 环境信息");
  hr();
  console.log(`  Node.js        ${nodeVersion()}`);
  console.log(`  Next.js        ${pkg.dependencies.next}`);
  console.log(`  React          ${pkg.dependencies.react}`);
  console.log(`  Prisma         ${pkg.devDependencies.prisma}`);
  console.log(`  站点 URL       ${envValue("NEXT_PUBLIC_SITE_URL") || "(未设置)"}`);
  console.log(
    `  OAuth          ${isOAuthConfigured() ? "已配置" : "未配置"}`
  );
  console.log(`  Docker         ${isDockerAvailable() ? "可用" : "不可用"}`);
  console.log(
    `  数据库容器     ${isDbContainerRunning() ? "运行中" : "未运行"}`
  );
  hr();
  console.log("");
}

function composeArgs() {
  // docker compose (v2) 优先，回退到 docker-compose
  const v2 = exec("docker compose version");
  if (v2 !== null) return ["docker", "compose"];
  return ["docker-compose"];
}

const compose = (...args) => run([...composeArgs(), ...args]);

async function doDbUp() {
  loadEnv();
  if (!isDockerAvailable()) {
    log.err("Docker 不可用。请先启动 Docker Desktop。");
    return 1;
  }
  if (isDbContainerRunning()) {
    log.ok("数据库容器已在运行");
    return (await waitForDb()) ? 0 : 1;
  }
  log.step("启动数据库容器…");
  const code = await compose("-f", "docker-compose.yml", "up", "-d", "db");
  if (code !== 0) return 1;
  return (await waitForDb()) ? 0 : 1;
}

async function doDbDown() {
  await compose("-f", "docker-compose.yml", "down");
  log.ok("数据库已停止");
}

async function doDbReset() {
  loadEnv();
  log.step("停止并删除数据库容器与数据卷…");
  await compose("-f", "docker-compose.yml", "down", "-v");
  log.step("重新启动数据库…");
  await compose("-f", "docker-compose.yml", "up", "-d", "db");
  if (!(await waitForDb())) return 1;
  log.step("同步 schema…");
  await prisma("db", "push");
  log.step("填充种子数据…");
  await prisma("db", "seed");
  log.ok("数据库已重置");
}

async function doDbMigrate() {
  loadEnv();
  if (!(await ensureDb())) return 1;
  await prisma("migrate", "dev");
}

async function doDbPush() {
  loadEnv();
  if (!(await ensureDb())) return 1;
  await prisma("generate");
  await prisma("db", "push");
}

/**
 * 跑 prisma/seed.ts。
 *
 * **不用 `prisma db seed`**：它会通过 shell 执行 package.json 里配的
 * `tsx prisma/seed.ts`，而 `tsx` 只在 npm 脚本里才被加进 PATH ——
 * 从 dev.mjs 直接调时找不到命令（`'tsx' is not recognized`）。
 * 这里直接拿 tsx 的 cli 入口跑，绕开 PATH 这一层。
 */
function runSeed(extraEnv) {
  const tsxCli = path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
  return runNode(tsxCli, [path.join("prisma", "seed.ts")], {
    env: extraEnv,
  });
}

async function doDbSeed() {
  loadEnv();
  if (!(await ensureDb())) return 1;
  log.step("填充种子数据（问卷 + 演示用户）…");
  const code = await runSeed();
  if (code === 0) log.ok("种子数据已填充");
  return code;
}

/**
 * 只恢复"内容"（问卷），不建演示用户。
 * 清库后想把问卷找回来、但不想要 Steve/Alex/Notch_Fan 时用这个。
 */
async function doDbSeedContent() {
  loadEnv();
  if (!(await ensureDb())) return 1;
  log.step("填充内容（问卷），跳过演示用户…");
  const code = await runSeed({ SEED_SKIP_USERS: "1" });
  if (code === 0) log.ok("内容已恢复（不含演示用户）");
  return code;
}

async function doStudio() {
  loadEnv();
  if (!(await ensureDb())) return 1;
  log.step("打开 Prisma Studio（Ctrl+C 退出）…");
  await prisma("studio");
}

async function ensureDb() {
  if (!isDockerAvailable()) {
    log.err("Docker 不可用。请先启动 Docker Desktop。");
    return false;
  }
  if (!isDbContainerRunning()) {
    log.step("数据库未启动，正在启动…");
    await compose("-f", "docker-compose.yml", "up", "-d", "db");
    if (!(await waitForDb())) return false;
  } else if (!isDbReady()) {
    if (!(await waitForDb())) return false;
  }
  return true;
}

async function doDev() {
  loadEnv();
  log.step("启动 dev server (http://localhost:3000) …");
  await nextCmd("dev");
}

/**
 * 生产构建。
 * 先确保 Prisma Client 是新的 —— 否则 schema 改过之后 build 会拿旧类型过。
 */
async function doBuild() {
  loadEnv();
  if (!assertSecretForProduction()) return 1;
  await ensurePrismaClient();
  log.step("生产构建 (next build) …");
  return nextCmd("build");
}

/** 启动生产服务器（需要先 build） */
async function doStart() {
  loadEnv();
  if (!assertSecretForProduction()) return 1;
  log.step("启动生产服务器 (next start) …");
  return nextCmd("start");
}

/**
 * 重新生成 Prisma Client。
 * 注意：dev server 跑着的时候会占用 query engine，Windows 上会 EPERM，
 * 这时先关掉 dev server 再执行。
 */
async function doDbGenerate() {
  loadEnv();
  log.step("生成 Prisma Client…");
  const code = await prisma("generate");
  if (code === 0) log.ok("Prisma Client 已生成");
  else log.err("生成失败（dev server 可能在占用 engine，先停掉再试）");
  return code;
}

async function doPreflight() {
  loadEnv();
  log.step("TypeScript 类型检查…");
  const t0 = await run([NODE, path.join(ROOT, "node_modules", "typescript", "bin", "tsc"), "--noEmit"]);
  log.step("ESLint…");
  const t1 = await run([NODE, path.join(ROOT, "node_modules", "eslint", "bin", "eslint.js"), "src"]);
  // 缺键不会让构建失败，只在浏览器里抛 MISSING_MESSAGE，所以单独查一遍
  log.step("i18n 键一致性…");
  const t2 = await run([NODE, path.join(ROOT, "scripts", "i18n-check.mjs")]);
  // 类型对不等于逻辑对（IP 取错边那种 bug 完全通得过 tsc），所以纯函数也跑一遍
  log.step("单元测试…");
  const t3 = await run(testArgs());

  // ⚠️ 必须**返回**退出码：main() 是 `const code = (await fn()) ?? 0`，
  // 不返回就等于永远 exit 0 —— CI 和 `debug.bat preflight && ...` 都会误判成功。
  const failed = [t0, t1, t2, t3].filter((c) => c !== 0).length;
  if (failed === 0) log.ok("preflight 全部通过");
  else log.err(`preflight 存在错误（${failed} 项未通过）`);
  return failed === 0 ? 0 : 1;
}

/** 单元测试的命令行。测试文件里有 server-only 模块，所以要 react-server 条件 */
function testArgs() {
  return [
    NODE,
    "--conditions=react-server",
    "--import",
    "tsx",
    "--test",
    "src/**/*.test.ts",
  ];
}

async function doTest() {
  loadEnv();
  log.step("单元测试…");
  const code = await run(testArgs());
  if (code === 0) log.ok("测试通过");
  else log.err("测试失败");
  return code;
}

/**
 * 备份数据库。
 * 逻辑都在 scripts/backup.mjs 里（纯 Node，不依赖 tsx），这里只是转发参数 ——
 * `debug.bat backup --keep 30` 这种写法能直接用。
 */
async function doBackup(rest = []) {
  loadEnv();
  const script = path.join(ROOT, "scripts", "backup.mjs");
  // 成败由 backup.mjs 自己汇报（它会打出文件、大小、轮转结果），这里不再重复
  return run([NODE, script, ...rest], { env: { NODE_OPTIONS: "" } });
}

/** 清理过期数据（逻辑在 src/server/retention.ts，借 tsx 跑） */
async function doCleanup(rest = []) {
  loadEnv();
  const script = path.join(ROOT, "scripts", "cleanup.mts");
  return run(
    [NODE, "--conditions=react-server", "--import", "tsx", script, ...rest],
    { env: { NODE_OPTIONS: "" } }
  );
}

/**
 * SMTP 自检：确认验证码 / 找回密码的邮件能不能真发出去。
 * 不带参数只检查配置与连通性，带邮箱则真发一封测试邮件。
 */
async function doMailTest(to) {
  loadEnv();
  const mod = await import("./mail-test.mjs");
  return mod.main({ to });
}

/**
 * 发送**真实模板**的验证码邮件预览（验证码是假的）。
 * 用来调邮件排版，不依赖"注册一个新账号"。
 *
 * 模板是 TS，所以这里借 tsx 直接跑 .mts，省得把模板复制一份到脚本里。
 */
async function doMailPreview(to) {
  loadEnv();
  if (!to) {
    log.warn("需要提供收件邮箱。");
    return 1;
  }
  const script = path.join(ROOT, "scripts", "mail-preview.mts");
  return run(
    [NODE, "--conditions=react-server", "--import", "tsx", script, to],
    { env: { NODE_OPTIONS: "" } }
  );
}

/**
 * Prisma Client 是否已生成（用 query engine 是否存在判断）。
 *
 * Windows 上如果 dev server / Prisma Studio 正在运行，它们会占用
 * query_engine-windows.dll.node，此时再跑 prisma generate 会因无法重命名该文件而
 * 报 EPERM。因此只有在客户端缺失、或 schema 比客户端更新时才需要生成。
 */
function prismaClientGenerated() {
  const candidates = [
    path.join(ROOT, "node_modules", ".prisma", "client", "query_engine-windows.dll.node"),
    path.join(ROOT, "node_modules", ".prisma", "client", "libquery_engine-debian-openssl-3.0.x.so.node"),
    path.join(ROOT, "node_modules", ".prisma", "client", "libquery_engine-darwin.dylib.node"),
  ];
  return candidates.some((p) => existsSync(p));
}

/** schema.prisma 是否比已生成的客户端更新 */
function prismaSchemaNewer() {
  const schema = path.join(ROOT, "prisma", "schema.prisma");
  const marker = path.join(ROOT, "node_modules", ".prisma", "client", "index.js");
  try {
    return statSync(schema).mtimeMs > statSync(marker).mtimeMs;
  } catch {
    return true;
  }
}

/** 需要时才生成 Prisma Client，避免 Windows 上运行中的进程占用导致 EPERM */
async function ensurePrismaClient() {
  if (prismaClientGenerated() && !prismaSchemaNewer()) {
    log.dim("Prisma Client 已是最新，跳过生成");
    return;
  }
  log.step("生成 Prisma Client…");
  const code = await prisma("generate");
  if (code !== 0) {
    log.warn(
      "Prisma Client 生成失败（Windows 上常见原因是 dev server / Prisma Studio 占用了引擎文件）。"
    );
    log.dim("如果站点能正常访问数据库，可以忽略；否则请先停止 dev server 再重跑。");
  }
}

async function doUp({ seed = false } = {}) {
  banner();
  await doCheck();
  await doDbUp();
  log.step("同步 schema…");
  await ensurePrismaClient();
  await prisma("db", "push");
  if (seed) {
    log.step("填充种子数据…");
    await prisma("db", "seed");
  }
  log.ok("环境就绪，启动开发服务器…");
  console.log("");
  await doDev();
}

// ---------------------------------------------------------------------------
// 调试辅助（需要 @prisma/client 与 iron-session）
// ---------------------------------------------------------------------------
async function loadPrisma() {
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

async function findUserByUsername(prisma, username) {
  const user = await prisma.user.findFirst({
    where: { minecraftUsername: username },
  });
  if (!user) {
    // 也支持按 id 查找
    return prisma.user.findUnique({ where: { id: username } });
  }
  return user;
}

async function promptLine(question) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await new Promise((resolve) =>
    rl.question(question, (a) => {
      rl.close();
      resolve(a.trim());
    })
  );
  return answer;
}

/** 读取 `--flag value` 形式的参数值，未提供时返回 undefined */
function flagValue(args, flag) {
  const i = args.indexOf(flag);
  if (i === -1) return undefined;
  const value = args[i + 1];
  if (!value || value.startsWith("--")) return undefined;
  return value;
}

async function doPromoteAdmin(username) {
  loadEnv();
  if (!username) {
    log.err(
      "用法: node scripts/dev.mjs admin <玩家名>（不带参数运行将进入交互式菜单）"
    );
    return 1;
  }
  const prisma = await loadPrisma();
  const user = await findUserByUsername(prisma, username);
  if (!user) {
    await prisma.$disconnect();
    return reportMissingUser(prisma, username);
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { role: "ADMIN" },
  });
  log.ok(`已将 ${user.minecraftUsername} (${user.id}) 提升为 ADMIN`);
  await prisma.$disconnect();
}

async function genSessionCookie(user) {
  loadEnv();
  const { sealData } = await import("iron-session");
  const secret = envValue("SESSION_SECRET");
  if (!secret) {
    log.err("SESSION_SECRET 未配置，无法生成会话。");
    return null;
  }
  /*
    ⚠️ **必须带上 sessionVersion。**
    会话 cookie 是无状态的，服务端靠对比 User.sessionVersion 来判断它有没有
    被作废（改密码时会 +1，见 src/server/auth.ts 的 getSessionUser）。
    这里只封 { userId } 的话，版本号是 undefined、和库里的 1 对不上，
    生成的 cookie 会**立刻被判为未登录** —— 调试入口等于失效。

    传用户行（而不是只传 id），这样调用方拿到的就是最新的版本号。
  */
  return sealData(
    { userId: user.id, sessionVersion: user.sessionVersion },
    { password: secret, ttl: 60 * 60 * 24 * 30 }
  );
}

/**
 * 未找到用户时的诊断：区分「名字写错」和「库里根本没有用户」，
 * 后者给出可直接照做的下一步（审批期间无法登录，需先 adduser）。
 */
async function reportMissingUser(prisma, username) {
  let total = 0;
  try {
    total = await prisma.user.count();
  } catch {
    // 数据库不可达等情况，退回普通提示
  }
  await prisma.$disconnect();

  if (total === 0) {
    log.err(`未找到用户「${username}」—— 当前数据库里没有任何用户。`);
    console.log("");
    log.info("账号在首次 Microsoft 登录时才会自动创建。若登录尚未打通，可以：");
    console.log(
      `    ${c.bold(`node scripts/dev.mjs adduser ${username}`)}   ${c.dim("# 直接新建调试用户")}`
    );
    console.log(
      `    ${c.bold("node scripts/dev.mjs db:seed")}             ${c.dim("# 或灌入 Steve / Alex / Notch_Fan 三个 demo 用户")}`
    );
  } else {
    log.err(`未找到用户「${username}」（库中共有 ${total} 个用户）。`);
    log.info("玩家名不匹配；也可直接传用户 ID。列出全部用户：");
    console.log(`    ${c.bold("node scripts/dev.mjs users")}`);
  }
  return 1;
}

/** 新建调试用户：审批期间无法登录时，用它造出可登录的账号 */
async function doAddUser(username, { role = "USER", uuid = null } = {}) {
  loadEnv();
  if (!username) {
    log.err(
      "用法: node scripts/dev.mjs adduser <玩家名> [--admin] [--uuid <UUID>]"
    );
    return 1;
  }
  const prisma = await loadPrisma();

  // UUID 用于皮肤头像 / 3D 模型；传入时先做格式校验
  let normalizedUuid = null;
  if (uuid) {
    normalizedUuid = normalizeUuid(uuid);
    if (!normalizedUuid) {
      log.err(`UUID 格式不正确：「${uuid}」（应为标准 36 位，如 xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx）`);
      await prisma.$disconnect();
      return 1;
    }
  }

  const existing = await findUserByUsername(prisma, username);
  if (existing) {
    log.warn(
      `用户「${username}」已存在 (${existing.id}, role=${existing.role})，未做修改。`
    );
    await prisma.$disconnect();
    return 0;
  }

  if (normalizedUuid) {
    const byUuid = await prisma.user.findUnique({
      where: { minecraftUuid: normalizedUuid },
    });
    if (byUuid) {
      log.err(
        `该 UUID 已被用户「${byUuid.minecraftUsername ?? byUuid.id}」占用，未创建。`
      );
      await prisma.$disconnect();
      return 1;
    }
  }

  const created = await prisma.user.create({
    data: {
      minecraftUsername: username,
      minecraftUuid: normalizedUuid,
      role: role === "ADMIN" ? "ADMIN" : "USER",
    },
  });
  log.ok(
    `已新建用户 ${created.minecraftUsername} (${created.id}, role=${created.role})` +
      (created.minecraftUuid ? ` uuid=${created.minecraftUuid}` : "")
  );
  if (created.role !== "ADMIN") {
    log.info(`如需管理员权限：node scripts/dev.mjs admin ${username}`);
  }
  await prisma.$disconnect();
}

/** 补齐 UUID 的标准格式（也接受 32 位无连字符写法）；非法返回 null */
function normalizeUuid(uuid) {
  const hex = String(uuid).replace(/[^0-9a-fA-F]/g, "");
  if (hex.length !== 32) return null;
  const dashed = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return dashed.toLowerCase();
}

/** 删除用户（按玩家名或用户 ID），连带删除其问卷提交（数据库 onDelete: Cascade） */
async function doDeleteUser(target) {
  loadEnv();
  if (!target) {
    log.err("用法: node scripts/dev.mjs deleteuser <玩家名|用户ID>");
    return 1;
  }
  const prisma = await loadPrisma();
  const user = await findUserByUsername(prisma, target);
  if (!user) {
    return reportMissingUser(prisma, target);
  }

  const submissions = await prisma.submission.count({
    where: { userId: user.id },
  });

  await prisma.user.delete({ where: { id: user.id } });
  log.ok(
    `已删除用户 ${user.minecraftUsername ?? "(无玩家名)"} (${user.id}, role=${user.role})`
  );
  if (submissions > 0) {
    log.dim(`同时级联删除了该用户的 ${submissions} 条问卷提交`);
  }
  await prisma.$disconnect();
}

/** 更新用户的 UUID / 玩家名 / 角色 */
async function doUpdateUser(target, { uuid, username, role } = {}) {
  loadEnv();
  if (!target) {
    log.err(
      "用法: node scripts/dev.mjs updateuser <玩家名|用户ID> [--uuid <UUID>] [--name <玩家名>] [--role ADMIN|USER]"
    );
    return 1;
  }
  const prisma = await loadPrisma();
  const user = await findUserByUsername(prisma, target);
  if (!user) {
    return reportMissingUser(prisma, target);
  }

  const data = {};
  if (uuid !== undefined) {
    const normalized = normalizeUuid(uuid);
    if (!normalized) {
      log.err(`UUID 格式不正确：「${uuid}」`);
      await prisma.$disconnect();
      return 1;
    }
    data.minecraftUuid = normalized;
  }
  if (username) data.minecraftUsername = username;
  if (role) {
    const upper = String(role).toUpperCase();
    if (upper !== "ADMIN" && upper !== "USER") {
      log.err(`角色只能是 ADMIN 或 USER，收到「${role}」`);
      await prisma.$disconnect();
      return 1;
    }
    data.role = upper;
  }

  if (Object.keys(data).length === 0) {
    log.warn("没有需要更新的字段。");
    await prisma.$disconnect();
    return 1;
  }

  const updated = await prisma.user.update({ where: { id: user.id }, data });
  log.ok(
    `已更新 ${updated.minecraftUsername ?? "(无玩家名)"} (${updated.id})：` +
      `uuid=${updated.minecraftUuid ?? "—"} role=${updated.role}`
  );
  await prisma.$disconnect();
}

/** 打开独立的用户管理 / 强制登录工具（交互式，见 scripts/users.mjs） */
async function doOpenUserManager() {
  const script = path.join(ROOT, "scripts", "users.mjs");
  if (!existsSync(script)) {
    log.err("找不到 scripts/users.mjs");
    return 1;
  }
  try {
    await runNode(script);
  } catch (err) {
    log.dim(`用户管理已退出（${err?.message ?? err}）`);
  }
  return 0;
}

/** 列出全部用户，便于确认可用的玩家名 / 用户 ID */
async function doListUsers() {
  loadEnv();
  const prisma = await loadPrisma();
  let users = [];
  try {
    users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        minecraftUsername: true,
        minecraftUuid: true,
        role: true,
      },
    });
  } catch (err) {
    await prisma.$disconnect();
    log.err(`读取用户失败：${err?.message ?? err}`);
    return 1;
  }
  await prisma.$disconnect();

  banner();
  if (users.length === 0) {
    log.warn("数据库里还没有任何用户。");
    log.info("新建一个：node scripts/dev.mjs adduser <玩家名>");
    console.log("");
    return 0;
  }
  console.log(`共 ${users.length} 个用户：`);
  console.log("");
  for (const u of users) {
    const who = u.minecraftUsername ?? "(无玩家名)";
    const uuid = u.minecraftUuid ? ` uuid=${u.minecraftUuid.slice(0, 8)}…` : "";
    console.log(`  ${c.bold(who)}  [${u.role}]  ${c.dim(u.id)}${c.dim(uuid)}`);
  }
  console.log("");
  return 0;
}

async function doSession(username) {
  if (!username) {
    log.err(
      "用法: node scripts/dev.mjs session <玩家名>（不带参数运行将进入交互式菜单）"
    );
    return 1;
  }
  const prisma = await loadPrisma();
  const user = await findUserByUsername(prisma, username);
  if (!user) {
    return reportMissingUser(prisma, username);
  }
  // findUserByUsername 用的是 findUnique（全字段），sessionVersion 已经在里面
  const sealed = await genSessionCookie(user);
  if (!sealed) return 1;
  hr();
  log.ok(`为用户 ${user.minecraftUsername} 生成调试会话（30 天有效）：`);
  console.log("");
  console.log(c.bold(c.green(`  mc_session=${sealed}`)));
  console.log("");
  log.info("在浏览器 DevTools → Application → Cookies 中写入该值，或通过 curl 使用：");
  console.log(c.dim(`  curl -H "Cookie: mc_session=${sealed}" http://localhost:3000/dashboard`));
  hr();
}

async function doMakeAdmin(username) {
  if (!username) {
    log.err(
      "用法: node scripts/dev.mjs makeadmin <玩家名>（不带参数运行将进入交互式菜单）"
    );
    return 1;
  }
  const promoted = await doPromoteAdmin(username);
  if (promoted) return promoted;
  // 角色已在 doPromoteAdmin 中确认存在，这里重新读取只为生成会话
  const prisma = await loadPrisma();
  const user = await findUserByUsername(prisma, username);
  await prisma.$disconnect();
  if (!user) return 1;
  await doSession(username);
}

// ---------------------------------------------------------------------------
// 帮助 / 菜单
// ---------------------------------------------------------------------------
function help() {
  banner();
  console.log("用法: node scripts/dev.mjs [命令] [参数]");
  console.log("");
  console.log(c.bold("  启动 / 数据库"));
  console.log("    up                一键启动（检查 → 数据库 → 迁移 → dev）");
  console.log("    up --seed         一键启动并填充种子数据");
  console.log("    dev               仅启动 dev server");
  console.log("    build             生产构建（next build）");
  console.log("    start             启动生产服务器（需先 build）");
  console.log("    db:up / db:down   启动 / 停止数据库");
  console.log("    db:reset          重置数据库（清空 + 迁移 + seed）");
  console.log("    db:migrate        执行 Prisma 迁移");
  console.log("    db:push           同步 schema（无迁移文件）");
  console.log("    db:generate       重新生成 Prisma Client");
  console.log("    db:seed           填充种子数据");
  console.log("    db:seed:content   只恢复问卷，不建演示用户");
  console.log("    db:studio         打开 Prisma Studio");
  console.log("");
  console.log(c.bold("  检查 / 信息"));
  console.log("    check             环境检查（doctor）");
  console.log("    preflight         typecheck + eslint + i18n + 单元测试");
  console.log("    test              只跑单元测试");
  console.log("    backup            备份数据库（pg_dump，带轮转）");
  console.log("    cleanup           清理过期数据（验证码 / 下载明细 / 每日计数）");
  console.log("    info              项目 / 环境信息");
  console.log("    mail:test [邮箱]  SMTP 自检（不带邮箱只测连接）");
  console.log("    mail:preview <邮箱>  发送真实模板的验证码邮件预览");
  console.log("");
  console.log(c.bold("  调试辅助（审批期间登录用）"));
  console.log("    users             打开用户管理 / 强制登录（交互式，= npm run users）");
  console.log("    users:list        列出全部用户（确认玩家名 / 用户 ID）");
  console.log("    adduser <玩家名>  新建用户（无需 Microsoft 登录）");
  console.log("                      --admin  直接给管理员权限");
  console.log("                      --uuid <UUID>  绑定 Minecraft UUID（用于皮肤）");
  console.log("    updateuser <用户> 修改用户的 UUID / 玩家名 / 角色");
  console.log("                      --uuid <UUID> | --name <玩家名> | --role ADMIN|USER");
  console.log("    deleteuser <用户> 删除用户（连带其问卷提交）");
  console.log("    admin <玩家名>    将用户提升为管理员");
  console.log("    session <玩家名>  生成调试用会话 cookie");
  console.log("    makeadmin <玩家名> 提升管理员并生成会话 cookie");
  console.log("");
  console.log(c.dim("以上命令省略 <玩家名> 会交互式提示输入。"));
  console.log(c.dim("不带参数运行将进入交互式菜单。"));
  console.log(c.dim("也可以直接用 debug.bat（等价，且更省事）。"));
  console.log("");
}

const MENU = [
  { group: "启动 / 数据库" },
  { key: "1", label: "一键启动（检查 → 数据库 → 迁移 → dev）", fn: () => doUp() },
  { key: "2", label: "一键启动并填充种子数据", fn: () => doUp({ seed: true }) },
  { key: "3", label: "仅启动 dev server", fn: doDev },
  { key: "4", label: "环境检查 (doctor)", fn: doCheck },
  { key: "5", label: "重置数据库（清空 + 迁移 + seed）", fn: doDbReset },
  { key: "6", label: "打开 Prisma Studio", fn: doStudio },
  { key: "c", label: "恢复问卷内容（不建演示用户）", fn: doDbSeedContent },
  { key: "b", label: "生产构建 (next build)", fn: doBuild },
  { key: "r", label: "启动生产服务器 (next start)", fn: doStart },
  { key: "t", label: "重新生成 Prisma Client", fn: doDbGenerate },
  { group: "检查 / 信息" },
  { key: "7", label: "代码检查（typecheck + eslint + i18n）", fn: doPreflight },
  { key: "8", label: "项目 / 环境信息", fn: doInfo },
  {
    key: "9",
    label: "SMTP 自检（发测试邮件）",
    input: "收件邮箱（留空只测连接）> ",
    optionalInput: true,
    fn: (to) => doMailTest(to),
  },
  {
    key: "v",
    label: "预览验证码邮件排版",
    input: "收件邮箱 > ",
    fn: (to) => doMailPreview(to),
  },
  { group: "调试辅助（审批期间登录用）" },
  { key: "u", label: "列出全部用户（简表）", fn: doListUsers },
  {
    key: "a",
    label: "新建调试用户",
    input: "玩家名 > ",
    fn: (name) => doAddUser(name),
  },
  {
    key: "p",
    label: "提升用户为管理员",
    input: "玩家名 > ",
    fn: (name) => doPromoteAdmin(name),
  },
  {
    key: "s",
    label: "生成调试会话 cookie",
    input: "玩家名 > ",
    fn: (name) => doSession(name),
  },
  {
    key: "m",
    label: "提升管理员 + 生成会话 cookie（一步到位）",
    input: "玩家名 > ",
    fn: (name) => doMakeAdmin(name),
  },
  {
    key: "d",
    label: "删除用户（连带问卷提交）",
    input: "玩家名 / 用户ID > ",
    fn: (name) => doDeleteUser(name),
  },
  {
    key: "g",
    label: "打开用户管理 / 强制登录（交互式）",
    fn: doOpenUserManager,
  },
  { group: "" },
  { key: "0", label: "退出", fn: null },
];

async function menu() {
  banner();
  console.log("请选择操作：");
  console.log("");
  for (const item of MENU) {
    if (item.group !== undefined) {
      if (item.group) {
        console.log(`  ${c.dim(item.group)}`);
      }
      continue;
    }
    console.log(`  ${c.bold(item.key)}) ${item.label}`);
  }
  console.log("");
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await new Promise((resolve) =>
    rl.question("输入编号并回车 > ", (a) => {
      rl.close();
      resolve(a.trim());
    })
  );
  const item = MENU.find(
    (m) => m.group === undefined && m.key === answer.toLowerCase()
  );
  if (item && item.fn) {
    console.log("");
    if (item.input) {
      const value = await promptLine(item.input);
      // optionalInput 的项允许留空（例如 SMTP 自检只测连接不发信）
      if (!value && !item.optionalInput) {
        log.warn("未输入内容，已取消。");
      } else {
        await item.fn(value);
      }
    } else {
      await item.fn();
    }
    console.log("");
    log.dim("按回车返回菜单…");
    await promptLine("");
    await menu();
  } else if (answer !== "0") {
    log.warn("无效的选项。");
    await sleep(400);
    await menu();
  }
}

// ---------------------------------------------------------------------------
// 入口
// ---------------------------------------------------------------------------
async function main() {
  const [cmd, ...args] = process.argv.slice(2);

  if (!cmd) {
    await menu();
    return;
  }

  if (cmd === "--help" || cmd === "-h" || cmd === "help") {
    help();
    return;
  }

  const commands = {
    up: () => doUp({ seed: args.includes("--seed") }),
    dev: doDev,
    build: doBuild,
    start: doStart,
    "db:up": doDbUp,
    "db:down": doDbDown,
    "db:reset": doDbReset,
    "db:migrate": doDbMigrate,
    "db:push": doDbPush,
    "db:generate": doDbGenerate,
    "db:seed": doDbSeed,
    "db:seed:content": doDbSeedContent,
    "db:studio": doStudio,
    check: doCheck,
    preflight: doPreflight,
    test: doTest,
    backup: () => doBackup(args),
    cleanup: () => doCleanup(args),
    info: doInfo,
    "mail:test": () => doMailTest(args[0]),
    "mail:preview": () => doMailPreview(args[0]),
    users: doOpenUserManager,
    // 旧写法保留，避免已有的习惯/文档失效
    "users:manage": doOpenUserManager,
    "users:list": doListUsers,
    adduser: () =>
      doAddUser(args[0], {
        role: args.includes("--admin") ? "ADMIN" : "USER",
        uuid: flagValue(args, "--uuid"),
      }),
    deleteuser: () => doDeleteUser(args[0]),
    updateuser: () =>
      doUpdateUser(args[0], {
        uuid: flagValue(args, "--uuid"),
        username: flagValue(args, "--name"),
        role: flagValue(args, "--role"),
      }),
    admin: () => doPromoteAdmin(args[0]),
    session: () => doSession(args[0]),
    makeadmin: () => doMakeAdmin(args[0]),
  };

  const fn = commands[cmd];
  if (!fn) {
    log.err(`未知命令「${cmd}」。使用 --help 查看帮助。`);
    process.exit(1);
  }

  const code = (await fn()) ?? 0;
  if (typeof code === "number" && code !== 0) process.exit(code);
}

main().catch((err) => {
  log.err(err?.message ?? String(err));
  process.exit(1);
});
