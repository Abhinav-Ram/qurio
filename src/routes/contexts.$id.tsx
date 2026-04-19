import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  ArrowLeft,
  Edit2,
  Check,
  X,
  Sparkles,
  Share2,
  Copy,
  Loader2,
  Inbox,
  ListChecks,
  FlaskConical,
} from "lucide-react";
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
  updateQuestion,
  ensureShareSlug,
} from "@/server/questions.functions";
import type { AnalysisReport } from "@/server/analysis.functions";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import {
  isQuestionsRunning,
  startQuestions,
  subscribeQuestions,
} from "@/lib/questions-jobs";

export const Route = createFileRoute("/contexts/$id")({
  beforeLoad: () => {
    if (!isLoggedIn()) throw redirect({ to: "/login" });
  },
  component: ContextWorkspace,
  head: () => ({
    meta: [{ title: "Interview workspace — QURIO" }],
  }),
});

type ContextRow = {
  id: string;
  title: string;
  context: string;
  hypothesis: string;
  share_slug: string | null;
  analysis: AnalysisReport | null;
};

type QuestionRow = {
  id: string;
  vector: string;
  text: string;
  follow_ups: string[];
  position: number;
};

type ResponseRow = {
  id: string;
  respondent_name: string;
  submitted_at: string;
  answers: { questionId: string; answer: string }[];
};

function ContextWorkspace() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const search = Route.useSearch() as { autogen?: string };

  const [ctx, setCtx] = useState<ContextRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const generating = useSyncExternalStore(
    (cb) => subscribeQuestions(id, cb),
    () => isQuestionsRunning(id),
    () => false,
  );
  const [shareOpen, setShareOpen] = useState(false);
  const [shareSlug, setShareSlug] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [tab, setTab] = useState<"questions" | "responses" | "analysis">("questions");
  const [responses, setResponses] = useState<ResponseRow[] | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisReport | null>(null);

  // Load context + existing questions
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [{ data: ctxRow, error: ctxErr }, { data: qRows, error: qErr }] = await Promise.all([
        supabase
          .from("interview_contexts")
          .select("id,title,context,hypothesis,share_slug,analysis")
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
      setCtx(ctxRow as unknown as ContextRow);
      setShareSlug((ctxRow as ContextRow).share_slug);
      setAnalysis(((ctxRow as unknown as ContextRow).analysis as AnalysisReport | null) ?? null);
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

  // Load responses when switching to the responses tab
  useEffect(() => {
    if ((tab !== "responses" && tab !== "analysis") || !ctx) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("interview_responses")
        .select("id,respondent_name,submitted_at,answers")
        .eq("context_id", ctx.id)
        .order("submitted_at", { ascending: false });
      if (!active) return;
      if (error) {
        toast.error(error.message);
        setResponses([]);
        return;
      }
      setResponses(
        (data ?? []).map((r) => ({
          id: r.id,
          respondent_name: r.respondent_name ?? "",
          submitted_at: r.submitted_at,
          answers: Array.isArray(r.answers)
            ? (r.answers as { questionId: string; answer: string }[])
            : [],
        })),
      );
    })();
    return () => {
      active = false;
    };
  }, [tab, ctx]);

  // If a question-generation job is already running when we mount (e.g. user
  // navigated away and back), attach to it so we still receive results.
  useEffect(() => {
    if (!ctx || !isQuestionsRunning(ctx.id)) return;
    let active = true;
    // Re-attach by calling start with a placeholder token — it returns the
    // existing in-flight promise without starting a new one.
    startQuestions(ctx.id, "")
      .then((qs) => {
        if (!active) return;
        setQuestions(qs);
      })
      .catch(() => {
        /* error already toasted by initiator */
      });
    return () => {
      active = false;
    };
  }, [ctx]);

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
    try {
      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess.session?.access_token;
      if (!accessToken) throw new Error("Not authenticated");
      const qs = await startQuestions(ctx.id, accessToken);
      setQuestions(qs);
      toast.success(`Generated ${qs.length} questions`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    }
  }

  async function openShare() {
    if (!ctx) return;
    setShareOpen(true);
    if (shareSlug) return;
    setSharing(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess.session?.access_token;
      if (!accessToken) throw new Error("Not authenticated");
      const res = await ensureShareSlug({ data: { contextId: ctx.id, accessToken } });
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
          <div className="flex items-end justify-between gap-3 flex-wrap mb-4">
            <div>
              <h1 className="text-2xl font-semibold">
                {tab === "questions"
                  ? "Interview questions"
                  : tab === "responses"
                    ? "Responses"
                    : "Analysis"}
              </h1>
              <p className="text-sm text-sys-muted">
                {tab === "questions"
                  ? "Review the AI-generated probes, edit anything, then share with your interviewee."
                  : tab === "responses"
                    ? "Each interviewee's answers, listed in the order the questions were asked."
                    : "Evidence-grounded synthesis of all collected responses."}
              </p>
            </div>
            <div className="flex gap-2">
              {tab === "questions" && questions.length > 0 && !shareSlug && (
                <Button variant="outline" onClick={runGenerate} disabled={generating}>
                  <Sparkles className="size-4" />
                  Regenerate
                </Button>
              )}
              {tab === "questions" && (
                <Button onClick={openShare} disabled={questions.length === 0 || generating}>
                  <Share2 className="size-4" />
                  {shareSlug ? "Share link" : "Save"}
                </Button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-border mb-6 -mx-1">
            <TabButton
              active={tab === "questions"}
              onClick={() => setTab("questions")}
              icon={<ListChecks className="size-3.5" />}
              label="Questions"
              count={questions.length}
            />
            <TabButton
              active={tab === "responses"}
              onClick={() => setTab("responses")}
              icon={<Inbox className="size-3.5" />}
              label="Responses"
              count={responses?.length ?? null}
            />
            <TabButton
              active={tab === "analysis"}
              onClick={() => setTab("analysis")}
              icon={<FlaskConical className="size-3.5" />}
              label="Analysis"
              count={analysis ? 1 : null}
            />
          </div>

          {tab === "questions" ? (
            generating ? (
              <div className="border border-dashed border-border rounded-lg p-12 text-center">
                <Loader2 className="size-6 mx-auto animate-spin text-sys-cyan mb-3" />
                <p className="text-sm text-sys-muted font-mono uppercase tracking-widest">
                  Drafting probe sequence…
                </p>
                <p className="text-xs text-sys-muted mt-2">
                  This can take 10–30 seconds. You can switch tabs — it keeps running.
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
                    locked={!!shareSlug}
                    onSaved={(updated) =>
                      setQuestions((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
                    }
                  />
                ))}
              </ul>
            )
          ) : tab === "responses" ? (
            <ResponsesPanel responses={responses} questions={questions} />
          ) : (
            <AnalysisPanel
              contextId={ctx.id}
              initial={analysis}
              hasResponses={(responses?.length ?? 0) > 0}
              onGenerated={setAnalysis}
            />
          )}
        </main>
      </div>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Short link to interview</DialogTitle>
            <DialogDescription>
              Share this link with the interviewee. Their answers will appear under the
              Responses tab as they submit.
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
  locked,
  onSaved,
}: {
  index: number;
  question: QuestionRow;
  locked?: boolean;
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
      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess.session?.access_token;
      if (!accessToken) throw new Error("Not authenticated");
      await updateQuestion({
        data: {
          id: question.id,
          vector: vector.trim(),
          text: text.trim(),
          followUps: followUps.map((s) => s.trim()).filter(Boolean),
          accessToken,
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
        {locked ? null : !editing ? (
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

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-mono uppercase tracking-widest border-b-2 transition-colors ${
        active
          ? "border-sys-cyan text-sys-text"
          : "border-transparent text-sys-muted hover:text-sys-text"
      }`}
    >
      {icon}
      {label}
      {count !== null && (
        <span className="text-[10px] text-sys-muted">({count})</span>
      )}
    </button>
  );
}

function ResponsesPanel({
  responses,
  questions,
}: {
  responses: ResponseRow[] | null;
  questions: QuestionRow[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const questionMap = useMemo(() => {
    const m = new Map<string, { text: string; index: number }>();
    questions.forEach((q, i) => m.set(q.id, { text: q.text, index: i }));
    return m;
  }, [questions]);

  if (responses === null) {
    return (
      <div className="text-sm text-sys-muted font-mono py-8 text-center">
        Loading responses…
      </div>
    );
  }
  if (responses.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-lg p-10 text-center">
        <Inbox className="size-8 mx-auto text-sys-muted mb-3" />
        <p className="text-sm text-sys-muted">
          No responses yet. Share your link to start collecting answers.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {responses.map((r) => {
        const open = openId === r.id;
        return (
          <li key={r.id} className="bg-card border border-border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenId(open ? null : r.id)}
              className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-card/60 transition-colors"
            >
              <div className="min-w-0">
                <p className="font-semibold truncate">
                  {r.respondent_name || "Anonymous"}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-widest text-sys-muted">
                  {new Date(r.submitted_at).toLocaleString()} · {r.answers.length} answers
                </p>
              </div>
              <span className="text-xs text-sys-cyan font-mono">
                {open ? "− Hide" : "+ View"}
              </span>
            </button>
            {open && (
              <div className="border-t border-border p-4 space-y-4">
                {r.answers.map((a, i) => {
                  const q = questionMap.get(a.questionId);
                  return (
                    <div key={i}>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-sys-muted mb-1">
                        Q.{String((q?.index ?? i) + 1).padStart(2, "0")}
                      </p>
                      <p className="text-sm font-medium mb-1">
                        {q?.text ?? "(question removed)"}
                      </p>
                      <p className="text-sm text-sys-muted whitespace-pre-wrap">
                        {a.answer.trim() || (
                          <span className="italic text-sys-amber">— skipped —</span>
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
