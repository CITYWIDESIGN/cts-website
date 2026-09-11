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

### Public pages

- **Home** — Hero (server status, image carousel, call to action), features, intro, stats, how-to-join, news, FAQ. Fully bilingual.
- **`/server` `/rules` `/community`** — server info, rules, community channels (QQ group / OOPZ / Discord).
- **`/u/<id>`** — public player profile, viewable by anyone (comments / resources / downloads).

### Accounts

- **Local accounts are the primary path** — username + email + password, with **two-step registration**: fill in the form → receive an email code; the account is created only after the code is verified.
- **Microsoft sign-in is optional** — linking it verifies a real Minecraft identity and unlocks an avatar frame. Everything on the site works without it (Minecraft ID / UUID can be entered manually in the dashboard, and the skin avatar still renders).
- **Password reset** — by email code.
- **Changing email** — to protect the account this requires **verifying both the current and the new address** (two codes, two emails).
- **Changing username** — once per day, to stop people dodging recognition by renaming.
- **Closing an account** — the account is invalidated and identity fields are erased, but published content is kept (shown as “Closed account”).

### Questionnaires & joining

Four question types (single choice, multiple choice, short text, long text); a step-by-step wizard with progress, required validation and a confirmation step. Admins approve or reject in the backend, and the result is reflected on the homepage call to action.

### Resource sharing (`/resources`)

| Action | Who |
| --- | --- |
| Browse list / view detail | Everyone (no sign-in) |
| **Download attachments** | Everyone (no sign-in) |
| **Upload a resource** | **Any signed-in user** — passing the join review is *not* required |
| Edit description / delete | The uploader or an admin |

- Three browsing views: **grid / feed / list**, with the choice remembered locally.
- Server-side search (`?q=`) and pagination (`?page=`).
- Likes, comments, replies, reporting and share links; every edit produces a revision record (git-commit style, visible on the detail page).
- Attachments live in the database (`resources` + `resource_blobs`) — **no shared filesystem or object storage required**, so local / Docker / multi-instance deployments behave identically.
- List queries fetch metadata only; attachment bytes live in a separate `resource_blobs` table read solely by the download route.
- Cover images are served from `/api/resources/[id]/image` so data URLs are never inlined into list HTML.
- Covers accept raster formats only (PNG / JPG / GIF / WebP / AVIF) — **SVG is explicitly rejected**, because SVG can embed scripts and rendering it inline same-origin is stored XSS.

### Notifications

Likes and replies land in the notification list (`notifications` table). Acting on your own content never notifies you.

### Admin backend (`/admin`)

| Section | Contents |
| --- | --- |
| Overview | Stat cards, recent registrations, recent submissions |
| Users | Search / filter / paginate / change role / ban (1d·3d·7d·30d·permanent) / hard delete |
| Questionnaires | Create, edit, publish/pause, view results, review submissions |
| Resources | Edit metadata, replace attachment, delete |
| Reports | Review the report and the reported content; dismiss or remove |
| **Join entry** | Configure what the homepage “Apply to join” button does (below) |
| **Limits** | Configure per-user daily caps (below) |
| Statistics | Comment / resource / download rankings, guests included (by IP) |
| Audit log | A full record of irreversible actions |

#### Join entry configuration

What the “Apply to join” button in the hero and header does is configured at `/admin/join`, with four behaviours:

| Behaviour | Description |
| --- | --- |
| Fill in a questionnaire | A specific one, or the latest published (default — same as the old hard-coded behaviour) |
| Open an external link | QQ group / Discord / external form, optionally in a new tab |
| Open an on-site page | Any path on this site |
| Turn the entry off | The button disappears from the homepage |

- **Review status takes priority over the setting** — anyone with a submission already in gets “Check review status”, never a push to re-apply.
- There is also a “require signing in first” switch (on by default): a signed-out visitor goes to the login page and then **lands straight on the target** (on-site targets travel via `redirectTo`, which the login form reads).
- If the chosen questionnaire is later unpublished or deleted, this falls back to the latest published one so the homepage never goes blank.

#### Usage limits

`/admin/limits` configures every daily cap for regular users. **Admins are exempt from all of them and are never counted.**

| Setting | Default |
| --- | --- |
| Comments per day (replies included) | 50 |
| Resources published per day | 50 |
| Upload per day | 1024 MB (1GB) |
| Download per day | 1024 MB (1GB) |
| Max size per resource file | 5 MB |
| Max size per cover image | 1 MB |

- Values are stored as **whole MB** (typing 1024 beats typing 1073741824) and converted to bytes in code.
- Uploads and downloads are counted separately; the download cap applies to **signed-out visitors** too, counted per IP (visitors behind the same NAT share a quota).
- Usage is counted per **UTC day + subject + action** (`transfer_usage` / `daily_actions`), so a new day is simply a new row and **no scheduled job is needed to reset counters**.
- Quotas are **never displayed** — you only see a message when you exceed one (upload returns `413 quota_exceeded`, download returns `429`).
- This is a **soft limit**: under concurrency the check/add pair can race and overshoot slightly, which is fine for abuse prevention.
- Validation has two layers: zod covers per-field ranges, plus a **relational** rule — the per-file cap may not exceed the daily upload quota, otherwise a file would be blocked before it finishes uploading. Legal-looking config, unusable feature.

### Design system

Neutral colors + a muted brand green, light & dark mode, `prefers-reduced-motion` support, fully responsive.

---

## Project Structure

```
webv2/
├── prisma/
│   ├── schema.prisma        # Data model
│   ├── seed.ts              # Seed data (questionnaire + optional demo users)
│   └── migrations/
├── messages/
│   ├── en.json              # English translations
│   └── zh.json              # Chinese translations (key sets must match exactly — enforced by a script)
├── scripts/
│   ├── dev.mjs              # unified CLI (start / database / checks / debug)
│   ├── users.mjs            # user management + force sign-in
│   └── i18n-check.mjs       # zh/en key-parity check
├── src/
│   ├── app/                 # App Router pages & route handlers
│   │   ├── (marketing)/     # / , /server, /rules, /community, /resources, /login
│   │   ├── (dashboard)/     # /dashboard, /questionnaires/*
│   │   ├── (admin)/         # /admin/*
│   │   └── api/             # auth, resource upload/download/cover
│   ├── components/
│   │   ├── ui/              # shadcn/ui primitives
│   │   ├── motion/          # entrance-animation primitives (Stagger / SplitHeading / RowReveal …)
│   │   ├── layout/          # header, footer, user menu, language switcher
│   │   ├── marketing/       # home page sections, join CTA
│   │   ├── questionnaire/   # questionnaire form
│   │   ├── resources/       # resource list / detail / upload & edit
│   │   └── admin/           # admin UI
│   ├── server/              # Data Access & enforcement layer (server-only)
│   │   ├── auth.ts          # session + role helpers
│   │   ├── settings.ts      # SiteSetting key/value config (join entry / limits)
│   │   ├── limit.ts         # daily action-count enforcement
│   │   ├── quota.ts         # daily transfer-quota enforcement
│   │   ├── resource.ts      # resource queries / CRUD
│   │   ├── ban.ts           # bans
│   │   ├── notify.ts        # notifications (never notifies you about yourself)
│   │   ├── audit.ts         # audit log
│   │   └── …                # questionnaire / submission / report / stats …
│   ├── lib/
│   │   ├── prisma.ts        # Prisma client singleton
│   │   ├── session.ts       # iron-session config
│   │   ├── session-secret.ts# single source of truth for SESSION_SECRET
│   │   ├── safe-redirect.ts # on-site redirect allow-list (open-redirect guard)
│   │   ├── image-types.ts   # cover-image MIME allow-list (no SVG)
│   │   ├── auth/microsoft.ts# Microsoft → Xbox → XSTS → Minecraft flow
│   │   ├── actions/         # Server Actions (mutations)
│   │   └── validators/      # Zod schemas (incl. join-config / limits)
│   ├── i18n/                # next-intl request config
│   └── config/site.ts       # Server name / address / status (mock)
├── debug.bat                # one-click Windows menu (wraps scripts/dev.mjs)
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

#### Verification and operations

```bash
npm run preflight                  # tsc + eslint + i18n + unit tests (the gate before any commit)
npm test                           # unit tests only (node:test — no test framework dependency)
npm run debug backup               # pg_dump + gzip into backups/, keeping the last 14 files
npm run debug backup --keep 30 --out /mnt/backup
npm run debug backup --list        # list existing dumps
npm run debug cleanup              # prune expired verification codes / counters / read notifications
npm run debug cleanup --dry-run    # report what would be deleted
```

**Back up the database.** Every piece of user content lives in Postgres — resource
attachments, cover images, carousel images, accounts. The audit log tells you *who*
deleted something, but it cannot bring data back. Restore with:

```bash
gunzip -c backups/cts-YYYYMMDD-HHMM.sql.gz | psql "$DATABASE_URL"
```

Put `backup` on a cron and point `--out` at a **different disk or machine**: a dump
sitting next to the database it protects is not a backup.

#### Real player count (optional)

The homepage status card can show the live player count by speaking the vanilla
**Server List Ping** protocol to your server (`src/server/mc-ping.ts`) — no plugin,
no third-party API. It is **off unless configured**:

```bash
MC_PING_HOST="127.0.0.1"     # turn it on
MC_PING_PORT="25565"
```

Results are cached (30s) and de-duplicated, so the homepage does not open a socket
per request. With it off, the card falls back to the static values in
`src/config/site.ts`.

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
| `SESSION_SECRET`          | ✅       | Encrypts the session cookie **and** signs the OAuth state (`openssl rand -base64 32`). Must be **at least 32 characters and not the placeholder**; production throws at request time without it, and `debug.bat build`/`start` refuse to run |
| `NEXT_PUBLIC_SITE_NAME`   | ⬜       | Site name, used for the email sender name and page titles           |
| `NEXT_PUBLIC_SITE_URL`    | ⬜       | Public site URL (used for SEO/redirects)                            |
| `MICROSOFT_CLIENT_ID`     | ⬜       | Microsoft Azure app client id (for OAuth)                          |
| `MICROSOFT_CLIENT_SECRET` | ⬜       | Microsoft Azure app client secret                                  |
| `MICROSOFT_REDIRECT_URI`  | ⬜       | Must match the Azure app's redirect URI                             |
| `SMTP_HOST` `SMTP_PORT` `SMTP_SECURE` | ⬜ | Mail server. `SMTP_SECURE=true` uses 465, `false` uses 587/STARTTLS |
| `SMTP_USER` `SMTP_PASS`   | ⬜       | **Sender** mailbox and app password (not your login password). **One sender mailbox is enough** — it can send codes to any recipient |
| `SMTP_FROM`               | ⬜       | From address; must match `SMTP_USER`                                |

With SMTP unconfigured: in **development** the code is printed to the server console and shown on the page, so the whole flow still works; in **production** sending fails loudly rather than silently.

Self-check: `node scripts/dev.mjs mail:test you@example.com` (no address = connection test only), and `node scripts/dev.mjs mail:preview you@example.com` sends a rendering preview of the real template.

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

There is a sign-up form; the first account you register is a regular user and must be promoted by hand:

**Option A — debug script (fastest)**

```bash
npm run debug makeadmin <username>   # on Windows: debug.bat makeadmin <username>
```

This does both things at once: promotes the user to `ADMIN` and prints a 30-day `mc_session` cookie you can paste into your browser. If the database has no users yet, create one first:

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
UPDATE users SET role = 'ADMIN' WHERE username = '<your-username>';
```

Roles are always checked on the server — never trusted from the client. Admins are exempt from every usage limit.

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

- **Cookie-based i18n (no URL prefix)** — keeps URLs clean (`/`, `/server`, …) per the spec. Tradeoff: public pages are server-rendered on demand instead of statically prerendered. If you prefer static pages, switch next-intl to the `[locale]` routing strategy. The zh/en key sets are kept identical by `scripts/i18n-check.mjs`, which also verifies that every `t("…")` reference in the code resolves.
- **Site config in a key/value table rather than one table per setting** — `SiteSetting` (`key` + Json `value`) validated with zod, so type safety is guaranteed in code, not by the database. Two keys today: `join` (join entry) and `limits` (usage limits). Missing row, malformed value or an unreachable database all fall back to defaults — configuration problems must never take the homepage down.
- **Limits are stored as whole MB** — typing `1024` in a form beats typing `1073741824`; not using GB avoids the floating-point edges of values like `0.5GB`. Byte values are derived by `limitsToBytes()`.
- **iron-session (stateless, encrypted cookie)** — simple and secure for this scale; no session table needed. Swap for a database session if you need revoke-all-sessions.
- **Passwords hashed with scrypt** — `passwordHash` is null for Microsoft-only accounts. Local accounts are the primary path; Microsoft linking is an add-on.
- **Question ordering via up/down buttons** — reliable on both desktop and mobile (drag-and-drop was intentionally avoided to keep mobile stable).
- **Answers store option text as a snapshot** — simple to render in results; choice options are also stored as text. If you later need analytics by option id, migrate to option-id references.
- **Server info lives in `src/config/site.ts`** — easy to move to a database later when "edit server info" is added to admin.
- **The audit log records irreversible actions only** — deleting a resource or user, closing an account, removing reported content, changing site settings. A failed audit write never blocks the main operation (auditing must not become a point of failure).
- **UI copy and input hints use two different registers** — interface labels, statuses, errors and the admin panel stay businesslike and expository; placeholders and input hints are conversational and **never use examples** (no “e.g. Skyblock modpack v2”).

## Known TODOs

- **Migrate Prisma seed config**: `package.json#prisma` is deprecated (warning `The configuration property package.json#prisma is deprecated`). It still works on Prisma 6 and does **not** affect authentication. Migrate to a `prisma.config.ts` before upgrading to Prisma 7.
- **The comment list is capped at 100 top-level threads per resource** (`listComments`); replies are fetched per thread so a thread is never half-rendered. Past the cap the oldest threads are not shown, and pagination is not implemented yet.
- **HSTS is not enabled.** Whether production always runs over HTTPS is a deployment decision, so `Strict-Transport-Security` is deliberately left out of `securityHeaders` in `next.config.ts` — enabling it blindly can lock a plain-HTTP deployment out. Add it once the domain and certificate are in place.
- **The per-IP verification-email cap is in-process** (`src/server/rate-limit.ts`), same trade-off as the sign-in throttle: it resets on restart and is not shared across instances. Move both to Redis or a counter table when the site runs multi-instance.
- **`getActivityStats` reads every user and sorts in memory** (admin stats page). Fine at this scale; push the ordering down into SQL if the user count reaches the thousands.
- **Backups and cleanup are manual commands, not scheduled jobs.** `npm run debug backup` produces a real `pg_dump` and `cleanup` prunes expired rows, but you still have to wire both into cron on the server, and point `--out` at a second disk.
- **`User.sessionVersion` requires a schema push.** Deploying this version needs `npm run db:push` once, and it signs everyone out — cookies issued before it carry no version number.
- **Configure SPF / DKIM once the domain is live**, otherwise verification emails tend to land in spam.
- **Microsoft sign-in returns 403 on the last step until the Minecraft AppID review completes** (see above). Local accounts are unaffected.

## License

**Proprietary — all rights reserved.** This repository is published for review and
reference only. It is **not** open source: no permission is granted to use, copy,
modify, redistribute or reuse any part of it. See [LICENSE](./LICENSE) for the
full terms.
