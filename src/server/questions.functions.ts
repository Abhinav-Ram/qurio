import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function getSupabase() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL;
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
const MODEL = "google/gemini-2.5-flash";

function getApiKey(): string {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  return key;
}

interface GenerateInput {
  contextId: string;
}

export const generateQuestionsForContext = createServerFn({ method: "POST" })
  .inputValidator((data: GenerateInput) => {
    if (!data?.contextId || typeof data.contextId !== "string") {
      throw new Error("contextId required");
    }
    return { contextId: data.contextId };
  })
  .handler(async ({ data }) => {
    const { data: ctx, error: ctxErr } = await supabaseAdmin
      .from("interview_contexts")
      .select("id,context,hypothesis")
      .eq("id", data.contextId)
      .maybeSingle();
    if (ctxErr) throw new Error(ctxErr.message);
    if (!ctx) throw new Error("Context not found");

    const systemPrompt = `You are a senior qualitative research strategist designing interview question sets.

Generate 5–8 structured, OPEN-ENDED interview questions grounded in the supplied context.
Each question must:
- Probe for behavior or evidence (not opinions or hypotheticals)
- Avoid leading wording — never bias toward any hypothesis
- Have a clear "vector" label (the dimension it investigates, max 3 words)
- Include 2–3 short, contingent follow-up questions

Return ONLY a tool call.`;

    const userPrompt = `INTERVIEW CONTEXT:
${ctx.context}

${ctx.hypothesis ? `HYPOTHESIS UNDER TEST:\n${ctx.hypothesis}` : "NO EXPLICIT HYPOTHESIS — design exploratory questions."}`;

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
            name: "emit_questions",
            description: "Return the structured interview question set.",
            parameters: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  minItems: 5,
                  maxItems: 8,
                  items: {
                    type: "object",
                    properties: {
                      vector: { type: "string" },
                      text: { type: "string" },
                      followUps: {
                        type: "array",
                        minItems: 2,
                        maxItems: 3,
                        items: { type: "string" },
                      },
                    },
                    required: ["vector", "text", "followUps"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["questions"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "emit_questions" } },
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
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
    if (!res.ok) {
      const txt = await res.text();
      console.error("AI gateway error", res.status, txt);
      throw new Error("AI generation failed.");
    }

    const json = await res.json();
    const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("Invalid AI response shape.");
    const parsed = JSON.parse(toolCall.function.arguments) as {
      questions: { vector: string; text: string; followUps: string[] }[];
    };

    // Replace existing questions for this context
    await supabaseAdmin.from("interview_questions").delete().eq("context_id", data.contextId);

    const rows = parsed.questions.map((q, i) => ({
      context_id: data.contextId,
      vector: q.vector,
      text: q.text,
      follow_ups: q.followUps,
      position: i,
    }));

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("interview_questions")
      .insert(rows)
      .select("id,vector,text,follow_ups,position")
      .order("position", { ascending: true });
    if (insErr) throw new Error(insErr.message);

    return { questions: inserted ?? [] };
  });

interface UpdateQuestionInput {
  id: string;
  vector: string;
  text: string;
  followUps: string[];
}

export const updateQuestion = createServerFn({ method: "POST" })
  .inputValidator((data: UpdateQuestionInput) => {
    if (!data?.id) throw new Error("id required");
    return {
      id: data.id,
      vector: (data.vector ?? "").slice(0, 80),
      text: (data.text ?? "").slice(0, 1000),
      followUps: (data.followUps ?? []).slice(0, 5).map((s) => String(s).slice(0, 300)),
    };
  })
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("interview_questions")
      .update({
        vector: data.vector,
        text: data.text,
        follow_ups: data.followUps,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

function randomSlug(len = 8): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  for (let i = 0; i < len; i++) s += alphabet[bytes[i] % alphabet.length];
  return s;
}

export const ensureShareSlug = createServerFn({ method: "POST" })
  .inputValidator((data: { contextId: string }) => {
    if (!data?.contextId) throw new Error("contextId required");
    return { contextId: data.contextId };
  })
  .handler(async ({ data }) => {
    const { data: existing, error: selErr } = await supabaseAdmin
      .from("interview_contexts")
      .select("share_slug")
      .eq("id", data.contextId)
      .maybeSingle();
    if (selErr) throw new Error(selErr.message);
    if (existing?.share_slug) return { slug: existing.share_slug };

    // Try a few times in the very rare collision case
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = randomSlug(8);
      const { error: updErr } = await supabaseAdmin
        .from("interview_contexts")
        .update({ share_slug: slug })
        .eq("id", data.contextId);
      if (!updErr) return { slug };
      if (!String(updErr.message).toLowerCase().includes("unique")) {
        throw new Error(updErr.message);
      }
    }
    throw new Error("Could not generate unique share slug");
  });
