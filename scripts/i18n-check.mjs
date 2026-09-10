/**
 * i18n 一致性检查。
 *
 * 为什么需要它：next-intl 在遇到缺失的键时**不会**构建失败，只在浏览器里
 * 抛 `MISSING_MESSAGE`，页面照常渲染、文字位置留空 —— 很容易漏掉。
 * 这个脚本做两件事：
 *   1. 比对 messages/zh.json 与 messages/en.json 的键集合（双语必须同步）
 *   2. 扫描 src/ 里 `useTranslations("ns")` / `getTranslations("ns")` 绑定，
 *      检查每个 `t("literal")` 引用的键真实存在
 *
 * 用法：node scripts/i18n-check.mjs
 * 退出码：0 通过，1 有问题
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function flatten(obj, prefix = "") {
  const out = new Map();
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const [kk, vv] of flatten(v, p)) out.set(kk, vv);
    } else {
      out.set(p, v);
    }
  }
  return out;
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if ([".ts", ".tsx"].includes(extname(p))) acc.push(p);
  }
  return acc;
}

const zh = flatten(
  JSON.parse(readFileSync(join(ROOT, "messages", "zh.json"), "utf8"))
);
const en = flatten(
  JSON.parse(readFileSync(join(ROOT, "messages", "en.json"), "utf8"))
);

const problems = [];

/* ---------------------------------------------------------- 1. 双语键一致性 */

const onlyZh = [...zh.keys()].filter((k) => !en.has(k)).sort();
const onlyEn = [...en.keys()].filter((k) => !zh.has(k)).sort();

if (onlyZh.length) {
  problems.push(`只在 zh.json 里存在的键（${onlyZh.length}）：`);
  for (const k of onlyZh) problems.push(`  - ${k}`);
}
if (onlyEn.length) {
  problems.push(`只在 en.json 里存在的键（${onlyEn.length}）：`);
  for (const k of onlyEn) problems.push(`  - ${k}`);
}

/* ------------------------------------------------------ 2. 源码引用的键存在 */

for (const file of walk(join(ROOT, "src"))) {
  const src = readFileSync(file, "utf8");

  // const t = useTranslations("ns") / await getTranslations("ns")
  const bindings = new Map();
  const bindRe =
    /(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*"([^"]+)"\s*\)/g;
  let m;
  while ((m = bindRe.exec(src))) bindings.set(m[1], m[2]);

  for (const [varName, ns] of bindings) {
    const useRe = new RegExp(`\\b${varName}\\s*\\(\\s*"([^"]+)"`, "g");
    let u;
    while ((u = useRe.exec(src))) {
      const full = `${ns}.${u[1]}`;
      if (zh.has(full) || en.has(full)) continue;
      const line = src.slice(0, u.index).split("\n").length;
      problems.push(`${relative(ROOT, file)}:${line}  缺失的键 ${full}`);
    }
  }
}

/* ------------------------------------------------------------------ 输出 */

if (problems.length) {
  console.error("✖ i18n 检查未通过：\n");
  for (const line of problems) console.error(line);
  console.error(`\nzh ${zh.size} 个键 / en ${en.size} 个键`);
  process.exit(1);
}

console.log(
  `✔ i18n 检查通过（zh ${zh.size} 个键 / en ${en.size} 个键，双语一致，引用全部存在）`
);
