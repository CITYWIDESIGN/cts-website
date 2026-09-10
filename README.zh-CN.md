# Minecraft 服务器官方网站

> English version: [README.md](./README.md)

一个现代、简约、具有高级质感的 Minecraft 服务器官方网站。全栈实现：用户账户系统、Microsoft / Minecraft 正版身份绑定、入服申请问卷系统，以及管理员后台。

整体 UI 刻意保持 **简约 / 现代 / 商务 / 丝滑**——它不是「Minecraft 主题网站」。Minecraft 是*业务内容*，UI 本身保持干净、克制。

---

## 技术栈

| 层面     | 选择                                                              |
| -------- | ----------------------------------------------------------------- |
| 框架     | [Next.js 16](https://nextjs.org)（App Router、Turbopack）         |
| 语言     | TypeScript（strict）                                              |
| UI       | React 19、Tailwind CSS v4、[shadcn/ui](https://ui.shadcn.com)     |
| 动画     | [Motion](https://motion.dev)（Framer Motion）                     |
| 国际化   | [next-intl](https://next-intl.dev) — 英文 & 简体中文              |
| 数据库   | PostgreSQL 16                                                     |
| ORM      | [Prisma](https://prisma.io)                                       |
| 认证     | iron-session + Microsoft OAuth（Xbox Live → XSTS → Minecraft）    |
| 校验     | [Zod](https://zod.dev)                                            |

---

## 功能

### 公开页面

- **首页** — Hero（服务器状态、影像轮播、行动入口）、特色、介绍、数据、加入流程、公告、FAQ，全部双语。
- **`/server` `/rules` `/community`** — 服务器信息、规则、社区渠道（QQ 群 / OOPZ / Discord）。
- **`/u/<id>`** — 玩家公开资料页，任何访客都能看（评论 / 资源 / 下载数）。

### 账户

- **本地账号为主** — 用户名 + 邮箱 + 密码，**两步注册**：填资料 → 收邮箱验证码，验证通过后账号才创建。
- **Microsoft 登录可选** — 绑定后可验证真实 Minecraft 身份并解锁一枚头像框；未绑定也能正常使用站内功能（Minecraft ID / UUID 可在个人中心手动填写，皮肤头像照常显示）。
- **找回密码** — 邮箱验证码重置。
- **换绑邮箱** — 为防账号被盗，需**同时验证当前邮箱与新邮箱**（两封验证码邮件）。
- **修改用户名** — 每天仅一次，防止"改名躲人"。
- **注销账号** — 账号立即失效、身份信息抹除，但已发布的内容保留（作者显示为「已注销用户」）。

### 问卷与入服申请

单选、多选、单行文本、多行文本四种题型；分步向导，带进度、必填校验与提交确认。管理员在后台审核（通过 / 拒绝），审核状态会反映到首页的行动入口上。

### 资源分享（`/resources`）

| 动作 | 权限 |
| --- | --- |
| 浏览列表 / 查看详情 | 所有人（无需登录） |
| **下载附件** | 所有人（无需登录） |
| **上传资源** | **只要登录即可**，不要求通过入服审核 |
| 编辑介绍 / 删除 | 上传者本人或管理员 |

- 三种浏览视图：**网格 / 动态 / 列表**，选择记在浏览器本地。
- 支持搜索（服务端，走 URL 的 `?q=`）与分页（`?page=`）。
- 点赞、评论、回复、举报、分享链接；每次编辑都生成一条修改记录（类似 git commit，可在详情页查看）。
- 附件存放在数据库（`resources` + `resource_blobs` 两张表）——**不依赖共享文件系统或外部对象存储**，本地 / Docker / 多实例部署行为一致。
- 列表查询只取元数据；附件二进制单独放 `resource_blobs`，只有下载接口才读取，避免列表把几 MB 的 blob 全拉回来。
- 封面图经 `/api/resources/[id]/image` 单独提供，避免把 data URL 内联进列表 HTML。
- 封面图只接受栅格格式（PNG / JPG / GIF / WebP / AVIF），**明确不支持 SVG** —— SVG 能内嵌脚本，同源内联渲染等于存储型 XSS。

### 通知

收到点赞或回复时进消息列表（`notifications` 表）；自己操作自己不会产生通知。

### 管理后台（`/admin`）

| 板块 | 内容 |
| --- | --- |
| 概览 | 统计卡片、最近注册用户、最近提交问卷 |
| 用户管理 | 搜索 / 筛选 / 分页 / 改角色 / 封禁（1d·3d·7d·30d·永久）/ 彻底删除 |
| 问卷管理 | 创建、编辑、发布 / 暂停、查看结果、审核提交 |
| 资源管理 | 编辑元信息、替换附件、删除 |
| 举报处理 | 查看举报与被举报内容摘要，忽略或删除内容 |
| **加入入口** | 配置首页「申请加入」按钮点击后的行为（见下） |
| **限额设置** | 配置普通用户的每日用量上限（见下） |
| 活跃度统计 | 评论 / 资源 / 下载排行，含未登录访客（按 IP） |
| 审计日志 | 不可逆操作的完整记录 |

#### 加入入口配置

首页与页头「申请加入」按钮点击后做什么，由管理员在 `/admin/join` 配置，四种行为：

| 行为 | 说明 |
| --- | --- |
| 填写问卷 | 指定某一份，或自动用最新发布的（默认，等同旧行为） |
| 打开外部链接 | QQ 群 / Discord / 外部报名表，可选新标签页打开 |
| 打开站内页面 | 任意站内路径 |
| 暂时关闭 | 首页不再显示该按钮 |

- **审核状态优先于配置** —— 已提交申请的人看到的始终是「查询审核结果」，不会被推去重填。
- 还有一个「必须先登录」开关（默认开）：未登录访客先跳登录页，登录后**直接落到目标**（站内目标走 `redirectTo`，登录表单会读取它）。
- 指定的问卷若被下线或删除，自动退回最新发布的一份，首页不会因此空掉。

#### 用量限额

`/admin/limits` 统一配置普通用户的每日上限。**管理员不受任何限制，也不计入用量记录。**

| 配置项 | 默认值 |
| --- | --- |
| 每日评论数（含回复） | 50 |
| 每日发布资源数 | 50 |
| 每日上传总量 | 1024 MB（1GB） |
| 每日下载总量 | 1024 MB（1GB） |
| 单个资源文件上限 | 5 MB |
| 单张封面图上限 | 1 MB |

- 配置一律以 **MB 整数**存储（表单里填 1024 比填 1073741824 现实），字节数由代码派生。
- 上传与下载分别计数；下载额度对**未登录访客**同样生效，按 IP 计（同一 NAT 出口共享额度）。
- 计数按「**UTC 日期 + 主体 + 行为**」落库（`transfer_usage` / `daily_actions` 两张表），跨天自然是新记录，**不需要定时任务清零**。
- 配额**不对外展示**，只在超限时提示（上传返回 `413 quota_exceeded`，下载返回 `429`）。
- 这是**软限制**：高并发下 check 与 add 之间存在竞态、可能略微超出；对"防滥用"足够。
- 校验有两层：zod 管单字段范围；另有一条**字段关系**规则 —— 单文件上限不得高于每日上传总额度，否则文件永远传不完就被额度挡住，表面合法、实际不可用。

### 设计系统

中性色 + 低饱和品牌绿、明暗主题、`prefers-reduced-motion` 降级、完整响应式。

---

## 项目结构

```
webv2/
├── prisma/
│   ├── schema.prisma        # 数据模型
│   ├── seed.ts              # 种子数据（问卷 + 可选演示用户）
│   └── migrations/
├── messages/
│   ├── en.json              # 英文文案
│   └── zh.json              # 中文文案（两边键必须完全一致，有脚本校验）
├── scripts/
│   ├── dev.mjs              # 统一 CLI（启动 / 数据库 / 检查 / 调试）
│   ├── users.mjs            # 用户管理 + 强制登录
│   └── i18n-check.mjs       # 中英文案键一致性校验
├── src/
│   ├── app/                 # App Router 页面与路由处理器
│   │   ├── (marketing)/     # / , /server, /rules, /community, /resources, /login
│   │   ├── (dashboard)/     # /dashboard, /questionnaires/*
│   │   ├── (admin)/         # /admin/*
│   │   └── api/             # 认证、资源上传/下载/封面
│   ├── components/
│   │   ├── ui/              # shadcn/ui 基础组件
│   │   ├── motion/          # 入场动画原语（Stagger / SplitHeading / RowReveal …）
│   │   ├── layout/          # 头部、页脚、用户菜单、语言切换
│   │   ├── marketing/       # 首页各 Section、加入入口按钮
│   │   ├── questionnaire/   # 问卷表单
│   │   ├── resources/       # 资源列表 / 详情 / 上传编辑
│   │   └── admin/           # 后台 UI
│   ├── server/              # 数据访问与判定层（server-only）
│   │   ├── auth.ts          # 会话与角色辅助
│   │   ├── settings.ts      # SiteSetting 键值配置读写（加入入口 / 限额）
│   │   ├── limit.ts         # 每日次数限额判定
│   │   ├── quota.ts         # 每日流量配额判定
│   │   ├── resource.ts      # 资源查询 / CRUD
│   │   ├── ban.ts           # 封禁
│   │   ├── notify.ts        # 通知（自己操作自己不通知）
│   │   ├── audit.ts         # 审计日志
│   │   └── …                # questionnaire / submission / report / stats …
│   ├── lib/
│   │   ├── prisma.ts        # Prisma 客户端单例
│   │   ├── session.ts       # iron-session 配置
│   │   ├── session-secret.ts# SESSION_SECRET 的唯一来源与校验
│   │   ├── safe-redirect.ts # 站内跳转白名单（挡开放重定向）
│   │   ├── image-types.ts   # 封面图 MIME 白名单（无 SVG）
│   │   ├── auth/microsoft.ts# Microsoft → Xbox → XSTS → Minecraft 流程
│   │   ├── actions/         # Server Actions（变更操作）
│   │   └── validators/      # Zod 校验（含 join-config / limits）
│   ├── i18n/                # next-intl 请求配置
│   └── config/site.ts       # 服务器名称/地址/状态（mock）
├── debug.bat                # Windows 一键菜单（等价于 scripts/dev.mjs）
├── .env.example
├── docker-compose.yml       # 本地 PostgreSQL
├── Dockerfile               # 生产镜像
└── next.config.ts
```

---

## 快速开始

### 环境要求

- Node.js **20.9+**（已在 24 上测试）
- [Docker](https://www.docker.com)（用于本地 PostgreSQL）

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

至少需要设置 `DATABASE_URL` 与 `SESSION_SECRET`。Microsoft OAuth 对本地开发是可选的——未配置时登录页会给出友好提示。

### 3. 启动数据库

```bash
npm run db:up        # docker compose up -d db
```

### 4. 建表并填充种子数据

```bash
npm run db:push      # 或：npm run db:migrate
npm run db:seed
```

### 5. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)。

常用命令：

```bash
npm run db:studio    # Prisma Studio（浏览/编辑数据）
npm run lint         # ESLint
npm run typecheck    # TypeScript
npm run build        # 生产构建
npm run start        # 运行生产构建
```

### 开发 / 调试脚本

`scripts/dev.mjs` 提供了一整套调试辅助功能：

```bash
npm run debug                      # 交互式菜单
npm run debug up --seed            # 一键启动（检查 → 数据库 → 迁移 → seed → dev）
npm run debug check                # 环境检查（doctor）
npm run debug users                # 列出全部用户（玩家名 / ID / 角色）
npm run debug adduser <玩家名> --admin --uuid <UUID>   # 新建用户（可带管理员与 UUID）
npm run debug updateuser <玩家名> --uuid <UUID>        # 修改 UUID / 玩家名 / 角色
npm run debug deleteuser <玩家名>                      # 删除用户（连带其问卷提交）
npm run debug makeadmin <玩家名>   # 将用户提升为管理员并打印会话 cookie
```

`adduser` 支持 `--admin`（直接给管理员）与 `--uuid <UUID>`（绑定 Minecraft UUID，用于皮肤头像与 3D 模型）；`updateuser` 支持 `--uuid` / `--name` / `--role ADMIN|USER`。UUID 缺连字符的 32 位写法也能识别，会补成标准格式。

#### 用户管理 / 强制登录（独立脚本）

`scripts/users.mjs` 是一个循环式交互菜单，专门用来管理用户并在没有 Microsoft 登录的情况下**强制登录**：

```bash
npm run users                      # 交互式菜单
npm run debug users:manage         # 等价入口（dev.mjs 转调）
```

也可在 `debug.bat` 菜单里按 `g` 打开。

| 菜单项 | 作用 |
| --- | --- |
| 列出 / 搜索用户 | 带 UUID、Microsoft 账号、提交数、注册时间 |
| 新建用户 | 可指定 UUID（校验格式与占用）与角色 |
| 编辑用户 | 玩家名 / UUID / Microsoft 账号 ID / 角色，回车保持原值，`-` 清空字段 |
| 切换角色 | USER ⇄ ADMIN |
| 删除用户 | 二次确认，连带级联删除其问卷提交 |
| **强制登录** | 签发 30 天 `mc_session` cookie，并给出地址与 curl 命令 |
| 为用户造一份问卷提交 | 按题型自动填合法答案，便于测试后台审核 |
| 查看 / 修改提交状态 | 等价于后台的通过 / 拒绝 |
| 数据库 / 站点概览 | 用户数、问卷数、各状态提交数、容器状态、站点地址 |

**强制登录怎么用**：菜单选 `l` → 选择用户 → 脚本打印一段 `mc_session` 值，同时给出两种用法：

1. 浏览器：打开站点 → F12 → Application → Cookies → 新建 `mc_session`，粘贴该值 → 刷新即可进入 `/dashboard` 与 `/admin`
2. 命令行：脚本直接给出可复制的 `curl -H "Cookie: mc_session=..."` 命令

> 会话用 `.env` 里的 `SESSION_SECRET` 签名，有效期 30 天；改了密钥需要重新签发。

Windows 用户也可直接运行项目根目录的 `debug.bat`（双击进入交互菜单，或 `debug.bat <命令>`，例如 `debug.bat up --seed`）。

还能重置数据库、打开 Prisma Studio、运行代码检查，以及通过 `session <玩家名>` 生成调试会话 cookie——无需真实 Microsoft 登录即可浏览受保护页面。

交互菜单已按功能分组；`adduser` / `admin` / `session` / `makeadmin` 省略 `<玩家名>` 时会交互式提示输入。

#### 等待 allow list 审批期间如何登录

AppID 获批前（见[第 2 步](#2-申请加入-minecraft-api-allow-list必做)）Microsoft 登录无法走通，也就没法靠"首次登录"创建账号。改用下面的流程：

```bash
npm run debug adduser YourName --admin   # 直接新建一个管理员账号
npm run debug session YourName           # 打印 30 天有效的 mc_session cookie
```

把打印出来的值写入浏览器 DevTools → Application → Cookies（`localhost:3000` 下的 `mc_session`），刷新后即可访问 `/admin` 与 `/dashboard`。也可以先 `db:seed` 造出 `Steve` / `Alex` / `Notch_Fan` 三个 demo 用户，再用 `makeadmin` 提升。

---

## 环境变量

| 变量                      | 必填 | 说明                                                       |
| ------------------------- | ---- | ---------------------------------------------------------- |
| `DATABASE_URL`            | ✅   | PostgreSQL 连接串                                          |
| `SESSION_SECRET`          | ✅   | 会话 cookie 加密密钥兼 OAuth state 签名（`openssl rand -base64 32`）。**至少 32 字符且不能是占位值**；生产环境缺失会直接抛错，`debug.bat build`/`start` 也会拒绝运行 |
| `NEXT_PUBLIC_SITE_NAME`   | ⬜   | 站点名，用于邮件发件人与页面标题                            |
| `NEXT_PUBLIC_SITE_URL`    | ⬜   | 站点公开 URL（用于 SEO / 重定向）                          |
| `MICROSOFT_CLIENT_ID`     | ⬜   | Microsoft Azure 应用客户端 ID（OAuth 用）                  |
| `MICROSOFT_CLIENT_SECRET` | ⬜   | Microsoft Azure 应用客户端密钥                             |
| `MICROSOFT_REDIRECT_URI`  | ⬜   | 必须与 Azure 应用的回调 URI 一致                            |
| `SMTP_HOST` `SMTP_PORT` `SMTP_SECURE` | ⬜ | 发信服务器。`SMTP_SECURE=true` 用 465，`false` 用 587/STARTTLS |
| `SMTP_USER` `SMTP_PASS`   | ⬜   | **发件**邮箱与授权码（不是登录密码）。**只需配一个发件邮箱**，它可以给任意收件人发验证码 |
| `SMTP_FROM`               | ⬜   | 发件人地址，需与 `SMTP_USER` 一致                           |

未配置 SMTP 时：**开发环境**把验证码打印到服务端控制台并显示在页面上，整条流程照常可走；**生产环境**邮件发送会明确报错，而不是静默失败。

自检：`node scripts/dev.mjs mail:test you@example.com`（不带邮箱只测连接）；`node scripts/dev.mjs mail:preview you@example.com` 发送真实模板的排版预览。

---

## Microsoft / Minecraft OAuth 配置

认证流程通过 Microsoft 官方 OAuth 验证用户**真实的 Minecraft 身份**——用户不会在本站输入 Microsoft 密码，本站也绝不保存密码。

```
Microsoft OAuth  →  Xbox Live (XBL)  →  XSTS  →  Minecraft 登录  →  Minecraft 档案（UUID + 玩家名）
```

### 1. 注册 Azure 应用

1. 打开 [Azure 门户 — 应用注册](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsList)。
2. 点击 **新注册**：
   - **名称**：随意（例如 `mc-server-website`）
   - **受支持的账户类型**：*仅个人 Microsoft 账户*
   - **重定向 URI**：`Web` → `http://localhost:3000/api/auth/callback`（生产环境再追加你的线上 URL）
3. 记下 **应用程序（客户端）ID**。
4. 在 **证书和密码 → 新客户端密码** 创建一个密码并记下其值。

> 无需申请任何 API 权限。流程只需要委托的 `XboxLive.signin offline_access` scope（由应用请求，而非通过 API 权限授予）。
>
> ⚠️ **但仅注册应用还不够**——新应用还必须被加入 Mojang 的 API 白名单，否则会在 `login_with_xbox` 收到 403。见下方「Minecraft API Allow List 审批」。

### 2. 申请加入 Minecraft API Allow List（必做）

Mojang 会**人工审核**所有新增的 Java 版 API 集成请求，通过后才把 AppID 加入 allow list。已存在的应用（启动器、网站）不受影响，但**任何新注册的 Azure 应用在获批前都会在最后一步拿到 403**：

```
HTTP 403
{ "path": "/authentication/login_with_xbox",
  "errorMessage": "Invalid app registration, see https://aka.ms/AppRegInfo for more information" }
```

前面几步（Microsoft OAuth → Xbox Live → XSTS）全部会成功，**只有 `login_with_xbox` 这一步失败**，这是判断该问题的关键特征。

**提交入口（现役表单）**：<https://forms.cloud.microsoft/Pages/ResponsePage.aspx?id=v4j5cvGGr0GRqy180BHbR-ajEQ1td1ROpz00KtS8Gd5UNVpPTkVLNFVROVQxNkdRMEtXVjNQQjdXVC4u>

> 官方帮助页 [Java Edition Game Service API Review or Application Process](https://help.minecraft.net/hc/en-us/articles/16254801392141) 里写的 `aka.ms/mce-reviewappid` **已失效**，用上面这个新表单。

**填表前先核对：**

| 表单字段 | 填什么 |
| --- | --- |
| 联系方式邮箱 | 必须与 Azure Portal 上的账号**可交叉核对** |
| 请求类型 | `New AppID for Approval` |
| 应用名称 | **不得包含** `Mojang`、`Minecraft`、`Microsoft`、`Live`、`Xbox`、`Discord`、`Hypixel` |
| Application ID | 应用程序（客户端）ID |
| Tenant ID | 目录（租户）ID，新应用审批必填 |
| 关联网站/域名 | 公网可访问的官网 / 仓库 / 社区链接，**不能填 localhost** |
| Justification | 必须说明正当用途，否则不予审核 |

**Justification 可直接使用（英文）：**

```
This is the official website of a community Minecraft: Java Edition server.

We use the official Microsoft OAuth -> Xbox Live -> XSTS -> Minecraft Services
authentication chain for exactly one purpose: to verify that a user signing in
actually owns the Minecraft: Java Edition account they claim, and to store the
resulting Minecraft UUID for account binding, server whitelist management, and
membership-application review on our website.

We do not bypass, disable, or modify any security, authentication, or
ownership/license verification. We never ask for or store Microsoft passwords.
One website account maps to exactly one Minecraft UUID. We do not resell
accounts, do not provide offline/cracked access, and do not distribute any
Minecraft game files.
```

**其他要点：**

- 审核**每周一批**，重复提交不会加速。
- 通知来自 **Mojang Enforcement**，注意查收垃圾邮件箱。
- 长时间无回音可通过 [enforce@minecraft.net](mailto:enforce@minecraft.net) 跟进（附上 Client ID 与提交时间）。
- 获批前想在本地继续开发：`npm run debug makeadmin <玩家名>` 可直接生成 30 天有效的调试会话 cookie。

### 3. 填写 `.env`

```env
MICROSOFT_CLIENT_ID="<client-id>"
MICROSOFT_CLIENT_SECRET="<client-secret>"
MICROSOFT_REDIRECT_URI="http://localhost:3000/api/auth/callback"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
```

### 4. 说明

- Microsoft 账户必须**拥有 Minecraft** 才能完成流程（否则档案查询返回 404，用户会看到友好错误提示）。
- **Minecraft UUID** 作为稳定身份存储（玩家名可能会被修改）。
- 实现位于 [`src/lib/auth/microsoft.ts`](src/lib/auth/microsoft.ts)，完全在服务端执行。
- 若最后一步返回 403 `Invalid app registration`，说明 AppID 尚未被加入 allow list —— 见 [第 2 步](#2-申请加入-minecraft-api-allow-list必做)。

---

## 将用户设为管理员

网站有注册表单，第一个注册的账号就是普通用户，需要手动提升为管理员：

**方式 A — 调试脚本（最快）**

```bash
npm run debug makeadmin <用户名或玩家名>   # Windows 也可用: debug.bat makeadmin <用户名>
```

同时完成两件事：把该用户提升为 `ADMIN`，并打印一个 30 天有效的 `mc_session` cookie，可直接贴进浏览器登录。数据库里还没有用户时，先建一个：

```bash
npm run debug adduser <用户名> --admin
```

**方式 B — Prisma Studio**

```bash
npm run db:studio
```

打开 `User` 表，找到你的账户，将 `role` 改为 `ADMIN`。

**方式 C — SQL**

```sql
UPDATE users SET role = 'ADMIN' WHERE username = '<用户名>';
```

角色判断始终在服务端进行，绝不信任前端。管理员不受任何用量限额约束。

---

## 部署

### Docker（推荐）

已包含生产 `Dockerfile`（多阶段构建，独立 Node.js 服务）。

```bash
# 1. 构建镜像
docker build -t mc-server-web .

# 2. 运行（连接真实数据库）
docker run -p 3000:3000 --env-file .env mc-server-web
```

同时需要一个 PostgreSQL 实例（可参考 `docker-compose.yml`）。生产环境需设置：

- `DATABASE_URL` 指向生产数据库
- `SESSION_SECRET` 为强随机值
- `MICROSOFT_REDIRECT_URI` / `NEXT_PUBLIC_SITE_URL` 指向你的公开 HTTPS 地址
- 在 Azure 应用里注册生产回调 URI

### VPS（手动）

```bash
npm ci
npm run db:migrate  # 或：prisma migrate deploy
npm run build
npm run start       # 监听 :3000，前置 nginx/caddy 处理 HTTPS
```

---

## 设计决策与取舍

- **基于 Cookie 的国际化（无 URL 前缀）** — 保持 URL 简洁（`/`、`/server` …）。代价：公开页面按需服务端渲染而非静态预渲染。若需要静态页面，可将 next-intl 切换为 `[locale]` 路由策略。中英文案的键集合由 `scripts/i18n-check.mjs` 强制一致（也校验代码里 `t("…")` 的引用是否存在）。
- **站点配置用键值表而不是每种配置一张表** — `SiteSetting`（`key` + Json `value`）配 zod 校验，类型安全由代码保证而不是数据库。目前有 `join`（加入入口）与 `limits`（用量限额）两个键。读不到、解析失败、或数据库连不上时一律退回默认值，绝不让首页因配置问题挂掉。
- **限额单位存 MB 整数** — 表单里填 `1024` 比填 `1073741824` 现实得多；不用 GB 存是为了避开 `0.5GB` 这类小数的浮点边界。字节数由 `limitsToBytes()` 派生。
- **iron-session（无状态、加密 Cookie）** — 对当前规模简单且安全，无需会话表。若需要「注销所有设备」可换用数据库会话。
- **密码用 scrypt 哈希** — 纯 Microsoft 账号的 `passwordHash` 为空，本地账号为主、Microsoft 绑定为辅。
- **题目排序使用上/下移动按钮** — 桌面与移动端都可靠（刻意避免拖拽排序以保证移动端稳定）。
- **答案存储选项文本快照** — 结果页渲染简单；选择题选项同样存文本。若日后需要按选项 id 做分析，可迁移为选项 id 引用。
- **服务器信息位于 `src/config/site.ts`** — 便于日后将「编辑服务器信息」迁移到数据库并加入后台。
- **审计日志只记不可逆操作** — 删资源 / 删用户 / 注销 / 按举报删内容 / 改站点配置。写入失败也不影响主流程（审计不该成为故障点）。
- **界面文案与提示语分两档语气** — 界面、状态、报错、后台保持商务、克制、说明性；输入框 placeholder 与输入类 hint 用口语化表达，且一律不举例子（例如不写「例如：空岛生存整合包 v2」）。

## 已知待办

- **迁移 Prisma seed 配置**：`package.json#prisma` 已废弃（会提示 `The configuration property package.json#prisma is deprecated`）。Prisma 6 上仍正常工作，**不影响认证**。升级到 Prisma 7 前需迁移到 `prisma.config.ts`。
- **评论列表仍是定长取用**（`listComments` 的 `take`），条数超过后会静默截断，尚未分页。
- **域名上线后配置 SPF / DKIM**，否则验证码邮件容易进垃圾箱。
- **Minecraft AppID 审批**未完成前，Microsoft 登录会在最后一步 403（见上文），本地账号不受影响。

## 许可证

**专有软件，保留所有权利。** 本仓库仅公开供审阅与参考，**不是开源项目**：未授予任何人使用、复制、修改、再分发或复用的许可。完整条款见 [LICENSE](./LICENSE)。
