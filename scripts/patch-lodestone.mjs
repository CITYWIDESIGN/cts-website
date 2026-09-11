/**
 * 给 `@mattzh72/lodestone` 打一个一行的补丁。
 *
 * 问题：`lib/packs/default.js` 里用
 *     new URL('../../assets/default-pack/', import.meta.url)
 * 来定位自带的原版材质包。那是个**目录**，而 Turbopack 和 webpack 都会把
 * `new URL(..., import.meta.url)` 当成静态资源引用去解析 —— 目录解析不了，
 * **整个生产构建直接失败**（`Module not found`）。开发模式不打包所以看不出来。
 *
 * 试过但没用的路：`next build --webpack` 一样失败；改用 subpath 导入绕不开，
 * 因为 `LitematicLoader` 只在主入口导出，而主入口 import 了这个文件。
 *
 * 补丁：把那句换成我们自己的公开路径。我们**本来就显式传 baseUrl**
 * （见 src/lib/litematic/preview.ts），这句只是兜底默认值。
 *
 * ⚠️ 这里必须构造**绝对地址**：lodestone 内部拿它当 `new URL('assets.json', base)`
 * 的 base，而 URL 构造器不接受相对路径 —— 给 `'/lodestone-pack/'` 会直接抛
 * `Invalid base URL`。所以拼上 origin（Node 环境下没有 location，退回占位值，
 * 反正那种情况下也不会真的去 fetch）。
 *
 * 幂等，可以重复跑。构建前自动执行（package.json 的 prebuild）。
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = path.join(ROOT, "node_modules", "@mattzh72", "lodestone", "lib", "packs", "default.js");

if (!existsSync(TARGET)) {
  // 依赖还没装好（或者被 prune 掉了）—— 不是错误，安静跳过
  console.log("[patch-lodestone] 没找到 lodestone，跳过");
  process.exit(0);
}

const ORIGINAL = /const base = new URL\([^)]*import\.meta\.url\)\.toString\(\);/;
/** 上一版补丁留下的形态（绝对地址那个修正之前）—— 也要能升级掉 */
const LEGACY = /const base = '\/lodestone-pack\/';/;
const PATCHED =
  "const base = new URL('/lodestone-pack/', globalThis.location?.origin ?? 'http://localhost').toString();";

const source = readFileSync(TARGET, "utf8");

if (source.includes(PATCHED)) {
  console.log("[patch-lodestone] 已经是打过补丁的状态");
  process.exit(0);
}

if (!ORIGINAL.test(source) && !LEGACY.test(source)) {
  // lodestone 升级后这行变了 —— 别猜，直接报出来让人看一眼
  console.error("[patch-lodestone] 找不到要替换的那行，lodestone 可能改过结构了。");
  console.error("  文件:", path.relative(ROOT, TARGET));
  console.error("  如果新版本已经不用 `new URL(..., import.meta.url)`，把这个脚本删掉即可。");
  process.exit(1);
}

writeFileSync(TARGET, source.replace(ORIGINAL, PATCHED).replace(LEGACY, PATCHED));
console.log("[patch-lodestone] 已替换默认材质包路径为 /lodestone-pack/");
