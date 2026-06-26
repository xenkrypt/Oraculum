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
      window.location.reload(); // Force reload to start challenge wizard!
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={createSession}
        disabled={isCreating}
        className="rounded-[255px_15px_225px_15px/15px_225px_15px_255px] border-[3px] border-ink bg-white px-6 py-3 text-xl font-heading shadow-hard transition hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-signal hover:text-white hover:shadow-hard-lg active:translate-x-1 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isCreating ? "Creating..." : "Start Assessment"}
      </button>
      {sessionId ? (
        <p className="break-all text-lg font-body text-moss">Active session: {sessionId}</p>
      ) : null}
      {error ? <p className="text-lg font-heading text-signal">{error}</p> : null}
    </div>
  );
}
