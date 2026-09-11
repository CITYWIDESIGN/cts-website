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
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# schema 也要带上：否则容器里跑不了 `npx prisma db push`（首次部署建表要用）。
# 之前只 COPY 了 node_modules 里的 prisma，命令能起来但找不到 schema。
COPY --from=builder /app/prisma ./prisma

# 健康检查用 wget（busybox 自带），不需要额外的 HEALTHCHECK 指令
USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
