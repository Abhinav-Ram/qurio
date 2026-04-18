import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { analysisPrompt } from "./prompts";

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars not configured on server.");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-pro";

function getApiKey(): string {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  return key;
}

export interface AnalysisReport {
  hypothesis: string;
  claims: {
    id: string;
    statement: string;
    type: "pain_point" | "preference" | "behavior" | "motivation" | "counter_experience";
    evidence: { quote: string; source: string; reference?: string };
  }[];
  claim_relationships: {
    claim_id: string;
    supports_hypothesis: boolean;
    contradicts_hypothesis: boolean;
    contradicts_claims: string[];
    explanation: string;
  }[];
  conflict_clusters: {
    theme: string;
    supporting_claims: string[];
    opposing_claims: string[];
    insight: string;
  }[];
  evaluation: {
    verdict: "Supported" | "Rejected" | "Inconclusive";
    supporting_claims: string[];
    contradicting_claims: string[];
    neutral_claims: string[];
    reasoning: string;
    missing_evidence: string[];
    conflicting_signals: string[];
  };
  decision: {
    recommended_action: string;
    reasoning: string;
    affected_segments: string[];
    risks: string[];
  };
  verification: {
    evidence_traceability: string;
    unsupported_claims: string[];
    contradictions_preserved: "Yes" | "No";
    notes: string;
  };
  generated_at: string;
}

export const generateAnalysis = createServerFn({ method: "POST" })
  .inputValidator((data: { contextId: string }) => {
    if (!data?.contextId) throw new Error("contextId required");
    return { contextId: data.contextId };
  })
  .handler(async ({ data }) => {
    const sb = getSupabase();
    const [{ data: ctx, error: ctxErr }, { data: qs, error: qErr }, { data: rs, error: rErr }] =
      await Promise.all([
        sb
          .from("interview_contexts")
          .select("id,context,hypothesis")
          .eq("id", data.contextId)
          .maybeSingle(),
        sb
          .from("interview_questions")
          .select("id,text,position")
          .eq("context_id", data.contextId)
          .order("position", { ascending: true }),
        sb
          .from("interview_responses")
          .select("id,respondent_name,answers,submitted_at")
          .eq("context_id", data.contextId)
          .order("submitted_at", { ascending: true }),
      ]);
    if (ctxErr) throw new Error(ctxErr.message);
    if (qErr) throw new Error(qErr.message);
    if (rErr) throw new Error(rErr.message);
    if (!ctx) throw new Error("Context not found");
    if (!rs || rs.length === 0) throw new Error("No responses to analyze yet.");

    const qMap = new Map<string, string>();
    (qs ?? []).forEach((q) => qMap.set(q.id, q.text));

    const transcript = rs
      .map((r, idx) => {
        const pid = `P${idx + 1}`;
        const name = (r.respondent_name as string) || "Anonymous";
        const answers = Array.isArray(r.answers)
          ? (r.answers as { questionId: string; answer: string }[])
          : [];
        const lines = answers
          .map((a) => {
            const qt = qMap.get(a.questionId) ?? "(question removed)";
            return `Q: ${qt}\nA: ${a.answer || "(no answer)"}`;
          })
          .join("\n\n");
        return `--- Participant ${pid} (${name}) ---\n${lines}`;
      })
      .join("\n\n");

    const systemPrompt = `You are an evidence-grounded qualitative research analyst.
Follow these MANDATORY rules:
- Every claim MUST be atomic and derived from explicit input text.
- Every claim MUST include a direct supporting quote from a participant.
- Do NOT merge conflicting viewpoints — preserve contradictions explicitly.
- Do NOT invent insights without evidence.
- Do NOT use probability, scoring, or confidence metrics.
- If evidence is insufficient, return verdict 'Inconclusive' with a clear explanation.
- Use participant IDs (P1, P2, ...) as the source for evidence.
Return ONLY a tool call.`;

    const userPrompt = `INTERVIEW CONTEXT:
${ctx.context || "(none)"}

HYPOTHESIS:
${ctx.hypothesis || "None provided"}

INTERVIEW TRANSCRIPT (${rs.length} participant${rs.length === 1 ? "" : "s"}):
${transcript}`;

    const body = {
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "emit_analysis",
            description: "Return the structured evidence-grounded analysis report.",
            parameters: {
              type: "object",
              properties: {
                hypothesis: { type: "string" },
                claims: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", description: "Stable id like C1, C2, ..." },
                      statement: { type: "string" },
                      type: {
                        type: "string",
                        enum: [
                          "pain_point",
                          "preference",
                          "behavior",
                          "motivation",
                          "counter_experience",
                        ],
                      },
                      evidence: {
                        type: "object",
                        properties: {
                          quote: { type: "string" },
                          source: { type: "string" },
                          reference: { type: "string" },
                        },
                        required: ["quote", "source"],
                      },
                    },
                    required: ["id", "statement", "type", "evidence"],
                  },
                },
                claim_relationships: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      claim_id: { type: "string" },
                      supports_hypothesis: { type: "boolean" },
                      contradicts_hypothesis: { type: "boolean" },
                      contradicts_claims: { type: "array", items: { type: "string" } },
                      explanation: { type: "string" },
                    },
                    required: [
                      "claim_id",
                      "supports_hypothesis",
                      "contradicts_hypothesis",
                      "contradicts_claims",
                      "explanation",
                    ],
                  },
                },
                conflict_clusters: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      theme: { type: "string" },
                      supporting_claims: { type: "array", items: { type: "string" } },
                      opposing_claims: { type: "array", items: { type: "string" } },
                      insight: { type: "string" },
                    },
                    required: ["theme", "supporting_claims", "opposing_claims", "insight"],
                  },
                },
                evaluation: {
                  type: "object",
                  properties: {
                    verdict: { type: "string", enum: ["Supported", "Rejected", "Inconclusive"] },
                    supporting_claims: { type: "array", items: { type: "string" } },
                    contradicting_claims: { type: "array", items: { type: "string" } },
                    neutral_claims: { type: "array", items: { type: "string" } },
                    reasoning: { type: "string" },
                    missing_evidence: { type: "array", items: { type: "string" } },
                    conflicting_signals: { type: "array", items: { type: "string" } },
                  },
                  required: [
                    "verdict",
                    "supporting_claims",
                    "contradicting_claims",
                    "neutral_claims",
                    "reasoning",
                    "missing_evidence",
                    "conflicting_signals",
                  ],
                },
                decision: {
                  type: "object",
                  properties: {
                    recommended_action: { type: "string" },
                    reasoning: { type: "string" },
                    affected_segments: { type: "array", items: { type: "string" } },
                    risks: { type: "array", items: { type: "string" } },
                  },
                  required: ["recommended_action", "reasoning", "affected_segments", "risks"],
                },
                verification: {
                  type: "object",
                  properties: {
                    evidence_traceability: { type: "string" },
                    unsupported_claims: { type: "array", items: { type: "string" } },
                    contradictions_preserved: { type: "string", enum: ["Yes", "No"] },
                    notes: { type: "string" },
                  },
                  required: [
                    "evidence_traceability",
                    "unsupported_claims",
                    "contradictions_preserved",
                    "notes",
                  ],
                },
              },
              required: [
                "hypothesis",
                "claims",
                "claim_relationships",
                "conflict_clusters",
                "evaluation",
                "decision",
                "verification",
              ],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "emit_analysis" } },
    };

    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (res.status === 429) throw new Error("Rate limit reached. Please wait and retry.");
    if (res.status === 402)
      throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
    if (!res.ok) {
      const txt = await res.text();
      console.error("AI gateway error", res.status, txt);
      throw new Error("AI analysis failed.");
    }

    const json = await res.json();
    const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("Invalid AI response shape.");
    const parsed = JSON.parse(toolCall.function.arguments) as Omit<AnalysisReport, "generated_at">;

    const report: AnalysisReport = {
      ...parsed,
      hypothesis: parsed.hypothesis || ctx.hypothesis || "None provided",
      generated_at: new Date().toISOString(),
    };

    const { error: updErr } = await sb
      .from("interview_contexts")
      .update({ analysis: report as unknown as Database["public"]["Tables"]["interview_contexts"]["Row"]["analysis"] })
      .eq("id", data.contextId);
    if (updErr) throw new Error(updErr.message);

    return { analysis: report };
  });
