import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ContextPanel } from "@/components/ContextPanel";
import { ProbeSequence } from "@/components/ProbeSequence";
import { SynthesisPanel } from "@/components/SynthesisPanel";
import { SystemHeader } from "@/components/SystemHeader";
import type { AnalysisResult, InterviewQuestion } from "@/lib/interview";
import { analyzeEvidence, generateQuestions } from "@/server/interview.functions";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Interview Intelligence — Evidence-Based Hypothesis Validation" },
      {
        name: "description",
        content:
          "Turn interview transcripts into evidence-grounded verdicts. Generate probes, capture answers, and extract atomic claims that support or contradict your hypothesis.",
      },
      { property: "og:title", content: "Interview Intelligence" },
      {
        property: "og:description",
        content:
          "Evidence-based hypothesis validation from interview transcripts. Every verdict traces back to a verbatim quote.",
      },
    ],
  }),
});

type Phase = "idle" | "drafting" | "interrogating" | "synthesizing" | "complete";

function Index() {
  const [context, setContext] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const phase: Phase =
    analyzing
      ? "synthesizing"
      : result
        ? "complete"
        : loadingQuestions
          ? "drafting"
          : questions.length > 0
            ? "interrogating"
            : "idle";

  const locked = questions.length > 0 || loadingQuestions;

  const handleGenerate = async () => {
    setError(null);
    setLoadingQuestions(true);
    try {
      const out = await generateQuestions({ data: { context, hypothesis } });
      setQuestions(out.questions);
      setAnswers({});
      setResult(null);
      toast.success(`Generated ${out.questions.length} probes`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to generate questions.";
      toast.error(msg);
      setError(msg);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleAnalyze = async () => {
    setError(null);
    setAnalyzing(true);
    setResult(null);
    try {
      const payload = {
        context,
        hypothesis,
        answers: questions.map((q) => ({
          questionId: q.id,
          question: q.text,
          answer: answers[q.id] ?? "",
        })),
      };
      const r = await analyzeEvidence({ data: payload });
      setResult(r);
      toast.success(`Verdict: ${r.verdict.toUpperCase()} (${r.confidence}%)`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Analysis failed.";
      toast.error(msg);
      setError(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleReset = () => {
    setQuestions([]);
    setAnswers({});
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-dvh flex flex-col p-3 md:p-4 gap-3 md:gap-4 max-w-[1800px] mx-auto w-full">
      <SystemHeader status={phase} />

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4 flex-1 min-h-0">
        <div className="lg:col-span-3 min-h-[400px] lg:min-h-0">
          <ContextPanel
            context={context}
            hypothesis={hypothesis}
            setContext={setContext}
            setHypothesis={setHypothesis}
            locked={locked}
            onGenerate={handleGenerate}
            onReset={handleReset}
            loading={loadingQuestions}
          />
        </div>

        <div className="lg:col-span-5 min-h-[500px] lg:min-h-0">
          <ProbeSequence
            questions={questions}
            answers={answers}
            onAnswerChange={(id, v) => setAnswers((prev) => ({ ...prev, [id]: v }))}
            onAnalyze={handleAnalyze}
            analyzing={analyzing}
            hypothesisProvided={hypothesis.trim().length >= 5}
            loadingQuestions={loadingQuestions}
          />
        </div>

        <div className="lg:col-span-4 min-h-[500px] lg:min-h-0">
          <SynthesisPanel result={result} analyzing={analyzing} error={error} />
        </div>
      </main>

      <footer className="font-mono text-[10px] text-sys-muted text-center pt-1 pb-2">
        Interview.Intel — every verdict traceable to a verbatim quote.
      </footer>
    </div>
  );
}
