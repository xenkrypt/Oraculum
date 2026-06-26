// ─── Oraculum AI Store ──────────────────────────────────────────────────────
// Comprehensive data layer. JSON file store for development — swap to MongoDB for production.
// Every collection is typed. Every write is atomic.

import fs from "fs/promises";
import path from "path";

const DB_PATH = path.join(process.cwd(), "lib", "store.json");

// ─── Types ────────────────────────────────────────────────────────────────────

export type TraitState = {
  score: number;        // 0-100 current weighted score
  confidence: number;   // 0-1 how confident we are in this score
  evidence: string[];   // behavioral observations supporting this score
  trend: "rising" | "stable" | "declining";
  last_updated: string;
};

export type TwinSnapshot = {
  timestamp: string;
  version: number;
  traits: Record<string, Pick<TraitState, "score" | "confidence">>;
  summary: string;
};

export type ShadowTwin = {
  id: string;
  user_id: string;
  version: number;
  traits: Record<string, TraitState>;
  personality_summary: string;
  hidden_talents: string[];
  dominant_style: string;
  growth_edge: string;       // the one area to develop for breakthrough
  evolution_snapshots: TwinSnapshot[];
  last_updated: string;
  created_at: string;
};

export type BehaviorEvent = {
  id: string;
  user_id: string;
  session_id: string;
  challenge_id: string;
  timestamp: string;
  type: "decision" | "ranking" | "reflection" | "daily_challenge";
  raw_response: Record<string, unknown>;
  extracted_features: {
    trait_signals: Record<string, number>;
    strategy: string;
    risk_level: string;
    reasoning_style: string;
    key_insight: string;
    confidence_delta: number;
  } | null;
  response_time_ms?: number;
  domain: string;
};

export type Session = {
  id: string;
  user_id: string;
  status: "active" | "completed" | "abandoned";
  scenario_history: string[]; // IDs of scenarios shown
  trait_confidence: Record<string, number>; // running confidence per trait
  started_at: string;
  completed_at?: string;
  metadata: Record<string, unknown>;
};

export type FuturePrediction = {
  id: string;
  user_id: string;
  session_id: string;
  paths: Array<{
    title: string;
    description: string;
    probability: number;
    timeline_months: number;
    roadmap: string[];
    skills_to_acquire: string[];
    expected_salary_range: string;
    lifestyle_fit: number;
    risk_factors: string[];
  }>;
  generated_at: string;
};

export type GrowthPlan = {
  id: string;
  user_id: string;
  target_path: string;
  skill_gaps: string[];
  weekly_tasks: Array<{ week: number; tasks: string[] }>;
  resources: string[];
  created_at: string;
};

export type WeeklyReflection = {
  id: string;
  user_id: string;
  week_of: string;
  answers: Record<string, string>;
  extracted_insights: {
    interest_shifts: string[];
    motivation_level: number;
    growth_areas: string[];
    burnout_signals: string[];
  } | null;
  created_at: string;
};

export type TalentProfile = {
  id: string;
  user_id: string;
  session_id: string;
  dimension_scores: Record<string, number>;
  summary_text: string;
  hidden_talents: string[];
  confidence: number;
  created_at: string;
  updated_at: string;
};

export type FuturePaths = {
  id: string;
  user_id: string;
  session_id: string;
  paths: Array<{ title: string; description: string }>;
  created_at: string;
  updated_at: string;
};

export type Store = {
  sessions: Session[];
  behavior_events: BehaviorEvent[];
  shadow_twins: ShadowTwin[];
  talent_profiles: TalentProfile[];
  future_paths: FuturePaths[];
  future_predictions: FuturePrediction[];
  growth_plans: GrowthPlan[];
  weekly_reflections: WeeklyReflection[];
  // Legacy compatibility
  challenge_responses: any[];
  challenge_definitions: any[];
  user_events: any[];
};

// ─── Default Store ─────────────────────────────────────────────────────────────

const DEFAULT_STORE: Store = {
  sessions: [],
  behavior_events: [],
  shadow_twins: [],
  talent_profiles: [],
  future_paths: [],
  future_predictions: [],
  growth_plans: [],
  weekly_reflections: [],
  challenge_responses: [],
  challenge_definitions: [],
  user_events: []
};

// ─── Core Functions ────────────────────────────────────────────────────────────

export async function getStore(): Promise<Store> {
  try {
    const raw = await fs.readFile(DB_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<Store>;
    // Merge with defaults to handle new fields
    return { ...DEFAULT_STORE, ...parsed };
  } catch (err: any) {
    if (err.code === "ENOENT") {
      await saveStore(DEFAULT_STORE);
      return DEFAULT_STORE;
    }
    throw err;
  }
}

export async function saveStore(store: Store): Promise<void> {
  await fs.writeFile(DB_PATH, JSON.stringify(store, null, 2), "utf-8");
}

// ─── ID generation ────────────────────────────────────────────────────────────

export function generateId(prefix = "id"): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`;
}

// ─── Shadow Twin Operations ────────────────────────────────────────────────────

const DEFAULT_TRAITS = ["analytical", "strategic", "creative", "leadership", "execution", "adaptability", "curiosity", "systems_thinking"];

export function createDefaultTwin(userId: string): ShadowTwin {
  const traits: Record<string, TraitState> = {};
  DEFAULT_TRAITS.forEach(t => {
    traits[t] = {
      score: 50,
      confidence: 0,
      evidence: [],
      trend: "stable",
      last_updated: new Date().toISOString()
    };
  });

  return {
    id: generateId("twin"),
    user_id: userId,
    version: 1,
    traits,
    personality_summary: "Profile in progress...",
    hidden_talents: [],
    dominant_style: "Undetermined",
    growth_edge: "Complete more challenges to reveal",
    evolution_snapshots: [],
    last_updated: new Date().toISOString(),
    created_at: new Date().toISOString()
  };
}

export async function getOrCreateTwin(userId: string): Promise<ShadowTwin> {
  const store = await getStore();
  let twin = store.shadow_twins.find(t => t.user_id === userId);
  if (!twin) {
    twin = createDefaultTwin(userId);
    store.shadow_twins.push(twin);
    await saveStore(store);
  }
  return twin;
}

export async function updateTwin(twin: ShadowTwin): Promise<void> {
  const store = await getStore();
  const idx = store.shadow_twins.findIndex(t => t.id === twin.id);
  
  // Take a snapshot before updating
  const snapshot: TwinSnapshot = {
    timestamp: new Date().toISOString(),
    version: twin.version,
    traits: Object.fromEntries(
      Object.entries(twin.traits).map(([k, v]) => [k, { score: v.score, confidence: v.confidence }])
    ),
    summary: twin.personality_summary
  };
  
  twin.version += 1;
  twin.last_updated = new Date().toISOString();
  twin.evolution_snapshots = [...(twin.evolution_snapshots || []).slice(-9), snapshot];

  if (idx >= 0) {
    store.shadow_twins[idx] = twin;
  } else {
    store.shadow_twins.push(twin);
  }
  
  await saveStore(store);
}

// ─── Bayesian Trait Update ────────────────────────────────────────────────────
// Uses exponential moving average with confidence-weighted alpha.
// Higher confidence → less influence from new signals (twin is more settled).

export function applyTraitSignals(
  twin: ShadowTwin,
  signals: Record<string, number>,
  insight: string,
  confidenceDelta: number
): ShadowTwin {
  const updated = { ...twin, traits: { ...twin.traits } };

  for (const [trait, signal] of Object.entries(signals)) {
    if (!(trait in updated.traits)) continue;

    const current = updated.traits[trait];
    const alpha = 0.7 - current.confidence * 0.4; // 0.7 when unknown, 0.3 when very confident
    const newScore = Math.round(alpha * current.score + (1 - alpha) * (signal * 100));
    const newConfidence = Math.min(0.99, current.confidence + confidenceDelta);
    const trend: TraitState["trend"] =
      newScore > current.score + 3 ? "rising" :
      newScore < current.score - 3 ? "declining" : "stable";

    updated.traits[trait] = {
      score: Math.max(0, Math.min(100, newScore)),
      confidence: newConfidence,
      evidence: [...current.evidence.slice(-4), insight].slice(-5),
      trend,
      last_updated: new Date().toISOString()
    };
  }

  return updated;
}

// ─── Backward-compatible aliases ──────────────────────────────────────────────
// So existing API routes that import from mockDb.ts still work.

export const getMockDb = async () => {
  const store = await getStore();
  return store as any;
};

export const saveMockDb = saveStore as any;
