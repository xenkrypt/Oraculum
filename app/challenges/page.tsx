import { StartSessionButton } from "@/components/StartSessionButton";

export default function ChallengesPage() {
  return (
    <section className="space-y-8">
      <div className="max-w-3xl space-y-3">
        <h1 className="text-4xl font-semibold tracking-normal">
          Micro-challenges
        </h1>
        <p className="text-lg leading-8 text-ink/70">
          This page will host the decision-based challenge flow. For now, it can
          create an authenticated session record and gives the API somewhere to
          attach future challenge responses.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
          <h2 className="text-xl font-semibold">Session setup</h2>
          <p className="mt-2 text-sm leading-6 text-ink/65">
            Sign in first, then create a session. The returned session id is
            stored locally so later pages can use it during prototyping.
          </p>
          <div className="mt-5">
            <StartSessionButton />
          </div>
        </div>

        <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
          <h2 className="text-xl font-semibold">Challenge runner placeholder</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-ink/65">
            <p>
              Future UI will fetch active challenge definitions from Supabase,
              render challenge-specific controls from the JSON config, and send
              raw responses to <code>/api/challenge-responses</code>.
            </p>
            <p>
              Scoring and profile synthesis will be introduced in a separate AI
              integration layer.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
