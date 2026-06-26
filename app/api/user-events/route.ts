import { NextResponse } from "next/server";
import {
  assertObject,
  assertString,
  jsonError,
  requireUser
} from "@/lib/api";
import { getMockDb, saveMockDb, generateId } from "@/lib/mockDb";

export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    const body = (await request.json()) as Record<string, unknown>;
    const type = assertString(body.type, "type");
    const sessionId =
      typeof body.session_id === "string" && body.session_id.length > 0
        ? body.session_id
        : null;
    const payload =
      body.payload === undefined ? {} : assertObject(body.payload, "payload");

    const db = await getMockDb();
    
    const event = {
      id: generateId(),
      user_id: user.id,
      session_id: sessionId,
      type,
      payload,
      created_at: new Date().toISOString()
    };
    
    db.user_events.push(event);
    await saveMockDb(db);

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET(request: Request) {
  try {
    const { user } = await requireUser();
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");
    const limit = Number(searchParams.get("limit") ?? 50);

    const db = await getMockDb();
    let events = db.user_events.filter(e => e.user_id === user.id);
    
    if (sessionId) {
      events = events.filter(e => e.session_id === sessionId);
    }
    
    events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    const maxLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50;
    events = events.slice(0, maxLimit);

    return NextResponse.json({ events });
  } catch (error) {
    return jsonError(error);
  }
}
