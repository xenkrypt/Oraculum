"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import { StaggerGroup, FadeUp, GlassCard, Skeleton } from "@/components/ui/Animate";
import { TRAITS } from "@/lib/scenarios";

// Three.js brain loads client-only (no SSR)
const ShadowTwinBrain = dynamic(() => import("@/components/ShadowTwinBrain"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-obsidian flex items-center justify-center">
      <div className="text-amber/40 text-xs font-mono uppercase tracking-[0.2em] animate-pulse">Initialising cognitive map...</div>
    </div>
  )
});

// ─── Radar / Trait Bar Chart ──────────────────────────────────────────────────
function TraitBar({
  label,
  score,
  confidence,
  color,
  trend
}: {
  label: string;
  score: number;
  confidence: number;
  color: string;
  trend: "rising" | "stable" | "declining";
}) {
  const trendIcon = trend === "rising" ? "↑" : trend === "declining" ? "↓" : "—";
  const trendColor = trend === "rising" ? "text-jade" : trend === "declining" ? "text-crimson" : "text-parchment-dim";
  const isHigh = score > 60;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase text-parchment-dim tracking-widest">{label}</span>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-mono ${trendColor}`}>{trendIcon}</span>
          <span className={`text-xs font-mono tabular-nums ${isHigh ? 'text-amber glow-amber' : 'text-parchment'}`}>
            {score.toString().padStart(2, '0')}
          </span>
        </div>
      </div>
      <div className="h-1 border border-parchment-faint bg-obsidian overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.1 }}
          className={`h-full ${isHigh ? 'bg-amber' : 'bg-parchment-faint'}`}
        />
      </div>
      {/* Confidence indicator */}
      <div className="flex justify-between items-center pt-0.5">
        <div className="text-[8px] font-mono text-parchment-faint uppercase">RES</div>
        <div className="h-px w-24 bg-obsidian flex justify-end overflow-hidden border-b border-parchment-faint">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${confidence * 100}%` }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
            className="h-full bg-jade/50"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Twin Version Badge ───────────────────────────────────────────────────────
function TwinVersionBadge({ version }: { version: number }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 border border-amber/30 bg-amber/5">
      <div className="w-1.5 h-1.5 bg-amber animate-pulse" />
      <span className="text-[10px] font-mono text-amber tracking-[0.2em] uppercase">Matrix v{version} · Evolving</span>
    </div>
  );
}

// ─── Evolution Timeline ───────────────────────────────────────────────────────
function EvolutionTimeline({ snapshots }: { snapshots: any[] }) {
  if (!snapshots?.length) {
    return (
      <div className="text-center py-8 text-parchment-faint text-[10px] font-mono uppercase tracking-widest border border-dashed border-parchment-faint">
        No evolution data available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {snapshots.slice().reverse().slice(0, 4).map((snap: any, i: number) => (
        <motion.div
          key={snap.timestamp}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08 }}
          className="flex items-start gap-4 group"
        >
          <div className="flex flex-col items-center">
            <div className={`w-1.5 h-1.5 shrink-0 ${i === 0 ? 'bg-amber glow-amber' : 'bg-parchment-faint'}`} />
            {i < 3 && <div className="w-px h-8 bg-parchment-faint mt-2" />}
          </div>
          <div>
            <p className="text-[10px] font-mono text-parchment-dim uppercase tracking-widest">
              {new Date(snap.timestamp).toLocaleDateString("en", { month: "short", day: "numeric" })}
              <span className="text-parchment-faint px-1">/</span>
              V{snap.version}
            </p>
            <p className="text-sm font-sans text-parchment mt-1 leading-relaxed group-hover:text-amber transition-colors line-clamp-2">{snap.summary}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Daily Challenge Card ─────────────────────────────────────────────────────
function DailyChallenge() {
  return (
    <div className="border border-jade/30 bg-jade/5 p-5 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-6 h-6 border-l border-b border-jade/30 flex items-center justify-center">
        <div className="w-1 h-1 bg-jade animate-pulse" />
      </div>
      <div className="text-[10px] font-mono text-jade tracking-[0.2em] uppercase mb-4 pb-2 border-b border-jade/20 inline-block">
        Daily Protocol
      </div>
      <p className="text-sm font-serif text-parchment leading-relaxed mb-6">
        You have 2 minutes and a whiteboard. Walk your team through your biggest current priority.
      </p>
      <Link
        href="/challenges"
        className="text-[10px] font-mono text-jade tracking-widest uppercase hover:text-white transition-colors flex items-center gap-2"
      >
        [ Initiate Sequence ]
      </Link>
    </div>
  );
}

// ─── Hidden Talents Card ──────────────────────────────────────────────────────
function HiddenTalents({ talents }: { talents: string[] }) {
  if (!talents?.length) return null;
  return (
    <div className="space-y-2">
      {talents.map((t, i) => (
        <motion.div
          key={t}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.07 }}
          className="flex items-center gap-3 p-3 border border-parchment-faint bg-obsidian group hover:border-amber/30 transition-colors"
        >
          <div className="text-[10px] font-mono text-parchment-dim group-hover:text-amber">
            [{i + 1}]
          </div>
          <span className="text-xs font-mono uppercase tracking-wide text-parchment">{t}</span>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [twin, setTwin] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const sid = localStorage.getItem("oraculum.activeSessionId");
    setSessionId(sid);

    if (sid) {
      Promise.all([
        fetch(`/api/talent-profile?session_id=${sid}`).then(r => r.json()).catch(() => ({})),
        fetch(`/api/twin?user_id=demo-user-001`).then(r => r.json()).catch(() => ({}))
      ]).then(([profileData, twinData]) => {
        const profile = profileData?.talentProfile;
        const shadowTwin = twinData?.twin;

        if (shadowTwin) {
          setTwin(shadowTwin);
        } else if (profile) {
          // Build a display twin from profile data
          setTwin({
            version: 1,
            personality_summary: profile.summary_text,
            hidden_talents: profile.hidden_talents || [],
            traits: Object.fromEntries(
              Object.entries(profile.dimension_scores || {}).map(([k, v]) => [
                k,
                { score: v, confidence: (profile.confidence || 50) / 100, trend: "stable" }
              ])
            ),
            evolution_snapshots: [],
            dominant_style: "Analytical Executor",
            growth_edge: "Expand creative risk tolerance"
          });
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  return (
    <div className="min-h-[calc(100vh-80px)] bg-grid py-4">
      <StaggerGroup className="space-y-8 max-w-7xl mx-auto">

        {/* ── Header ── */}
        <FadeUp>
          <div className="flex items-end justify-between border-b border-parchment-faint pb-4">
            <div>
              <h1 className="text-4xl font-serif text-parchment tracking-wide">
                {twin ? (
                  <span className="text-gradient-amber">Shadow Twin Interface</span>
                ) : "Cognitive Dashboard"}
              </h1>
              <p className="text-parchment-dim text-[10px] font-mono tracking-widest uppercase mt-2">
                {twin
                  ? "Living topology — evolving with every interaction"
                  : "Awaiting primary assessment sequence"}
              </p>
            </div>
            {twin && <TwinVersionBadge version={twin.version} />}
          </div>
        </FadeUp>

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">

          {/* Left: 3D Brain */}
          <FadeUp>
            <div className="border border-parchment-faint bg-obsidian overflow-hidden relative" style={{ height: 500 }}>
              <div className="absolute top-4 left-4 z-10 text-[10px] font-mono text-amber tracking-[0.3em] uppercase bg-obsidian/80 px-2 py-1">
                Visual Cortex Render
              </div>
              {loading ? (
                <div className="w-full h-full border border-dashed border-parchment-faint flex items-center justify-center">
                  <span className="text-xs font-mono text-parchment-dim uppercase tracking-widest animate-pulse">Establishing Link...</span>
                </div>
              ) : (
                <ShadowTwinBrain
                  traits={twin?.traits}
                  className="w-full h-full"
                />
              )}
            </div>
          </FadeUp>

          {/* Right: Trait bars + metadata */}
          <div className="space-y-6">
            <FadeUp>
              <div className="border border-parchment-faint bg-panel/30 p-6">
                <div className="flex items-center justify-between mb-6 border-b border-parchment-faint pb-2">
                  <h2 className="text-[10px] font-mono text-parchment-dim uppercase tracking-[0.3em]">
                    Topology Matrix
                  </h2>
                </div>

                {loading ? (
                  <div className="space-y-4 opacity-50">
                     {[1,2,3,4,5].map(i => <div key={i} className="h-6 border border-parchment-faint" />)}
                  </div>
                ) : twin?.traits ? (
                  <div className="space-y-4">
                    {TRAITS.map(t => {
                      const state = twin.traits[t.id];
                      if (!state) return null;
                      return (
                        <TraitBar
                          key={t.id}
                          label={t.label}
                          score={state.score ?? 50}
                          confidence={state.confidence ?? 0}
                          color={t.color}
                          trend={state.trend ?? "stable"}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 space-y-4 border border-dashed border-parchment-faint">
                    <p className="text-parchment-dim text-[10px] font-mono uppercase tracking-widest">No matrix established</p>
                    <Link
                      href="/challenges"
                      className="btn-ghost px-4 py-2 text-[10px] font-mono uppercase tracking-[0.2em] inline-block"
                    >
                      [ INITIATE_ASSESSMENT ]
                    </Link>
                  </div>
                )}
              </div>
            </FadeUp>

            {twin && (
              <FadeUp>
                <div className="border border-parchment-faint bg-panel/30 p-6">
                  <h2 className="text-[10px] font-mono text-parchment-dim uppercase tracking-[0.3em] mb-4 border-b border-parchment-faint pb-2">
                    Primary Profile
                  </h2>
                  <p className="text-2xl font-serif text-amber tracking-wide mb-2">
                    {twin.dominant_style}
                  </p>
                  <p className="text-[10px] font-mono text-parchment-dim uppercase tracking-widest mt-1">
                    Growth vector: <span className="text-parchment">{twin.growth_edge}</span>
                  </p>
                </div>
              </FadeUp>
            )}
          </div>
        </div>

        {/* ── Bottom row ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Hidden Talents */}
          <FadeUp>
            <div className="border border-parchment-faint bg-panel/30 p-6 h-full space-y-4">
              <h2 className="text-[10px] font-mono text-parchment-dim uppercase tracking-[0.3em] border-b border-parchment-faint pb-2">
                Latent Nodes
              </h2>
              {loading ? (
                <div className="h-24 border border-dashed border-parchment-faint" />
              ) : (
                <HiddenTalents talents={twin?.hidden_talents ?? []} />
              )}
              {!twin && (
                <p className="text-[10px] font-mono text-parchment-dim uppercase text-center pt-4">Requires active matrix</p>
              )}
            </div>
          </FadeUp>

          {/* Evolution Timeline */}
          <FadeUp>
            <div className="border border-parchment-faint bg-panel/30 p-6 h-full space-y-4">
              <h2 className="text-[10px] font-mono text-parchment-dim uppercase tracking-[0.3em] border-b border-parchment-faint pb-2">
                System Log
              </h2>
              {loading ? (
                <div className="h-32 border border-dashed border-parchment-faint" />
              ) : (
                <EvolutionTimeline snapshots={twin?.evolution_snapshots ?? []} />
              )}
            </div>
          </FadeUp>

          {/* Daily Challenge */}
          <FadeUp>
            <DailyChallenge />
          </FadeUp>
        </div>

        {/* ── Summary quote ── */}
        {twin?.personality_summary && (
          <FadeUp>
            <div className="border-l-2 border-amber/40 bg-obsidian p-8 border-y border-r border-parchment-faint">
              <p className="text-[10px] font-mono text-amber/60 uppercase tracking-[0.3em] mb-4">
                Oracle Diagnostics
              </p>
              <p className="text-xl font-serif text-parchment leading-relaxed italic max-w-4xl">
                &ldquo;{twin.personality_summary}&rdquo;
              </p>
            </div>
          </FadeUp>
        )}

        {/* ── Quick actions ── */}
        <FadeUp>
          <div className="flex flex-wrap gap-4 pt-6 border-t border-parchment-faint">
            <Link href="/challenges" className="btn-ghost px-6 py-2 text-[10px] font-mono uppercase tracking-[0.2em]">
              [ New_Assessment ]
            </Link>
            <Link href="/results" className="btn-ghost px-6 py-2 text-[10px] font-mono uppercase tracking-[0.2em]">
              [ View_Matrix ]
            </Link>
            <Link href="/twin" className="btn-amber px-6 py-2 text-[10px] font-mono uppercase tracking-[0.2em]">
              Interface_With_Twin
            </Link>
          </div>
        </FadeUp>

      </StaggerGroup>
    </div>
  );
}
