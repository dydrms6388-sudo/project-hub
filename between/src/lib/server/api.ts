import "server-only";
import { NextResponse } from "next/server";
import { AppError, toUserMessage } from "./errors";

export function jsonError(e: unknown) {
  const status = e instanceof AppError ? e.status : 500;
  return NextResponse.json({ error: toUserMessage(e) }, { status });
}
