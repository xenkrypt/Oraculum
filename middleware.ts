import { type NextRequest, NextResponse } from "next/server";

// Passthrough middleware — no Supabase, no external auth required for demo.
// Cookie-based mock auth is handled at the API route level via lib/api.ts.
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};
