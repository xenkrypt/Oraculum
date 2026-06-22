import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/api";
import type { Json } from "@/lib/types/database";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const body = (await request.json().catch(() => ({}))) as {
      metadata?: Json;
    };

    const { data: session, error } = await supabase
      .from("sessions")
      .insert({
        user_id: user.id,
        metadata: body.metadata ?? {}
      })
      .select("id,status,started_at,metadata")
      .single();

    if (error) {
      throw error;
    }

    await supabase.from("user_events").insert({
      user_id: user.id,
      session_id: session.id,
      type: "session_started",
      payload: { metadata: session.metadata }
    });

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET() {
  try {
    const { supabase } = await requireUser();
    const { data: sessions, error } = await supabase
      .from("sessions")
      .select("id,status,started_at,completed_at,metadata")
      .order("started_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ sessions });
  } catch (error) {
    return jsonError(error);
  }
}
