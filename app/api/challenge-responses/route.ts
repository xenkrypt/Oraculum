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
    const sessionId = assertString(body.session_id, "session_id");
    const challengeId = assertString(body.challenge_id, "challenge_id");
    const rawResponse = assertObject(body.raw_response, "raw_response");

    const { data: response, error } = await supabase
      .from("challenge_responses")
      .insert({
        user_id: user.id,
        session_id: sessionId,
        challenge_id: challengeId,
        raw_response: rawResponse
      })
      .select("id,user_id,session_id,challenge_id,raw_response,created_at")
      .single();

    if (error) {
      throw error;
    }

    await supabase.from("user_events").insert({
      user_id: user.id,
      session_id: sessionId,
      type: "challenge_completed",
      payload: {
        challenge_id: challengeId,
        response_id: response.id
      }
    });

    return NextResponse.json({ response }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET(request: Request) {
  try {
    const { supabase } = await requireUser();
    const { searchParams } = new URL(request.url);
    const sessionId = assertString(searchParams.get("session_id"), "session_id");

    const { data: responses, error } = await supabase
      .from("challenge_responses")
      .select(
        "id,session_id,challenge_id,raw_response,created_at,challenge_definitions(title,type,config)"
      )
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ responses });
  } catch (error) {
    return jsonError(error);
  }
}
