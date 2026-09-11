import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { absoluteUrl } from "@/lib/public-origin";

/*
  跳转目标必须走 absoluteUrl —— `new URL("/", request.url)` 在容器里会算成
  `https://0.0.0.0:3000/`（Dockerfile 的 HOSTNAME/PORT），登出后直接跳到死地址。
  详见 @/lib/public-origin。
*/

export async function POST(request: Request) {
  const session = await getSession();
  session.destroy();

  return NextResponse.redirect(absoluteUrl(request, "/"));
}

export async function GET(request: Request) {
  const session = await getSession();
  session.destroy();

  return NextResponse.redirect(absoluteUrl(request, "/"));
}
