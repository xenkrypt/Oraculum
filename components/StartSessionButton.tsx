"use client";

import { useState } from "react";

type SessionResponse = {
  session: {
    id: string;
    status: string;
    started_at: string;
  };
};

export function StartSessionButton() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  async function createSession() {
    setIsCreating(true);
    setError(null);

    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        metadata: {
          source: "challenge_placeholder"
        }
      })
    });

    const payload = (await response.json()) as
      | SessionResponse
      | { error: string };

    setIsCreating(false);

    if (!response.ok) {
      setError("error" in payload ? payload.error : "Unable to create session");
      return;
    }

    if ("session" in payload) {
      localStorage.setItem("oraculum.activeSessionId", payload.session.id);
      setSessionId(payload.session.id);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={createSession}
        disabled={isCreating}
        className="rounded-md bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-moss disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isCreating ? "Creating..." : "Create session"}
      </button>
      {sessionId ? (
        <p className="break-all text-sm text-moss">Active session: {sessionId}</p>
      ) : null}
      {error ? <p className="text-sm text-signal">{error}</p> : null}
    </div>
  );
}
