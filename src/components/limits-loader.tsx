import { getLimits } from "@/server/settings";
import { LimitsProvider } from "@/components/limits-provider";

/**
 * 服务端包装：读一次限额配置，交给客户端 Context 复用。
 *
 * 和 JoinStateLoader 一样，放在 layout 里 —— 页面里可能有好几个上传入口
 * （上传弹窗、编辑弹窗、后台管理弹窗），不该各查一次库。
 */
export async function LimitsLoader({
  children,
}: {
  children: React.ReactNode;
}) {
  const limits = await getLimits();
  return <LimitsProvider value={limits}>{children}</LimitsProvider>;
}
