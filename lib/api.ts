import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

export async function requireUser() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new ApiError("Authentication required.", 401);
  }

  return { supabase, user };
}

export function jsonError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : "Unexpected error.";
  return NextResponse.json({ error: message }, { status: 500 });
}

export function assertString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.length === 0) {
    throw new ApiError(`${fieldName} is required.`);
  }

  return value;
}

export function assertObject(value: unknown, fieldName: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(`${fieldName} must be an object.`);
  }

  return value as Record<string, unknown>;
}

export function assertArray(value: unknown, fieldName: string) {
  if (!Array.isArray(value)) {
    throw new ApiError(`${fieldName} must be an array.`);
  }

  return value;
}
