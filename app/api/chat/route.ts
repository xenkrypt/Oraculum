import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { chatWithTwin } from "@/lib/gemini";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { session_id, message, history = [] } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    // Fetch twin + profile for full in-character context
    let profile = null;
    let twin = null;
    if (session_id) {
      const store = await getStore();
      profile = store.talent_profiles.find(t => t.session_id === session_id) ?? null;
      twin = store.shadow_twins.find(t => t.user_id === "demo-user-001") ?? null;
    }

    const response = await chatWithTwin(message, history, profile, twin);
    return NextResponse.json({ response });
  } catch (error) {
    console.error("[/api/chat]", error);
    return NextResponse.json(
      { error: "The Oracle is temporarily unavailable. Please try again." },
      { status: 500 }
    );
  }
}
