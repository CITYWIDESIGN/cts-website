@AGENTS.md

# 交接备注（给以后的 AI 会话看）

这个文件是**工作笔记**，不是给审阅者看的说明文档 —— 面向人/审阅者的内容在
`README.md` / `README.zh-CN.md`，不要往这里堆功能列表。

---

## 一、绝对不能违反的两条

1. **不要跑 `next build`。** 用户自己跑 `debug.bat`。我只需要保证 `preflight`
   通过。`debug.bat` 是 `%*` 透传到 `scripts/dev.mjs`，所以**只有改了 CLI 命令
   才需要动它**。
2. **中英文案必须同步。** `messages/zh.json` 与 `messages/en.json` 的键集合
   必须完全一致，`node scripts/dev.mjs preflight` 里的 i18n 检查会强制这一点。
   任何界面文案改动都要同时改两个文件。

## 二、验证方式

```bash
node scripts/dev.mjs preflight   # tsc + eslint + i18n，改完必跑
```

沙箱里 **`next dev` 起不来**，所以浏览器行为我验证不了 —— 涉及布局、动画、
交互的改动要明确告诉用户「没实测过，请刷新确认」，不要假装验证过。

沙箱里 `node.exe` / `git.exe` / `docker.exe` / `cmd.exe` 会被拒绝，需要
`sandbox_permissions: danger-full-access` + 一句 justification 重试。这是正常
流程，不是命令写错了。

需要打真实数据库做冒烟测试时：写一个 `scripts/_xxx.mts`，用
`node --conditions=react-server --import tsx scripts/_xxx.mts` 跑
（`--conditions=react-server` 是为了让 `server-only` 模块能加载），**跑完删掉**，
别提交进去。

## 三、已经踩过的坑（别再踩）

- **不要用 PowerShell 数组做文本替换。** 嵌套数组会被静默展平，曾经因此把
  `dashboard/page.tsx` 整个文件替换坏过（`const`→`oonst`）。要用脚本就用 Node。
- **`git commit -m "<多行消息>"` 会失败**（`fatal: /: '/' is outside repository`）。
  把消息写到 `.git/xxx.txt` 再用 `git commit -F`。（注意：`write` 工具对已经
  删掉的路径会报 "file no longer exists"，换个文件名即可。）
- **`prisma db seed` 找不到 `tsx`**：PATH 只在 npm 脚本里才被补上，
  `dev.mjs` 直接调会失败。用 `node --import tsx prisma/seed.ts`。
- **`react-hooks/set-state-in-effect` 是 lint 错误**：不要在 effect 里 setState。
  读 localStorage 用 `useSyncExternalStore`（带独立 serverSnapshot，避免
  hydration 不匹配）；定时器放 effect 里是允许的。
- **`react-hooks/static-components` 也是错误**：不要在组件内部定义组件
  （每次渲染都是新类型 → 子树卸载重建 → 输入框丢焦点）。提到模块顶层。
- **Motion 的 `layoutId` + sticky/fixed 容器 = 指示条乱飞**。Motion 按**文档
  坐标**做 FLIP（`getBoundingClientRect()` + `window.scrollY`），sticky 元素的
  视口位置不随滚动变，算出来的文档位置会漂。解法是在容器上声明 `layoutRoot`
  （`src/components/motion/layout-root.tsx`）。同样地，页面高度变化导致浏览器
  夹回 `scrollY` 时也会错位 —— 所以共享指示条的容器都加了 `layoutRoot`。
- **`SplitHeading` 的换行粒度**：逐字渲染时每个字符都是 `inline-block`，而
  相邻 inline-block 之间浏览器允许断行，会把英文单词从中间劈开。所以拉丁词
  先合成整体再逐字动画，见 `src/components/motion/split-heading.tsx`。
- **Tailwind v4 的 `divide-y` 只作用于直接子元素**；`@layer base` 里设了
  `* { border-color: var(--border) }`，所以不带颜色的 `border-*` 不是 currentColor。
- **公开仓库**：`.env*`、`appid表单.txt`（服务器 IP / ICP / Azure 租户 ID）
  都是 gitignored，而且历史里清过。别再把它们加回来。

## 四、代码结构要点

- **站点配置**：`SiteSetting` 键值表（`key` + Json `value`），读写在
  `src/server/settings.ts` 里用 zod 校验，目前有 `join` / `limits` 两个键。
  读取失败一律回退默认值 —— 配置问题不能让首页挂掉。
- **判定层不要持有数字**：`src/server/limit.ts`（次数）与 `src/server/quota.ts`
  （流量）都从 `getLimits()` 取，前端通过 `LimitsProvider` 拿同一份配置
  （只用于显示 N MB 和即时反馈，**服务端那份才是准的**）。
- **Server Actions 目录**：`src/lib/actions/`，按领域分文件。`admin.ts` 里导出
  `ActionState` 类型给其它 action 文件复用。错误以 **key** 返回，由前端翻译。
- **`src/server/*` 是 server-only 的数据访问 + 判定层**；`src/lib/validators/*`
  是客户端和服务端共用的 schema（不能放 `server-only`）。
- **动画原语**：`src/components/motion/`（Stagger / SplitHeading / CountUp /
  RowReveal / StatCard / PageEnter）。`RowReveal` 有 `as="tr" | "li"`，
  列表里用 `li`，否则会出现 `<tr>` 嵌在 `<ul>` 里的 hydration 报错。
- **后台页面标题统一用 `AdminPageHeader`**，表格样式在 `src/components/ui/table.tsx`。
  分页统一用 `src/components/ui/pagination.tsx`（别再手写）。
- **QQ 群二维码是生成物**：`src/components/community/qq-qr.tsx` 里的模块矩阵
  是从 QQ 导出的那张截图**还原**出来的（不是直接贴图）。要换二维码得重新提取，
  别手改那串 path。两个坑写在组件头注释里：定位图案必须按规范写死（QQ 画的是
  圆角，照抄会得到坏图案）、中间留空不能比原图 logo 更大（那块靠纠错码兜底）。

## 五、文案规范

两档语气，**别混**：

- **界面 / 功能**（导航、标题、按钮、状态、空状态、报错、后台）→ 商务、克制、
  说明性。例：「暂无资源」而不是「还没有人分享资源，来当第一个吧」。
- **提示语**（placeholder 与输入类 hint）→ 口语化，且**一律不举例子**。
  例：「给这个资源起个名字」而不是「例如：空岛生存整合包 v2」。

数字**不要写死在文案里**（曾经 `imageHint` 写死 1MB、`quotaExceeded` 写死 1GB，
限额变成可配置之后这些文案就说谎了）。要带 `{max}` / `{limit}` 参数。

## 六、当前状态 / 待办

**数据库**：只留一份真实问卷「入服申请」（`qst_join_application`，4 题 8 选项，
PUBLISHED）。用户是站长自己的账号 `ciiity`（**role = USER**，要进后台得先
`debug.bat` 菜单 `p` 提升）—— 别当成测试数据删掉。

站点定位：**CTS 服务器 / CTServer**，Fabric 服务端，原版机制，主打生电
（红石与自动化）与建筑，**没有经济系统、没有插件**。文案和数据都以这个为准。

待办（也写在 README 的「已知待办」里）：

- `listComments` 是定长 `take`，超过会静默截断，还没做分页。
- 域名上线后要配 SPF / DKIM。
- Minecraft AppID 审批未完成前，Microsoft 登录最后一步会 403；本地账号不受影响。
- `package.json#prisma` 已废弃，升 Prisma 7 前要迁到 `prisma.config.ts`。

还**没在浏览器里实测过**的（下次有机会要验）：注册 / 登录 / 换绑邮箱（双验证
码）/ 改用户名 / 注销 / 封禁、资源分页与搜索、评论回复动画、头像下的 U 型线、
以及几次动画修复（`layoutRoot`、主标题单行）。
