import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

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

interface SubmitInput {
  slug: string;
  respondentName: string;
  answers: { questionId: string; answer: string }[];
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
