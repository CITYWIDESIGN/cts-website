import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { requireAdmin } from "@/server/auth";
import { listUsers } from "@/server/admin";
import { isBanned } from "@/server/ban";
import { UsersFilter } from "@/components/admin/users-filter";
import { UserRoleSelect } from "@/components/admin/user-role-select";
import { UserBanDialog } from "@/components/admin/user-ban-dialog";
import { UserDeleteDialog } from "@/components/admin/user-delete-dialog";
import { UserAvatarLink } from "@/components/user/user-avatar-link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageEnter, Stagger, StaggerItem } from "@/components/motion/stagger";
import { RowReveal } from "@/components/motion/row-reveal";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Pagination } from "@/components/ui/pagination";
import { formatDateTime, formatUuid } from "@/lib/format";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; role?: string }>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const t = await getTranslations("admin.userManagement");
  const common = await getTranslations("common");

  const page = Number(params.page) || 1;
  const { users, total, totalPages } = await listUsers({
    search: params.search,
    page,
    role: params.role === "ADMIN" || params.role === "USER" ? params.role : undefined,
  });

  /** 翻页链接：保留搜索词和角色筛选，只换页码 */
  function hrefForPage(n: number) {
    const sp = new URLSearchParams();
    if (params.search) sp.set("search", params.search);
    if (params.role) sp.set("role", params.role);
    sp.set("page", String(n));
    return `?${sp.toString()}`;
  }

  return (
    <PageEnter className="flex flex-col gap-6">
      <Stagger inView={false} stagger={0.09} className="flex flex-col gap-6">
        <StaggerItem index={0}>
          <AdminPageHeader title={t("title")} description={t("description")} />
        </StaggerItem>

        <StaggerItem index={1}>
          <UsersFilter />
        </StaggerItem>

        <StaggerItem index={2}>
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("username")}</TableHead>
                  <TableHead>{t("account")}</TableHead>
                  <TableHead>UUID</TableHead>
                  <TableHead>{t("role")}</TableHead>
                  <TableHead>{t("submissionStatus")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("registered")}</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      {t("noUsers")}
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user, i) => {
                    // 到期未解封的记录不算"封禁中"：只看时间
                    const banned = isBanned(user);
                    return (
                      <RowReveal
                        key={user.id}
                        index={i}
                        className="transition-colors duration-200 hover:bg-accent/40"
                      >
                        <TableCell>
                          {/* 头像可点，进公开资料页 —— 任何访客都能看，不限于管理员 */}
                          <span className="flex items-center gap-2.5">
                            <UserAvatarLink
                              userId={user.id}
                              name={user.minecraftUsername}
                              uuid={user.minecraftUuid}
                              size={28}
                            />
                            <Link
                              href={`/u/${user.id}`}
                              className="truncate font-medium hover:underline"
                            >
                              {user.minecraftUsername ?? "—"}
                            </Link>
                          </span>
                        </TableCell>
                        {/* 登录用的账号名。和玩家名是两回事，之前后台看不到 */}
                        <TableCell className="font-mono text-xs">
                          {user.username ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {formatUuid(user.minecraftUuid)}
                        </TableCell>
                        <TableCell>
                          <UserRoleSelect userId={user.id} role={user.role} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {user._count.submissions}
                        </TableCell>
                        <TableCell>
                          {banned ? (
                            <Badge variant="destructive">{t("banned")}</Badge>
                          ) : (
                            <Badge variant="secondary">{t("active")}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDateTime(user.createdAt)}
                        </TableCell>
                        <TableCell>
                          {/* 管理员之间不互相删除/封禁：自己的行也不显示入口 */}
                          {user.role !== "ADMIN" && user.id !== admin.id && (
                            <div className="flex items-center gap-1">
                              <UserBanDialog
                                userId={user.id}
                                name={user.minecraftUsername}
                                banned={banned}
                                bannedUntil={
                                  user.bannedUntil
                                    ? user.bannedUntil.toISOString()
                                    : null
                                }
                                banReason={user.banReason}
                                variant="icon"
                              />
                              <UserDeleteDialog
                                userId={user.id}
                                name={
                                  user.minecraftUsername ?? user.username ?? user.id
                                }
                              />
                            </div>
                          )}
                        </TableCell>
                      </RowReveal>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </StaggerItem>

        <StaggerItem
          index={3}
          className="flex items-center justify-between gap-3 text-sm text-muted-foreground"
        >
          <span>{t("count", { count: total })}</span>
          <Pagination
            page={page}
            totalPages={totalPages}
            hrefFor={hrefForPage}
            compact
            labels={{
              prev: common("prevPage"),
              next: common("nextPage"),
              nav: common("pagination"),
            }}
          />
        </StaggerItem>
      </Stagger>
    </PageEnter>
  );
}
