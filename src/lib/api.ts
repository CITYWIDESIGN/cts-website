import { NextResponse } from "next/server";

export function jsonError(
  message: string,
  status: number,
  code?: string
): NextResponse {
  return NextResponse.json({ error: message, code }, { status });
}

export function unauthorized(message = "Unauthorized"): NextResponse {
  return jsonError(message, 401, "UNAUTHORIZED");
}

export function forbidden(message = "Forbidden"): NextResponse {
  return jsonError(message, 403, "FORBIDDEN");
}

export function notFound(message = "Not found"): NextResponse {
  return jsonError(message, 404, "NOT_FOUND");
}
