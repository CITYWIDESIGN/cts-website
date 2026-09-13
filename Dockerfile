# syntax=docker/dockerfile:1

# ---------- Dependencies ----------
FROM node:22-alpine AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json* ./
RUN npm ci

# ---------- Builder ----------
FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Ensure Prisma Client is generated for the target platform
RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1

# ⚠️ NEXT_PUBLIC_* 是**构建时内联**的，运行时的 env 对它没用。
# app/sitemap.ts 和 app/robots.ts 在 next build 阶段就被求值，
# 那时容器里没有这个变量，回退成 src/config/site.ts 的默认值
# http://localhost:3000 —— 线上 sitemap.xml 里 5 条链接全指向 localhost，
# 搜索引擎取到等于"这站不存在"。
# 所以必须作为构建参数传进来（compose 里配 build.args）。
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
RUN npm run build

# ---------- Runner ----------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma engine for alpine
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# ⚠️ 这一份 CLI **在 runner 里跑不起来** —— standalone 只保留应用真正 import 到的
# 模块，而 Prisma CLI 自己要一堆传递依赖（@prisma/config 等的 require 会失败）。
# 建表请用下面的 `migrate` target，不要在这里 `npx prisma db push`。
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# schema 也带上，方便进容器查看
COPY --from=builder /app/prisma ./prisma

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]

# ---------- Schema sync ----------
# 只给 `prisma db push` 用的一次性镜像：基于 builder，所以 node_modules 是完整的。
# 不进最终镜像，也就不会把编译工具链带到生产。
#
#   docker compose -f docker-compose.prod.yml run --rm migrate
FROM builder AS migrate
CMD ["npx", "prisma", "db", "push"]
