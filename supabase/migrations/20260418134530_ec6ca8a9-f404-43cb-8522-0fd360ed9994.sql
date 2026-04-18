-- Add share_slug to interview_contexts
ALTER TABLE public.interview_contexts
  ADD COLUMN share_slug text UNIQUE;

CREATE INDEX idx_interview_contexts_share_slug ON public.interview_contexts(share_slug);

-- Create interview_questions table
CREATE TABLE public.interview_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  context_id uuid NOT NULL REFERENCES public.interview_contexts(id) ON DELETE CASCADE,
  vector text NOT NULL DEFAULT '',
  text text NOT NULL DEFAULT '',
  follow_ups jsonb NOT NULL DEFAULT '[]'::jsonb,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_interview_questions_context_id ON public.interview_questions(context_id);
CREATE INDEX idx_interview_questions_position ON public.interview_questions(context_id, position);

ALTER TABLE public.interview_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read questions" ON public.interview_questions FOR SELECT USING (true);
CREATE POLICY "anyone can insert questions" ON public.interview_questions FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone can update questions" ON public.interview_questions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "anyone can delete questions" ON public.interview_questions FOR DELETE USING (true);

CREATE TRIGGER set_questions_updated_at
  BEFORE UPDATE ON public.interview_questions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();