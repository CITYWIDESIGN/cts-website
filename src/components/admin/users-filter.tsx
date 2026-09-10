"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function UsersFilter() {
  const t = useTranslations("admin.userManagement");
  const common = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [search, setSearch] = React.useState(searchParams.get("search") ?? "");
  const role = searchParams.get("role") ?? "";

  function update(next: { search?: string; role?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.search !== undefined) {
      if (next.search) params.set("search", next.search);
      else params.delete("search");
    }
    if (next.role !== undefined) {
      if (next.role) params.set("role", next.role);
      else params.delete("role");
    }
    params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update({ search });
        }}
        className="relative flex-1"
      >
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="pl-9"
        />
      </form>

      <Select
        value={role || "ALL"}
        onValueChange={(v) => update({ role: v === "ALL" ? "" : v })}
      >
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">{common("all")}</SelectItem>
          <SelectItem value="USER">{t("roleUser")}</SelectItem>
          <SelectItem value="ADMIN">{t("roleAdmin")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
