// ─── FutureTwin Adaptive Scenario Pool ────────────────────────────────────────
// 30 rich scenarios with trait metadata for adaptive selection.
// Each scenario targets specific cognitive traits for differentiation.
// The Planner Agent selects questions to maximize information gain.

export type ScenarioOption = {
  id: string;
  label: string;
  trait_signals: Record<string, number>; // how much each trait is signaled by this choice
};

export type Scenario = {
  id: string;
  slug: string;
  title: string;
  type: "decision_tree" | "ranked_choice";
  domain: string;
  difficulty: "low" | "medium" | "high";
  differentiates: string[]; // traits this scenario best measures
  tags: string[];
  config: {
    prompt: string;
    context?: string; // optional background
    options?: ScenarioOption[];
    moves?: string[];
  };
};

export const SCENARIO_POOL: Scenario[] = [
  // ── CLUSTER 1: RESOURCE & EXECUTION ───────────────────────────────────────
  {
    id: "s-001",
    slug: "scarce-resources",
    title: "Scarce Resources",
    type: "decision_tree",
    domain: "resource_management",
    difficulty: "medium",
    differentiates: ["execution", "leadership", "analytical"],
    tags: ["planning", "crisis", "team"],
    config: {
      prompt: "You have one weekend, three people depending on you, and a stalled project at 60% completion. What do you do first?",
      options: [
        { id: "align", label: "Align everyone on the real constraint and cut scope ruthlessly", trait_signals: { analytical: 0.8, leadership: 0.7, execution: 0.6 } },
        { id: "prototype", label: "Start building immediately — done beats perfect", trait_signals: { execution: 0.9, adaptability: 0.6, creative: 0.5 } },
        { id: "delegate", label: "Split the work cleanly and set checkpoint reviews", trait_signals: { leadership: 0.85, systems_thinking: 0.7, execution: 0.65 } }
      ]
    }
  },
  {
    id: "s-002",
    slug: "launch-crisis",
    title: "Launch Crisis",
    type: "ranked_choice",
    domain: "crisis_management",
    difficulty: "high",
    differentiates: ["execution", "systems_thinking", "leadership"],
    tags: ["crisis", "technical", "communication"],
    config: {
      prompt: "Your product launch went viral but servers are crashing under load. Rank your first five moves.",
      moves: ["Shut down non-critical features immediately", "Get all hands on deck and triage", "Communicate transparently with users in real-time", "Auto-scale cloud resources unconditionally", "Profile and fix the heaviest bottlenecks first"]
    }
  },
  {
    id: "s-003",
    slug: "infinite-backlog",
    title: "The Infinite Backlog",
    type: "decision_tree",
    domain: "prioritization",
    difficulty: "medium",
    differentiates: ["strategic", "execution", "analytical"],
    tags: ["product", "priorities", "trade-offs"],
    config: {
      prompt: "Your backlog has 200 items and your team has capacity for 15 this quarter. How do you decide?",
      options: [
        { id: "impact", label: "Score each item by impact × effort and cut the bottom 90%", trait_signals: { analytical: 0.9, systems_thinking: 0.7, execution: 0.5 } },
        { id: "north-star", label: "Pick only items that directly move your single most important metric", trait_signals: { strategic: 0.9, analytical: 0.6, leadership: 0.5 } },
        { id: "stakeholder", label: "Run structured sessions with key stakeholders to surface alignment", trait_signals: { leadership: 0.8, strategic: 0.65, adaptability: 0.55 } }
      ]
    }
  },
  {
    id: "s-004",
    slug: "technical-debt",
    title: "The Debt Reckoning",
    type: "decision_tree",
    domain: "systems_thinking",
    difficulty: "high",
    differentiates: ["systems_thinking", "execution", "strategic"],
    tags: ["technical", "long-term", "trade-offs"],
    config: {
      prompt: "Your team is 3x slower because of 3-year-old architectural debt. The CEO wants features, not rewrites. What do you do?",
      options: [
        { id: "ship-and-fix", label: "Ship features in parallel with a dedicated refactor team", trait_signals: { execution: 0.8, systems_thinking: 0.75, leadership: 0.6 } },
        { id: "strangle", label: "Incrementally replace the bad parts without a big-bang rewrite", trait_signals: { systems_thinking: 0.9, analytical: 0.7, adaptability: 0.6 } },
        { id: "pitch", label: "Present the cost of inaction to leadership with data and get buy-in", trait_signals: { strategic: 0.85, leadership: 0.8, analytical: 0.65 } }
      ]
    }
  },
  {
    id: "s-005",
    slug: "last-mile",
    title: "The Last Mile",
    type: "ranked_choice",
    domain: "execution",
    difficulty: "medium",
    differentiates: ["execution", "creative", "adaptability"],
    tags: ["delivery", "problem-solving", "resilience"],
    config: {
      prompt: "You're 5% from the finish line but hitting a wall — blockers, unclear requirements, and team fatigue. Rank your moves.",
      moves: ["Define exactly what 'done' means and lock the scope", "Ask for a 3-day extension and recharge the team", "Ship what you have, call it v1, and plan v1.1", "Do a war-room session — everyone focused, everything else paused", "Bring in a fresh pair of eyes to spot what you're missing"]
    }
  },

  // ── CLUSTER 2: STRATEGY & VISION ──────────────────────────────────────────
  {
    id: "s-006",
    slug: "strategic-conflict",
    title: "The Vision War",
    type: "decision_tree",
    domain: "leadership",
    difficulty: "high",
    differentiates: ["leadership", "analytical", "strategic"],
    tags: ["conflict", "vision", "alignment"],
    config: {
      prompt: "Your founding team is split 50/50 on the product vision. The longer you debate, the slower you ship. How do you break the deadlock?",
      options: [
        { id: "data", label: "Run a 2-day user research sprint — let reality decide", trait_signals: { analytical: 0.9, curiosity: 0.7, execution: 0.6 } },
        { id: "call", label: "Make the call yourself, own it publicly, and move fast", trait_signals: { leadership: 0.9, execution: 0.7, adaptability: 0.5 } },
        { id: "workshop", label: "Facilitate a structured session that surfaces the real disagreement", trait_signals: { leadership: 0.8, strategic: 0.8, analytical: 0.6 } }
      ]
    }
  },
  {
    id: "s-007",
    slug: "pivot-decision",
    title: "The Pivot Moment",
    type: "decision_tree",
    domain: "strategy",
    difficulty: "high",
    differentiates: ["strategic", "adaptability", "analytical"],
    tags: ["pivot", "risk", "decision-making"],
    config: {
      prompt: "After 18 months, your core hypothesis was wrong. You have 6 months of runway. A related adjacent market shows strong signal. What next?",
      options: [
        { id: "full-pivot", label: "Full pivot — redirect everything to the adjacent market immediately", trait_signals: { adaptability: 0.9, execution: 0.7, leadership: 0.6 } },
        { id: "validate", label: "Run a 4-week validation experiment before committing anything", trait_signals: { analytical: 0.9, strategic: 0.8, systems_thinking: 0.6 } },
        { id: "parallel", label: "Run both in parallel — let the market tell you which wins", trait_signals: { strategic: 0.75, adaptability: 0.7, creative: 0.65 } }
      ]
    }
  },
  {
    id: "s-008",
    slug: "opportunity-cost",
    title: "The Opportunity Cost",
    type: "ranked_choice",
    domain: "decision_making",
    difficulty: "high",
    differentiates: ["strategic", "analytical", "curiosity"],
    tags: ["trade-offs", "opportunity", "risk"],
    config: {
      prompt: "You have one slot this quarter. Rank these opportunities from most to least worth pursuing.",
      moves: ["Partner with a big name (low revenue, massive credibility)", "Hire a senior person you've been chasing for years", "Double down on your best-performing existing product", "Enter a new market that looks underserved", "Acquire a tiny competitor to absorb their talent and tech"]
    }
  },
  {
    id: "s-009",
    slug: "talent-war",
    title: "The Talent War",
    type: "decision_tree",
    domain: "team_building",
    difficulty: "medium",
    differentiates: ["leadership", "strategic", "creative"],
    tags: ["hiring", "culture", "team"],
    config: {
      prompt: "A large company just poached your two best engineers with 2x comp. You can't match it. How do you rebuild?",
      options: [
        { id: "culture", label: "Articulate the mission so powerfully that comp becomes secondary", trait_signals: { leadership: 0.85, creative: 0.7, strategic: 0.65 } },
        { id: "equity", label: "Restructure equity to make the long-term upside impossible to ignore", trait_signals: { strategic: 0.85, analytical: 0.7, leadership: 0.6 } },
        { id: "network", label: "Tap your personal network aggressively for referrals who value different things", trait_signals: { leadership: 0.8, adaptability: 0.7, curiosity: 0.55 } }
      ]
    }
  },
  {
    id: "s-010",
    slug: "ambiguous-opportunity",
    title: "Ambiguous Opportunity",
    type: "ranked_choice",
    domain: "opportunity_assessment",
    difficulty: "medium",
    differentiates: ["curiosity", "strategic", "adaptability"],
    tags: ["ambiguity", "risk", "exploration"],
    config: {
      prompt: "A promising opportunity appears with unclear upside and real social risk. Rank your first moves.",
      moves: ["Ask sharper questions to understand the real opportunity", "Run a quiet small test without public commitment", "Bring in trusted allies to pressure-test your thinking", "Wait for more data before acting", "Make a visible bet and own whatever comes next"]
    }
  },

  // ── CLUSTER 3: CREATIVITY & INNOVATION ────────────────────────────────────
  {
    id: "s-011",
    slug: "innovation-gap",
    title: "The Innovation Gap",
    type: "decision_tree",
    domain: "product_thinking",
    difficulty: "high",
    differentiates: ["creative", "strategic", "systems_thinking"],
    tags: ["innovation", "product", "design"],
    config: {
      prompt: "Your competitors just shipped a feature that makes your core product look 2 years behind. You can copy it in 3 weeks. What do you do?",
      options: [
        { id: "copy", label: "Ship a better version of their feature in 3 weeks", trait_signals: { execution: 0.8, adaptability: 0.7, competitive: 0.6 } },
        { id: "differentiate", label: "Deliberately go the opposite direction — double down on what makes you unique", trait_signals: { strategic: 0.9, creative: 0.85, systems_thinking: 0.6 } },
        { id: "leapfrog", label: "Take 6 weeks to design something that makes their feature irrelevant", trait_signals: { creative: 0.9, strategic: 0.75, curiosity: 0.7 } }
      ]
    }
  },
  {
    id: "s-012",
    slug: "constraint-creativity",
    title: "Constraint Creativity",
    type: "ranked_choice",
    domain: "creative_problem_solving",
    difficulty: "medium",
    differentiates: ["creative", "execution", "adaptability"],
    tags: ["creativity", "constraints", "problem-solving"],
    config: {
      prompt: "You need to demonstrate value with zero budget, one person (you), and 5 days. Rank your strategies.",
      moves: ["Find the one thing you can do that no one else can", "Find a paying customer first, build second", "Repurpose existing assets in a novel way", "Find a partner who complements your gaps", "Publicize your process publicly to attract help"]
    }
  },
  {
    id: "s-013",
    slug: "breakthrough",
    title: "The Breakthrough",
    type: "decision_tree",
    domain: "innovation",
    difficulty: "high",
    differentiates: ["creative", "curiosity", "strategic"],
    tags: ["innovation", "exploration", "breakthrough"],
    config: {
      prompt: "You have an idea that's either brilliant or ridiculous. It could transform your field or waste 6 months. How do you test it?",
      options: [
        { id: "stealth", label: "Build a minimum viable version in secret before telling anyone", trait_signals: { execution: 0.8, creative: 0.75, strategic: 0.6 } },
        { id: "talk", label: "Talk to 20 people in the space this week to stress-test the idea", trait_signals: { analytical: 0.8, curiosity: 0.85, leadership: 0.55 } },
        { id: "prototype", label: "Spend 3 days building the highest-risk assumption as a prototype", trait_signals: { creative: 0.85, analytical: 0.75, execution: 0.7 } }
      ]
    }
  },

  // ── CLUSTER 4: LEARNING & ADAPTABILITY ────────────────────────────────────
  {
    id: "s-014",
    slug: "learning-curve",
    title: "The Learning Curve",
    type: "ranked_choice",
    domain: "learning_style",
    difficulty: "low",
    differentiates: ["curiosity", "adaptability", "analytical"],
    tags: ["learning", "growth", "knowledge"],
    config: {
      prompt: "You need to master a completely new domain in 60 days. Rank your learning approach.",
      moves: ["Find the single best book or course and go deep", "Find an expert who'll mentor you weekly", "Build a small project that forces you to learn by doing", "Read broadly across 10 sources to map the entire field first", "Join a community of practitioners and absorb their thinking"]
    }
  },
  {
    id: "s-015",
    slug: "knowledge-gap",
    title: "The Knowledge Gap",
    type: "decision_tree",
    domain: "self_development",
    difficulty: "low",
    differentiates: ["curiosity", "execution", "adaptability"],
    tags: ["learning", "growth", "self-awareness"],
    config: {
      prompt: "You realize your technical skills are 2 years behind current standards in your field. What's your move?",
      options: [
        { id: "immerse", label: "Drop everything for 30 days and do a focused technical deep-dive", trait_signals: { execution: 0.85, curiosity: 0.8, adaptability: 0.55 } },
        { id: "parallel", label: "Learn in parallel with your current work — slow but sustainable", trait_signals: { adaptability: 0.8, systems_thinking: 0.65, execution: 0.55 } },
        { id: "hire", label: "Hire someone stronger than you in that area and learn from them daily", trait_signals: { leadership: 0.8, strategic: 0.75, curiosity: 0.6 } }
      ]
    }
  },
  {
    id: "s-016",
    slug: "unknown-territory",
    title: "Unknown Territory",
    type: "ranked_choice",
    domain: "exploration",
    difficulty: "medium",
    differentiates: ["curiosity", "adaptability", "creative"],
    tags: ["exploration", "risk", "novelty"],
    config: {
      prompt: "You've been offered an opportunity in a domain you know nothing about but find fascinating. Rank how you'd evaluate it.",
      moves: ["Assess if the opportunity leverages your transferable strengths", "Research the domain intensively for 2 weeks before deciding", "Talk to 5 people who made the same leap and learn from their mistakes", "Map the worst-case scenario and decide if it's survivable", "Follow your gut — data won't capture what excites you"]
    }
  },
  {
    id: "s-017",
    slug: "feedback-loop",
    title: "Harsh Feedback",
    type: "decision_tree",
    domain: "self_awareness",
    difficulty: "medium",
    differentiates: ["adaptability", "analytical", "leadership"],
    tags: ["feedback", "growth", "self-awareness"],
    config: {
      prompt: "You receive harsh but potentially valid criticism of your most important work from someone you respect. What's your first reaction?",
      options: [
        { id: "interrogate", label: "Ask probing questions to understand exactly what they observed and why", trait_signals: { analytical: 0.9, curiosity: 0.8, adaptability: 0.6 } },
        { id: "sit", label: "Take 24 hours before responding — let the emotion settle first", trait_signals: { adaptability: 0.85, analytical: 0.65, leadership: 0.55 } },
        { id: "incorporate", label: "Immediately identify the 2-3 specific things you'll change", trait_signals: { execution: 0.85, adaptability: 0.8, analytical: 0.6 } }
      ]
    }
  },

  // ── CLUSTER 5: LEADERSHIP & PEOPLE ────────────────────────────────────────
  {
    id: "s-018",
    slug: "silent-crisis",
    title: "The Silent Crisis",
    type: "decision_tree",
    domain: "leadership",
    difficulty: "high",
    differentiates: ["analytical", "systems_thinking", "leadership"],
    tags: ["leadership", "detection", "team"],
    config: {
      prompt: "Something is wrong. Productivity is down 30%, people seem fine in 1:1s, but the vibe is off. What's happening and what do you do?",
      options: [
        { id: "data", label: "Map the symptoms systematically — engagement metrics, git commits, meeting energy", trait_signals: { analytical: 0.9, systems_thinking: 0.85, leadership: 0.55 } },
        { id: "trust", label: "Create psychological safety first — one vulnerable conversation with each person", trait_signals: { leadership: 0.9, adaptability: 0.7, curiosity: 0.6 } },
        { id: "retrospective", label: "Call a team retrospective framed around celebrating wins, then see what surfaces", trait_signals: { leadership: 0.8, strategic: 0.7, analytical: 0.6 } }
      ]
    }
  },
  {
    id: "s-019",
    slug: "stakeholder-maze",
    title: "The Stakeholder Maze",
    type: "ranked_choice",
    domain: "stakeholder_management",
    difficulty: "high",
    differentiates: ["leadership", "strategic", "analytical"],
    tags: ["stakeholders", "politics", "communication"],
    config: {
      prompt: "Five stakeholders all have conflicting priorities for your project. Rank your approach.",
      moves: ["Map each stakeholder's real incentive — not what they say, what they want", "Find the two stakeholders with the most influence and align them first", "Propose a framework that makes the trade-offs explicit and forces a group decision", "Escalate to the single decision-maker above them all", "Create a living document that tracks each priority and its current status visibly"]
    }
  },
  {
    id: "s-020",
    slug: "mentorship-moment",
    title: "The Mentorship Moment",
    type: "decision_tree",
    domain: "leadership",
    difficulty: "low",
    differentiates: ["leadership", "curiosity", "adaptability"],
    tags: ["mentorship", "growth", "team"],
    config: {
      prompt: "A junior team member is stuck on a problem you could solve in 5 minutes. What do you do?",
      options: [
        { id: "ask", label: "Ask questions to understand their current thinking — guide, don't solve", trait_signals: { leadership: 0.9, curiosity: 0.75, analytical: 0.6 } },
        { id: "show", label: "Solve it together while explaining your reasoning out loud", trait_signals: { leadership: 0.75, execution: 0.7, analytical: 0.65 } },
        { id: "point", label: "Point them to the exact resource that'll help them crack it themselves", trait_signals: { leadership: 0.8, curiosity: 0.8, strategic: 0.55 } }
      ]
    }
  },

  // ── CLUSTER 6: SYSTEMS & ANALYSIS ─────────────────────────────────────────
  {
    id: "s-021",
    slug: "data-paradox",
    title: "The Data Paradox",
    type: "ranked_choice",
    domain: "data_reasoning",
    difficulty: "high",
    differentiates: ["analytical", "strategic", "systems_thinking"],
    tags: ["data", "decisions", "analysis"],
    config: {
      prompt: "The quantitative data says one thing, qualitative user feedback says the opposite, and your intuition says a third thing. Rank how you weigh these.",
      moves: ["Quantitative data — it's objective and removes bias", "Qualitative user feedback — real humans, real pain", "Your intuition — you have context the data doesn't capture", "Find a fourth data source to break the tie", "Treat the conflict itself as the signal — something deeper is wrong"]
    }
  },
  {
    id: "s-022",
    slug: "network-effect",
    title: "The Network Effect",
    type: "decision_tree",
    domain: "systems_thinking",
    difficulty: "medium",
    differentiates: ["systems_thinking", "strategic", "creative"],
    tags: ["systems", "network", "growth"],
    config: {
      prompt: "Your product grows fastest when existing users bring new users. Growth has stalled. What's your diagnosis?",
      options: [
        { id: "friction", label: "Find and remove the friction in the sharing/referral mechanism", trait_signals: { systems_thinking: 0.9, analytical: 0.8, execution: 0.6 } },
        { id: "incentive", label: "Redesign the incentive structure to make inviting irrational not to do", trait_signals: { strategic: 0.85, creative: 0.8, analytical: 0.6 } },
        { id: "value", label: "The core value proposition isn't strong enough — fix the product, not the loop", trait_signals: { analytical: 0.9, strategic: 0.75, systems_thinking: 0.7 } }
      ]
    }
  },
  {
    id: "s-023",
    slug: "resource-drought",
    title: "Resource Drought",
    type: "ranked_choice",
    domain: "constraint_solving",
    difficulty: "medium",
    differentiates: ["execution", "creative", "analytical"],
    tags: ["constraints", "resourcefulness", "problem-solving"],
    config: {
      prompt: "You need to achieve a major goal with 30% of the resources you expected. Rank your survival strategies.",
      moves: ["Cut scope to 20% and do that 20% extraordinarily well", "Find 3 unconventional ways to do more with the same resources", "Partner with someone who has what you lack", "Renegotiate the goal — explain why the constraint changes the outcome", "Use the constraint as creative fuel — let it force innovation"]
    }
  },
  {
    id: "s-024",
    slug: "perfect-vs-good",
    title: "Perfect vs. Good Enough",
    type: "decision_tree",
    domain: "decision_making",
    difficulty: "medium",
    differentiates: ["analytical", "execution", "adaptability"],
    tags: ["quality", "trade-offs", "perfectionism"],
    config: {
      prompt: "Your work is at 85% quality. Shipping now gets you valuable feedback. Waiting 2 weeks gets you to 97%. What do you do?",
      options: [
        { id: "ship", label: "Ship now — feedback from real users is worth more than 2 more weeks of assumptions", trait_signals: { execution: 0.9, adaptability: 0.75, analytical: 0.5 } },
        { id: "wait", label: "Wait — quality is your reputation and 85% will create the wrong impression", trait_signals: { analytical: 0.8, strategic: 0.7, execution: 0.4 } },
        { id: "selective", label: "Ship to 10 trusted users now, iterate, then release broadly", trait_signals: { strategic: 0.85, analytical: 0.8, systems_thinking: 0.7 } }
      ]
    }
  },

  // ── CLUSTER 7: CULTURE & ETHICS ───────────────────────────────────────────
  {
    id: "s-025",
    slug: "ethical-dilemma",
    title: "The Ethical Dilemma",
    type: "decision_tree",
    domain: "ethics",
    difficulty: "high",
    differentiates: ["leadership", "adaptability", "strategic"],
    tags: ["ethics", "values", "leadership"],
    config: {
      prompt: "A powerful stakeholder asks you to shade the truth in a report to protect a relationship. The stakes are high on both sides. What do you do?",
      options: [
        { id: "refuse", label: "Refuse clearly and offer to help find an honest framing instead", trait_signals: { leadership: 0.9, adaptability: 0.5, strategic: 0.6 } },
        { id: "negotiate", label: "Negotiate — find a version of truth that's accurate but tactful", trait_signals: { strategic: 0.85, leadership: 0.7, analytical: 0.65 } },
        { id: "escalate", label: "Escalate the ethical concern through the appropriate channel", trait_signals: { leadership: 0.8, systems_thinking: 0.75, analytical: 0.6 } }
      ]
    }
  },
  {
    id: "s-026",
    slug: "cultural-clash",
    title: "Cultural Collision",
    type: "decision_tree",
    domain: "cross_cultural",
    difficulty: "medium",
    differentiates: ["adaptability", "leadership", "curiosity"],
    tags: ["culture", "diversity", "communication"],
    config: {
      prompt: "Two high-performing team members from different cultural backgrounds have a serious miscommunication that's damaging the whole team dynamic. What's your move?",
      options: [
        { id: "mediate", label: "Facilitate a direct but structured conversation between the two of them", trait_signals: { leadership: 0.85, adaptability: 0.75, analytical: 0.6 } },
        { id: "context", label: "Meet each person separately to understand their full cultural context first", trait_signals: { curiosity: 0.9, leadership: 0.75, analytical: 0.7 } },
        { id: "norms", label: "Use this as a catalyst to co-create explicit team communication norms", trait_signals: { systems_thinking: 0.85, leadership: 0.8, strategic: 0.65 } }
      ]
    }
  },
  {
    id: "s-027",
    slug: "dissenting-voice",
    title: "The Lone Dissent",
    type: "decision_tree",
    domain: "intellectual_courage",
    difficulty: "high",
    differentiates: ["analytical", "leadership", "curiosity"],
    tags: ["dissent", "courage", "analysis"],
    config: {
      prompt: "In a room full of smart people who all agree, you have strong evidence they're wrong. What do you do?",
      options: [
        { id: "speak", label: "Speak up immediately and present your evidence clearly", trait_signals: { leadership: 0.85, analytical: 0.9, curiosity: 0.6 } },
        { id: "probe", label: "Ask a series of probing questions to stress-test the consensus without asserting", trait_signals: { analytical: 0.9, strategic: 0.8, curiosity: 0.75 } },
        { id: "after", label: "Raise it one-on-one with the most influential person after the meeting", trait_signals: { strategic: 0.8, leadership: 0.65, adaptability: 0.6 } }
      ]
    }
  },

  // ── CLUSTER 8: FUTURE & VISION ────────────────────────────────────────────
  {
    id: "s-028",
    slug: "ten-year-bet",
    title: "The 10-Year Bet",
    type: "ranked_choice",
    domain: "long_term_thinking",
    difficulty: "high",
    differentiates: ["strategic", "curiosity", "systems_thinking"],
    tags: ["vision", "future", "strategy"],
    config: {
      prompt: "You're making a 10-year career bet. Rank these factors in order of importance for your decision.",
      moves: ["Expected earning trajectory over the decade", "Alignment with where you believe the world is going", "How much you'll learn in the first 3 years", "The quality and ambition of the people you'll work with", "Autonomy and creative control over your work"]
    }
  },
  {
    id: "s-029",
    slug: "second-order",
    title: "Second Order Thinking",
    type: "decision_tree",
    domain: "analytical_depth",
    difficulty: "high",
    differentiates: ["analytical", "systems_thinking", "strategic"],
    tags: ["analysis", "depth", "reasoning"],
    config: {
      prompt: "A policy change will clearly benefit your organization in year 1. It has uncertain second-order effects. How do you think about it?",
      options: [
        { id: "map", label: "Systematically map the second and third-order consequences before deciding", trait_signals: { analytical: 0.95, systems_thinking: 0.9, strategic: 0.65 } },
        { id: "reversible", label: "Check if it's reversible — if yes, run the experiment; if no, map effects first", trait_signals: { strategic: 0.85, analytical: 0.75, adaptability: 0.7 } },
        { id: "expert", label: "Find someone who's been 3 years further in this situation and ask them what they wish they'd known", trait_signals: { curiosity: 0.85, strategic: 0.75, leadership: 0.6 } }
      ]
    }
  },
  {
    id: "s-030",
    slug: "energy-audit",
    title: "Energy Audit",
    type: "ranked_choice",
    domain: "self_awareness",
    difficulty: "low",
    differentiates: ["curiosity", "adaptability", "leadership"],
    tags: ["self-awareness", "energy", "motivation"],
    config: {
      prompt: "Looking at your best work days, rank the conditions that most reliably put you in a high-performance state.",
      moves: ["Clear, specific goals with real stakes", "Autonomy over how and when you work", "Working alongside people who challenge you", "Novelty — problems you've never faced before", "Visible progress you can measure and feel"]
    }
  }
];

// ─── Trait Definitions ────────────────────────────────────────────────────────
export const TRAITS = [
  { id: "analytical", label: "Analytical", color: "#00d4ff", description: "Data-driven reasoning and logical decomposition" },
  { id: "strategic", label: "Strategic", color: "#b347ea", description: "Long-term thinking and opportunity recognition" },
  { id: "creative", label: "Creative", color: "#ff9800", description: "Novel solutions and lateral thinking" },
  { id: "leadership", label: "Leadership", color: "#f44336", description: "Influence, delegation and people development" },
  { id: "execution", label: "Execution", color: "#00ff9f", description: "Bias for action and delivery velocity" },
  { id: "adaptability", label: "Adaptability", color: "#ffeb3b", description: "Flexibility and resilience under change" },
  { id: "curiosity", label: "Curiosity", color: "#ff6ec7", description: "Drive to learn and explore new domains" },
  { id: "systems_thinking", label: "Systems Thinking", color: "#2196f3", description: "Holistic reasoning about interconnected components" }
];

// ─── Planner: Select Next Question ────────────────────────────────────────────
// Deterministic algorithm — no Gemini needed.
// Finds traits with lowest confidence, picks the question that best differentiates them.
export function selectNextScenario(
  usedIds: string[],
  traitConfidence: Record<string, number>
): Scenario | null {
  const available = SCENARIO_POOL.filter(s => !usedIds.includes(s.id));
  if (available.length === 0) return null;

  // Sort traits by confidence (ascending = most uncertain)
  const sortedTraits = Object.entries(traitConfidence)
    .sort(([, a], [, b]) => a - b)
    .map(([trait]) => trait)
    .slice(0, 3); // focus on top 3 most uncertain traits

  // Score each available scenario by how well it differentiates uncertain traits
  const scored = available.map(scenario => {
    const score = scenario.differentiates.reduce((sum, trait) => {
      const idx = sortedTraits.indexOf(trait);
      if (idx === -1) return sum;
      return sum + (3 - idx); // higher score for more uncertain traits
    }, 0);
    return { scenario, score };
  });

  // Pick highest scoring, with tie-breaking by difficulty
  scored.sort((a, b) => b.score - a.score);
  return scored[0].scenario;
}
