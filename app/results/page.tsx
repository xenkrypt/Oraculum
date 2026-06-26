"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { StaggerGroup, FadeUp, GlassCard } from "@/components/ui/Animate";
import { TRAITS } from "@/lib/scenarios";

function TraitBar({ label, score, color }: { label: string; score: number; color: string }) {
  // We'll map the neon colors from scenarios.ts to our terminal oracle aesthetic
  const isHigh = score > 60;
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs font-mono uppercase tracking-widest text-parchment-dim">{label}</span>
        <span className={`text-xs font-mono font-semibold tabular-nums ${isHigh ? 'text-amber glow-amber' : 'text-parchment-dim'}`}>
          {score.toString().padStart(2, '0')}
        </span>
      </div>
      <div className="h-1 border border-parchment-faint bg-obsidian overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.15 }}
          className={`h-full ${isHigh ? 'bg-amber' : 'bg-parchment-faint'}`}
        />
      </div>
    </div>
  );
}

function PathCard({ path, index }: { path: { title: string; description: string }; index: number }) {
  return (
    <div className="border border-parchment-faint bg-panel/30 p-6 relative overflow-hidden group hover:border-amber/40 transition-colors">
      <div className="absolute top-0 right-0 w-8 h-8 border-l border-b border-parchment-faint flex items-center justify-center font-mono text-[10px] text-parchment-dim bg-obsidian">
        {index + 1}
      </div>
      <h3 className="text-lg font-serif font-medium text-parchment mb-2 tracking-wide group-hover:text-amber transition-colors">{path.title}</h3>
      <p className="text-sm font-sans text-parchment-dim leading-relaxed">{path.description}</p>
    </div>
  );
}

export default function ResultsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [paths, setPaths] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sessionId = localStorage.getItem("oraculum.activeSessionId");
    if (!sessionId) {
      setLoading(false);
      return;
    }

    Promise.all([
      fetch(`/api/talent-profile?session_id=${sessionId}`).then(r => r.json()),
      fetch(`/api/future-paths?session_id=${sessionId}`).then(r => r.json())
    ])
      .then(([profileData, pathData]) => {
        setProfile(profileData?.talentProfile ?? null);
        setPaths(pathData?.futurePaths ?? null);
        setLoading(false);
      })
      .catch(err => {
        setError("Could not load your profile. Please try again.");
        setLoading(false);
      });
  }, []);

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 min-h-[70vh] bg-grid">
        <div className="w-12 h-12 border border-amber/30 rotate-45 flex items-center justify-center glow-amber">
          <div className="w-2 h-2 bg-amber animate-ping" />
        </div>
        <p className="text-xs font-mono text-amber tracking-[0.2em] uppercase">Retrieving Oracle Profile...</p>
      </div>
    );
  }

  // ── No session ──
  if (!localStorage.getItem?.("oraculum.activeSessionId") || (!profile && !loading)) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 min-h-[70vh] text-center bg-grid">
        <h1 className="text-2xl font-serif text-parchment uppercase tracking-widest">No Profile Matrix Found</h1>
        <p className="text-parchment-dim font-sans max-w-md">
          Complete the cognitive sequence to generate your Shadow Twin architecture.
        </p>
        <Link
          href="/challenges"
          className="btn-amber px-8 py-3 text-sm uppercase tracking-widest mt-4"
        >
          Initiate Sequence
        </Link>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 min-h-[70vh] text-center bg-grid">
        <div className="w-12 h-12 border border-crimson flex items-center justify-center mb-4">
          <span className="font-mono text-crimson text-xl">ERR</span>
        </div>
        <p className="text-crimson font-mono text-sm">{error}</p>
        <Link href="/challenges" className="btn-ghost px-6 py-2 uppercase tracking-widest text-xs mt-4">
          [ RETRY_SEQUENCE ]
        </Link>
      </div>
    );
  }

  const scores = profile?.dimension_scores ?? {};
  const futurePaths = (paths?.paths ?? profile?.paths ?? []).slice(0, 3);

  return (
    <div className="min-h-screen py-4 bg-grid">
      <StaggerGroup className="space-y-12 max-w-4xl mx-auto">

        {/* ── Header ── */}
        <FadeUp>
          <div className="text-center space-y-6 py-8 border-b border-parchment-faint">
            <div className="inline-flex items-center gap-3 px-4 py-1 border border-jade/30 bg-jade/5 text-jade text-[10px] font-mono uppercase tracking-[0.3em] glow-jade mb-4">
              <div className="w-1.5 h-1.5 bg-jade rounded-full" />
              Shadow Twin Profiling — V1
            </div>
            
            <h1 className="text-5xl font-serif font-light text-parchment tracking-wide">
              {profile?.dominant_style ?? "Cognitive Architecture"}
            </h1>
            
            <p className="text-lg font-sans text-parchment-dim max-w-2xl mx-auto leading-relaxed border-l-2 border-amber/50 pl-6 text-left italic">
              "{profile?.summary_text ?? "Your cognitive fingerprint has been mapped."}"
            </p>
            
            <div className="flex items-center justify-center gap-4 text-xs font-mono text-parchment-dim uppercase tracking-widest pt-4">
              <span>Matrix Integrity:</span>
              <span className="text-jade font-semibold">{profile?.confidence ?? 0}%</span>
              <span className="text-parchment-faint">|</span>
              <span>ID: {profile?.id?.slice(0, 8) || "UNKNOWN"}</span>
            </div>
          </div>
        </FadeUp>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          
          {/* ── Left Column: Traits ── */}
          <div className="md:col-span-5 space-y-8">
            <FadeUp>
              <div className="border border-parchment-faint bg-panel/50 p-6 relative">
                <div className="absolute -top-3 left-6 bg-obsidian px-2 text-[10px] font-mono text-amber tracking-[0.2em] uppercase">
                  Topology Map
                </div>
                <div className="space-y-5 mt-2">
                  {TRAITS.map(t => (
                    <TraitBar
                      key={t.id}
                      label={t.label}
                      score={scores[t.id] ?? 50}
                      color={t.color}
                    />
                  ))}
                </div>
              </div>
            </FadeUp>
            
            {/* ── Growth Edge ── */}
            {profile?.growth_edge && (
              <FadeUp>
                <div className="border border-amber/30 bg-amber/5 p-6 relative">
                  <div className="absolute -top-3 right-6 bg-obsidian px-2 text-[10px] font-mono text-amber tracking-[0.2em] uppercase">
                    Growth Edge
                  </div>
                  <p className="text-sm font-sans text-parchment pt-2 leading-relaxed">
                    {profile.growth_edge}
                  </p>
                </div>
              </FadeUp>
            )}
          </div>

          {/* ── Right Column: Futures & Talents ── */}
          <div className="md:col-span-7 space-y-8">
            {/* ── Hidden Talents ── */}
            {profile?.hidden_talents?.length > 0 && (
              <FadeUp>
                <div className="border border-parchment-faint bg-panel/30 p-6">
                  <h2 className="text-[10px] font-mono text-parchment-dim uppercase tracking-[0.3em] mb-4 border-b border-parchment-faint pb-2">
                    Latent Vectors
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {profile.hidden_talents.map((talent: string) => (
                      <span
                        key={talent}
                        className="px-3 py-1 border border-parchment-faint bg-obsidian text-xs font-mono text-parchment-dim uppercase"
                      >
                        {talent}
                      </span>
                    ))}
                  </div>
                </div>
              </FadeUp>
            )}

            {/* ── Future Paths ── */}
            {futurePaths.length > 0 && (
              <FadeUp>
                <div className="space-y-4">
                  <h2 className="text-[10px] font-mono text-parchment-dim uppercase tracking-[0.3em] pl-2">
                    Simulated Futures
                  </h2>
                  <div className="space-y-4">
                    {futurePaths.map((path: any, i: number) => (
                      <PathCard key={path.title} path={path} index={i} />
                    ))}
                  </div>
                </div>
              </FadeUp>
            )}
          </div>
        </div>

        {/* ── CTA ── */}
        <FadeUp>
          <div className="flex flex-wrap gap-4 justify-center pt-8 border-t border-parchment-faint">
            <Link
              href="/twin"
              className="btn-amber px-8 py-3 text-sm uppercase tracking-[0.2em]"
            >
              Interface with Twin
            </Link>
            <Link
              href="/dashboard"
              className="btn-ghost px-8 py-3 text-sm uppercase tracking-[0.2em]"
            >
              Dashboard
            </Link>
          </div>
        </FadeUp>

      </StaggerGroup>
    </div>
  );
}
