import { NextResponse } from "next/server";
import { assertString, jsonError, requireUser } from "@/lib/api";
import { getStore, saveStore, generateId, getOrCreateTwin, updateTwin, applyTraitSignals } from "@/lib/store";
import { generateProfileWithGemini } from "@/lib/gemini";

export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const sessionId = assertString(body.session_id, "session_id");

    const store = await getStore();

    // Collect challenge responses for this session
    const responses = store.challenge_responses.filter(r => r.session_id === sessionId);
    console.log(`[talent-profile] Analysing ${responses.length} responses for session ${sessionId}`);

    // Generate via Gemini (with fallback)
    const analysis = await generateProfileWithGemini(responses);

    // Upsert talent profile
    let talentProfile = store.talent_profiles.find(t => t.session_id === sessionId);
    if (talentProfile) {
      Object.assign(talentProfile, {
        dimension_scores: analysis.dimension_scores,
        summary_text: analysis.summary_text,
        hidden_talents: analysis.hidden_talents,
        confidence: analysis.confidence,
        updated_at: new Date().toISOString()
      });
    } else {
      talentProfile = {
        id: generateId("profile"),
        user_id: user.id,
        session_id: sessionId,
        dimension_scores: analysis.dimension_scores,
        summary_text: analysis.summary_text,
        hidden_talents: analysis.hidden_talents ?? [],
        confidence: analysis.confidence ?? 70,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      store.talent_profiles.push(talentProfile);
    }

    // Upsert future paths
    let futurePaths = store.future_paths.find(f => f.session_id === sessionId);
    const pathsData = analysis.paths ?? [];
    if (futurePaths) {
      Object.assign(futurePaths, { paths: pathsData, updated_at: new Date().toISOString() });
    } else {
      futurePaths = {
        id: generateId("paths"),
        user_id: user.id,
        session_id: sessionId,
        paths: pathsData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      store.future_paths.push(futurePaths);
    }

    // Mark session complete
    const session = store.sessions.find(s => s.id === sessionId);
    if (session) {
      (session as any).status = "completed";
      (session as any).completed_at = new Date().toISOString();
    }

    // Also update shadow twin with the new scores
    let twin = await getOrCreateTwin(user.id);
    const signals: Record<string, number> = {};
    for (const [k, v] of Object.entries(analysis.dimension_scores)) {
      signals[k] = (v as number) / 100;
    }
    twin = applyTraitSignals(twin, signals, analysis.summary_text, 0.2);
    twin.personality_summary = analysis.summary_text;
    twin.hidden_talents = analysis.hidden_talents ?? [];
    twin.dominant_style = analysis.dominant_style ?? "Analytical Executor";
    twin.growth_edge = analysis.growth_edge ?? "Expand creative risk tolerance";
    await updateTwin(twin);

    await saveStore(store);
    return NextResponse.json({ talentProfile });
  } catch (error) {
    console.error("[talent-profile POST]", error);
    return jsonError(error);
  }
}

export async function GET(request: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(request.url);
    const sessionId = assertString(searchParams.get("session_id"), "session_id");
    const store = await getStore();
    const talentProfile = store.talent_profiles.find(t => t.session_id === sessionId) ?? null;
    return NextResponse.json({ talentProfile });
  } catch (error) {
    return jsonError(error);
  }
}
