import Link from "next/link";
import { SkinHead } from "@/components/skin/skin-head";
import { AvatarFrame, avatarInnerSize } from "@/components/user/avatar-frame";
import { skinRawUrl } from "@/lib/skin";
import { cn } from "@/lib/utils";

/**
 * 可点击的用户头像 → `/u/<id>` 资料页。
 *
 * 资料页是**公开**的：任何访客都能点头像进去看，不限于管理员。
 * 没有皮肤（没填 / 没绑定 Minecraft）时退回首字母方块。
 *
 * `framed` 表示"佩戴头像框"，只有**绑定了 Microsoft** 的账号才会传 true。
 *
 * 故意不加 "use client"：它本身没有状态，服务端组件和客户端组件都能用。
 */
export function UserAvatarLink({
  userId,
  name,
  uuid,
  size = 32,
  framed = false,
  className,
}: {
  userId: string;
  name: string | null;
  uuid: string | null;
  /** 显示边长（px），含头像框 */
  size?: number;
  /** 是否佩戴头像框（绑定 Microsoft 的奖励） */
  framed?: boolean;
  className?: string;
}) {
  const skin = skinRawUrl(uuid);
  const label = name ?? "?";
  const title = name ?? userId;

  // 有框时头像本体要小一圈，让出环的位置
  const inner = framed ? avatarInnerSize(size) : size;

  const avatar = skin ? (
    <SkinHead skinUrl={skin} alt={label} size={inner} />
  ) : (
    <span
      className="flex items-center justify-center rounded-[3px] bg-primary/12 font-semibold text-primary"
      style={{
        width: inner,
        height: inner,
        fontSize: Math.round(inner * 0.42),
      }}
    >
      {label.charAt(0).toUpperCase()}
    </span>
  );

  return (
    <Link
      href={`/u/${userId}`}
      title={title}
      aria-label={title}
      className={cn(
        "inline-flex shrink-0 rounded-md transition-transform duration-200 hover:scale-105 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        className
      )}
    >
      {framed ? (
        <AvatarFrame size={size}>{avatar}</AvatarFrame>
      ) : (
        <span className="block overflow-hidden rounded-md ring-1 ring-border">
          {avatar}
        </span>
      )}
    </Link>
  );
}
