"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  async function handleStart() {
    let sid = typeof window !== "undefined" ? localStorage.getItem("oraculum.activeSessionId") : null;
    if (!sid) {
      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ metadata: { source: "home_cta" } })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.session?.id) {
            localStorage.setItem("oraculum.activeSessionId", data.session.id);
          }
        }
      } catch {}
    }
    router.push("/challenges");
  }

  return (
    <div className="relative min-h-[calc(100vh-80px)] flex flex-col items-center justify-center bg-grid-fine overflow-hidden">
      
      {/* Background Ambience */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-1/4 w-[800px] h-[800px] rounded-full bg-amber/5 blur-[120px] animate-pulse" style={{ animationDuration: "8s" }} />
        <div className="absolute -bottom-1/4 -right-1/4 w-[600px] h-[600px] rounded-full bg-jade/5 blur-[100px] animate-pulse" style={{ animationDuration: "12s", animationDelay: "2s" }} />
      </div>

      <div className="relative z-10 text-center max-w-4xl px-4 space-y-12 stagger">
        
        {/* Terminal Badge */}
        <div className="inline-flex items-center gap-3 px-4 py-1 border border-amber/20 bg-amber/5 text-amber text-xs font-mono uppercase tracking-widest shadow-[0_0_15px_rgba(232,163,60,0.1)]">
          <div className="w-1.5 h-1.5 bg-amber pulse-amber" />
          SYSTEM_ONLINE
        </div>

        {/* Headline */}
        <div className="space-y-4">
          <h1 className="text-5xl sm:text-7xl font-serif font-light leading-[1.1] tracking-tight">
            Discover the <br/>
            <span className="text-gradient-amber italic pr-2">Architecture</span> of your Mind
          </h1>
          <p className="text-lg sm:text-xl font-sans text-parchment-dim max-w-2xl mx-auto leading-relaxed">
            10 adaptive micro-decisions. An intelligence that reads the silence between your choices.
            A living Shadow Twin that evolves with every interaction.
          </p>
        </div>

        {/* CTA */}
        <div className="flex flex-wrap items-center justify-center gap-6 pt-4">
          <button
            onClick={handleStart}
            className="btn-amber px-10 py-4 text-sm uppercase tracking-[0.2em] relative group overflow-hidden"
          >
            <span className="relative z-10">Initiate Sequence</span>
            <div className="absolute inset-0 bg-white/20 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300 ease-out" />
          </button>
          <Link
            href="/dashboard"
            className="btn-ghost px-8 py-4 text-sm uppercase tracking-[0.2em]"
          >
            Access Dashboard
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-12">
          {[
            "Adaptive Heuristics",
            "8-Dimensional Matrix",
            "Bayesian Memory",
            "Living Topography",
            "Future Simulation"
          ].map((feature) => (
            <span
              key={feature}
              className="px-4 py-2 text-xs font-mono text-parchment-dim border border-parchment-faint bg-panel/50 backdrop-blur-md hover:border-amber/30 hover:text-amber transition-colors cursor-default"
            >
              [{feature}]
            </span>
          ))}
        </div>

        {/* Architecture Hint */}
        <div className="pt-16">
          <div className="border border-parchment-faint bg-panel/30 backdrop-blur-md p-6 max-w-3xl mx-auto">
            <p className="text-[10px] font-mono text-parchment-dim uppercase tracking-[0.3em] mb-4 text-left border-b border-parchment-faint pb-2">
              Agent Pipeline Topology
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-amber-dim">
              {["Planner", "Extractor", "Shadow Twin", "Simulator", "Researcher"].map((step, i, arr) => (
                <div key={step} className="flex items-center gap-2">
                  <span className="bg-amber/10 border border-amber/20 px-3 py-1.5 glow-amber">{step}</span>
                  {i < arr.length - 1 && <span className="text-parchment-faint">→</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
