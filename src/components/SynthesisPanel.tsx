import type { AnalysisResult, ClaimVerdict, FinalVerdict } from "@/lib/interview";

interface Props {
  result: AnalysisResult | null;
  analyzing: boolean;
  error: string | null;
}

const VERDICT_CONFIG: Record<
  FinalVerdict,
  { label: string; color: string; bg: string; border: string }
> = {
  supported: {
    label: "Hypothesis Supported",
    color: "text-sys-green",
    bg: "bg-sys-green/10",
    border: "border-sys-green/40",
  },
  rejected: {
    label: "Hypothesis Rejected",
    color: "text-sys-red",
    bg: "bg-sys-red/10",
    border: "border-sys-red/40",
  },
  inconclusive: {
    label: "Inconclusive",
    color: "text-sys-amber",
    bg: "bg-sys-amber/10",
    border: "border-sys-amber/40",
  },
};

const CLAIM_CONFIG: Record<
  ClaimVerdict,
  { label: string; color: string; border: string; bg: string; sigil: string }
> = {
  supports: {
    label: "SUPPORTS",
    color: "text-sys-green",
    border: "border-sys-green/50",
    bg: "bg-sys-green/10",
    sigil: "+",
  },
  contradicts: {
    label: "CONTRADICTS",
    color: "text-sys-red",
    border: "border-sys-red/50",
    bg: "bg-sys-red/10",
    sigil: "−",
  },
  neutral: {
    label: "NEUTRAL",
    color: "text-sys-muted",
    border: "border-sys-grid",
    bg: "bg-sys-grid/30",
    sigil: "○",
  },
};

export function SynthesisPanel({ result, analyzing, error }: Props) {
  return (
    <section
      aria-label="Evidence synthesis"
      className="bg-sys-panel border border-sys-cyan/30 flex flex-col h-full overflow-hidden shadow-[inset_0_0_40px_color-mix(in_oklab,var(--color-sys-cyan)_4%,transparent)]"
    >
      <div className="p-3 border-b border-sys-cyan/20 bg-sys-cyan/5 flex items-center justify-between font-mono">
        <h2 className="text-xs text-sys-cyan uppercase tracking-widest">[03] Evidence.Synthesis</h2>
        <span
          className={`text-[10px] px-1 border ${
            result
              ? "text-sys-green border-sys-green/40 bg-sys-green/10"
              : analyzing
                ? "text-sys-amber border-sys-amber/40 bg-sys-amber/10 animate-pulse"
                : "text-sys-muted border-sys-grid"
          }`}
        >
          {result ? "VERDICT LOCKED" : analyzing ? "PROCESSING" : "AWAITING DATA"}
        </span>
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        {error && (
          <div className="border border-sys-red/50 bg-sys-red/10 p-3 mb-4 font-mono text-xs text-sys-red">
            ⚠ {error}
          </div>
        )}

        {!result && !analyzing && !error && <SynthesisEmpty />}
        {analyzing && <SynthesisLoading />}
        {result && <SynthesisResult result={result} />}
      </div>
    </section>
  );
}

function SynthesisEmpty() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center font-mono text-xs text-sys-muted gap-3 px-4">
      <div className="text-sys-cyan text-3xl">∴</div>
      <p className="uppercase tracking-widest text-sys-text">Synthesis Standby</p>
      <p className="leading-relaxed normal-case max-w-xs">
        After capturing answers, run analysis to extract atomic claims and produce a verdict grounded
        in the transcript.
      </p>
    </div>
  );
}

function SynthesisLoading() {
  const lines = [
    "Parsing transcript...",
    "Extracting atomic claims...",
    "Cross-referencing hypothesis...",
    "Computing verdict signal...",
  ];
  return (
    <div className="font-mono text-xs text-sys-muted space-y-2">
      {lines.map((l, i) => (
        <div key={l} className="flex items-center gap-2 animate-pulse" style={{ animationDelay: `${i * 200}ms` }}>
          <span className="text-sys-amber">▸</span>
          <span>{l}</span>
        </div>
      ))}
    </div>
  );
}

function SynthesisResult({ result }: { result: AnalysisResult }) {
  const cfg = VERDICT_CONFIG[result.verdict];
  const supports = result.claims.filter((c) => c.verdict === "supports");
  const contradicts = result.claims.filter((c) => c.verdict === "contradicts");
  const neutrals = result.claims.filter((c) => c.verdict === "neutral");

  return (
    <div className="flex flex-col gap-6">
      {/* Verdict header */}
      <div className={`border ${cfg.border} ${cfg.bg} p-4`}>
        <div className="flex items-end justify-between gap-3 mb-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-sys-muted">
            Final Verdict
          </span>
          <span className={`font-mono text-3xl tabular-nums ${cfg.color}`}>
            {result.confidence}
            <span className="text-base text-sys-muted">%</span>
          </span>
        </div>
        <h3 className={`text-lg font-semibold ${cfg.color}`}>{cfg.label}</h3>
        <p className="text-xs text-sys-text/80 leading-relaxed mt-2">{result.rationale}</p>
        <div className="flex gap-1 mt-3 h-1.5 overflow-hidden bg-sys-bg">
          <div
            className="bg-sys-green h-full"
            style={{
              width: `${result.claims.length === 0 ? 0 : (supports.length / result.claims.length) * 100}%`,
            }}
            title={`${supports.length} supporting`}
          />
          <div
            className="bg-sys-red h-full"
            style={{
              width: `${result.claims.length === 0 ? 0 : (contradicts.length / result.claims.length) * 100}%`,
            }}
            title={`${contradicts.length} contradicting`}
          />
          <div
            className="bg-sys-muted/40 h-full"
            style={{
              width: `${result.claims.length === 0 ? 0 : (neutrals.length / result.claims.length) * 100}%`,
            }}
            title={`${neutrals.length} neutral`}
          />
        </div>
      </div>

      <ClaimGroup title="Supporting Evidence" claims={supports} verdict="supports" />
      <ClaimGroup title="Contradicting Evidence" claims={contradicts} verdict="contradicts" />
      <ClaimGroup title="Neutral / Contextual" claims={neutrals} verdict="neutral" />
    </div>
  );
}

function ClaimGroup({
  title,
  claims,
  verdict,
}: {
  title: string;
  claims: AnalysisResult["claims"];
  verdict: ClaimVerdict;
}) {
  const cfg = CLAIM_CONFIG[verdict];
  return (
    <div>
      <div className="flex items-center justify-between mb-2 font-mono text-[10px] uppercase tracking-widest">
        <span className={cfg.color}>
          {cfg.sigil} {title}
        </span>
        <span className="text-sys-muted tabular-nums">{claims.length}</span>
      </div>
      {claims.length === 0 ? (
        <p className="font-mono text-[10px] text-sys-muted/70 italic uppercase tracking-wider px-1">
          — No claims —
        </p>
      ) : (
        <ul className="space-y-2">
          {claims.map((c) => (
            <li key={c.id} className={`border ${cfg.border} ${cfg.bg} p-3`}>
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <span className="font-mono text-[10px] text-sys-muted">{c.id}</span>
                <span className={`font-mono text-[10px] px-1 border ${cfg.border} ${cfg.color}`}>
                  ← {c.questionId}
                </span>
              </div>
              <p className="text-sm text-sys-text leading-relaxed mb-2">{c.claim}</p>
              <blockquote className="text-xs text-sys-text/80 italic border-l-2 border-sys-cyan pl-3 py-1 bg-sys-bg">
                <span className="text-sys-cyan font-mono not-italic mr-1">"</span>
                {c.quote}
                <span className="text-sys-cyan font-mono not-italic ml-1">"</span>
              </blockquote>
              {c.reasoning && (
                <p className="text-[11px] text-sys-muted mt-2 leading-relaxed">
                  <span className="text-sys-cyan font-mono">sys.note:</span> {c.reasoning}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
