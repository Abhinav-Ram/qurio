/**
 * Central registry for all AI configuration used across the pipeline:
 * - Gateway URL (Lovable AI Gateway endpoint)
 * - API key accessor (reads LOVABLE_API_KEY from server env)
 * - Per-stage model selection
 * - Per-stage system + user prompts
 *
 * Tune everything AI-related here without touching server-function logic.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shared gateway config
// ─────────────────────────────────────────────────────────────────────────────
export const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export function getAIApiKey(): string {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  return key;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 1: Question generation (src/server/questions.functions.ts)
// ─────────────────────────────────────────────────────────────────────────────
export const questionsPrompt = {
  model: "google/gemini-2.5-flash",

  system: `You are a senior qualitative research strategist designing interview question sets.

Generate 5–8 structured, OPEN-ENDED interview questions grounded in the supplied context.
Each question must:
- Probe for behavior or evidence (not opinions or hypotheticals)
- Avoid leading wording — never bias toward any hypothesis
- Have a clear "vector" label (the dimension it investigates, max 3 words)
- Include 2–3 short, contingent follow-up questions

Return ONLY a tool call.`,

  user: ({ context, hypothesis }: { context: string; hypothesis: string }) =>
    `INTERVIEW CONTEXT:
${context}

${
  hypothesis
    ? `HYPOTHESIS UNDER TEST:\n${hypothesis}`
    : "NO EXPLICIT HYPOTHESIS — design exploratory questions."
}`,
};

// ─────────────────────────────────────────────────────────────────────────────
// Stage 2: Evidence analysis (src/server/analysis.functions.ts)
// ─────────────────────────────────────────────────────────────────────────────
export const analysisPrompt = {
  model: "google/gemini-2.5-pro",
  system: `You are an evidence-grounded qualitative research analyst.
Follow these MANDATORY rules:
- Every claim MUST be atomic and derived from explicit input text.
- Every claim MUST include a direct supporting quote from a participant.
- Do NOT merge conflicting viewpoints — preserve contradictions explicitly.
- Do NOT invent insights without evidence.
- Do NOT use probability, scoring, or confidence metrics.
- If evidence is insufficient, return verdict 'Inconclusive' with a clear explanation.
- Use participant IDs (P1, P2, ...) as the source for evidence.
Return ONLY a tool call.`,

  user: ({
    context,
    hypothesis,
    transcript,
    participantCount,
  }: {
    context: string;
    hypothesis: string;
    transcript: string;
    participantCount: number;
  }) =>
    `INTERVIEW CONTEXT:
${context || "(none)"}

HYPOTHESIS:
${hypothesis || "None provided"}

INTERVIEW TRANSCRIPT (${participantCount} participant${participantCount === 1 ? "" : "s"}):
${transcript}`,
};
