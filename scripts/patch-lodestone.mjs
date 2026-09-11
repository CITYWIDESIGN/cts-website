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
 * （见 src/lib/litematic/preview.ts），这句只是兜底默认值；换成
 * `/lodestone-pack/` 之后即使有人忘了传也能正确指向构建时拷过去的材质包。
 *
 * 幂等，可以重复跑。构建前自动执行（package.json 的 postinstall）。
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
const PATCHED = "const base = '/lodestone-pack/';";

const source = readFileSync(TARGET, "utf8");

if (source.includes(PATCHED)) {
  console.log("[patch-lodestone] 已经是打过补丁的状态");
  process.exit(0);
}

if (!ORIGINAL.test(source)) {
  // lodestone 升级后这行变了 —— 别猜，直接报出来让人看一眼
  console.error("[patch-lodestone] 找不到要替换的那行，lodestone 可能改过结构了。");
  console.error("  文件:", path.relative(ROOT, TARGET));
  console.error("  如果新版本已经不用 `new URL(..., import.meta.url)`，把这个脚本删掉即可。");
  process.exit(1);
}

writeFileSync(TARGET, source.replace(ORIGINAL, PATCHED));
console.log("[patch-lodestone] 已替换默认材质包路径为 /lodestone-pack/");
