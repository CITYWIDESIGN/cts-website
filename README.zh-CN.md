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

- **公开页面** — 首页（Hero、服务器状态、特色、介绍、CTA）、`/server`、`/rules`、`/login`（全部双语、SEO 友好）。
- **账户系统** — 使用 Microsoft 登录，绑定真实 Minecraft 身份（UUID + 玩家名）。本站绝不经手或保存 Microsoft 密码。
- **问卷系统** — 单选、多选、单行文本、多行文本。分步向导，带进度显示、必填校验与提交确认。
- **管理后台** — 数据概览、用户管理（搜索/筛选/分页/角色）、问卷 CRUD + 编辑器、提交审核（通过/拒绝）、资源管理。
- **资源分享** — 类似 MCBBS 的资源板块：游客可浏览与下载，登录用户可上传（附件 ≤5MB，可附封面图），管理员在后台编辑或删除。
- **社区页** — QQ 群二维码、OOPZ 与 Discord 入口。
- **设计系统** — 中性色 + 低饱和品牌绿、明暗主题、`prefers-reduced-motion` 降级、完整响应式。

### 资源分享（`/resources`）

| 动作 | 权限 |
| --- | --- |
| 浏览列表 / 查看详情 | 所有人（无需登录） |
| **下载附件** | 所有人（无需登录） |
| **上传资源** | **只要登录即可**，不要求通过入服审核 |
| 编辑介绍 / 删除 | 仅管理员（后台 `/admin/resources`） |

- 附件单个不超过 **5MB**，可另附封面图（≤1MB）
- 附件存放在数据库（`resources` + `resource_blobs` 两张表）——**不依赖共享文件系统或外部对象存储**，本地 / Docker / 多实例部署行为一致
- 列表查询只取元数据；附件二进制单独放 `resource_blobs`，只有下载接口才读取，避免列表把几 MB 的 blob 全拉回来
- 封面图经 `/api/resources/[id]/image` 单独提供，避免把 data URL 内联进列表 HTML
- 下载次数自动计数；删除资源级联删除附件

### 每日传输配额

| 动作 | 非管理员 | 管理员 |
| --- | --- | --- |
| 上传 | **每天 1GB** | 不限 |
| 下载 | **每天 1GB**（未登录访客同样受限于此） | 不限 |

- 配额**不对外展示**，只在超限时提示（上传返回 `413 quota_exceeded`，下载返回 `429`）
- 计数按「**UTC 日期 + 主体**」落库（`transfer_usage` 表）：登录用户按 user id，未登录访客按 IP
- 跨天自然是新记录，**不需要定时任务清零**
- 上传与下载分别计数，互不影响
- 管理员完全不参与配额（连用量行都不写）
- 说明：这是**软限制**，高并发下 check 与 add 之间存在竞态、可能略微超出；对"防滥用"足够。访客按 IP 计意味着同一 NAT 出口共享额度

---

## 项目结构

```
webv2/
├── prisma/
│   ├── schema.prisma        # 数据模型
│   ├── seed.ts              # 演示数据（问卷 + 用户）
│   └── migrations/
├── messages/
│   ├── en.json              # 英文文案
│   └── zh.json              # 中文文案
├── src/
│   ├── app/                 # App Router 页面与路由处理器
│   │   ├── (marketing)/     # / , /server, /rules, /login
│   │   ├── (dashboard)/     # /dashboard, /questionnaires/*
│   │   ├── (admin)/         # /admin/*
│   │   └── api/             # 认证路由
│   ├── components/
│   │   ├── ui/              # shadcn/ui 基础组件
│   │   ├── layout/          # 头部、页脚、用户菜单、导航
│   │   ├── marketing/       # 首页各 Section
│   │   ├── questionnaire/   # 问卷表单
│   │   └── admin/           # 后台 UI
│   ├── server/              # 数据访问层（server-only）
│   │   ├── auth.ts          # 会话与角色辅助
│   │   ├── questionnaire.ts # 问卷查询/CRUD
│   │   ├── submission.ts    # 提交查询/CRUD
│   │   └── admin.ts         # 后台统计/用户
│   ├── lib/
│   │   ├── prisma.ts        # Prisma 客户端单例
│   │   ├── session.ts       # iron-session 配置
│   │   ├── auth/microsoft.ts# Microsoft → Xbox → XSTS → Minecraft 流程
│   │   ├── actions/         # Server Actions（变更操作）
│   │   └── validators/      # Zod 校验
│   ├── i18n/                # next-intl 请求配置
│   └── config/site.ts       # 服务器名称/地址/状态（mock）
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
| `SESSION_SECRET`          | ✅   | 会话 cookie 加密密钥（`openssl rand -base64 32`）          |
| `MICROSOFT_CLIENT_ID`     | ⬜   | Microsoft Azure 应用客户端 ID（OAuth 用）                  |
| `MICROSOFT_CLIENT_SECRET` | ⬜   | Microsoft Azure 应用客户端密钥                             |
| `MICROSOFT_REDIRECT_URI`  | ⬜   | 必须与 Azure 应用的回调 URI 一致                            |
| `NEXT_PUBLIC_SITE_URL`    | ⬜   | 站点公开 URL（用于 SEO / 重定向）                          |

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

网站没有注册表单——账户在首次 Microsoft 登录时自动创建。首次登录后，将你的账户提升为管理员：

**方式 A — 调试脚本（最快）**

```bash
npm run debug makeadmin <玩家名>   # Windows 也可用: debug.bat makeadmin <玩家名>
```

同时完成两件事：把该用户提升为 `ADMIN`，并打印一个 30 天有效的 `mc_session` cookie，可直接贴进浏览器登录。若数据库里还没有用户（首次 Microsoft 登录尚未走通时），先建一个：

```bash
npm run debug adduser <玩家名> --admin
```

**方式 B — Prisma Studio**

```bash
npm run db:studio
```

打开 `User` 表，找到你的账户，将 `role` 改为 `ADMIN`。

**方式 C — SQL**

```sql
UPDATE users SET role = 'ADMIN' WHERE minecraft_username = '<你的玩家名>';
```

角色判断始终在服务端进行，绝不信任前端。

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

- **基于 Cookie 的国际化（无 URL 前缀）** — 保持 URL 简洁（`/`、`/server` …）。代价：公开页面按需服务端渲染而非静态预渲染。若需要静态页面，可将 next-intl 切换为 `[locale]` 路由策略。
- **iron-session（无状态、加密 Cookie）** — 对当前规模简单且安全，无需会话表。若需要「注销所有设备」可换用数据库会话。
- **题目排序使用上/下移动按钮** — 桌面与移动端都可靠（刻意避免拖拽排序以保证移动端稳定）。
- **答案存储选项文本快照** — 结果页渲染简单；选择题选项同样存文本。若日后需要按选项 id 做分析，可迁移为选项 id 引用。
- **服务器信息位于 `src/config/site.ts`** — 便于日后将「编辑服务器信息」迁移到数据库并加入后台。

## 已知待办

- **迁移 Prisma seed 配置**：`package.json#prisma` 已废弃（会提示 `The configuration property package.json#prisma is deprecated`）。Prisma 6 上仍正常工作，**不影响认证**。升级到 Prisma 7 前需迁移到 `prisma.config.ts`。

## 许可证

私有项目，保留所有权利。
