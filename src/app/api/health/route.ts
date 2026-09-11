import { NextResponse } from "next/server";

/**
 * 存活检查（Docker healthcheck / 隧道监控用）。
 *
 * **故意不查数据库**：这是"进程还活着、能响应请求"的探针，
 * 用来让 Docker 决定要不要重启容器。把数据库也拉进来会变成"依赖探针"——
 * 数据库短暂抖动一下，Docker 就会把好端端的应用容器重启掉，反而放大故障。
 * 数据库的真实健康由页面自己暴露（挂了会报错）。
 *
 * 不返回任何内部信息（版本、环境、依赖状态），所以可以公开。
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}
