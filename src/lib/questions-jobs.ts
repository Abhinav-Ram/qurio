import { generateQuestionsForContext } from "@/server/questions.functions";

export type GeneratedQuestion = {
  id: string;
  vector: string;
  text: string;
  follow_ups: string[];
  position: number;
};

type JobState = {
  promise: Promise<GeneratedQuestion[]>;
  startedAt: number;
};

// Module-level map survives component unmounts (tab switches, navigation away & back).
const jobs = new Map<string, JobState>();
const listeners = new Map<string, Set<() => void>>();

function notify(contextId: string) {
  listeners.get(contextId)?.forEach((l) => l());
}

export function isQuestionsRunning(contextId: string): boolean {
  return jobs.has(contextId);
}

export function subscribeQuestions(contextId: string, listener: () => void): () => void {
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

export function startQuestions(
  contextId: string,
  accessToken: string,
): Promise<GeneratedQuestion[]> {
  const existing = jobs.get(contextId);
  if (existing) return existing.promise;

  const promise = (async () => {
    try {
      const res = await generateQuestionsForContext({
        data: { contextId, accessToken },
      });
      return (res.questions as GeneratedQuestion[]).map((r) => ({
        ...r,
        follow_ups: Array.isArray(r.follow_ups) ? (r.follow_ups as string[]) : [],
      }));
    } finally {
      jobs.delete(contextId);
      notify(contextId);
    }
  })();

  jobs.set(contextId, { promise, startedAt: Date.now() });
  notify(contextId);
  return promise;
}
