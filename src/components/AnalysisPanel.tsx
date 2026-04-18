import { useEffect, useState, useSyncExternalStore } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles, Loader2, RefreshCw, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { AnalysisReport } from "@/server/analysis.functions";
import { analysisReportToMarkdown } from "@/lib/analysis-format";
import {
  isAnalysisRunning,
  startAnalysis,
  subscribeAnalysis,
} from "@/lib/analysis-jobs";

interface Props {
  contextId: string;
  initial: AnalysisReport | null;
  hasResponses: boolean;
  onGenerated: (a: AnalysisReport) => void;
}

export function AnalysisPanel({ contextId, initial, hasResponses, onGenerated }: Props) {
  const [analysis, setAnalysis] = useState<AnalysisReport | null>(initial);

  // Subscribe to the global job store so we reflect background runs started
  // before this component mounted (e.g. user switched tabs while generating).
  const loading = useSyncExternalStore(
    (cb) => subscribeAnalysis(contextId, cb),
    () => isAnalysisRunning(contextId),
    () => false,
  );

  // If a job is already in flight when we mount, attach to it so we still get
  // the result (and toast) when it resolves.
  useEffect(() => {
    if (!isAnalysisRunning(contextId)) return;
    let active = true;
    // Re-subscribe to result by starting (returns the existing promise).
    startAnalysis(contextId)
      .then((res) => {
        if (!active) return;
        setAnalysis(res);
        onGenerated(res);
      })
      .catch(() => {
        /* error already toasted by initiator */
      });
    return () => {
      active = false;
    };
  }, [contextId, onGenerated]);

  async function run() {
    if (!hasResponses) {
      toast.error("Need at least one response before analysing.");
      return;
    }
    try {
      const res = await startAnalysis(contextId);
      setAnalysis(res);
      onGenerated(res);
      toast.success("Analysis ready");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed");
    }
  }

  if (loading) {
    return (
      <div className="border border-dashed border-border rounded-lg p-12 text-center">
        <Loader2 className="size-6 mx-auto animate-spin text-sys-cyan mb-3" />
        <p className="text-sm text-sys-muted font-mono uppercase tracking-widest">
          Synthesising evidence…
        </p>
        <p className="text-xs text-sys-muted mt-2">
          This can take 20–40 seconds. You can switch tabs — it keeps running.
        </p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="border border-dashed border-border rounded-lg p-10 text-center">
        <FlaskConical className="size-8 mx-auto text-sys-muted mb-3" />
        <p className="text-sm text-sys-muted mb-4">No analysis yet.</p>
        <Button onClick={run} disabled={!hasResponses}>
          <Sparkles className="size-4" />
          Create analysis
        </Button>
        {!hasResponses && (
          <p className="text-xs text-sys-muted mt-3">Collect at least one response first.</p>
        )}
      </div>
    );
  }

  const md = analysisReportToMarkdown(analysis);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={run} disabled={loading}>
          <RefreshCw className="size-4" />
          Regenerate
        </Button>
      </div>
      <article className="prose-analysis bg-card border border-border rounded-lg p-6">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
      </article>
    </div>
  );
}
