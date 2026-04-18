import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getInterviewBySlug,
  submitInterviewResponse,
  type PublicInterview,
} from "@/server/responses.functions";

export const Route = createFileRoute("/i/$slug")({
  component: InterviewForm,
  head: () => ({
    meta: [{ title: "Interview — please share your perspective" }],
  }),
});

function InterviewForm() {
  const { slug } = Route.useParams();
  const [interview, setInterview] = useState<PublicInterview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0); // 0 = name, then 1..N for questions, then N+1 = review
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await getInterviewBySlug({ data: { slug } });
        if (!active) return;
        setInterview(res);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Could not load interview");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  const totalQuestions = interview?.questions.length ?? 0;
  const totalSteps = totalQuestions + 2; // name + questions + review
  const onNameStep = step === 0;
  const onReviewStep = step === totalSteps - 1;
  const currentQuestion = useMemo(
    () => (!onNameStep && !onReviewStep ? interview?.questions[step - 1] : null),
    [interview, step, onNameStep, onReviewStep],
  );

  function next() {
    if (onNameStep && !name.trim()) {
      toast.error("Please enter your name first");
      return;
    }
    setStep((s) => Math.min(s + 1, totalSteps - 1));
  }
  function prev() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function submit() {
    if (!interview) return;
    setSubmitting(true);
    try {
      await submitInterviewResponse({
        data: {
          slug,
          respondentName: name.trim(),
          answers: interview.questions.map((q) => ({
            questionId: q.id,
            answer: answers[q.id] ?? "",
          })),
        },
      });
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center text-sm text-sys-muted">
        <Loader2 className="size-4 animate-spin mr-2" /> Loading interview…
      </div>
    );
  }

  if (error || !interview) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold mb-2">Interview unavailable</h1>
          <p className="text-sm text-sys-muted">{error ?? "This link is invalid or expired."}</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6">
        <div className="max-w-md text-center bg-card border border-border rounded-lg p-8">
          <div className="size-12 rounded-full bg-sys-cyan/10 text-sys-cyan flex items-center justify-center mx-auto mb-4">
            <Check className="size-6" />
          </div>
          <h1 className="text-xl font-semibold mb-2">Thank you</h1>
          <p className="text-sm text-sys-muted">
            Your responses have been recorded. You can close this tab.
          </p>
        </div>
      </div>
    );
  }

  if (totalQuestions === 0) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6">
        <p className="text-sm text-sys-muted">This interview has no questions yet.</p>
      </div>
    );
  }

  const progressPct = Math.round((step / (totalSteps - 1)) * 100);

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="border-b border-border px-5 py-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-sys-muted">Interview</p>
        <h1 className="text-base font-semibold truncate">{interview.title}</h1>
      </header>

      {/* progress */}
      <div className="h-1 bg-border">
        <div
          className="h-full bg-sys-cyan transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <main className="flex-1 max-w-2xl w-full mx-auto p-5 md:p-8">
        <p className="font-mono text-[10px] uppercase tracking-widest text-sys-muted mb-3">
          {onNameStep
            ? "Step 1 — about you"
            : onReviewStep
              ? `Review — ${totalQuestions} answers`
              : `Question ${step} of ${totalQuestions}`}
        </p>

        {onNameStep && (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold leading-snug">What's your name?</h2>
            <p className="text-sm text-sys-muted">
              We'll attach this to your responses so the team knows who said what.
            </p>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              maxLength={120}
              onKeyDown={(e) => {
                if (e.key === "Enter") next();
              }}
            />
          </div>
        )}

        {currentQuestion && (
          <div className="space-y-4">
            {currentQuestion.vector && (
              <p className="font-mono text-[10px] uppercase tracking-widest text-sys-cyan">
                // {currentQuestion.vector}
              </p>
            )}
            <h2 className="text-2xl font-semibold leading-snug">{currentQuestion.text}</h2>
            {currentQuestion.follow_ups.length > 0 && (
              <ul className="space-y-1 pl-4 border-l border-border">
                {currentQuestion.follow_ups.map((fu, i) => (
                  <li
                    key={i}
                    className="text-xs text-sys-muted leading-relaxed font-mono before:content-['↳'] before:text-sys-amber before:mr-2"
                  >
                    {fu}
                  </li>
                ))}
              </ul>
            )}
            <div className="space-y-1 pt-2">
              <Label className="text-[10px] uppercase tracking-widest text-sys-muted">
                Your answer
              </Label>
              <Textarea
                value={answers[currentQuestion.id] ?? ""}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [currentQuestion.id]: e.target.value }))
                }
                placeholder="Take your time. Specifics and examples are gold."
                className="min-h-[180px]"
                autoFocus
              />
            </div>
          </div>
        )}

        {onReviewStep && (
          <div className="space-y-5">
            <h2 className="text-2xl font-semibold leading-snug">Review your answers</h2>
            <p className="text-sm text-sys-muted">
              Edit anything by clicking back, then submit when you're ready.
            </p>
            <ul className="space-y-4">
              {interview.questions.map((q, i) => (
                <li key={q.id} className="bg-card border border-border rounded-lg p-4">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-sys-muted mb-1">
                    Q.{String(i + 1).padStart(2, "0")}
                  </p>
                  <p className="text-sm font-medium mb-2">{q.text}</p>
                  <p className="text-sm text-sys-muted whitespace-pre-wrap">
                    {answers[q.id]?.trim() || (
                      <span className="italic text-sys-amber">— skipped —</span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-between gap-3 mt-8">
          <Button variant="ghost" onClick={prev} disabled={step === 0 || submitting}>
            <ArrowLeft className="size-4" /> Back
          </Button>

          {!onReviewStep ? (
            <Button onClick={next}>
              Next <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={submitting}>
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {submitting ? "Submitting…" : "Submit responses"}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
