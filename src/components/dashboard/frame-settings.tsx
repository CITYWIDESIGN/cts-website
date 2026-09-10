"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { UserAvatarLink } from "@/components/user/user-avatar-link";
import {
  setWearFrameAction,
  unbindMicrosoftAction,
} from "@/lib/actions/auth/account";

/**
 * 头像框设置 —— **只有绑定了 Microsoft 的账号才有框**。
 *
 * 用 Switch 控制"佩戴 / 不佩戴"：不佩戴时头像还是能用的，只是没有装饰。
 * 旁边的预览直接复用 `<UserAvatarLink>`，和站内其它位置的头像完全一致，
 * 所见即所得。
 */
export function FrameSettings({
  userId,
  name,
  uuid,
  wearing,
}: {
  userId: string;
  name: string | null;
  uuid: string | null;
  wearing: boolean;
}) {
  const t = useTranslations("dashboard.frame");
  const router = useRouter();

  const [on, setOn] = React.useState(wearing);
  const [pending, setPending] = React.useState(false);

  async function toggle(next: boolean) {
    setOn(next); // 乐观切换，失败再回滚
    setPending(true);
    const res = await setWearFrameAction(next);
    setPending(false);

    if (!res.ok) {
      setOn(!next);
      toast.error(t("failed"));
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-5">
        {/* 预览：左右各一个对比 */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <UserAvatarLink
              userId={userId}
              name={name}
              uuid={uuid}
              framed={on}
              size={64}
            />
            <span className="text-[11px] text-muted-foreground">
              {on ? t("previewOn") : t("previewOff")}
            </span>
          </div>
          <div className="flex flex-col items-center gap-2 opacity-60">
            <UserAvatarLink
              userId={userId}
              name={name}
              uuid={uuid}
              framed={!on}
              size={64}
              // 预览里的另一个只是对照，点进去反而奇怪
              className="pointer-events-none"
            />
            <span className="text-[11px] text-muted-foreground">
              {on ? t("previewOff") : t("previewOn")}
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <Switch
              id="wear-frame"
              checked={on}
              disabled={pending}
              onCheckedChange={toggle}
            />
            <Label htmlFor="wear-frame" className="cursor-pointer">
              {t("wear")}
            </Label>
            {pending && (
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t("description")}</p>
        </div>
      </div>
    </div>
  );
}

/** 解除 Microsoft 绑定（二次确认） */
export function UnbindMicrosoftButton() {
  const t = useTranslations("dashboard.frame");
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  async function run() {
    setPending(true);
    const res = await unbindMicrosoftAction();
    setPending(false);
    setConfirming(false);
    if (!res.ok) {
      toast.error(t("failed"));
      return;
    }
    toast.success(t("unbound"));
    router.refresh();
  }

  if (!confirming) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setConfirming(true)}
        className="text-muted-foreground"
      >
        <Unlink className="size-3.5" />
        {t("unbind")}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">{t("unbindConfirm")}</span>
      <Button variant="destructive" size="sm" onClick={run} disabled={pending}>
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Unlink className="size-3.5" />
        )}
        {t("unbindConfirmYes")}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setConfirming(false)}
        disabled={pending}
      >
        {t("cancel")}
      </Button>
    </div>
  );
}
