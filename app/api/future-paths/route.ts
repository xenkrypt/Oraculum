import { NextResponse } from "next/server";
import { assertArray, assertString, jsonError, requireUser } from "@/lib/api";
import { getStore, saveStore, generateId } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    const body = (await request.json()) as Record<string, unknown>;
    const sessionId = assertString(body.session_id, "session_id");
    const paths = assertArray(body.paths, "paths");

    const db = await getStore();
    
    let futurePaths = db.future_paths.find(f => f.session_id === sessionId);
    if (futurePaths) {
      futurePaths.paths = paths;
      futurePaths.updated_at = new Date().toISOString();
    } else {
      futurePaths = {
        id: generateId(),
        user_id: user.id,
        session_id: sessionId,
        paths,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      db.future_paths.push(futurePaths);
    }

    db.user_events.push({
      id: generateId(),
      user_id: user.id,
      session_id: sessionId,
      type: "future_paths_generated",
      payload: {
        future_paths_id: futurePaths.id,
        path_count: paths.length
      },
      created_at: new Date().toISOString()
    });

    await saveStore(db);

    return NextResponse.json({ futurePaths });
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET(request: Request) {
  try {
    const { user } = await requireUser();
    const { searchParams } = new URL(request.url);
    const sessionId = assertString(searchParams.get("session_id"), "session_id");

    const db = await getStore();
    const futurePaths = db.future_paths.find(f => f.session_id === sessionId) || null;

    return NextResponse.json({ futurePaths });
  } catch (error) {
    return jsonError(error);
  }
}
