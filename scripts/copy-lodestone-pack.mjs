/**
 * 把 lodestone 自带的原版材质包搬到 `public/lodestone-pack/`。
 *
 * 为什么不能直接用它的 `loadDefaultPackResources()`（不传 baseUrl）：
 * 那个函数用 `new URL('../../assets/default-pack/', import.meta.url)` 找资源，
 * 也就是**相对模块文件的位置**。经过 Next 打包之后 `import.meta.url` 指向的是
 * `/_next/static/chunks/xxx.js`，那个相对路径下面根本没有资源 —— 开发时
 * （不打包）能跑，构建后就 404，属于"上生产才炸"的那一类。
 *
 * 所以显式指定 baseUrl 指向我们自己域名下的静态目录，构建前拷一份过去。
 * **不把材质打进仓库**：那是 Minecraft 的原版素材（版权归 Mojang），
 * 而且有 2.9MB，从 node_modules 拷是最省事也最干净的做法。
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FROM = path.join(ROOT, "node_modules", "@mattzh72", "lodestone", "assets", "default-pack");
const TO = path.join(ROOT, "public", "lodestone-pack");

if (!existsSync(FROM)) {
  console.error(`[lodestone-pack] 找不到源目录：${FROM}`);
  console.error("  确认 @mattzh72/lodestone 已经安装（npm install）。");
  process.exit(1);
}

rmSync(TO, { recursive: true, force: true });
mkdirSync(TO, { recursive: true });
cpSync(FROM, TO, { recursive: true });

console.log(`[lodestone-pack] 已复制到 public/lodestone-pack（${path.relative(ROOT, FROM)}）`);
