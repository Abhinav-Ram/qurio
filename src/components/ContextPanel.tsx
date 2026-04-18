interface Props {
  context: string;
  hypothesis: string;
  setContext: (v: string) => void;
  setHypothesis: (v: string) => void;
  locked: boolean;
  onGenerate: () => void;
  onReset: () => void;
  loading: boolean;
}

export function ContextPanel({
  context,
  hypothesis,
  setContext,
  setHypothesis,
  locked,
  onGenerate,
  onReset,
  loading,
}: Props) {
  return (
    <section
      aria-label="Context and hypothesis input"
      className="bg-sys-panel border border-sys-grid flex flex-col h-full overflow-hidden"
    >
      <div className="p-3 border-b border-sys-grid bg-sys-grid/30 flex items-center justify-between font-mono">
        <h2 className="text-xs text-sys-muted uppercase tracking-widest">[01] Context.Hypothesis</h2>
        <span
          className={`text-[10px] px-1 ${
            locked
              ? "text-sys-cyan border border-sys-cyan/40 bg-sys-cyan/10"
              : "text-sys-muted border border-sys-grid"
          }`}
        >
          {locked ? "LOCKED" : "EDITABLE"}
        </span>
      </div>

      <div className="p-4 flex flex-col gap-5 overflow-y-auto flex-1">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="ii-context"
            className="text-[10px] text-sys-muted uppercase tracking-widest font-mono"
          >
            Interview Context
          </label>
          <textarea
            id="ii-context"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            disabled={locked}
            rows={5}
            placeholder="What problem or topic is this interview investigating? Who is the subject?"
            className="bg-sys-bg border border-sys-grid focus:border-sys-cyan focus:ring-1 focus:ring-sys-cyan/40 outline-none p-3 text-sm text-sys-text placeholder:text-sys-muted/70 resize-y font-sans transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="ii-hypothesis"
            className="text-[10px] text-sys-amber uppercase tracking-widest font-mono"
          >
            Hypothesis <span className="text-sys-muted normal-case">(optional for question gen, required for analysis)</span>
          </label>
          <textarea
            id="ii-hypothesis"
            value={hypothesis}
            onChange={(e) => setHypothesis(e.target.value)}
            disabled={locked}
            rows={3}
            placeholder='e.g. "Users churn due to onboarding complexity."'
            className="bg-sys-bg border-l-2 border-sys-amber border-y border-r border-y-sys-grid border-r-sys-grid focus:border-sys-amber focus:ring-1 focus:ring-sys-amber/30 outline-none p-3 text-sm text-sys-text placeholder:text-sys-muted/70 resize-y font-sans transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      <div className="p-3 border-t border-sys-grid bg-sys-grid/20 flex gap-2">
        {!locked ? (
          <button
            type="button"
            onClick={onGenerate}
            disabled={loading || context.trim().length < 5}
            className="flex-1 bg-sys-cyan text-sys-bg font-mono text-xs uppercase tracking-widest font-semibold px-3 py-2 hover:bg-sys-cyan/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Generating..." : "Generate Probes →"}
          </button>
        ) : (
          <button
            type="button"
            onClick={onReset}
            className="flex-1 border border-sys-grid hover:border-sys-amber hover:text-sys-amber font-mono text-xs uppercase tracking-widest px-3 py-2 transition-colors"
          >
            ↺ New Session
          </button>
        )}
      </div>
    </section>
  );
}
