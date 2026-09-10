import { loadJoinState } from "@/lib/join-state";
import { JoinStateProvider } from "@/components/marketing/join-state-context";

/**
 * 服务端包装：读取一次加入状态，交给客户端 Context 复用。
 * 这样首页三处 CTA 只需查一次库，也不会把服务端组件塞进客户端。
 */
export async function JoinStateLoader({
  children,
}: {
  children: React.ReactNode;
}) {
  const state = await loadJoinState();
  return <JoinStateProvider value={state}>{children}</JoinStateProvider>;
}
