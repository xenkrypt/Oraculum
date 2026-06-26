import { NextResponse } from "next/server";
import { SCENARIO_POOL } from "@/lib/scenarios";

export async function GET() {
  // Return all scenarios for reference — adaptive selection happens client-side
  return NextResponse.json({ challenges: SCENARIO_POOL, count: SCENARIO_POOL.length });
}
