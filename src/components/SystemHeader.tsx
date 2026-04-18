import { useEffect, useState } from "react";

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

interface Props {
  status: "idle" | "drafting" | "interrogating" | "synthesizing" | "complete";
}

const STATUS_LABEL: Record<Props["status"], string> = {
  idle: "STANDBY",
  drafting: "GENERATING PROBES",
  interrogating: "ACTIVE INTERROGATION",
  synthesizing: "SYNTHESIZING EVIDENCE",
  complete: "ANALYSIS LOCKED",
};

const STATUS_COLOR: Record<Props["status"], string> = {
  idle: "text-sys-muted",
  drafting: "text-sys-amber",
  interrogating: "text-sys-amber",
  synthesizing: "text-sys-cyan",
  complete: "text-sys-green",
};

export function SystemHeader({ status }: Props) {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const sessionId = useState(() => {
    const r = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `K-${r}`;
  })[0];

  return (
    <header className="flex items-center justify-between border-b border-sys-grid pb-3 font-mono shrink-0">
      <div className="flex items-center gap-4">
        <div className="bg-sys-cyan text-sys-bg font-semibold px-2 py-0.5 text-xs tracking-widest uppercase">
          Interview.Intel
        </div>
        <div className="text-sys-muted text-xs sm:text-sm">
          OP: <span className="text-sys-text">{sessionId}</span> //{" "}
          <span className="hidden sm:inline">EVIDENCE_VALIDATION</span>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 text-xs">
        <div className="flex items-center gap-2">
          <div
            className={`size-2 rounded-full ${
              status === "idle" ? "bg-sys-muted" : "bg-sys-amber animate-pulse"
            }`}
          />
          <span className={`uppercase tracking-wider ${STATUS_COLOR[status]} hidden md:inline`}>
            {STATUS_LABEL[status]}
          </span>
        </div>
        <div className="text-sys-cyan border border-sys-cyan/30 bg-sys-cyan/10 px-2 py-0.5 tabular-nums">
          REC: {formatDuration(now - start)}
        </div>
      </div>
    </header>
  );
}
