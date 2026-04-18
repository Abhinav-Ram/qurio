import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles, Loader2, RefreshCw, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { AnalysisReport } from "@/server/analysis.functions";
import { analysisReportToMarkdown } from "@/lib/analysis-format";
import { generateAnalysis } from "@/server/analysis.functions";

interface Props {
  contextId: string;
  initial: AnalysisReport | null;
  hasResponses: boolean;
  onGenerated: (a: AnalysisReport) => void;
}

export function AnalysisPanel({ contextId, initial, hasResponses, onGenerated }: Props) {
  const [analysis, setAnalysis] = useState<AnalysisReport | null>(initial);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!hasResponses) {
      toast.error("Need at least one response before analysing.");
      return;
    }
    setLoading(true);
    try {
      const res = await generateAnalysis({ data: { contextId } });
      setAnalysis(res.analysis);
      onGenerated(res.analysis);
      toast.success("Analysis ready");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="border border-dashed border-border rounded-lg p-12 text-center">
        <Loader2 className="size-6 mx-auto animate-spin text-sys-cyan mb-3" />
        <p className="text-sm text-sys-muted font-mono uppercase tracking-widest">
          Synthesising evidence…
        </p>
        <p className="text-xs text-sys-muted mt-2">This can take 20–40 seconds.</p>
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
