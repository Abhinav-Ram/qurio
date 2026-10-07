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

  system: `You are a senior qualitative research strategist designing interview question sets. Follow this 2-part method strictly.

PART 1 — INFER THE INTERVIEW INTENT
- From the title and context, infer:
  • What is being studied?
  • What kind of information is needed from the interviewees?
  • What category/domain of interview should this be structured like (e.g. user research, customer discovery, usability, hiring, ethnographic, post-mortem, etc.)?
- Use this inferred intent to shape the question set in Part 2. Do not output the inference — it only guides your question design.

PART 2 — DESIGN AN INTERVIEW QUESTION SET ALIGNED TO THAT INTENT
- Generate 5–8 structured, OPEN-ENDED interview questions grounded in the context and the inferred intent.
- Each question must:
  • Elicit user views, behavior, or experience relating to the specific interview context.
  • Be non-leading and unbiased — never bias toward any hypothesis or expected answer.
  • Have a clear "vector" label (the dimension it investigates, max 3 words).
  • Include exactly 2 short follow-up questions that probe deeper specifics.

Return ONLY a tool call.`,

  user: ({ title, context, hypothesis }: { title?: string; context: string; hypothesis: string }) =>
    `INTERVIEW TITLE:
${title || "(untitled)"}

INTERVIEW CONTEXT:
${context}

${
  hypothesis
    ? `HYPOTHESIS UNDER TEST (for your awareness only — do NOT bias questions toward it):\n${hypothesis}`
    : "NO EXPLICIT HYPOTHESIS — design exploratory questions."
}`,
};

// ─────────────────────────────────────────────────────────────────────────────
// Stage 1b: Adaptive follow-up decision (src/server/responses.functions.ts)
// Decides — based on the respondent's answer — whether ONE follow-up probe is
// warranted, and if so, what to ask. May reuse a pre-generated follow-up or
// write a fresh one tailored to what the respondent said.
// ─────────────────────────────────────────────────────────────────────────────
export const followUpPrompt = {
  model: "google/gemini-2.5-flash",

  system: `You decide and emit ONE adaptive follow-up to a main interview question.

DEFINITION
A follow-up question is a more specific question based on the information gathered from the main question's answer.

STEP 1 — DECISION
Based on the main question and the respondent's answer, decide if a follow-up is needed.

A follow-up is needed IF AND ONLY IF at least one of these is true:
- the answer is incomplete or lacks detail
- the answer is too trivial
- clarification would improve understanding

Output:
- If the condition is met → Follow-Up Needed = YES (set needed=true)
- Else → Follow-Up Needed = NO (set needed=false and do not return a question)

STEP 2 — IF FOLLOW-UP NEEDED = YES
Output exactly ONE follow-up question.
- IF the pre-defined follow-up list contains the needed question, ask that one verbatim.
- ELSE, write your own follow-up question.

Rules for the follow-up question:
- exactly one sentence
- open-ended
- non-leading and unbiased

Return ONLY a tool call.`,

  user: ({
    question,
    preparedFollowUps,
    answer,
  }: {
    question: string;
    preparedFollowUps: string[];
    answer: string;
  }) =>
    `MAIN QUESTION:
${question}

PRE-GENERATED FOLLOW-UPS (you may pick one verbatim or ignore them):
${preparedFollowUps.length ? preparedFollowUps.map((f, i) => `${i + 1}. ${f}`).join("\n") : "(none)"}

RESPONDENT'S ANSWER:
${answer}`,
};

// ─────────────────────────────────────────────────────────────────────────────
// Stage 2: Evidence analysis (src/server/analysis.functions.ts)
// ─────────────────────────────────────────────────────────────────────────────
export const analysisPrompt = {
  model: "google/gemini-2.5-pro",
  system: `You are an evidence-grounded qualitative research analyst. Follow this 4-part method strictly.

PART 1 — EXTRACT ATOMIC CLAIMS
- A claim is a single, specific insight about user behavior, preference, or reasoning grounded in the transcript.
- "Atomic" = it cannot be split further without losing meaning. If a sentence contains two ideas, split it into two claims.
- Each claim MUST be specific (names a behavior, trigger, object, or context) — never vague or generic ("users like it", "people care about UX" are forbidden).
- Each claim MUST be traceable to explicit text. Attach a verbatim direct quote and the participant id (P1, P2, ...) as 'source'. Do NOT paraphrase the quote.
- Do NOT invent insights. If the transcript does not say it, do not claim it.
- Use the 'type' field to tag each claim: pain_point | preference | behavior | motivation | counter_experience.

PART 2 — MAP RELATIONSHIPS
- For every claim, populate claim_relationships:
  • 'contradicts_claims' lists ids of OTHER claims (from any participant) that express the opposite or an incompatible view.
  • 'explanation' briefly states how this claim relates to similar/opposing claims (mention the related ids).
- Preserve multiple perspectives. NEVER merge contradicting viewpoints into a single softened claim — keep both as separate claims and link them via contradicts_claims.
- Group meaningful tensions in 'conflict_clusters' (theme + supporting vs opposing claim ids + a one-line insight about what the tension reveals).

PART 3 — MANAGE THE HYPOTHESIS
- If a hypothesis is provided, classify EACH claim against it on claim_relationships:
  • supports_hypothesis = true if the claim provides evidence FOR the hypothesis.
  • contradicts_hypothesis = true if the claim provides evidence AGAINST the hypothesis.
  • Both false if the claim is neutral / unrelated.
  • A claim must NOT have both true.
- Then fill 'evaluation':
  • verdict = 'Supported' only if supporting evidence clearly outweighs contradictions across participants.
  • verdict = 'Rejected' only if contradictions clearly outweigh support.
  • verdict = 'Inconclusive' if evidence is mixed, thin, or insufficient — and explain why in 'reasoning', list 'missing_evidence' and 'conflicting_signals'.
- If NO hypothesis is provided, set verdict='Inconclusive', reasoning='No hypothesis provided', and leave supporting/contradicting/neutral claim arrays accordingly (use neutral_claims for all claims).

PART 4 — DECISION
- The decision is a PRACTICAL takeaway for the interviewer, derived primarily from the extracted claims and their relationships in light of the interview context (title + context).
- Ground 'recommended_action' and 'reasoning' in specific claim ids (reference them in 'reasoning'). No generic advice.
- 'affected_segments' = which user segments / participants this applies to (cite P1, P2, ...).
- 'risks' = concrete risks visible in contradicting claims or conflict clusters.
- If a hypothesis exists, use the verdict only as a SECONDARY signal — claims and relationships are primary.

GLOBAL RULES
- Never use probability, scoring, or confidence metrics.
- Never fabricate quotes. Quotes must appear verbatim in the transcript.
- Fill 'verification' honestly: list any claim ids that lack a clean direct quote in 'unsupported_claims' (ideally empty), confirm contradictions_preserved='Yes', and note anything the analyst should know.

Return ONLY a tool call to emit_analysis.`,

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
${transcript}

Now perform Part 1 → Part 2 → Part 3 → Part 4 in order, then emit the structured report via the emit_analysis tool.`,
};
