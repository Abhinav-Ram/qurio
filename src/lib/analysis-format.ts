import type { AnalysisReport } from "@/server/analysis.functions";

export function analysisReportToMarkdown(r: AnalysisReport): string {
  const json = (v: unknown) => "```json\n" + JSON.stringify(v, null, 2) + "\n```";
  const sep = "\n\n---\n\n";

  return [
    `# REPORT`,
    `**HYPOTHESIS:**\n\n> ${r.hypothesis ? r.hypothesis.replace(/\n/g, "\n> ") : "None provided"}`,
    `${sep}## 1. Claim Extraction\n\n**Claims:**\n${json(r.claims)}`,
    `${sep}## 2. Contradiction Mapping\n\n**Claim Relationships:**\n${json(r.claim_relationships)}\n\n**Conflict Clusters:**\n${json(r.conflict_clusters)}`,
    `${sep}## 3. Hypothesis Evaluation\n\n**Evaluation:**\n${json(r.evaluation)}`,
    `${sep}## 4. Decision Layer\n\n**Decision:**\n${json(r.decision)}`,
    `${sep}## 5. Verification (Evidence Integrity)\n\n**Verification:**\n${json(r.verification)}`,
    `${sep}_Generated ${new Date(r.generated_at).toLocaleString()}_`,
  ].join("\n\n");
}
