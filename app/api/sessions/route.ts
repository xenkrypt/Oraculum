import { NextResponse } from "next/server";
import { getStore, saveStore, generateId } from "@/lib/store";
import { requireUser, jsonError } from "@/lib/api";

export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    const body = (await request.json().catch(() => ({}))) as any;
    const store = await getStore();

    const session = {
      id: generateId(),
      user_id: user.id,
      status: "active" as const,
      scenario_history: [],
      trait_confidence: {},
      started_at: new Date().toISOString(),
      metadata: body.metadata ?? {}
    };
    store.sessions.push(session);
    await saveStore(store);
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET() {
  try {
    const { user } = await requireUser();
    const store = await getStore();
    const sessions = store.sessions
      .filter(s => s.user_id === user.id)
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
    return NextResponse.json({ sessions });
  } catch (error) {
    return jsonError(error);
  }
}
