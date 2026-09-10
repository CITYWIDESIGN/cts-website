"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveMinecraftIdentityAction } from "@/lib/actions/auth/account";

/** 有对应文案的错误码；其余走 generic */
const KNOWN_ERRORS = new Set([
  "UUID_TAKEN",
  "UNKNOWN",
  "NAME_TOO_SHORT",
  "NAME_TOO_LONG",
  "NAME_INVALID_CHARS",
  "UUID_INVALID_UUID",
]);

/**
 * 手填 Minecraft ID / UUID。
 *
 * 这条路径**不需要 Microsoft 登录**，也不用审核 —— 目的是让没通过
 * Mojang 白名单 / 不想绑 Microsoft 的人也能有皮肤头像。
 * UUID 仍然全局唯一，避免两个人抢同一张脸。
 *
 * 注意：手填的信息无法验证，所以**不会**给头像框；头像框是绑定
 * Microsoft 的奖励。
 */
export function MinecraftIdentityForm({
  initialName,
  initialUuid,
}: {
  initialName: string;
  initialUuid: string;
}) {
  const t = useTranslations("dashboard.identity");
  const router = useRouter();

  const [name, setName] = React.useState(initialName);
  const [uuid, setUuid] = React.useState(initialUuid);
  const [pending, setPending] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);

    const res = await saveMinecraftIdentityAction({
      minecraftUsername: name,
      minecraftUuid: uuid,
    });

    setPending(false);

    if (!res.ok) {
      toast.error(t(`errors.${KNOWN_ERRORS.has(res.error ?? "") ? res.error : "generic"}`));
      return;
    }

    toast.success(t("saved"));
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="mc-name">{t("name")}</Label>
        <Input
          id="mc-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("nameHint")}
          maxLength={16}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="mc-uuid">{t("uuid")}</Label>
        <Input
          id="mc-uuid"
          value={uuid}
          onChange={(e) => setUuid(e.target.value)}
          placeholder={t("uuidHint")}
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">{t("uuidHelp")}</p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !name.trim()}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {pending ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}
