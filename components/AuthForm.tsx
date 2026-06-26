"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PressButton } from "@/components/ui/Animate";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    // Mock Authentication — set cookie
    const mockUser = {
      id: "mock-user-" + Math.random().toString(36).substr(2, 9),
      email,
      display_name: email.split("@")[0]
    };

    document.cookie = `oraculum.mock_user=${encodeURIComponent(
      JSON.stringify(mockUser)
    )}; path=/; max-age=86400`;

    // Create a session immediately so the challenges page has a valid session ID
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata: { source: "auth_page", email } })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.session?.id) {
          localStorage.setItem("oraculum.activeSessionId", data.session.id);
        }
      }
    } catch {
      // Non-blocking — challenges page will auto-create if missing
    }

    setIsSubmitting(false);
    router.push("/challenges");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="email" className="text-[10px] font-mono text-amber tracking-[0.2em] uppercase">
          Email Identity
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full bg-obsidian border border-parchment-faint px-4 py-3 font-mono text-sm text-parchment placeholder-parchment-dim/50 outline-none transition focus:border-amber/50 focus:bg-amber/5"
          placeholder="sysop@oraculum.network"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="text-[10px] font-mono text-amber tracking-[0.2em] uppercase">
          Access Token
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={6}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full bg-obsidian border border-parchment-faint px-4 py-3 font-mono text-sm text-parchment placeholder-parchment-dim/50 outline-none transition focus:border-amber/50 focus:bg-amber/5"
          placeholder="••••••••"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-parchment-faint">
        <PressButton
          type="submit"
          disabled={isSubmitting}
          className="btn-amber px-8 py-3 text-sm uppercase tracking-[0.2em] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSubmitting
            ? "[ AUTHENTICATING ]"
            : mode === "signin"
              ? "Establish Link"
              : "Generate Access"}
        </PressButton>
        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="btn-ghost px-6 py-3 text-[10px] font-mono uppercase tracking-[0.2em]"
        >
          {mode === "signin" ? "Request Access ->" : "<- Return to Auth"}
        </button>
      </div>
    </form>
  );
}
