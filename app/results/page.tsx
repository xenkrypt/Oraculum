export default function ResultsPage() {
  const dimensions = [
    "Systems Thinking",
    "Strategic Depth",
    "Risk Appetite",
    "Collaboration Style",
    "Creativity Under Constraints",
    "Adaptability"
  ];

  return (
    <section className="space-y-8">
      <div className="max-w-3xl space-y-3">
        <h1 className="text-4xl font-semibold tracking-normal">Results</h1>
        <p className="text-lg leading-8 text-ink/70">
          The Thinking Style Map and recommended Future Paths will appear here
          once scoring and generation services are connected.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
          <h2 className="text-xl font-semibold">Thinking Style Map</h2>
          <div className="mt-5 space-y-4">
            {dimensions.map((dimension, index) => (
              <div key={dimension}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span>{dimension}</span>
                  <span className="text-ink/50">pending</span>
                </div>
                <div className="h-2 rounded-full bg-mist">
                  <div
                    className="h-2 rounded-full bg-moss"
                    style={{ width: `${24 + index * 8}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
          <h2 className="text-xl font-semibold">Future Paths</h2>
          <div className="mt-5 space-y-3">
            {["Community Leader", "Creative Builder", "Strategic Operator"].map(
              (path) => (
                <article
                  key={path}
                  className="rounded-md border border-ink/10 bg-paper p-4"
                >
                  <h3 className="font-semibold">{path}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink/65">
                    90-day roadmap placeholder. This will be stored in
                    <code> future_paths.paths</code> as structured JSON.
                  </p>
                </article>
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
