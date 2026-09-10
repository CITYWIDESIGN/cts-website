import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/auth";
import { Button } from "@/components/ui/button";
import { UserMenuButton } from "./user-menu-button";
import { skinRawUrl } from "@/lib/skin";
import { hasAvatarFrame } from "@/lib/frame";

/**
 * 右上角用户入口（服务端）：读取会话后交给客户端按钮渲染。
 * 皮肤用**原始 64×64 纹理**（而不是已合成的头像），这样 <SkinHead> 才能
 * 自己把内层 + 帽子外层叠出来。
 * 具体功能（我的问卷 / 账户设置 / 管理后台 / 退出登录）都在个人中心里。
 */
export async function UserMenu() {
  const t = await getTranslations("nav");
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Button asChild size="sm">
        <Link href="/login">{t("login")}</Link>
      </Button>
    );
  }

  // 没填 Minecraft ID 的人用本地账号名兜底，否则头像旁边会是个"—"
  const username = user.minecraftUsername ?? user.username ?? "—";
  const initial = (username.charAt(0) ?? "?").toUpperCase();

  return (
    <UserMenuButton
      username={username}
      initial={initial}
      skinUrl={skinRawUrl(user.minecraftUuid)}
      framed={hasAvatarFrame(user)}
      label={t("dashboard")}
      menuLabel={t("dashboard")}
      hereLabel={t("currentlyHere")}
    />
  );
}
