-- Responses for shared interviews
CREATE TABLE public.interview_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  context_id uuid NOT NULL REFERENCES public.interview_contexts(id) ON DELETE CASCADE,
  respondent_name text NOT NULL DEFAULT '',
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_interview_responses_context ON public.interview_responses(context_id, submitted_at DESC);

ALTER TABLE public.interview_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can insert responses" ON public.interview_responses
  FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "anyone can read responses" ON public.interview_responses
  FOR SELECT TO public USING (true);
CREATE POLICY "anyone can delete responses" ON public.interview_responses
  FOR DELETE TO public USING (true);

-- Ensure share_slug is unique so /i/:slug lookups are safe
CREATE UNIQUE INDEX IF NOT EXISTS uniq_interview_contexts_share_slug
  ON public.interview_contexts(share_slug)
  WHERE share_slug IS NOT NULL;