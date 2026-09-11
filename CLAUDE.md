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
node scripts/dev.mjs preflight   # tsc + eslint + i18n + 单元测试，改完必跑
node scripts/dev.mjs test        # 只跑单元测试
```

**单元测试用 Node 内置的 `node:test`，不引任何依赖**（`tsx` 已经有了）。
测试文件与源码同目录、`*.test.ts` 后缀，`preflight` 会自动带上。
跑法里必须带 `--conditions=react-server`：`src/server/*` 有 `server-only`，
不带这个条件会直接抛错（和冒烟脚本是同一个原因）。

`preflight` 现在是**四个**步骤，而且函数**必须返回退出码** ——
`main()` 是 `const code = (await fn()) ?? 0`，不返回就等于永远 exit 0，
CI 和 `debug.bat preflight && ...` 都会误判成功。加新步骤时别忘这一条。

运维命令（也需要环境的，本地跑）：

```bash
node scripts/dev.mjs backup [--keep 30] [--out D:\bak] [--list]
node scripts/dev.mjs cleanup [--dry-run]
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
- **`x-forwarded-for` 只能取最右边那个值。** 最左边的是**客户端自己写的** ——
  代理只会把自己看到的对端**追加**在末尾。曾经 `@/server/quota` 与
  `lib/actions/auth/throttle` 各自取第一个值，于是每次请求换个随机 XFF
  就能拿到全新的限流桶，**登录爆破限流和上传/下载配额全部形同虚设**。
  现在统一走 `@/lib/request-ip`（取最右 + 校验是合法 IP + 解析不出来就
  回退 `"unknown"` 让所有人共用一个桶）。要加新的"按 IP"逻辑，只许用那个文件。
  **走 Cloudflare 时**（隧道或橙云）改用它强制覆写的 `cf-connecting-ip`：
  设 `TRUST_CF_CONNECTING_IP=1`。**但只有源站没有别的入站路径时才能开** ——
  应用端口能被公网直连的话，谁都能自己塞这个头，限流和配额又变回摆设。
- **OAuth 的 state 必须和 cookie 双提交。** 签名是**无状态**的，任何一次
  `GET /api/auth/login` 产出的 state 都永久有效，光验签名挡不住
  **login CSRF**（攻击者走一遍授权拿到 code+state，诱导受害者点链接，
  受害者的会话就被写成攻击者的账号）。`/api/auth/login` 把 state 同时写进
  `oauth_state` cookie，callback 要求两者一致并即刻删除。
- **Route Handler 没有 bodySizeLimit。** Server Action 有（`next.config.ts`
  调到了 16MB），但 `request.formData()` 在 route handler 里会把**整个请求体**
  收进内存。所以上传接口必须**先看 `Content-Length` 再解析**，不然一个
  2GB 的 POST 就能把进程打爆 —— 后面那句 `file.size > maxFileMb` 是解析之后
  才执行的，拦不住。
- **`minecraftUuid` 允许用户自填、无人审核**，所以**不能**拿它当身份凭证去
  自动关联账号：攻击者先注册并把 UUID 填成受害者的，等受害者用 Microsoft
  登录就会被关联进攻击者的账号。callback 里的 `upsertUser` 现在会拒绝
  覆盖已有的 `microsoftAccountId`、并在按 UUID 关联时写审计。
  改那段之前先想清楚这一点。
- **加 `User.sessionVersion` 那一列之后必须跑一次 `db push`。** 会话 cookie 是
  无状态的（iron-session 只密封了 userId），服务端没法主动作废它 —— 改密码后
  偷到 cookie 的人照样能用。`sessionVersion` 就是用来堵这个的：登录时写进
  cookie，`getSessionUser()` 每次比对，改密时 +1。
  **副作用：升级后所有人（包括站长）都需要重新登录一次**，
  因为老 cookie 里没有这个字段。
  读会话只许走 `getSessionUser()`（`getCurrentUser` 是它的 React cache 包装，
  `getApiUser` 也调它）—— 别在别处直接读 `session.userId`，那样会漏掉版本校验。
- **`getActivityStats` / 任何"公开页面"的查询都必须有上界。** 已经踩过两次：
  资源列表的 `take: 100` 静默截断、用户资料页把该用户的全部资源捞回来。
  现在的规矩是：列表一定带 `take`，需要"总数"就用 `_count` 让数据库去数，
  不要靠 `array.length`。
- **`preflight` 的每个步骤函数必须 return 退出码。** `main()` 里是
  `const code = (await fn()) ?? 0`，不 return 就是永远 exit 0。

## 四、代码结构要点

- **站点配置**：`SiteSetting` 键值表（`key` + Json `value`），读写在
  `src/server/settings.ts` 里用 zod 校验，目前有 `join` / `limits` / `stats` /
  `server-info` / `rules` 五个键。读取失败一律回退默认值 —— 配置问题不能让
  首页挂掉。
- **管理员可编辑的内容分两种存法**，选错了以后要返工：
  - **单例内容**（首页数字、服务器介绍与配置、规则）→ `SiteSetting` 的 Json。
    只有一份、整体覆盖式保存。
  - **会不断新增的**（公告、轮播图）→ 独立表（`Announcement` / `CarouselSlide`）。
    需要排序、草稿态、稳定 id 来编辑删除，这些是数据库该干的活。
- **二进制一律进数据库**，不依赖共享文件系统或对象存储：资源附件
  `ResourceBlob`、资源封面 `ResourceImage`、轮播图 `CarouselImage`。列表查询
  必须 `select` 掉字节列，只有图片/下载接口才读。
- **Server Action 的请求体默认只有 1MB**。这个项目有两处会通过 action 传二进制
  （资源编辑换附件、后台上传轮播图），所以 `next.config.ts` 把
  `experimental.serverActions.bodySizeLimit` 调到了 16MB。
  调整后台的 `maxFileMb` 时要顺带看一眼这个上限。
- **Prisma 6 的 Bytes 字段要 `Uint8Array<ArrayBuffer>`**，而 `Buffer` / 从 File
  读出来的字节是 `ArrayBufferLike`，直接传类型不过。包一层 `new Uint8Array(x)`。
- **后台填的内容不能放 `messages/*.json`**（那是构建产物）。用 `{ zh, en }`
  结构（见 `src/lib/localized.ts`）：**中文必填、英文可选、缺省回退中文**，
  所以管理员可以只用中文先写起来。公告那张表是中英分列存放。
  表单控件是 `src/components/admin/content-fields.tsx` 里的 `LocalizedField`
  与 `RepeatableList`，后台三个内容表单共用。
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
- **运维三件套**（都在 `scripts/` 下，也挂在 `debug.bat` 上）：
  - `backup.mjs` —— pg_dump + gzip + 轮转。**站点的全部用户内容都在 Postgres 里**
    （附件、封面、轮播图、账号），审计日志只能查"是谁删的"，救不回数据。
    优先用本机 `pg_dump`，没有就退回 `docker compose exec db pg_dump`。
    默认写到仓库下的 `backups/`（已 gitignore）——**生产要用 `--out` 指到另一块盘**。
  - `cleanup.mts` + `src/server/retention.ts` —— 清 `EmailCode` /
    `ResourceDownload` / `TransferUsage` / `DailyAction` / 已读 `Notification` /
    `AuditLog`。这几张表原先**只增不减**，保留期写在 `RETENTION_DAYS` 里。
  - 单元测试 —— `node:test`，见第二节。
- **`src/server/mc-ping.ts` 是自己实现的 Server List Ping**（不调第三方 API、
  不需要服务端插件）：站点和 MC 服务器同机时直接对 `127.0.0.1:25565` 说协议，
  拿到真实在线人数。**默认关闭**，要 `MC_PING_HOST` 或 `MC_PING=1` 才启用 ——
  否则没有本地 MC 服务的部署会平白多出一次必然超时的探测。
  返回 `null` 表示"没开启"（回退静态配置），`online: false` 才是"真的离线"，
  这两个别混。

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

- 域名上线后要配 SPF / DKIM。
- Minecraft AppID 审批未完成前，Microsoft 登录最后一步会 403；本地账号不受影响。
- `package.json#prisma` 已废弃，升 Prisma 7 前要迁到 `prisma.config.ts`。
- 邮箱验证码的**按 IP** 上限是**进程内**的（`@/server/rate-limit`），
  重启清零、多实例不共享；参考 `lib/actions/auth/throttle.ts` 的同一个取舍。
  哪天要多实例部署，这两处一起换成 Redis 或计数表。
- `getActivityStats`（后台统计页）仍会把全部用户读出来再在内存里排序。
  用户量上千以后再考虑把排序下推到 SQL。
- 还没配 HSTS：生产是不是一定跑 HTTPS 我没法确认，贸然开 `Strict-Transport-Security`
  会把纯 HTTP 的部署锁死。域名和证书都就绪后在 `next.config.ts` 的
  `securityHeaders` 里加。
- **备份还没挂到定时任务上**。`debug.bat backup` 手动跑得通（已验证能出真 SQL），
  但生产要自己加 cron，而且 `--out` 要指到**另一块盘** ——
  备份和数据库在同一块盘上不算备份。
- `cleanup` 同样只是手动命令，生产要自己加 cron（每天一次足够）。
- 首页在线人数要真正显示出来，需要在 `.env` 里设 `MC_PING_HOST`（本机就是
  `127.0.0.1`）；没设的时候卡片回退到 `src/config/site.ts` 的静态值。

改过安全相关的几处之后**没在浏览器里实测过**，下次要验：登录（含限流）、
Microsoft 登录（含 state 校验与账号冲突提示）、资源上传/下载的配额与体积拦截、
邮箱验证码发送、用户资料页的资源列表截断、根级错误页、
以及各页面的 loading 骨架屏。
