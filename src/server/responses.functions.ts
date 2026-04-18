import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { followUpPrompt, AI_GATEWAY_URL, getAIApiKey } from "./prompts";

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

export interface PublicQuestion {
  id: string;
  vector: string;
  text: string;
  follow_ups: string[];
  position: number;
}

export interface PublicInterview {
  contextId: string;
  title: string;
  questions: PublicQuestion[];
}

// Fetch the public-facing interview by share slug (no sensitive data).
export const getInterviewBySlug = createServerFn({ method: "POST" })
  .inputValidator((data: { slug: string }) => {
    if (!data?.slug || typeof data.slug !== "string") throw new Error("slug required");
    return { slug: data.slug.slice(0, 64) };
  })
  .handler(async ({ data }): Promise<PublicInterview> => {
    const sb = getSupabase();
    const { data: ctx, error: ctxErr } = await sb
      .from("interview_contexts")
      .select("id,title")
      .eq("share_slug", data.slug)
      .maybeSingle();
    if (ctxErr) throw new Error(ctxErr.message);
    if (!ctx) throw new Error("Interview not found");

    const { data: qs, error: qErr } = await sb
      .from("interview_questions")
      .select("id,vector,text,follow_ups,position")
      .eq("context_id", ctx.id)
      .order("position", { ascending: true });
    if (qErr) throw new Error(qErr.message);

    return {
      contextId: ctx.id,
      title: ctx.title,
      questions: (qs ?? []).map((q) => ({
        id: q.id,
        vector: q.vector,
        text: q.text,
        position: q.position,
        follow_ups: Array.isArray(q.follow_ups) ? (q.follow_ups as string[]) : [],
      })),
    };
  });

interface AnswerInput {
  questionId: string;
  answer: string;
  followUp?: { question: string; answer: string } | null;
}

interface SubmitInput {
  slug: string;
  respondentName: string;
  answers: AnswerInput[];
}

export const submitInterviewResponse = createServerFn({ method: "POST" })
  .inputValidator((data: SubmitInput) => {
    if (!data?.slug) throw new Error("slug required");
    if (!Array.isArray(data?.answers)) throw new Error("answers required");
    return {
      slug: String(data.slug).slice(0, 64),
      respondentName: String(data.respondentName ?? "").slice(0, 120),
      answers: data.answers.slice(0, 50).map((a) => ({
        questionId: String(a.questionId).slice(0, 64),
        answer: String(a.answer ?? "").slice(0, 5000),
        followUp:
          a.followUp && a.followUp.question
            ? {
                question: String(a.followUp.question).slice(0, 500),
                answer: String(a.followUp.answer ?? "").slice(0, 5000),
              }
            : null,
      })),
    };
  })
  .handler(async ({ data }) => {
    const sb = getSupabase();
    const { data: ctx, error: ctxErr } = await sb
      .from("interview_contexts")
      .select("id")
      .eq("share_slug", data.slug)
      .maybeSingle();
    if (ctxErr) throw new Error(ctxErr.message);
    if (!ctx) throw new Error("Interview not found");

    const { error: insErr } = await sb.from("interview_responses").insert({
      context_id: ctx.id,
      respondent_name: data.respondentName,
      answers: data.answers,
    });
    if (insErr) throw new Error(insErr.message);
    return { ok: true };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Adaptive follow-up: AI looks at the question + prepared follow-ups + the
// respondent's answer and decides whether to ask ONE follow-up (and what).
// ─────────────────────────────────────────────────────────────────────────────
export interface FollowUpDecision {
  needed: boolean;
  question: string | null;
  source: "prepared" | "fresh" | null;
}

export const decideFollowUp = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { question: string; preparedFollowUps: string[]; answer: string }) => {
      if (!data?.question) throw new Error("question required");
      return {
        question: String(data.question).slice(0, 1000),
        preparedFollowUps: Array.isArray(data.preparedFollowUps)
          ? data.preparedFollowUps.slice(0, 5).map((s) => String(s).slice(0, 300))
          : [],
        answer: String(data.answer ?? "").slice(0, 5000),
      };
    },
  )
  .handler(async ({ data }): Promise<FollowUpDecision> => {
    // Trivial guard: empty answer → no follow-up.
    if (!data.answer.trim()) {
      return { needed: false, question: null, source: null };
    }

    const body = {
      model: followUpPrompt.model,
      messages: [
        { role: "system", content: followUpPrompt.system },
        {
          role: "user",
          content: followUpPrompt.user({
            question: data.question,
            preparedFollowUps: data.preparedFollowUps,
            answer: data.answer,
          }),
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "emit_decision",
            description: "Decide whether to ask a single follow-up and what to ask.",
            parameters: {
              type: "object",
              properties: {
                needed: { type: "boolean" },
                source: {
                  type: "string",
                  enum: ["prepared", "fresh", "none"],
                  description: "'prepared' if reusing a pre-generated follow-up, 'fresh' if newly written, 'none' if not needed.",
                },
                question: {
                  type: "string",
                  description: "The follow-up question to ask, or empty string if not needed.",
                },
              },
              required: ["needed", "source", "question"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "emit_decision" } },
    };

    try {
      const res = await fetch(AI_GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getAIApiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        console.error("Follow-up decision failed", res.status, await res.text());
        return { needed: false, question: null, source: null };
      }

      const json = await res.json();
      const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) {
        return { needed: false, question: null, source: null };
      }
      const parsed = JSON.parse(toolCall.function.arguments) as {
        needed: boolean;
        source: "prepared" | "fresh" | "none";
        question: string;
      };

      const q = (parsed.question ?? "").trim();
      if (!parsed.needed || !q) {
        return { needed: false, question: null, source: null };
      }
      return {
        needed: true,
        question: q,
        source: parsed.source === "fresh" ? "fresh" : "prepared",
      };
    } catch (err) {
      console.error("decideFollowUp error", err);
      return { needed: false, question: null, source: null };
    }
  });
