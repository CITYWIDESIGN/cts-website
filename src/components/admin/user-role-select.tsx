"use client";

import * as React from "react";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { adminUpdateUserRole } from "@/lib/actions/admin";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function UserRoleSelect({
  userId,
  role,
}: {
  userId: string;
  role: "USER" | "ADMIN";
}) {
  const t = useTranslations("admin.userManagement");
  const [isPending, startTransition] = useTransition();

  function onChange(next: string) {
    startTransition(async () => {
      const result = await adminUpdateUserRole(userId, next);
      if (!result.ok) {
        toast.error(t("role"));
      }
    });
  }

  return (
    <Select value={role} onValueChange={onChange} disabled={isPending}>
      <SelectTrigger className="h-8 w-28" size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="USER">{t("roleUser")}</SelectItem>
        <SelectItem value="ADMIN">{t("roleAdmin")}</SelectItem>
      </SelectContent>
    </Select>
  );
}
