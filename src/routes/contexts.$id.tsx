import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Edit2, Check, X, Sparkles, Share2, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { isLoggedIn } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  generateQuestionsForContext,
  updateQuestion,
  ensureShareSlug,
} from "@/server/questions.functions";

export const Route = createFileRoute("/contexts/$id")({
  beforeLoad: () => {
    if (!isLoggedIn()) throw redirect({ to: "/login" });
  },
  component: ContextWorkspace,
  head: () => ({
    meta: [{ title: "Interview workspace — Interview Intelligence" }],
  }),
});

type ContextRow = {
  id: string;
  title: string;
  context: string;
  hypothesis: string;
  share_slug: string | null;
};

type QuestionRow = {
  id: string;
  vector: string;
  text: string;
  follow_ups: string[];
  position: number;
};

function ContextWorkspace() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const search = Route.useSearch() as { autogen?: string };

  const [ctx, setCtx] = useState<ContextRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [generating, setGenerating] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareSlug, setShareSlug] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  // Load context + existing questions
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [{ data: ctxRow, error: ctxErr }, { data: qRows, error: qErr }] = await Promise.all([
        supabase
          .from("interview_contexts")
          .select("id,title,context,hypothesis,share_slug")
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("interview_questions")
          .select("id,vector,text,follow_ups,position")
          .eq("context_id", id)
          .order("position", { ascending: true }),
      ]);
      if (!active) return;
      if (ctxErr || !ctxRow) {
        toast.error(ctxErr?.message ?? "Context not found");
        navigate({ to: "/dashboard" });
        return;
      }
      setCtx(ctxRow as ContextRow);
      setShareSlug((ctxRow as ContextRow).share_slug);
      if (qErr) toast.error(qErr.message);
      setQuestions(
        (qRows ?? []).map((r) => ({
          ...r,
          follow_ups: Array.isArray(r.follow_ups) ? (r.follow_ups as string[]) : [],
        })),
      );
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id, navigate]);

  // Auto-generate if redirected here with ?autogen=1 and no questions yet
  useEffect(() => {
    if (loading || generating) return;
    if (search.autogen && questions.length === 0 && ctx) {
      void runGenerate();
      // strip the search param so refresh doesn't regenerate
      navigate({ to: "/contexts/$id", params: { id }, search: {}, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, ctx, search.autogen]);

  async function runGenerate() {
    if (!ctx) return;
    setGenerating(true);
    try {
      const res = await generateQuestionsForContext({ data: { contextId: ctx.id } });
      setQuestions(
        (res.questions as QuestionRow[]).map((r) => ({
          ...r,
          follow_ups: Array.isArray(r.follow_ups) ? (r.follow_ups as string[]) : [],
        })),
      );
      toast.success(`Generated ${res.questions.length} questions`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function openShare() {
    if (!ctx) return;
    setShareOpen(true);
    if (shareSlug) return;
    setSharing(true);
    try {
      const res = await ensureShareSlug({ data: { contextId: ctx.id } });
      setShareSlug(res.slug);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create share link");
      setShareOpen(false);
    } finally {
      setSharing(false);
    }
  }

  const shareUrl =
    shareSlug && typeof window !== "undefined" ? `${window.location.origin}/i/${shareSlug}` : "";

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center text-sm text-sys-muted">
        Loading workspace…
      </div>
    );
  }

  if (!ctx) return null;

  return (
    <div className="min-h-dvh flex flex-col">
      <div className="px-4 md:px-6 pt-4">
        <AppHeader />
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-[320px_1fr] gap-0 border-t border-border">
        {/* Sidebar */}
        <aside className="border-r border-border bg-card/40 p-5 md:sticky md:top-0 md:h-[calc(100dvh-72px)] overflow-y-auto">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 text-xs text-sys-muted hover:text-sys-text mb-4"
          >
            <ArrowLeft className="size-3" /> Dashboard
          </Link>

          <p className="font-mono text-[10px] uppercase tracking-widest text-sys-muted">Title</p>
          <h2 className="text-lg font-semibold mb-4 break-words">{ctx.title}</h2>

          <p className="font-mono text-[10px] uppercase tracking-widest text-sys-muted">Context</p>
          <p className="text-sm whitespace-pre-wrap leading-relaxed mb-4 text-sys-text/90">
            {ctx.context || <span className="text-sys-muted italic">None</span>}
          </p>

          <p className="font-mono text-[10px] uppercase tracking-widest text-sys-muted">
            Hypothesis
          </p>
          <p className="text-sm whitespace-pre-wrap leading-relaxed text-sys-cyan/90">
            {ctx.hypothesis || <span className="text-sys-muted italic">None</span>}
          </p>
        </aside>

        {/* Main */}
        <main className="p-5 md:p-8 max-w-3xl w-full mx-auto">
          <div className="flex items-end justify-between gap-3 flex-wrap mb-6">
            <div>
              <h1 className="text-2xl font-semibold">Interview questions</h1>
              <p className="text-sm text-sys-muted">
                Review the AI-generated probes, edit anything, then share with your interviewee.
              </p>
            </div>
            <div className="flex gap-2">
              {questions.length > 0 && (
                <Button variant="outline" onClick={runGenerate} disabled={generating}>
                  <Sparkles className="size-4" />
                  Regenerate
                </Button>
              )}
              <Button onClick={openShare} disabled={questions.length === 0 || generating}>
                <Share2 className="size-4" />
                Save & share
              </Button>
            </div>
          </div>

          {generating ? (
            <div className="border border-dashed border-border rounded-lg p-12 text-center">
              <Loader2 className="size-6 mx-auto animate-spin text-sys-cyan mb-3" />
              <p className="text-sm text-sys-muted font-mono uppercase tracking-widest">
                Drafting probe sequence…
              </p>
            </div>
          ) : questions.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg p-10 text-center">
              <p className="text-sm text-sys-muted mb-4">No questions yet.</p>
              <Button onClick={runGenerate}>
                <Sparkles className="size-4" />
                Generate questions
              </Button>
            </div>
          ) : (
            <ul className="space-y-4">
              {questions.map((q, idx) => (
                <QuestionCard
                  key={q.id}
                  index={idx}
                  question={q}
                  onSaved={(updated) =>
                    setQuestions((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
                  }
                />
              ))}
            </ul>
          )}
        </main>
      </div>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Short link to interview</DialogTitle>
            <DialogDescription>
              Share this link with the interviewee. The form for them is coming next.
            </DialogDescription>
          </DialogHeader>

          {sharing || !shareUrl ? (
            <div className="flex items-center gap-2 text-sm text-sys-muted py-4">
              <Loader2 className="size-4 animate-spin" /> Generating link…
            </div>
          ) : (
            <div className="flex gap-2">
              <Input readOnly value={shareUrl} className="font-mono text-sm" />
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(shareUrl);
                  toast.success("Link copied");
                }}
              >
                <Copy className="size-4" /> Copy
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuestionCard({
  index,
  question,
  onSaved,
}: {
  index: number;
  question: QuestionRow;
  onSaved: (q: QuestionRow) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [vector, setVector] = useState(question.vector);
  const [text, setText] = useState(question.text);
  const [followUps, setFollowUps] = useState<string[]>(question.follow_ups);
  const [saving, setSaving] = useState(false);

  function reset() {
    setVector(question.vector);
    setText(question.text);
    setFollowUps(question.follow_ups);
    setEditing(false);
  }

  async function save() {
    setSaving(true);
    try {
      await updateQuestion({
        data: {
          id: question.id,
          vector: vector.trim(),
          text: text.trim(),
          followUps: followUps.map((s) => s.trim()).filter(Boolean),
        },
      });
      onSaved({
        ...question,
        vector: vector.trim(),
        text: text.trim(),
        follow_ups: followUps.map((s) => s.trim()).filter(Boolean),
      });
      setEditing(false);
      toast.success("Question updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-sys-muted">
          <span>Q.{String(index + 1).padStart(2, "0")}</span>
          {!editing && question.vector && (
            <span className="text-sys-cyan">// {question.vector}</span>
          )}
        </div>
        {!editing ? (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <Edit2 className="size-3" /> Edit
          </Button>
        ) : (
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={reset} disabled={saving}>
              <X className="size-3" /> Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={saving || !text.trim()}>
              <Check className="size-3" /> {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        )}
      </div>

      {!editing ? (
        <>
          <p className="text-sm leading-relaxed mb-3">{question.text}</p>
          {question.follow_ups.length > 0 && (
            <ul className="space-y-1 pl-4 border-l border-border">
              {question.follow_ups.map((fu, i) => (
                <li
                  key={i}
                  className="text-xs text-sys-muted leading-relaxed font-mono before:content-['↳'] before:text-sys-amber before:mr-2"
                >
                  {fu}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-widest text-sys-muted">
              Vector (theme)
            </Label>
            <Input value={vector} onChange={(e) => setVector(e.target.value)} maxLength={80} />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-widest text-sys-muted">Question</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-[90px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-widest text-sys-muted">
              Follow-up probes
            </Label>
            {followUps.map((fu, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={fu}
                  onChange={(e) =>
                    setFollowUps((prev) => prev.map((p, idx) => (idx === i ? e.target.value : p)))
                  }
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setFollowUps((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <X className="size-3" />
                </Button>
              </div>
            ))}
            {followUps.length < 5 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setFollowUps((prev) => [...prev, ""])}
              >
                + Add follow-up
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
