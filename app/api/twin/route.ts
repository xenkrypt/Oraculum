import { NextResponse } from "next/server";
import { getStore, saveStore, getOrCreateTwin, updateTwin, applyTraitSignals, generateId } from "@/lib/store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id") || "demo-user-001";
  try {
    const twin = await getOrCreateTwin(userId);
    return NextResponse.json({ twin });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id = "demo-user-001", signals, insight = "Manual update" } = body;
    let twin = await getOrCreateTwin(user_id);
    if (signals && Object.keys(signals).length > 0) {
      twin = applyTraitSignals(twin, signals, insight, 0.12);
    }
    await updateTwin(twin);
    return NextResponse.json({ twin });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { twin } = body;
    if (!twin) return NextResponse.json({ error: "twin required" }, { status: 400 });
    await updateTwin(twin);
    return NextResponse.json({ twin });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
