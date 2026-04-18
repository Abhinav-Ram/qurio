import type { AnalysisReport } from "@/server/analysis.functions";
import { generateAnalysis } from "@/server/analysis.functions";

type JobState = {
  promise: Promise<AnalysisReport>;
  startedAt: number;
};

// Module-level map survives component unmounts (tab switches, navigation away & back).
const jobs = new Map<string, JobState>();
const listeners = new Map<string, Set<() => void>>();

function notify(contextId: string) {
  listeners.get(contextId)?.forEach((l) => l());
}

export function isAnalysisRunning(contextId: string): boolean {
  return jobs.has(contextId);
}

export function subscribeAnalysis(contextId: string, listener: () => void): () => void {
  let set = listeners.get(contextId);
  if (!set) {
    set = new Set();
    listeners.set(contextId, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) listeners.delete(contextId);
  };
}

export function startAnalysis(contextId: string): Promise<AnalysisReport> {
  const existing = jobs.get(contextId);
  if (existing) return existing.promise;

  const promise = (async () => {
    try {
      const res = await generateAnalysis({ data: { contextId } });
      return res.analysis;
    } finally {
      jobs.delete(contextId);
      notify(contextId);
    }
  })();

  jobs.set(contextId, { promise, startedAt: Date.now() });
  notify(contextId);
  return promise;
}
