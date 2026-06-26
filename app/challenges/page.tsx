"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { selectNextScenario, TRAITS, type Scenario } from "@/lib/scenarios";
import { PressButton } from "@/components/ui/Animate";

const MAX_QUESTIONS = 10;
const CONFIDENCE_THRESHOLD = 0.78;

type Phase = "loading" | "challenge" | "extracting" | "processing" | "done" | "error";

export default function ChallengesPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [usedIds, setUsedIds] = useState<string[]>([]);
  const [traitConfidence, setTraitConfidence] = useState<Record<string, number>>(
    Object.fromEntries(TRAITS.map(t => [t.id, 0]))
  );
  const [runningTraitScores, setRunningTraitScores] = useState<Record<string, number>>(
    Object.fromEntries(TRAITS.map(t => [t.id, 50]))
  );
  const [questionCount, setQuestionCount] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [rankedMoves, setRankedMoves] = useState<string[]>([]);
  const [extractingMsg, setExtractingMsg] = useState("EXTRACTING_SIGNALS...");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const initialized = useRef(false);

  // ─── Init: ensure session + load first scenario ───────────────────────────
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    async function init() {
      try {
        let sid = localStorage.getItem("oraculum.activeSessionId");
        if (!sid) {
          const res = await fetch("/api/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ metadata: { source: "challenges_adaptive" } })
          });
          const data = await res.json();
          sid = data.session?.id || `local-${Date.now()}`;
          localStorage.setItem("oraculum.activeSessionId", sid!);
        }
        setSessionId(sid);

        // Load first scenario
        const first = selectNextScenario([], traitConfidence);
        if (!first) throw new Error("No scenarios available");
        setCurrentScenario(first);
        setPhase("challenge");
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to load challenges");
        setPhase("error");
      }
    }
    init();
  }, []);

  // ─── Submit response → extract features → advance ─────────────────────────
  async function handleNext() {
    if (!sessionId || !currentScenario) return;
    setPhase("extracting");

    const rawResponse =
      currentScenario.type === "decision_tree"
        ? { selected: selectedOption, challenge_title: currentScenario.title }
        : { ranked: rankedMoves, challenge_title: currentScenario.title };

    // Save response
    await fetch("/api/challenge-responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        challenge_id: currentScenario.id,
        raw_response: rawResponse,
        domain: currentScenario.domain
      })
    }).catch(() => {});

    // Extract behavior features
    const extractedFeatures = await extractFeatures(currentScenario, rawResponse);
    const newUsed = [...usedIds, currentScenario.id];
    setUsedIds(newUsed);

    // Update running trait scores and confidence
    const newScores = { ...runningTraitScores };
    const newConfidence = { ...traitConfidence };
    if (extractedFeatures?.trait_signals) {
      for (const [trait, signal] of Object.entries(extractedFeatures.trait_signals)) {
        if (!(trait in newScores)) continue;
        const alpha = 0.65;
        newScores[trait] = Math.round(alpha * newScores[trait] + (1 - alpha) * ((signal as number) * 100));
        newConfidence[trait] = Math.min(0.99, newConfidence[trait] + (extractedFeatures.confidence_delta || 0.12));
      }
    }
    setRunningTraitScores(newScores);
    setTraitConfidence(newConfidence);

    const newCount = questionCount + 1;
    setQuestionCount(newCount);

    // Check if done: enough questions + avg confidence
    const avgConfidence = Object.values(newConfidence).reduce((s, c) => s + c, 0) / TRAITS.length;
    if (newCount >= MAX_QUESTIONS || avgConfidence >= CONFIDENCE_THRESHOLD) {
      setPhase("processing");
      await finalizeAssessment(sessionId, newScores);
      return;
    }

    // Select next question
    const next = selectNextScenario(newUsed, newConfidence);
    if (!next) {
      setPhase("processing");
      await finalizeAssessment(sessionId, newScores);
      return;
    }

    setSelectedOption(null);
    setRankedMoves([]);
    setCurrentScenario(next);
    setPhase("challenge");
  }

  // ─── Extract behavior features from a single answer ───────────────────────
  async function extractFeatures(scenario: Scenario, rawResponse: any) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch("/api/agent/behavior-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_id: scenario.id,
          question: scenario.config.prompt,
          answer: typeof rawResponse === "object" ? JSON.stringify(rawResponse) : String(rawResponse)
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) return await res.json();
    } catch {}

    if (scenario.type === "decision_tree" && scenario.config.options) {
      const chosen = scenario.config.options.find(o => o.id === rawResponse.selected);
      if (chosen?.trait_signals) {
        return { trait_signals: chosen.trait_signals, confidence_delta: 0.12, key_insight: chosen.label };
      }
    }

    const signals: Record<string, number> = {};
    scenario.differentiates.forEach(t => { signals[t] = 0.6 + Math.random() * 0.25; });
    return { trait_signals: signals, confidence_delta: 0.1 };
  }

  // ─── Finalize: run Gemini analysis ────────────────────────────────────────
  async function finalizeAssessment(sid: string, finalScores: Record<string, number>) {
    const msgs = [
      "SYNTHESIZING_COGNITIVE_FINGERPRINT",
      "CONSULTING_ORACLE_MATRIX",
      "MAPPING_TOPOLOGY",
      "IDENTIFYING_HIDDEN_VECTORS"
    ];
    let mi = 0;
    const interval = setInterval(() => {
      setExtractingMsg(msgs[mi % msgs.length]);
      mi++;
    }, 1400);

    try {
      const res = await fetch("/api/talent-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sid,
          preliminary_scores: finalScores
        })
      });
      if (!res.ok) throw new Error("Analysis failed");
    } catch (err) {
      console.error("Finalize error:", err);
    } finally {
      clearInterval(interval);
      setPhase("done");
      setTimeout(() => router.push("/results"), 1800);
    }
  }

  function handleRankMove(move: string) {
    if (rankedMoves.includes(move)) {
      setRankedMoves(p => p.filter(m => m !== move));
    } else {
      setRankedMoves(p => [...p, move]);
    }
  }

  const isNextDisabled =
    phase !== "challenge" ||
    (currentScenario?.type === "decision_tree" && !selectedOption) ||
    (currentScenario?.type === "ranked_choice" &&
      rankedMoves.length !== (currentScenario?.config.moves?.length ?? 0));

  const avgConfidence = Object.values(traitConfidence).reduce((s, c) => s + c, 0) / TRAITS.length;

  // ── Render: Loading ──
  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] bg-grid">
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-sm font-mono text-amber tracking-widest uppercase flex flex-col items-center gap-4"
        >
          <div className="w-8 h-8 border border-amber/30 rotate-45 flex items-center justify-center">
            <div className="w-2 h-2 bg-amber animate-pulse" />
          </div>
          INITIALIZING_ASSESSMENT_ENGINE...
        </motion.div>
      </div>
    );
  }

  // ── Render: Error ──
  if (phase === "error") {
    return (
      <div className="flex flex-col items-center justify-center gap-6 text-center min-h-[70vh] bg-grid">
        <div className="w-12 h-12 border border-crimson/50 text-crimson flex items-center justify-center rotate-45 mb-4">
          <span className="-rotate-45 font-mono text-xl">!</span>
        </div>
        <h1 className="text-2xl font-serif text-crimson uppercase tracking-widest">System Failure</h1>
        <p className="text-parchment-dim font-mono text-sm max-w-md">{errorMsg}</p>
        <button
          onClick={() => { initialized.current = false; setPhase("loading"); }}
          className="btn-ghost px-6 py-2 uppercase tracking-widest text-xs mt-4"
        >
          [ REBOOT_SEQUENCE ]
        </button>
      </div>
    );
  }

  // ── Render: Processing / Done ──
  if (phase === "processing" || phase === "done") {
    return (
      <div className="flex flex-col items-center justify-center gap-8 text-center min-h-[70vh] bg-grid">
        <motion.div
          className="relative w-32 h-32"
          animate={{ rotate: 360 }}
          transition={{ duration: 10, repeat: phase === "done" ? 0 : Infinity, ease: "linear" }}
        >
          <div className="absolute inset-0 border border-amber/20 rounded-full" />
          <div className="absolute inset-2 border border-dashed border-amber/40 rounded-full" style={{ animation: "spin 20s linear infinite reverse" }} />
          <div className="absolute inset-8 border border-amber/10 rounded-full bg-amber/5 backdrop-blur-md flex items-center justify-center">
             <div className="w-3 h-3 bg-amber pulse-amber rounded-full glow-amber" />
          </div>
        </motion.div>
        
        <div className="space-y-4 max-w-md">
          <h1 className="text-sm font-mono text-amber tracking-[0.3em] uppercase">
            {phase === "done" ? "PROFILE_GENERATED ✓" : extractingMsg}
          </h1>
          <p className="text-parchment-dim font-sans text-sm">
            {phase === "done" ? "Transferring to Oracle display..." : `Integrating ${questionCount} cognitive vectors into Shadow Twin matrix.`}
          </p>
        </div>
      </div>
    );
  }

  // ── Render: Extracting ──
  if (phase === "extracting") {
    return (
      <div className="flex flex-col items-center justify-center gap-8 text-center min-h-[70vh] bg-grid">
        <div className="flex gap-1 h-12 items-end border-b border-amber/20 pb-2 px-8">
          {[0,1,2,3,4,5,6,7].map((i) => (
            <motion.div
              key={i}
              className="w-2 bg-amber/60"
              animate={{ height: [4, 32 + Math.random() * 20, 4] }}
              transition={{ duration: 0.5 + Math.random() * 0.5, repeat: Infinity, delay: i * 0.1 }}
            />
          ))}
        </div>
        <p className="text-xs font-mono text-amber uppercase tracking-widest">{extractingMsg}</p>
      </div>
    );
  }

  // ── Render: Active Challenge ──
  if (!currentScenario) return null;

  return (
    <div className="min-h-[calc(100vh-80px)] py-8 bg-grid flex flex-col justify-center">
      <div className="mx-auto w-full max-w-3xl px-4 space-y-10">

        {/* Header / Progress */}
        <div className="space-y-4 stagger">
          <div className="flex justify-between items-end border-b border-parchment-faint pb-3">
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-amber tracking-[0.2em] uppercase">
                Vector {questionCount + 1}
              </span>
              <h2 className="font-serif text-2xl text-parchment tracking-wide">{currentScenario.title}</h2>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-mono text-jade tracking-widest uppercase">
                {Math.round(avgConfidence * 100)}% Res
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-sans text-parchment-dim">{currentScenario.domain.replace(/_/g, " ")}</span>
                <span className="w-1 h-1 bg-parchment-dim/50 rounded-full" />
                <span className="text-xs font-sans text-parchment-dim uppercase">{currentScenario.difficulty}</span>
              </div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="h-0.5 w-full bg-parchment-faint relative overflow-hidden">
            <motion.div
              className="absolute top-0 bottom-0 left-0 bg-amber glow-amber"
              initial={{ width: 0 }}
              animate={{ width: `${(avgConfidence / CONFIDENCE_THRESHOLD) * 100}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Scenario Prompt */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentScenario.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="glass p-8 border-l-2 border-l-amber/50 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 font-serif text-8xl leading-none select-none">"</div>
            <p className="text-xl font-serif leading-relaxed text-parchment relative z-10">
              {currentScenario.config.prompt}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Options */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentScenario.id}-options`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-4"
          >
            {/* Decision Tree */}
            {currentScenario.type === "decision_tree" && currentScenario.config.options?.map((opt, i) => (
              <motion.button
                key={opt.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => setSelectedOption(opt.id)}
                className={`w-full text-left p-6 font-sans text-lg border transition-all duration-300 relative overflow-hidden group ${
                  selectedOption === opt.id
                    ? "bg-amber/10 border-amber text-amber glow-amber"
                    : "glass border-parchment-faint text-parchment-dim hover:border-amber/40 hover:text-parchment hover:bg-amber/5"
                }`}
              >
                {selectedOption === opt.id && (
                   <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber" />
                )}
                <div className="relative z-10 flex gap-4">
                  <span className="font-mono text-xs opacity-50 pt-1">[{i + 1}]</span>
                  <span>{opt.label}</span>
                </div>
              </motion.button>
            ))}

            {/* Ranked Choice */}
            {currentScenario.type === "ranked_choice" && (
              <div className="space-y-4">
                <p className="font-mono text-xs text-amber/60 uppercase tracking-widest border-b border-parchment-faint pb-2 inline-block">
                  Rank Sequence Protocol
                </p>
                {currentScenario.config.moves?.map((move, i) => {
                  const rank = rankedMoves.indexOf(move) + 1;
                  return (
                    <motion.button
                      key={move}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      onClick={() => handleRankMove(move)}
                      className={`w-full flex items-center gap-6 text-left p-5 font-sans text-lg border transition-all duration-300 ${
                        rank > 0
                          ? "bg-jade/10 border-jade text-jade glow-jade"
                          : "glass border-parchment-faint text-parchment-dim hover:border-jade/40 hover:text-parchment hover:bg-jade/5"
                      }`}
                    >
                      <div className={`w-8 h-8 shrink-0 flex items-center justify-center font-mono text-sm border ${
                        rank > 0 ? "border-jade bg-jade/20 text-jade" : "border-parchment-faint text-parchment-dim/50"
                      }`}>
                        {rank > 0 ? rank : "-"}
                      </div>
                      <span>{move}</span>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Action Bar */}
        <div className="flex justify-between items-center pt-8 border-t border-parchment-faint">
          <div className="text-[10px] font-mono text-parchment-dim/50 uppercase">
             Session_{sessionId?.slice(0, 8) || "WAIT"}
          </div>
          <PressButton
            onClick={handleNext}
            disabled={isNextDisabled}
            className="btn-amber px-10 py-3 text-sm uppercase tracking-[0.2em] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:shadow-none"
          >
            {questionCount < MAX_QUESTIONS - 1 ? "Commit Vector" : "Compile Profile"}
          </PressButton>
        </div>
      </div>
    </div>
  );
}
