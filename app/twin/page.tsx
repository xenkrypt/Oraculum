export default function TwinPage() {
  return (
    <section className="mx-auto max-w-4xl space-y-8">
      <div className="max-w-3xl space-y-3">
        <h1 className="text-4xl font-semibold tracking-normal">Shadow Twin</h1>
        <p className="text-lg leading-8 text-ink/70">
          This chat surface will later retrieve user events, challenge
          responses, profile summaries, and future paths before calling an LLM.
        </p>
      </div>

      <div className="rounded-lg border border-ink/10 bg-white shadow-soft">
        <div className="border-b border-ink/10 p-4 text-sm font-medium">
          Conversation placeholder
        </div>
        <div className="space-y-4 p-5">
          <div className="max-w-[80%] rounded-md bg-paper p-4 text-sm leading-6 text-ink/70">
            When the AI layer arrives, this message will be grounded in the
            authenticated user&apos;s event log and prior challenge artifacts.
          </div>
          <form className="flex gap-3">
            <input
              disabled
              className="min-w-0 flex-1 rounded-md border border-ink/15 bg-paper px-4 py-3 text-sm text-ink/50"
              placeholder="Chat is not connected yet"
            />
            <button
              disabled
              className="rounded-md bg-ink/40 px-5 py-3 text-sm font-semibold text-white"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
