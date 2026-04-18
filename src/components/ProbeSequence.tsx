import type { InterviewQuestion } from "@/lib/interview";

interface Props {
  questions: InterviewQuestion[];
  answers: Record<string, string>;
  onAnswerChange: (questionId: string, value: string) => void;
  onAnalyze: () => void;
  analyzing: boolean;
  hypothesisProvided: boolean;
  loadingQuestions: boolean;
}

export function ProbeSequence({
  questions,
  answers,
  onAnswerChange,
  onAnalyze,
  analyzing,
  hypothesisProvided,
  loadingQuestions,
}: Props) {
  const filledCount = questions.filter((q) => (answers[q.id] ?? "").trim().length > 0).length;
  const canAnalyze = hypothesisProvided && filledCount > 0 && !analyzing;

  return (
    <section
      aria-label="Probe sequence"
      className="bg-sys-panel border border-sys-grid flex flex-col h-full overflow-hidden"
    >
      <div className="p-3 border-b border-sys-grid bg-sys-grid/30 flex items-center justify-between font-mono">
        <h2 className="text-xs text-sys-amber uppercase tracking-widest">[02] Probe.Sequence</h2>
        <span className="text-[10px] text-sys-muted tabular-nums">
          {filledCount}/{questions.length} CAPTURED
        </span>
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        {loadingQuestions ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-sys-muted font-mono text-xs">
            <div className="flex gap-1">
              <span className="size-2 bg-sys-amber animate-pulse" />
              <span className="size-2 bg-sys-amber animate-pulse [animation-delay:120ms]" />
              <span className="size-2 bg-sys-amber animate-pulse [animation-delay:240ms]" />
            </div>
            <p className="uppercase tracking-widest">Drafting probe sequence…</p>
          </div>
        ) : questions.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-4">
            {questions.map((q, idx) => (
              <ProbeCard
                key={q.id}
                index={idx}
                question={q}
                value={answers[q.id] ?? ""}
                onChange={(v) => onAnswerChange(q.id, v)}
              />
            ))}
          </div>
        )}
      </div>

      {questions.length > 0 && (
        <div className="p-3 border-t border-sys-grid bg-sys-grid/20 flex flex-col gap-2">
          {!hypothesisProvided && (
            <p className="text-[10px] text-sys-amber font-mono uppercase tracking-wider">
              ⚠ Add a hypothesis above to enable analysis.
            </p>
          )}
          <button
            type="button"
            onClick={onAnalyze}
            disabled={!canAnalyze}
            className="w-full bg-sys-amber text-sys-bg font-mono text-xs uppercase tracking-widest font-semibold px-3 py-2 hover:bg-sys-amber/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {analyzing ? "Synthesizing evidence..." : "▶ Analyze Evidence"}
          </button>
        </div>
      )}
    </section>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center font-mono text-xs text-sys-muted gap-3 px-6">
      <div className="text-sys-cyan text-3xl">⌖</div>
      <p className="uppercase tracking-widest text-sys-text">Awaiting Context</p>
      <p className="leading-relaxed normal-case max-w-xs">
        Provide an interview context on the left and generate a probe sequence to begin gathering evidence.
      </p>
    </div>
  );
}

function ProbeCard({
  index,
  question,
  value,
  onChange,
}: {
  index: number;
  question: InterviewQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  const captured = value.trim().length > 0;
  return (
    <article
      className={`border bg-sys-bg p-3 transition-colors ${
        captured ? "border-sys-cyan/50" : "border-sys-grid hover:border-sys-grid/80"
      }`}
    >
      <header className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest">
          <span className="text-sys-muted">{question.id}</span>
          <span className="text-sys-cyan">// {question.vector}</span>
        </div>
        <span
          className={`font-mono text-[10px] px-1.5 py-0.5 border ${
            captured
              ? "text-sys-cyan border-sys-cyan/40 bg-sys-cyan/10"
              : "text-sys-muted border-sys-grid"
          }`}
        >
          {captured ? "CAPTURED" : `Q.${String(index + 1).padStart(2, "0")}`}
        </span>
      </header>

      <p className="text-sm text-sys-text mb-3 leading-relaxed">{question.text}</p>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder="Record subject's verbatim response..."
        className="w-full bg-sys-panel border-l-2 border-sys-cyan border-y border-r border-y-sys-grid border-r-sys-grid focus:border-sys-cyan focus:ring-1 focus:ring-sys-cyan/30 outline-none p-3 text-sm text-sys-text placeholder:text-sys-muted/60 resize-y font-mono transition-colors"
      />

      {question.followUps.length > 0 && (
        <details className="mt-2 group">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-sys-muted hover:text-sys-amber transition-colors list-none flex items-center gap-2">
            <span className="group-open:rotate-90 transition-transform inline-block">▸</span>
            Follow-up probes ({question.followUps.length})
          </summary>
          <ul className="mt-2 space-y-1.5 pl-4 border-l border-sys-grid">
            {question.followUps.map((fu, i) => (
              <li
                key={i}
                className="text-xs text-sys-muted leading-relaxed font-mono before:content-['↳'] before:text-sys-amber before:mr-2"
              >
                {fu}
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}
