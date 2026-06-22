import { NextResponse } from "next/server";
import {
  assertObject,
  assertString,
  jsonError,
  requireUser
} from "@/lib/api";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const body = (await request.json()) as Record<string, unknown>;
    const type = assertString(body.type, "type");
    const sessionId =
      typeof body.session_id === "string" && body.session_id.length > 0
        ? body.session_id
        : null;
    const payload =
      body.payload === undefined ? {} : assertObject(body.payload, "payload");

    const { data: event, error } = await supabase
      .from("user_events")
      .insert({
        user_id: user.id,
        session_id: sessionId,
        type,
        payload
      })
      .select("id,user_id,session_id,type,payload,created_at")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET(request: Request) {
  try {
    const { supabase } = await requireUser();
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");
    const limit = Number(searchParams.get("limit") ?? 50);

    let query = supabase
      .from("user_events")
      .select("id,session_id,type,payload,created_at")
      .order("created_at", { ascending: false })
      .limit(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50);

    if (sessionId) {
      query = query.eq("session_id", sessionId);
    }

    const { data: events, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({ events });
  } catch (error) {
    return jsonError(error);
  }
}
