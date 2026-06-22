import Link from "next/link";

export default function HomePage() {
  return (
    <section className="grid gap-8 lg:grid-cols-[1fr_0.85fr] lg:items-center">
      <div className="space-y-7">
        <div className="inline-flex rounded-full border border-moss/30 bg-white px-3 py-1 text-sm text-moss">
          Early architecture scaffold
        </div>
        <div className="space-y-4">
          <h1 className="max-w-3xl text-5xl font-semibold leading-tight tracking-normal md:text-7xl">
            Find the shape of your talent through tiny decisions.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-ink/72">
            Oraculum will guide users through short life micro-challenges,
            assemble a Thinking Style Map, suggest practical future paths, and
            preserve the trail of insight for a future Shadow Twin agent.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/challenges"
            className="rounded-md bg-ink px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-moss"
          >
            Start Session
          </Link>
          <Link
            href="/auth"
            className="rounded-md border border-ink/15 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:border-moss/60"
          >
            Sign in
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
        <div className="aspect-[4/3] rounded-md bg-mist p-5">
          <div className="grid h-full grid-cols-6 grid-rows-6 gap-2">
            {Array.from({ length: 36 }).map((_, index) => (
              <div
                key={index}
                className="rounded-sm border border-white/70 bg-white/50"
                style={{
                  opacity: 0.42 + ((index % 7) * 0.08),
                  transform: `scale(${0.8 + ((index % 5) * 0.04)})`
                }}
              />
            ))}
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {["Thinking Style Map", "Future Paths", "Shadow Twin Memory"].map(
            (label) => (
              <div
                key={label}
                className="rounded-md border border-ink/10 bg-paper px-3 py-4 text-sm font-medium"
              >
                {label}
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
}
