# Minecraft Server Official Website

> 中文文档请见 [README.zh-CN.md](./README.zh-CN.md) · See the Chinese version at [README.zh-CN.md](./README.zh-CN.md)

A modern, minimal, and premium official website for a Minecraft server. Built as a full-stack application with user accounts, Microsoft/Minecraft identity binding, an application questionnaire system, and an admin backend.

The UI is intentionally **minimal / modern / business / smooth** — not a "Minecraft-themed" site. Minecraft is the *content*; the UI itself stays clean and restrained.

---

## Tech Stack

| Layer      | Choice                                                            |
| ---------- | ----------------------------------------------------------------- |
| Framework  | [Next.js 16](https://nextjs.org) (App Router, Turbopack)          |
| Language   | TypeScript (strict)                                               |
| UI         | React 19, Tailwind CSS v4, [shadcn/ui](https://ui.shadcn.com)     |
| Animation  | [Motion](https://motion.dev) (Framer Motion)                      |
| i18n       | [next-intl](https://next-intl.dev) — English & 简体中文           |
| Database   | PostgreSQL 16                                                     |
| ORM        | [Prisma](https://prisma.io)                                       |
| Auth       | iron-session + Microsoft OAuth (Xbox Live → XSTS → Minecraft)     |
| Validation | [Zod](https://zod.dev)                                            |

---

## Features

- **Public pages** — Home (Hero, server status, features, intro, CTA), `/server`, `/rules`, `/login` (all bilingual, SEO-ready).
- **Account system** — Sign in with Microsoft, bind a real Minecraft identity (UUID + username). No password is ever handled by this site.
- **Questionnaires** — Single choice, multiple choice, short text, long text. Step-by-step wizard with progress, required validation, and a confirmation step.
- **Admin backend** — Dashboard stats, user management (search/filter/pagination/role), questionnaire CRUD + editor, submission review (approve/reject), resource management.
- **Resource sharing** — an MCBBS-style board: guests browse and download, signed-in users upload (≤5MB per file, optional cover image), admins edit or delete from the backend.
- **Community page** — QQ group QR code, OOPZ and Discord entry points.
- **Design system** — Neutral colors + a muted brand green, light & dark mode, `prefers-reduced-motion` support, fully responsive.

### Resource sharing (`/resources`)

| Action | Who |
| --- | --- |
| Browse list / view detail | Everyone (no sign-in) |
| **Download attachments** | Everyone (no sign-in) |
| **Upload a resource** | **Any signed-in user** — passing the join review is *not* required |
| Edit description / delete | Admins only (backend `/admin/resources`) |

- Files are capped at **5MB** each, with an optional cover image (≤1MB)
- Attachments live in the database (`resources` + `resource_blobs`) — **no shared filesystem or object storage required**, so local / Docker / multi-instance deployments behave identically
- List queries fetch metadata only; attachment bytes live in a separate `resource_blobs` table read solely by the download route
- Cover images are served from `/api/resources/[id]/image` so data URLs are never inlined into list HTML
- Download counts increment automatically; deleting a resource cascades to its attachment

### Daily transfer quota

| Action | Non-admins | Admins |
| --- | --- | --- |
| Upload | **1GB per day** | unlimited |
| Download | **1GB per day** (anonymous visitors included) | unlimited |

- The quota is **never displayed** — you only see a message when you exceed it (upload returns `413 quota_exceeded`, download returns `429`)
- Usage is counted per **UTC day + subject** (`transfer_usage` table): signed-in users by user id, anonymous visitors by IP
- A new day is simply a new row, so **no scheduled job is needed to reset counters**
- Upload and download are counted independently
- Admins are excluded from quota entirely (no usage row is written)
- Note: this is a **soft limit** — under concurrency the check/add pair can race and overshoot slightly, which is fine for abuse prevention. IP-based counting means visitors behind the same NAT share a quota.

---

## Project Structure

```
webv2/
├── prisma/
│   ├── schema.prisma        # Data model
│   ├── seed.ts              # Demo data (questionnaire + users)
│   └── migrations/
├── messages/
│   ├── en.json              # English translations
│   └── zh.json              # Chinese translations
├── src/
│   ├── app/                 # App Router pages & route handlers
│   │   ├── (marketing)/     # / , /server, /rules, /login
│   │   ├── (dashboard)/     # /dashboard, /questionnaires/*
│   │   ├── (admin)/         # /admin/*
│   │   └── api/             # Auth route handlers
│   ├── components/
│   │   ├── ui/              # shadcn/ui primitives
│   │   ├── layout/          # header, footer, user menu, nav
│   │   ├── marketing/       # home page sections
│   │   ├── questionnaire/   # questionnaire form
│   │   └── admin/           # admin UI
│   ├── server/              # Data Access Layer (server-only)
│   │   ├── auth.ts          # session + role helpers
│   │   ├── questionnaire.ts # questionnaire queries/CRUD
│   │   ├── submission.ts    # submission queries/CRUD
│   │   └── admin.ts         # admin stats/users
│   ├── lib/
│   │   ├── prisma.ts        # Prisma client singleton
│   │   ├── session.ts       # iron-session config
│   │   ├── auth/microsoft.ts# Microsoft → Xbox → XSTS → Minecraft flow
│   │   ├── actions/         # Server Actions (mutations)
│   │   └── validators/      # Zod schemas
│   ├── i18n/                # next-intl request config
│   └── config/site.ts       # Server name / address / status (mock)
├── .env.example
├── docker-compose.yml       # local PostgreSQL
├── Dockerfile               # production image
└── next.config.ts
```

---

## Getting Started

### Prerequisites

- Node.js **20.9+** (tested with 24)
- [Docker](https://www.docker.com) (for local PostgreSQL)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

At minimum, set `DATABASE_URL` and `SESSION_SECRET`. Microsoft OAuth is optional for local development — the login page shows a friendly message when it's not configured.

### 3. Start the database

```bash
npm run db:up        # docker compose up -d db
```

### 4. Create the schema and seed data

```bash
npm run db:push      # or: npm run db:migrate
npm run db:seed
```

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful commands:

```bash
npm run db:studio    # Prisma Studio (browse/edit data)
npm run lint         # ESLint
npm run typecheck    # TypeScript
npm run build        # production build
npm run start        # run the production build
```

### Development / debug script

A full-featured debug helper is available at `scripts/dev.mjs`:

```bash
npm run debug                      # interactive menu
npm run debug up --seed            # one-shot: check → db → migrate → seed → dev
npm run debug check                # environment doctor
npm run debug users                # list all users (names / ids / roles)
npm run debug adduser <username> --admin --uuid <UUID>   # create a user (optionally admin, with UUID)
npm run debug updateuser <username> --uuid <UUID>        # change UUID / username / role
npm run debug deleteuser <username>                      # delete a user (and their submissions)
npm run debug makeadmin <username> # promote a user to admin + print a session cookie
```

`adduser` accepts `--admin` (grant admin immediately) and `--uuid <UUID>` (bind a Minecraft UUID, used for the skin head and the 3D model); `updateuser` accepts `--uuid` / `--name` / `--role ADMIN|USER`. A 32-character UUID without dashes is also accepted and normalized.

#### User management / force login (separate script)

`scripts/users.mjs` is a looped interactive menu for managing users and — crucially — for **forcing a login** without Microsoft sign-in:

```bash
npm run users                      # interactive menu
npm run debug users:manage         # equivalent entry (delegated from dev.mjs)
```

You can also press `g` in the `debug.bat` menu.

| Menu item | What it does |
| --- | --- |
| List / search users | Shows UUID, Microsoft account, submission count, registration date |
| Create user | Optional UUID (format + uniqueness checked) and role |
| Edit user | Username / UUID / Microsoft account id / role; blank keeps the current value, `-` clears |
| Toggle role | USER ⇄ ADMIN |
| Delete user | Confirmation required; cascades to the user's submissions |
| **Force login** | Issues a 30-day `mc_session` cookie and prints the exact address and curl command |
| Create a submission | Fills valid answers per question type, handy for testing the review flow |
| View / change submission status | Same effect as approving or rejecting in the admin UI |
| Database / site overview | User, questionnaire and per-status submission counts, container state, site URL |

**How force login is used**: pick `l` → choose a user → the script prints an `mc_session` value plus two ways to use it:

1. Browser: open the site → F12 → Application → Cookies → add `mc_session` with that value → reload; `/dashboard` and `/admin` become accessible
2. Command line: the script prints a ready-to-copy `curl -H "Cookie: mc_session=..."` command

> The session is signed with `SESSION_SECRET` from `.env` and lasts 30 days; rotating the secret invalidates it.

On Windows you can also run `debug.bat` directly (double-click for the interactive menu, or `debug.bat <command>`, e.g. `debug.bat up --seed`).

It can also reset the database, open Prisma Studio, run preflight checks, and generate a debug session cookie (`session <username>`) so you can browse protected pages without a real Microsoft login.

The interactive menu groups these commands; omitting `<username>` on `adduser` / `admin` / `session` / `makeadmin` prompts for it interactively.

#### Signing in while the app awaits allow-list approval

Until the AppID is approved (see [step 2](#2-request-access-to-the-minecraft-api-allow-list-required)), Microsoft sign-in cannot complete, so accounts cannot be created by logging in. Use this sequence instead:

```bash
npm run debug adduser YourName --admin   # create an admin account directly
npm run debug session YourName           # print a 30-day mc_session cookie
```

Paste the printed value into DevTools → Application → Cookies (`mc_session` on `localhost:3000`) and reload — `/admin` and `/dashboard` become accessible. Alternatively, `db:seed` creates three demo users (`Steve`, `Alex`, `Notch_Fan`) that `makeadmin` can promote.

---

## Environment Variables

| Variable                  | Required | Description                                                        |
| ------------------------- | -------- | ------------------------------------------------------------------ |
| `DATABASE_URL`            | ✅       | PostgreSQL connection string                                       |
| `SESSION_SECRET`          | ✅       | Secret for encrypting session cookies (`openssl rand -base64 32`)  |
| `MICROSOFT_CLIENT_ID`     | ⬜       | Microsoft Azure app client id (for OAuth)                          |
| `MICROSOFT_CLIENT_SECRET` | ⬜       | Microsoft Azure app client secret                                  |
| `MICROSOFT_REDIRECT_URI`  | ⬜       | Must match the Azure app's redirect URI                             |
| `NEXT_PUBLIC_SITE_URL`    | ⬜       | Public site URL (used for SEO/redirects)                            |

---

## Microsoft / Minecraft OAuth Setup

The authentication flow verifies a user's **real Minecraft identity** through Microsoft's official OAuth — users never enter a Microsoft password on this site, and we never store one.

```
Microsoft OAuth  →  Xbox Live (XBL)  →  XSTS  →  Minecraft login  →  Minecraft profile (UUID + username)
```

### 1. Register an Azure application

1. Go to the [Azure Portal — App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsList).
2. Click **New registration**:
   - **Name**: anything (e.g. `mc-server-website`)
   - **Supported account types**: *Personal Microsoft accounts only*
   - **Redirect URI**: `Web` → `http://localhost:3000/api/auth/callback` (add your production URL as a second redirect URI)
3. Note the **Application (client) ID**.
4. Under **Certificates & secrets → New client secret**, create a secret and note its value.

> No API permissions are required. The flow only needs the delegated `XboxLive.signin offline_access` scope (requested by the app, not granted via API permissions).
>
> ⚠️ **Registering the app is not enough.** A new application must also be added to Mojang's API allow list, otherwise `login_with_xbox` returns 403. See "Minecraft API allow list approval" below.

### 2. Request access to the Minecraft API allow list (required)

Mojang **manually reviews** every new Java Edition API integration request and adds approved AppIDs to an allow list. Existing applications (launchers, websites) keep working, but **any newly registered Azure app gets a 403 at the final step until it is approved**:

```
HTTP 403
{ "path": "/authentication/login_with_xbox",
  "errorMessage": "Invalid app registration, see https://aka.ms/AppRegInfo for more information" }
```

Every earlier step (Microsoft OAuth → Xbox Live → XSTS) succeeds — **only `login_with_xbox` fails**, which is the signature of this problem.

**Submission form (currently active)**: <https://forms.cloud.microsoft/Pages/ResponsePage.aspx?id=v4j5cvGGr0GRqy180BHbR-ajEQ1td1ROpz00KtS8Gd5UNVpPTkVLNFVROVQxNkdRMEtXVjNQQjdXVC4u>

> The `aka.ms/mce-reviewappid` link in the official [Java Edition Game Service API Review or Application Process](https://help.minecraft.net/hc/en-us/articles/16254801392141) article is **dead** — use the form above.

**Check these before submitting:**

| Form field | What to enter |
| --- | --- |
| Contact email | Must be cross-referenceable against your Azure Portal account |
| Request type | `New AppID for Approval` |
| Application name | **Must not contain** `Mojang`, `Minecraft`, `Microsoft`, `Live`, `Xbox`, `Discord`, or `Hypixel` |
| Application ID | Application (client) ID |
| Tenant ID | Directory (tenant) ID — required for new app approval |
| Associated website or domain | A publicly reachable site / repo / community link — **no localhost** |
| Justification | Required; submissions without a valid justification are not reviewed |

**Justification text you can reuse:**

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

**Other notes:**

- Submissions are reviewed **weekly**; multiple submissions do not speed things up.
- Notifications come from **Mojang Enforcement** — check your spam folder.
- If it takes too long, follow up via [enforce@minecraft.net](mailto:enforce@minecraft.net) with your Client ID and submission date.
- To keep developing locally before approval: `npm run debug makeadmin <username>` prints a 30-day debug session cookie.

### 3. Fill in `.env`

```env
MICROSOFT_CLIENT_ID="<client-id>"
MICROSOFT_CLIENT_SECRET="<client-secret>"
MICROSOFT_REDIRECT_URI="http://localhost:3000/api/auth/callback"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
```

### 4. Notes

- A Microsoft account must **own Minecraft** to complete the flow (otherwise the profile lookup returns 404 and the user sees a friendly error).
- The **Minecraft UUID** is stored as the stable identity (usernames can change).
- The implementation lives in [`src/lib/auth/microsoft.ts`](src/lib/auth/microsoft.ts) and is fully server-side.
- A 403 `Invalid app registration` at the final step means the AppID is not on the allow list yet — see [step 2](#2-request-access-to-the-minecraft-api-allow-list-required).

---

## Making a User an Admin

There is no sign-up form — accounts are created on first Microsoft login. After you first log in, promote your account to admin:

**Option A — debug script (fastest)**

```bash
npm run debug makeadmin <username>   # on Windows: debug.bat makeadmin <username>
```

This does both things at once: promotes the user to `ADMIN` and prints a 30-day `mc_session` cookie you can paste into your browser. If the database has no users yet (before the first Microsoft login works), create one first:

```bash
npm run debug adduser <username> --admin
```

**Option B — Prisma Studio**

```bash
npm run db:studio
```

Open the `User` table, find your account, and change `role` to `ADMIN`.

**Option C — SQL**

```sql
UPDATE users SET role = 'ADMIN' WHERE minecraft_username = '<your-username>';
```

Roles are always checked on the server — never trusted from the client.

---

## Deployment

### Docker (recommended)

A production `Dockerfile` is included (multi-stage, standalone Node.js server).

```bash
# 1. Build the image
docker build -t mc-server-web .

# 2. Run it (with a real database)
docker run -p 3000:3000 --env-file .env mc-server-web
```

You also need a PostgreSQL instance (see `docker-compose.yml` for reference). For production, set:

- `DATABASE_URL` to your production database
- `SESSION_SECRET` to a strong random value
- `MICROSOFT_REDIRECT_URI` / `NEXT_PUBLIC_SITE_URL` to your public HTTPS URL
- Register the production redirect URI in the Azure app

### VPS (manual)

```bash
npm ci
npm run db:migrate  # or: prisma migrate deploy
npm run build
npm run start        # runs on :3000, put nginx/caddy in front for HTTPS
```

---

## Design Decisions & Tradeoffs

- **Cookie-based i18n (no URL prefix)** — keeps URLs clean (`/`, `/server`, …) per the spec. Tradeoff: public pages are server-rendered on demand instead of statically prerendered. If you prefer static pages, switch next-intl to the `[locale]` routing strategy.
- **iron-session (stateless, encrypted cookie)** — simple and secure for this scale; no session table needed. Swap for a database session if you need revoke-all-sessions.
- **Question ordering via up/down buttons** — reliable on both desktop and mobile (drag-and-drop was intentionally avoided to keep mobile stable).
- **Answers store option text as a snapshot** — simple to render in results; choice options are also stored as text. If you later need analytics by option id, migrate to option-id references.
- **Server info lives in `src/config/site.ts`** — easy to move to a database later when "edit server info" is added to admin.

## Known TODOs

- **Migrate Prisma seed config**: `package.json#prisma` is deprecated (warning `The configuration property package.json#prisma is deprecated`). It still works on Prisma 6 and does **not** affect authentication. Migrate to a `prisma.config.ts` before upgrading to Prisma 7.

## License

**Proprietary — all rights reserved.** This repository is published for review and
reference only. It is **not** open source: no permission is granted to use, copy,
modify, redistribute or reuse any part of it. See [LICENSE](./LICENSE) for the
full terms.
