import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function getStats() {
  const [totalUsers, boundUsers, totalSubmissions, pendingSubmissions] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { minecraftUuid: { not: null } } }),
      prisma.submission.count(),
      prisma.submission.count({ where: { status: "PENDING" } }),
    ]);

  return { totalUsers, boundUsers, totalSubmissions, pendingSubmissions };
}

export async function getRecentUsers(limit = 5) {
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      minecraftUsername: true,
      minecraftUuid: true,
      role: true,
      createdAt: true,
    },
  });
}

export async function getRecentSubmissions(limit = 5) {
  return prisma.submission.findMany({
    orderBy: { submittedAt: "desc" },
    take: limit,
    select: {
      id: true,
      status: true,
      submittedAt: true,
      user: {
        select: { minecraftUsername: true },
      },
      questionnaire: {
        select: { title: true },
      },
    },
  });
}

const USERS_PAGE_SIZE = 20;

export async function listUsers(options: {
  search?: string;
  page?: number;
  role?: "USER" | "ADMIN";
}) {
  const page = Math.max(1, options.page ?? 1);
  const where: Prisma.UserWhereInput = {};

  if (options.search) {
    where.OR = [
      { minecraftUsername: { contains: options.search, mode: "insensitive" } },
      { minecraftUuid: { contains: options.search, mode: "insensitive" } },
    ];
  }
  if (options.role) {
    where.role = options.role;
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * USERS_PAGE_SIZE,
      take: USERS_PAGE_SIZE,
      select: {
        id: true,
        username: true,
        minecraftUsername: true,
        minecraftUuid: true,
        role: true,
        createdAt: true,
        bannedAt: true,
        bannedUntil: true,
        banReason: true,
        _count: { select: { submissions: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users,
    total,
    page,
    pageSize: USERS_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / USERS_PAGE_SIZE)),
  };
}
