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
  console.log("[patch-lodestone] 路径补丁已经是打过补丁的状态");
} else {

if (!ORIGINAL.test(source) && !LEGACY.test(source)) {
  // lodestone 升级后这行变了 —— 别猜，直接报出来让人看一眼
  console.error("[patch-lodestone] 找不到要替换的那行，lodestone 可能改过结构了。");
  console.error("  文件:", path.relative(ROOT, TARGET));
  console.error("  如果新版本已经不用 `new URL(..., import.meta.url)`，把这个脚本删掉即可。");
  process.exit(1);
}

writeFileSync(TARGET, source.replace(ORIGINAL, PATCHED).replace(LEGACY, PATCHED));
  console.log("[patch-lodestone] 已替换默认材质包路径为 /lodestone-pack/");
}

/**
 * 第二个补丁：**透明背景**。
 *
 * lodestone 的渲染器把背景写死了：
 *   - `new THREE.WebGLRenderer({ alpha: false })`  → canvas 没有 alpha 通道
 *   - `setClearColor(0x000000, 1)`                  → 清除色是不透明黑
 *   - 每次绘制都先渲染一层天空四边形（skyScene）
 *
 * 于是导出的 PNG **一定带底色**，卡片和详情页上就是一块突兀的方块，
 * 而且没法跟随明暗主题。设置里也没有"关掉天空"的开关。
 *
 * 改动三处：
 *   1. alpha: true                       —— 让 canvas 有 alpha 通道
 *   2. setClearColor(0x000000, 0)        —— 清除为**全透明**
 *   3. 跳过天空那一遍（两处：直接绘制 + 后处理路径）
 *
 * 只动主渲染器那一次 setClearColor；另外两处（1850/1858 附近的黑/白）
 * 是**阴影贴图**的清屏色，改了会破坏阴影，不碰。
 */
/*
 * 透明背景那一组补丁**已撤销**。
 *
 * 当时的想法是"透明底自动跟随明暗主题"，但站长要的是**真正渲染出来的背景**
 * （白天/黑夜两套），所以改成按主题设置天空颜色渲染两轮，背景必须不透明。
 * 留着"跳过天空 + 清除色透明"反而会把背景弄没。
 *
 * 这个常量保留成空数组，是为了让下面的 applyPatches 逻辑不用改分支。
 */
const ALPHA_PATCHES = [
  { name: "alpha 通道", from: "alpha: false,", to: "alpha: true," },
  { name: "清除色改为全透明", from: "setClearColor(0x000000, 1);", to: "setClearColor(0x000000, 0);" },
  {
    /*
     * 跳过天空。
     *
     * 用**全局替换**（all: true）而不是逐条匹配上下文 —— 天空在
     * "直接绘制" 和 "后处理" 两条路径里各渲染一次，而这两处的注释和
     * 相邻代码在 lodestone 的小版本之间会漂移（已经踩过一次：按上下文
     * 匹配的那条静默失配，天空只关掉了一半）。整行删掉最稳。
     */
    name: "跳过天空",
    from: "this.renderer.render(this.skyScene, this.skyCamera);",
    to: "/* [patched] 天空已跳过：预览要透明背景 */",
    all: true,
  },
  { name: "关掉太阳", from: "sunDisc: true", to: "sunDisc: false", all: true },
];

const RENDERER = path.join(
  ROOT,
  "node_modules",
  "@mattzh72",
  "lodestone",
  "lib",
  "render",
  "ThreeStructureRenderer.js"
);

function applyPatches() {
  if (!existsSync(RENDERER)) {
    console.log("[patch-lodestone] 没找到渲染器文件，跳过透明背景补丁");
    return;
  }
  let source = readFileSync(RENDERER, "utf8");
  const pending = ALPHA_PATCHES.filter((p) => source.includes(p.from));

  if (pending.length === 0) {
    console.log("[patch-lodestone] 透明背景补丁已就位");
    return;
  }

  for (const p of pending) {
    // all: true 用 split/join 做全局替换（String.replace 只换第一处）
    source = p.all ? source.split(p.from).join(p.to) : source.replace(p.from, p.to);
    console.log(`[patch-lodestone] 已应用：${p.name}`);
  }
  writeFileSync(RENDERER, source);
}

applyPatches();
