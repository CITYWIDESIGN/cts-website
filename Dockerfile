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
