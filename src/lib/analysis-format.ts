import type { AnalysisReport } from "@/lib/analysis.functions";

const TYPE_LABEL: Record<string, string> = {
  pain_point: "Pain point",
  preference: "Preference",
  behavior: "Behavior",
  motivation: "Motivation",
  counter_experience: "Counter-experience",
};

const VERDICT_EMOJI: Record<string, string> = {
  Supported: "✅",
  Rejected: "❌",
  Inconclusive: "⚖️",
};

function bullets(items: string[] | undefined, empty = "_None_"): string {
  if (!items || items.length === 0) return empty;
  return items.map((i) => `- ${i}`).join("\n");
}

function chips(ids: string[] | undefined): string {
  if (!ids || ids.length === 0) return "_none_";
  return ids.map((id) => `\`${id}\``).join(", ");
}

function blockquote(text: string): string {
  return text
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");
}

export function analysisReportToMarkdown(r: AnalysisReport): string {
  const sep = "\n\n---\n\n";
  const out: string[] = [];

  out.push(`# Report`);
  out.push(`**Hypothesis**\n\n${blockquote(r.hypothesis || "None provided")}`);

  // 1. Claims
  out.push(`${sep}## 1. Claim Extraction`);
  if (r.claims.length === 0) {
    out.push("_No claims extracted._");
  } else {
    r.claims.forEach((c) => {
      out.push(
        [
          `### \`${c.id}\` — ${TYPE_LABEL[c.type] ?? c.type}`,
          `${c.statement}`,
          ``,
          `${blockquote(`"${c.evidence.quote}"`)}`,
          ``,
          `**Source:** ${c.evidence.source}${c.evidence.reference ? ` · _${c.evidence.reference}_` : ""}`,
        ].join("\n"),
      );
    });
  }

  // 2. Contradictions
  out.push(`${sep}## 2. Contradiction Mapping`);
  out.push(`### Claim Relationships`);
  if (r.claim_relationships.length === 0) {
    out.push("_No relationships mapped._");
  } else {
    r.claim_relationships.forEach((rel) => {
      const flags: string[] = [];
      if (rel.supports_hypothesis) flags.push("✅ supports hypothesis");
      if (rel.contradicts_hypothesis) flags.push("❌ contradicts hypothesis");
      if (!rel.supports_hypothesis && !rel.contradicts_hypothesis) flags.push("○ neutral");
      out.push(
        [
          `**\`${rel.claim_id}\`** — ${flags.join(" · ")}`,
          rel.contradicts_claims.length > 0
            ? `_Contradicts:_ ${chips(rel.contradicts_claims)}`
            : "",
          rel.explanation,
        ]
          .filter(Boolean)
          .join("\n\n"),
      );
    });
  }

  out.push(`### Conflict Clusters`);
  if (r.conflict_clusters.length === 0) {
    out.push("_No conflict clusters._");
  } else {
    r.conflict_clusters.forEach((cl) => {
      out.push(
        [
          `**Theme:** ${cl.theme}`,
          `- _Supporting:_ ${chips(cl.supporting_claims)}`,
          `- _Opposing:_ ${chips(cl.opposing_claims)}`,
          ``,
          `${cl.insight}`,
        ].join("\n"),
      );
    });
  }

  // 3. Evaluation
  out.push(`${sep}## 3. Hypothesis Evaluation`);
  const ev = r.evaluation;
  out.push(`### Verdict: ${VERDICT_EMOJI[ev.verdict] ?? ""} ${ev.verdict}`);
  out.push(ev.reasoning);
  out.push(
    [
      `**Supporting claims:** ${chips(ev.supporting_claims)}`,
      `**Contradicting claims:** ${chips(ev.contradicting_claims)}`,
      `**Neutral claims:** ${chips(ev.neutral_claims)}`,
    ].join("\n\n"),
  );
  out.push(`**Missing evidence**\n\n${bullets(ev.missing_evidence)}`);
  out.push(`**Conflicting signals**\n\n${bullets(ev.conflicting_signals)}`);

  // 4. Decision
  out.push(`${sep}## 4. Decision Layer`);
  out.push(`### Recommended action\n\n${r.decision.recommended_action}`);
  out.push(`**Reasoning**\n\n${r.decision.reasoning}`);
  out.push(`**Affected segments**\n\n${bullets(r.decision.affected_segments)}`);
  out.push(`**Risks**\n\n${bullets(r.decision.risks)}`);

  // 5. Verification
  out.push(`${sep}## 5. Verification (Evidence Integrity)`);
  out.push(
    [
      `**Evidence traceability:** ${r.verification.evidence_traceability}`,
      `**Contradictions preserved:** ${r.verification.contradictions_preserved}`,
    ].join("\n\n"),
  );
  out.push(`**Unsupported claims**\n\n${bullets(r.verification.unsupported_claims, "_None — all claims have direct evidence._")}`);
  if (r.verification.notes) out.push(`**Notes**\n\n${r.verification.notes}`);

  out.push(`${sep}_Generated ${new Date(r.generated_at).toLocaleString()}_`);

  return out.join("\n\n");
}
