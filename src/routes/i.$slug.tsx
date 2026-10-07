import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CornerDownRight, Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  decideFollowUp,
  getInterviewBySlug,
  submitInterviewResponse,
  type PublicInterview,
} from "@/lib/responses.functions";

export const Route = createFileRoute("/i/$slug")({
  component: InterviewForm,
  head: () => ({
    meta: [{ title: "Interview — please share your perspective" }],
  }),
});

interface MainAnswer {
  answer: string;
  followUp?: {
    question: string;
    answer: string;
    source: "prepared" | "fresh";
  } | null;
  // Cached so we don't re-call the AI on Back/Next bounces unless answer changes.
  decidedFor?: string;
}

function InterviewForm() {
  const { slug } = Route.useParams();
  const [interview, setInterview] = useState<PublicInterview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [answers, setAnswers] = useState<Record<string, MainAnswer>>({});
  // Step model: 0 = name. Then for each question: a "main" sub-step and optional "follow" sub-step. Then review.
  const [step, setStep] = useState(0);
  const [subStep, setSubStep] = useState<"main" | "follow">("main");
  const [deciding, setDeciding] = useState(false);
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
  // Steps: 0 = name, 1..N = questions, N+1 = review
  const totalSteps = totalQuestions + 2;
  const onNameStep = step === 0;
  const onReviewStep = step === totalSteps - 1;
  const currentQuestion = useMemo(
    () => (!onNameStep && !onReviewStep ? interview?.questions[step - 1] : null),
    [interview, step, onNameStep, onReviewStep],
  );
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;

  function setMainAnswer(qid: string, value: string) {
    setAnswers((prev) => {
      const existing = prev[qid];
      // If the main answer changed, drop any cached follow-up — it's stale.
      const followUp = existing?.decidedFor === value ? existing.followUp : null;
      return {
        ...prev,
        [qid]: {
          answer: value,
          followUp,
          decidedFor: existing?.decidedFor === value ? existing.decidedFor : undefined,
        },
      };
    });
  }

  function setFollowUpAnswer(qid: string, value: string) {
    setAnswers((prev) => {
      const existing = prev[qid];
      if (!existing?.followUp) return prev;
      return {
        ...prev,
        [qid]: {
          ...existing,
          followUp: { ...existing.followUp, answer: value },
        },
      };
    });
  }

  async function next() {
    if (onNameStep) {
      if (!name.trim()) {
        toast.error("Please enter your name first");
        return;
      }
      setStep(1);
      setSubStep("main");
      return;
    }

    if (currentQuestion) {
      const a = answers[currentQuestion.id];
      const text = (a?.answer ?? "").trim();

      if (subStep === "main") {
        if (!text) {
          toast.error("Please share at least a brief answer before continuing.");
          return;
        }

        // If we already decided for this exact answer, reuse the decision.
        if (a?.decidedFor === a?.answer && a?.followUp) {
          setSubStep("follow");
          return;
        }
        if (a?.decidedFor === a?.answer && !a?.followUp) {
          advancePastQuestion();
          return;
        }

        // Ask the AI whether a follow-up is warranted.
        setDeciding(true);
        try {
          const decision = await decideFollowUp({
            data: {
              question: currentQuestion.text,
              preparedFollowUps: currentQuestion.follow_ups,
              answer: text,
            },
          });
          if (decision.needed && decision.question && decision.source) {
            const followQuestion = decision.question;
            const followSource: "prepared" | "fresh" = decision.source;
            setAnswers((prev) => ({
              ...prev,
              [currentQuestion.id]: {
                ...(prev[currentQuestion.id] ?? { answer: text }),
                answer: text,
                decidedFor: text,
                followUp: {
                  question: followQuestion,
                  answer: prev[currentQuestion.id]?.followUp?.answer ?? "",
                  source: followSource,
                },
              },
            }));
            setSubStep("follow");
          } else {
            setAnswers((prev) => ({
              ...prev,
              [currentQuestion.id]: {
                ...(prev[currentQuestion.id] ?? { answer: text }),
                answer: text,
                decidedFor: text,
                followUp: null,
              },
            }));
            advancePastQuestion();
          }
        } catch (err) {
          console.error(err);
          // Fail open: if the decision call breaks, just move on.
          advancePastQuestion();
        } finally {
          setDeciding(false);
        }
        return;
      }

      // subStep === "follow" → done with this question (follow-up answer optional)
      advancePastQuestion();
    }
  }

  function advancePastQuestion() {
    setSubStep("main");
    setStep((s) => Math.min(s + 1, totalSteps - 1));
  }

  function prev() {
    if (subStep === "follow") {
      setSubStep("main");
      return;
    }
    setStep((s) => {
      const target = Math.max(s - 1, 0);
      // When stepping back into a question, jump straight to its main view.
      setSubStep("main");
      return target;
    });
  }

  async function submit() {
    if (!interview) return;
    setSubmitting(true);
    try {
      await submitInterviewResponse({
        data: {
          slug,
          respondentName: name.trim(),
          answers: interview.questions.map((q) => {
            const a = answers[q.id];
            return {
              questionId: q.id,
              answer: a?.answer ?? "",
              followUp:
                a?.followUp && a.followUp.question
                  ? { question: a.followUp.question, answer: a.followUp.answer ?? "" }
                  : null,
            };
          }),
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

  // Progress accounts for the optional follow-up sub-step within a question.
  const baseProgress = step / (totalSteps - 1);
  const subProgress = subStep === "follow" ? 0.5 / (totalSteps - 1) : 0;
  const progressPct = Math.min(100, Math.round((baseProgress + subProgress) * 100));

  const onFollowSub = !!currentQuestion && subStep === "follow" && !!currentAnswer?.followUp;

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
              : onFollowSub
                ? `Question ${step} of ${totalQuestions} — follow-up`
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

        {currentQuestion && subStep === "main" && (
          <div className="space-y-4">
            {currentQuestion.vector && (
              <p className="font-mono text-[10px] uppercase tracking-widest text-sys-cyan">
                // {currentQuestion.vector}
              </p>
            )}
            <h2 className="text-2xl font-semibold leading-snug">{currentQuestion.text}</h2>
            <div className="space-y-1 pt-2">
              <Label className="text-[10px] uppercase tracking-widest text-sys-muted">
                Your answer
              </Label>
              <Textarea
                value={currentAnswer?.answer ?? ""}
                onChange={(e) => setMainAnswer(currentQuestion.id, e.target.value)}
                placeholder="Take your time. Specifics and examples are gold."
                className="min-h-[180px]"
                autoFocus
                required
              />
              <p className="text-[11px] text-sys-muted pt-1">
                An answer is required to continue. Based on what you share, we may ask one quick
                follow-up.
              </p>
            </div>
          </div>
        )}

        {onFollowSub && currentQuestion && currentAnswer?.followUp && (
          <div className="space-y-4">
            {/* Recap of the main question + answer for context */}
            <div className="bg-card border border-border rounded-md p-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-sys-muted mb-1">
                You just answered
              </p>
              <p className="text-sm font-medium mb-2">{currentQuestion.text}</p>
              <p className="text-sm text-sys-muted whitespace-pre-wrap line-clamp-4">
                {currentAnswer.answer}
              </p>
            </div>

            {/* Visually distinct follow-up card — amber accent + corner arrow */}
            <div className="relative border-l-4 border-sys-amber bg-sys-amber/5 rounded-r-md p-4 space-y-3">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-sys-amber">
                <CornerDownRight className="size-3.5" />
                <span>Follow-up</span>
                {currentAnswer.followUp.source === "fresh" && (
                  <span className="inline-flex items-center gap-1 text-sys-amber/80 normal-case tracking-normal text-[10px]">
                    <Sparkles className="size-3" /> tailored to your answer
                  </span>
                )}
              </div>
              <h2 className="text-xl font-semibold leading-snug">
                {currentAnswer.followUp.question}
              </h2>
              <div className="space-y-1 pt-1">
                <Label className="text-[10px] uppercase tracking-widest text-sys-muted">
                  Your answer (optional)
                </Label>
                <Textarea
                  value={currentAnswer.followUp.answer ?? ""}
                  onChange={(e) => setFollowUpAnswer(currentQuestion.id, e.target.value)}
                  placeholder="Add detail, an example, or skip and continue."
                  className="min-h-[140px]"
                  autoFocus
                />
              </div>
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
              {interview.questions.map((q, i) => {
                const a = answers[q.id];
                return (
                  <li key={q.id} className="bg-card border border-border rounded-lg p-4">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-sys-muted mb-1">
                      Q.{String(i + 1).padStart(2, "0")}
                    </p>
                    <p className="text-sm font-medium mb-2">{q.text}</p>
                    <p className="text-sm text-sys-muted whitespace-pre-wrap">
                      {a?.answer?.trim() || (
                        <span className="italic text-sys-amber">— skipped —</span>
                      )}
                    </p>
                    {a?.followUp && (
                      <div className="mt-3 border-l-2 border-sys-amber pl-3">
                        <p className="font-mono text-[10px] uppercase tracking-widest text-sys-amber mb-1 flex items-center gap-1">
                          <CornerDownRight className="size-3" /> Follow-up
                        </p>
                        <p className="text-sm font-medium mb-1">{a.followUp.question}</p>
                        <p className="text-sm text-sys-muted whitespace-pre-wrap">
                          {a.followUp.answer?.trim() || (
                            <span className="italic text-sys-muted/70">— no answer —</span>
                          )}
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="flex justify-between gap-3 mt-8">
          <Button
            variant="ghost"
            onClick={prev}
            disabled={(step === 0 && subStep === "main") || submitting || deciding}
          >
            <ArrowLeft className="size-4" /> Back
          </Button>

          {!onReviewStep ? (
            <Button onClick={next} disabled={deciding}>
              {deciding ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Thinking…
                </>
              ) : (
                <>
                  Next <ArrowRight className="size-4" />
                </>
              )}
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
