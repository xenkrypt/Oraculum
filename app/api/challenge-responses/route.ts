import { NextResponse } from "next/server";
import { assertObject, assertString, jsonError, requireUser } from "@/lib/api";
import { getStore, saveStore, generateId } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    const body = (await request.json()) as Record<string, unknown>;
    const sessionId = assertString(body.session_id, "session_id");
    const challengeId = assertString(body.challenge_id, "challenge_id");
    const rawResponse = assertObject(body.raw_response, "raw_response");
    const domain = (body.domain as string) || "general";

    const store = await getStore();
    const response = {
      id: generateId("resp"),
      user_id: user.id,
      session_id: sessionId,
      challenge_id: challengeId,
      raw_response: rawResponse,
      domain,
      created_at: new Date().toISOString()
    };
    store.challenge_responses.push(response);
    await saveStore(store);
    return NextResponse.json({ response }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET(request: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(request.url);
    const sessionId = assertString(searchParams.get("session_id"), "session_id");
    const store = await getStore();
    const responses = store.challenge_responses
      .filter(r => r.session_id === sessionId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return NextResponse.json({ responses });
  } catch (error) {
    return jsonError(error);
  }
}
