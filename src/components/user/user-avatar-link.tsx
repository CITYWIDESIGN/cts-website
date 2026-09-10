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
    /*
      ⚠️ `h-fit` 不能去掉。
      这里的 Link 与里面的 span 都是 **flex item**，而 flex 的 `align-items`
      默认是 `stretch` —— 只要父容器没写 items-center / items-start，
      它们就会被拉到整行高度（评论区里一行 ~70px，而头像只有 32px）。
      于是 `ring-1` 那一圈被画在一个 ~70px 高的圆角矩形上，32px 的头像
      只盖住它的上半部分，**底下就露出一条 U 形的线**。

      `h-fit` 让高度由内容决定，不再被拉伸；同时 `align-self` 仍是 auto，
      所以在 `items-center` 的父容器里依旧正常居中。
    */
    <Link
      href={`/u/${userId}`}
      title={title}
      aria-label={title}
      className={cn(
        "inline-flex h-fit shrink-0 rounded-md transition-transform duration-200 hover:scale-105 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        className
      )}
    >
      {framed ? (
        <AvatarFrame size={size}>{avatar}</AvatarFrame>
      ) : (
        // 显式尺寸，双保险：即使父容器是 stretch，这圈 ring 也只会贴着头像
        <span
          className="block overflow-hidden rounded-md ring-1 ring-border"
          style={{ width: size, height: size }}
        >
          {avatar}
        </span>
      )}
    </Link>
  );
}
