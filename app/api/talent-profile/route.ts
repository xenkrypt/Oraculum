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
    const dimensionScores = assertObject(
      body.dimension_scores,
      "dimension_scores"
    );
    const summaryText = assertString(body.summary_text, "summary_text");

    // AI integration point: a future scorer/generator should produce
    // dimension_scores and summary_text, then call this persistence route.
    const { data: talentProfile, error } = await supabase
      .from("talent_profiles")
      .upsert(
        {
          user_id: user.id,
          session_id: sessionId,
          dimension_scores: dimensionScores,
          summary_text: summaryText
        },
        { onConflict: "session_id" }
      )
      .select("id,user_id,session_id,dimension_scores,summary_text,updated_at")
      .single();

    if (error) {
      throw error;
    }

    await supabase.from("user_events").insert({
      user_id: user.id,
      session_id: sessionId,
      type: "talent_profile_generated",
      payload: {
        talent_profile_id: talentProfile.id
      }
    });

    return NextResponse.json({ talentProfile });
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET(request: Request) {
  try {
    const { supabase } = await requireUser();
    const { searchParams } = new URL(request.url);
    const sessionId = assertString(searchParams.get("session_id"), "session_id");

    const { data: talentProfile, error } = await supabase
      .from("talent_profiles")
      .select("id,session_id,dimension_scores,summary_text,created_at,updated_at")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return NextResponse.json({ talentProfile });
  } catch (error) {
    return jsonError(error);
  }
}
