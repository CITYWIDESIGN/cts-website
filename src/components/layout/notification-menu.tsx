import { getCurrentUser } from "@/server/auth";
import { countUnread, listNotifications } from "@/server/notify";
import { NotificationBell } from "./notification-bell";

/**
 * 消息铃铛（服务端）：读取未读数与最近消息后交给客户端渲染。
 * 未登录直接不渲染。
 */
export async function NotificationMenu() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [items, unread] = await Promise.all([
    listNotifications(user.id, 30),
    countUnread(user.id),
  ]);

  return (
    <NotificationBell
      authed
      unread={unread}
      items={items.map((n) => ({
        id: n.id,
        type: n.type,
        actorName: n.actorName,
        resourceId: n.resourceId,
        resolution: n.resolution,
        readAt: n.readAt ? n.readAt.toISOString() : null,
        createdAt: n.createdAt.toISOString(),
      }))}
    />
  );
}
