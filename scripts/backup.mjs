/**
 * 数据库备份（`debug.bat backup`）。
 *
 * 为什么必须有这个：**站点的全部用户内容都在 Postgres 里** —— 资源附件、
 * 封面、轮播图、账号、问卷。这个项目已经出过一次"资源全没了"的事故，
 * 当时的补救是加了审计日志，但审计日志只能事后查**是谁删的**，
 * **救不回数据**。没有备份，一次误操作就是终局。
 *
 * 做法：`pg_dump` 出纯 SQL，边 dump 边 gzip，按时间戳存到 `backups/`，
 * 只留最近 N 份。用纯 SQL（而不是自定义格式）是有意的：恢复只需要 psql，
 * 不依赖 pg_restore 的版本匹配 —— 出事的时候少一个变量。
 *
 * 用法：
 *   node scripts/backup.mjs                 # 正常备份
 *   node scripts/backup.mjs --keep 30       # 保留 30 份（默认 14）
 *   node scripts/backup.mjs --out D:\bak    # 换目录（建议指向另一块盘）
 *   node scripts/backup.mjs --list          # 只列出现有备份
 *
 * 生产上挂 cron，例如每天凌晨 4 点：
 *   0 4 * * * cd /srv/cts-website && node scripts/backup.mjs >> logs/backup.log 2>&1
 *
 * ⚠️ **备份放在同一块盘上不算备份。** 默认写到仓库下的 `backups/`
 * （已 gitignore），正式部署请用 `--out` 指到另一块磁盘或另一台机器。
 */
import { spawn } from "node:child_process";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* ------------------------------------------------------------ 参数解析 */
function flag(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const KEEP = Math.max(1, Number(flag("keep", "14")) || 14);
const OUT_DIR = path.resolve(ROOT, flag("out", "backups"));
const LIST_ONLY = process.argv.includes("--list");

/* --------------------------------------------------------- 读取连接串 */
/** 极简 .env 解析：只认 KEY=VALUE，够用且不引依赖 */
function loadEnv() {
  const file = path.join(ROOT, ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m) continue;
    const value = m[2].replace(/^["']|["']$/g, "");
    if (!(m[1] in process.env)) process.env[m[1]] = value;
  }
}
loadEnv();

function parseDbUrl(raw) {
  try {
    const u = new URL(raw);
    return {
      user: decodeURIComponent(u.username) || "postgres",
      db: decodeURIComponent(u.pathname.replace(/^\//, "")) || "postgres",
    };
  } catch {
    return null;
  }
}

const url = process.env.DATABASE_URL;

/* ------------------------------------------------------------ 列备份 */
function listBackups() {
  if (!existsSync(OUT_DIR)) return [];
  return readdirSync(OUT_DIR)
    .filter((f) => f.startsWith("cts-") && f.endsWith(".sql.gz"))
    .map((name) => {
      const full = path.join(OUT_DIR, name);
      const st = statSync(full);
      return { name, full, size: st.size, mtime: st.mtime };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

const fmt = (bytes) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

if (LIST_ONLY) {
  const rows = listBackups();
  if (rows.length === 0) {
    console.log(`没有找到备份（目录：${OUT_DIR}）`);
  } else {
    console.log(`备份目录：${OUT_DIR}`);
    for (const r of rows) {
      console.log(`  ${r.name}  ${fmt(r.size).padStart(9)}  ${r.mtime.toISOString()}`);
    }
  }
  process.exit(0);
}

if (!url) {
  console.error("✖ 没有 DATABASE_URL（检查 .env 或环境变量）");
  process.exit(1);
}

/* ------------------------------------------------------------ 跑 dump */
/**
 * 起一个 pg_dump 进程。
 *
 * 优先用本机的 `pg_dump`；本机没装（ENOENT）就退回 `docker compose exec`，
 * 因为本项目默认的数据库就是 compose 起的那个 postgres 容器。
 * `PG_DUMP_BIN` 可以强制指定二进制路径。
 */
function spawnDump() {
  const override = process.env.PG_DUMP_BIN;
  const parsed = parseDbUrl(url);

  const attempts = [];
  if (override) {
    attempts.push({ bin: override, args: [url], label: override });
  } else {
    attempts.push({ bin: "pg_dump", args: [url], label: "pg_dump" });
    if (parsed) {
      attempts.push({
        bin: "docker",
        args: [
          "compose",
          "exec",
          "-T",
          "db",
          "pg_dump",
          "-U",
          parsed.user,
          "-d",
          parsed.db,
        ],
        label: "docker compose exec db pg_dump",
      });
    }
  }
  return attempts;
}

/** 试每一种方式，返回第一个能真正跑起来的进程 */
function startDump(attempts, index = 0) {
  const attempt = attempts[index];
  if (!attempt) {
    return { child: null, stdout: null, done: Promise.resolve({ ok: false, message: "" }) };
  }

  const child = spawn(attempt.bin, attempt.args, {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });

  let stderr = "";
  child.stderr.on("data", (d) => (stderr += d.toString()));

  const done = new Promise((resolve) => {
    child.on("error", (err) => resolve({ ok: false, message: err.message, enoent: err.code === "ENOENT" }));
    child.on("close", (code) =>
      resolve({
        ok: code === 0,
        message: code === 0 ? "" : stderr.trim() || `${attempt.label} 退出码 ${code}`,
        enoent: false,
      })
    );
  });

  return { child, stdout: child.stdout, done, attempt, attempts, index };
}

mkdirSync(OUT_DIR, { recursive: true });

const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
const target = path.join(OUT_DIR, `cts-${stamp}.sql.gz`);

const attempts = spawnDump();
let session = startDump(attempts);

// 本机没有 pg_dump 时，立刻换 docker 那条路（进程还没吐任何东西）
if (session.child) {
  const early = await Promise.race([
    session.done,
    new Promise((r) => setTimeout(() => r(null), 120)),
  ]);
  if (early && !early.ok && early.enoent && session.index + 1 < attempts.length) {
    session = startDump(attempts, session.index + 1);
  } else if (early && !early.ok && !early.enoent) {
    console.error(`✖ 备份失败：${early.message}`);
    process.exit(1);
  }
}

if (!session.stdout) {
  console.error("✖ 找不到可用的 pg_dump。");
  console.error("  装 postgresql-client，或用 PG_DUMP_BIN 指定路径。");
  process.exit(1);
}

try {
  await pipeline(session.stdout, createGzip({ level: 6 }), createWriteStream(target));
} catch (err) {
  try {
    unlinkSync(target);
  } catch {
    /* ignore */
  }
  console.error(`✖ 写入失败：${err.message}`);
  process.exit(1);
}

const result = await session.done;
if (!result.ok) {
  // 半截文件比没有更危险 —— 留着会被当成"有一份备份"
  try {
    unlinkSync(target);
  } catch {
    /* ignore */
  }
  console.error(`✖ 备份失败：${result.message}`);
  process.exit(1);
}

const size = statSync(target).size;

/* -------------------------------------------------------------- 轮转 */
const all = listBackups();
const removed = all.slice(KEEP);

console.log("");
console.log("  ✔ 备份完成");
console.log(`    文件  ${path.relative(ROOT, target)}`);
console.log(`    大小  ${fmt(size)}`);
console.log(`    方式  ${session.attempt?.label ?? "pg_dump"}`);
console.log(`    保留  最近 ${KEEP} 份（原有 ${all.length} 份）`);
for (const r of removed) {
  unlinkSync(r.full);
  console.log(`    清理  已删除 ${r.name}`);
}
console.log("");
console.log("  恢复方式（会覆盖现有数据，先停掉应用）：");
console.log(`    gunzip -c ${path.basename(target)} | psql "$DATABASE_URL"`);
console.log("");
