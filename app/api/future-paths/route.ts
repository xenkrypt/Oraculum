import { NextResponse } from "next/server";
import { assertArray, assertString, jsonError, requireUser } from "@/lib/api";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const body = (await request.json()) as Record<string, unknown>;
    const sessionId = assertString(body.session_id, "session_id");
    const paths = assertArray(body.paths, "paths");

    // AI integration point: a future roadmap generator should produce this
    // structured paths array after reading responses and the talent profile.
    const { data: futurePaths, error } = await supabase
      .from("future_paths")
      .upsert(
        {
          user_id: user.id,
          session_id: sessionId,
          paths
        },
        { onConflict: "session_id" }
      )
      .select("id,user_id,session_id,paths,updated_at")
      .single();

    if (error) {
      throw error;
    }

    await supabase.from("user_events").insert({
      user_id: user.id,
      session_id: sessionId,
      type: "future_paths_generated",
      payload: {
        future_paths_id: futurePaths.id,
        path_count: paths.length
      }
    });

    return NextResponse.json({ futurePaths });
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET(request: Request) {
  try {
    const { supabase } = await requireUser();
    const { searchParams } = new URL(request.url);
    const sessionId = assertString(searchParams.get("session_id"), "session_id");

    const { data: futurePaths, error } = await supabase
      .from("future_paths")
      .select("id,session_id,paths,created_at,updated_at")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return NextResponse.json({ futurePaths });
  } catch (error) {
    return jsonError(error);
  }
}
