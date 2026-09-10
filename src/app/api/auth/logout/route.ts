import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST(request: Request) {
  const session = await getSession();
  session.destroy();

  return NextResponse.redirect(new URL("/", request.url));
}

export async function GET(request: Request) {
  const session = await getSession();
  session.destroy();

  return NextResponse.redirect(new URL("/", request.url));
}
