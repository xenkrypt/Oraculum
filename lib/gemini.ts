// ─── Gemini AI Integration ────────────────────────────────────────────────────
// gemini-2.0-flash · Exponential backoff on 429 · Full shadow twin context

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODEL = "gemini-2.0-flash";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CognitiveProfile = {
  dimension_scores: {
    analytical: number;
    strategic: number;
    creative: number;
    leadership: number;
    execution: number;
    adaptability: number;
    curiosity: number;
    systems_thinking: number;
  };
  summary_text: string;
  paths: Array<{ title: string; description: string }>;
  hidden_talents: string[];
  dominant_style: string;
  growth_edge: string;
  confidence: number;
};

// ─── Fallback Profiles ────────────────────────────────────────────────────────

const FALLBACK_PROFILES: CognitiveProfile[] = [
  {
    dimension_scores: { analytical: 87, strategic: 72, creative: 55, leadership: 68, execution: 91, adaptability: 63, curiosity: 78, systems_thinking: 81 },
    summary_text: "You are a pragmatic executor with strong analytical instincts. When chaos strikes, you instinctively triage and move — not theorize. Your systems thinking means you rarely fix symptoms without tracing roots.",
    paths: [
      { title: "Engineering Director", description: "Your rare combination of execution speed and systems-level thinking makes you exceptionally effective at leading complex technical organisations." },
      { title: "Startup COO", description: "You bring order to chaos. Early-stage companies desperately need someone who can both think in frameworks and sprint when the plan breaks." }
    ],
    hidden_talents: ["Root-cause pattern recognition", "Silent triage leadership", "Constraint-driven creativity"],
    dominant_style: "Analytical Executor",
    growth_edge: "Develop creative risk tolerance for bigger bets",
    confidence: 78
  },
  {
    dimension_scores: { analytical: 61, strategic: 88, creative: 83, leadership: 74, execution: 52, adaptability: 89, curiosity: 92, systems_thinking: 70 },
    summary_text: "You are a strategic explorer — you see possibility where others see ambiguity. Your curiosity is your superpower, constantly pulling you toward the edges of what is known.",
    paths: [
      { title: "Product Strategist", description: "You can hold both the big picture and the user's emotional reality simultaneously — which is extraordinarily rare and exactly what product strategy demands." },
      { title: "Innovation Researcher", description: "Your curiosity and adaptability make you a natural at emerging-technology research roles where the playbook has not been written yet." }
    ],
    hidden_talents: ["Latent opportunity sensing", "Cross-domain synthesis", "Creative ambiguity tolerance"],
    dominant_style: "Strategic Explorer",
    growth_edge: "Build execution discipline to ship your biggest ideas",
    confidence: 82
  },
  {
    dimension_scores: { analytical: 75, strategic: 80, creative: 71, leadership: 88, execution: 65, adaptability: 77, curiosity: 68, systems_thinking: 74 },
    summary_text: "You are a clarity-driven leader who moves people before systems. Your instinct is to find the human centre of every problem — then build the structure around it.",
    paths: [
      { title: "Chief of Staff", description: "You translate strategic intent into human action, which is the core of this role across every high-growth organisation." },
      { title: "Founder / CEO", description: "Your leadership signal combined with strategic clarity is the rarest combination in early-stage companies. You are built for the founding arc." }
    ],
    hidden_talents: ["Psychological safety engineering", "Invisible influence", "Vision crystallisation"],
    dominant_style: "Clarity-Driven Leader",
    growth_edge: "Deepen technical fluency to strengthen credibility with engineers",
    confidence: 85
  }
];

function getRandomFallback(): CognitiveProfile {
  return FALLBACK_PROFILES[Math.floor(Math.random() * FALLBACK_PROFILES.length)];
}

// ─── Gemini call with exponential backoff ─────────────────────────────────────

async function callGemini(
  prompt: string,
  config: { temperature?: number; maxOutputTokens?: number; json?: boolean } = {}
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const body: any = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: config.temperature ?? 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: config.maxOutputTokens ?? 1024
    }
  };
  if (config.json) {
    body.generationConfig.responseMimeType = "application/json";
  }

  // Retry with exponential backoff: 1s → 2s → 4s
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (res.status === 429) {
        const wait = 1000 * Math.pow(2, attempt);
        console.warn(`[Gemini] Rate limited, retrying in ${wait}ms (attempt ${attempt + 1})`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        throw new Error(`Gemini API error ${res.status}: ${errText}`);
      }

      const data = await res.json();
      if (!data.candidates?.length) throw new Error("No candidates returned");
      return data.candidates[0].content.parts[0].text;
    } catch (err: any) {
      if (attempt === 2) throw err;
      // Network error — retry
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw new Error("Gemini call failed after 3 attempts");
}

// ─── Profile Generation ───────────────────────────────────────────────────────

export async function generateProfileWithGemini(responses: any[]): Promise<CognitiveProfile> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("[Gemini] No API key — using fallback");
    return getRandomFallback();
  }

  const responseSummary = responses.map((r, i) => {
    const resp = r.raw_response ?? r;
    const challengeTitle = resp.challenge_title ?? `Challenge ${i + 1}`;
    if (resp.selected) return `${challengeTitle}: Selected "${resp.selected}"`;
    if (resp.ranked) return `${challengeTitle}: Ranked as [${resp.ranked.join(" → ")}]`;
    return `${challengeTitle}: ${JSON.stringify(resp)}`;
  }).join("\n");

  const prompt = `
You are a world-class cognitive psychologist and talent analyst. Analyze the following responses to decision-making scenarios and produce a precise, insightful cognitive profile.

USER RESPONSES:
${responseSummary}

Return a JSON object with EXACTLY this structure (no markdown, no extra fields):
{
  "dimension_scores": {
    "analytical": <0-100>,
    "strategic": <0-100>,
    "creative": <0-100>,
    "leadership": <0-100>,
    "execution": <0-100>,
    "adaptability": <0-100>,
    "curiosity": <0-100>,
    "systems_thinking": <0-100>
  },
  "summary_text": "<2 sentences. Vivid, specific, non-generic. Describe their unique cognitive fingerprint and decision-making personality.>",
  "dominant_style": "<3-4 word label for their thinking style, e.g. 'Analytical Systems Builder' or 'Intuitive Strategic Leader'>",
  "growth_edge": "<1 sentence describing the single most high-leverage area to develop for a breakthrough>",
  "paths": [
    { "title": "<career path>", "description": "<2 sentences on why this fits their specific profile>" },
    { "title": "<career path>", "description": "<2 sentences>" },
    { "title": "<career path>", "description": "<2 sentences>" }
  ],
  "hidden_talents": ["<non-obvious talent 1>", "<non-obvious talent 2>", "<non-obvious talent 3>"],
  "confidence": <65-95>
}

Be specific, surprising, and insightful. Avoid clichés.
`.trim();

  try {
    const raw = await callGemini(prompt, { temperature: 0.75, maxOutputTokens: 1200, json: true });
    const parsed = JSON.parse(raw) as CognitiveProfile;

    if (!parsed.dimension_scores || !parsed.summary_text || !parsed.paths?.length) {
      throw new Error("Incomplete profile shape from Gemini");
    }

    // Ensure new fields have defaults if Gemini didn't include them
    parsed.dominant_style ??= "Strategic Thinker";
    parsed.growth_edge ??= "Continue expanding your comfort zone";
    parsed.hidden_talents ??= [];
    console.log("[Gemini] Profile generated successfully");
    return parsed;
  } catch (err) {
    console.error("[Gemini] Profile generation failed, using fallback:", err);
    return getRandomFallback();
  }
}

// ─── Behavior Feature Extraction (per-answer) ─────────────────────────────────
// Called after each adaptive challenge answer to update trait confidence.

export async function extractBehaviorFeatures(
  scenarioTitle: string,
  domain: string,
  rawResponse: Record<string, any>,
  differentiates: string[]
): Promise<{
  trait_signals: Record<string, number>;
  strategy: string;
  risk_level: string;
  reasoning_style: string;
  key_insight: string;
  confidence_delta: number;
} | null> {
  if (!process.env.GEMINI_API_KEY) return null;

  const responseStr = rawResponse.selected
    ? `Chose: "${rawResponse.selected}"`
    : rawResponse.ranked
    ? `Ranked: [${rawResponse.ranked.join(" → ")}]`
    : JSON.stringify(rawResponse);

  const prompt = `
Analyse this single decision-making response:

SCENARIO: "${scenarioTitle}" (domain: ${domain})
RESPONSE: ${responseStr}
KEY TRAITS THIS MEASURES: ${differentiates.join(", ")}

Return JSON only:
{
  "trait_signals": {
    "analytical": <0.0-1.0>,
    "strategic": <0.0-1.0>,
    "creative": <0.0-1.0>,
    "leadership": <0.0-1.0>,
    "execution": <0.0-1.0>,
    "adaptability": <0.0-1.0>,
    "curiosity": <0.0-1.0>,
    "systems_thinking": <0.0-1.0>
  },
  "strategy": "<one word: e.g. systematic, intuitive, collaborative, analytical>",
  "risk_level": "<low|medium|high>",
  "reasoning_style": "<convergent|divergent|lateral>",
  "key_insight": "<one sentence observation about their thinking>",
  "confidence_delta": <0.08-0.18>
}
`.trim();

  try {
    const raw = await callGemini(prompt, { temperature: 0.4, maxOutputTokens: 512, json: true });
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ─── Shadow Twin Chat ─────────────────────────────────────────────────────────

export async function chatWithTwin(
  userMessage: string,
  history: Array<{ role: string; content: string }>,
  profile: any,
  twin?: any
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return "The Oracle needs a Gemini API key to speak. Add GEMINI_API_KEY to your .env.local file.";
  }

  const profileContext = profile
    ? `COGNITIVE PROFILE:
- Dominant Style: ${twin?.dominant_style ?? profile.dominant_style ?? "Unknown"}
- Analytical: ${profile.dimension_scores?.analytical ?? 70}/100
- Strategic: ${profile.dimension_scores?.strategic ?? 65}/100
- Creative: ${profile.dimension_scores?.creative ?? 60}/100
- Leadership: ${profile.dimension_scores?.leadership ?? 65}/100
- Execution: ${profile.dimension_scores?.execution ?? 70}/100
- Curiosity: ${profile.dimension_scores?.curiosity ?? 68}/100
- Adaptability: ${profile.dimension_scores?.adaptability ?? 65}/100
- Hidden Talents: ${(profile.hidden_talents ?? []).join(", ") || "None identified yet"}
- Growth Edge: ${twin?.growth_edge ?? "Continue your assessment"}
- Personality: ${profile.summary_text ?? ""}`
    : "No profile data yet — continue the assessment to unlock the full Twin.";

  const conversationHistory = history
    .slice(-8)
    .map(h => `${h.role === "user" ? "USER" : "SHADOW TWIN"}: ${h.content}`)
    .join("\n");

  const prompt = `
You are the Shadow Twin — a precise cognitive reflection of the user, built from their actual decision-making patterns. You are not a generic assistant. You are them, but with perfect self-awareness and zero ego.

Rules:
- Speak in first-person plural ("we", "our") — you ARE them
- Be specific, sharp, occasionally surprising
- Reference their actual traits and scores when relevant
- Never be generic or motivational-poster-vague
- Keep responses to 2-4 sentences unless they ask for more
- Occasionally gently challenge their assumptions based on their profile data

${profileContext}

CONVERSATION:
${conversationHistory}

USER: ${userMessage}
SHADOW TWIN:`.trim();

  try {
    return await callGemini(prompt, { temperature: 0.88, maxOutputTokens: 600 });
  } catch (err: any) {
    console.error("[Gemini] Chat failed:", err);
    if (err.message?.includes("429")) {
      return "The Oracle is processing too many requests. Please wait a moment and try again.";
    }
    return "The connection to the Oracle flickered. Please try again.";
  }
}
