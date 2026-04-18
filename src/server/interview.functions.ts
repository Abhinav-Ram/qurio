import { createServerFn } from "@tanstack/react-start";
import type { AnalysisResult, InterviewQuestion, QuestionAnswer } from "@/lib/interview";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

function getApiKey(): string {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  return key;
}

interface GenerateInput {
  context: string;
  hypothesis: string;
}

export const generateQuestions = createServerFn({ method: "POST" })
  .inputValidator((data: GenerateInput) => {
    if (!data?.context || data.context.trim().length < 5) {
      throw new Error("Interview context is required (min 5 characters).");
    }
    return {
      context: data.context.slice(0, 4000),
      hypothesis: (data.hypothesis ?? "").slice(0, 1000),
    };
  })
  .handler(async ({ data }) => {
    const systemPrompt = `You are a senior qualitative research strategist designing interview question sets for hypothesis validation.

Generate 5–8 structured, OPEN-ENDED interview questions grounded in the supplied context.
Each question must:
- Probe for behavior or evidence (not opinions or hypotheticals)
- Avoid leading wording — never bias toward the hypothesis
- Have a clear "vector" label (the dimension it investigates, max 3 words)
- Include 2–3 short, contingent follow-up questions to dig deeper

Return ONLY a tool call. No prose.`;

    const userPrompt = `INTERVIEW CONTEXT:
${data.context}

${data.hypothesis ? `HYPOTHESIS UNDER TEST:\n${data.hypothesis}` : "NO EXPLICIT HYPOTHESIS — design exploratory questions."}`;

    const body = {
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "emit_questions",
            description: "Return the structured interview question set.",
            parameters: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  minItems: 5,
                  maxItems: 8,
                  items: {
                    type: "object",
                    properties: {
                      vector: { type: "string" },
                      text: { type: "string" },
                      followUps: {
                        type: "array",
                        minItems: 2,
                        maxItems: 3,
                        items: { type: "string" },
                      },
                    },
                    required: ["vector", "text", "followUps"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["questions"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "emit_questions" } },
    };

    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (res.status === 429) throw new Error("Rate limit reached. Please wait a moment and retry.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
    if (!res.ok) {
      const txt = await res.text();
      console.error("AI gateway error", res.status, txt);
      throw new Error("AI generation failed. Please try again.");
    }

    const json = await res.json();
    const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("Invalid AI response shape.");
    const parsed = JSON.parse(toolCall.function.arguments) as {
      questions: { vector: string; text: string; followUps: string[] }[];
    };

    const questions: InterviewQuestion[] = parsed.questions.map((q, i) => ({
      id: `PRB-${String(i + 1).padStart(3, "0")}`,
      vector: q.vector,
      text: q.text,
      followUps: q.followUps,
    }));

    return { questions };
  });

interface AnalyzeInput {
  context: string;
  hypothesis: string;
  answers: QuestionAnswer[];
}

export const analyzeEvidence = createServerFn({ method: "POST" })
  .inputValidator((data: AnalyzeInput) => {
    if (!data?.hypothesis || data.hypothesis.trim().length < 5) {
      throw new Error("A hypothesis is required to analyze evidence.");
    }
    const filled = (data.answers ?? []).filter((a) => a.answer?.trim().length > 0);
    if (filled.length === 0) throw new Error("At least one answer must be filled in.");
    return {
      context: (data.context ?? "").slice(0, 4000),
      hypothesis: data.hypothesis.slice(0, 1000),
      answers: filled.map((a) => ({
        questionId: a.questionId,
        question: a.question.slice(0, 1000),
        answer: a.answer.slice(0, 4000),
      })),
    };
  })
  .handler(async ({ data }) => {
    const systemPrompt = `You are a rigorous qualitative evidence analyst.

Your job: extract ATOMIC CLAIMS from interview answers and classify each one strictly relative to the stated hypothesis.

RULES:
- An atomic claim is a single factual or behavioral assertion the respondent made.
- For EACH claim, you MUST include the verbatim "quote" copied from the user's answer (no paraphrasing).
- Tie each claim to the questionId it came from.
- Classify each claim as exactly one of:
  • "supports"     — direct evidence FOR the hypothesis
  • "contradicts"  — direct evidence AGAINST the hypothesis
  • "neutral"      — relevant context but doesn't move the needle
- Be conservative. Tangential opinions = neutral. Only label support/contradict when the quote clearly does so.
- Then issue a final verdict:
  • "supported"     — claims meaningfully support and contradicting evidence is weak
  • "rejected"      — contradicting evidence is meaningful and support is weak
  • "inconclusive"  — mixed, sparse, or insufficient evidence
- Confidence is a 0–100 integer reflecting strength of evidence (not certainty of opinion).

Return ONLY a tool call.`;

    const userPrompt = `CONTEXT:
${data.context || "(none)"}

HYPOTHESIS:
${data.hypothesis}

INTERVIEW TRANSCRIPT:
${data.answers
  .map(
    (a) => `[${a.questionId}] Q: ${a.question}
A: ${a.answer}`,
  )
  .join("\n\n")}`;

    const body = {
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "emit_analysis",
            description: "Return the structured evidence analysis.",
            parameters: {
              type: "object",
              properties: {
                verdict: { type: "string", enum: ["supported", "rejected", "inconclusive"] },
                confidence: { type: "integer", minimum: 0, maximum: 100 },
                rationale: { type: "string" },
                claims: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      claim: { type: "string" },
                      quote: { type: "string" },
                      questionId: { type: "string" },
                      verdict: { type: "string", enum: ["supports", "contradicts", "neutral"] },
                      reasoning: { type: "string" },
                    },
                    required: ["claim", "quote", "questionId", "verdict", "reasoning"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["verdict", "confidence", "rationale", "claims"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "emit_analysis" } },
    };

    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (res.status === 429) throw new Error("Rate limit reached. Please wait a moment and retry.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
    if (!res.ok) {
      const txt = await res.text();
      console.error("AI gateway error", res.status, txt);
      throw new Error("AI analysis failed. Please try again.");
    }

    const json = await res.json();
    const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("Invalid AI response shape.");
    const parsed = JSON.parse(toolCall.function.arguments);

    const questionMap = new Map(data.answers.map((a) => [a.questionId, a.question]));
    const result: AnalysisResult = {
      verdict: parsed.verdict,
      confidence: parsed.confidence,
      rationale: parsed.rationale,
      claims: parsed.claims.map((c: { claim: string; quote: string; questionId: string; verdict: "supports" | "contradicts" | "neutral"; reasoning: string }, i: number) => ({
        id: `CLM-${String(i + 1).padStart(3, "0")}`,
        claim: c.claim,
        quote: c.quote,
        questionId: c.questionId,
        question: questionMap.get(c.questionId) ?? "",
        verdict: c.verdict,
        reasoning: c.reasoning,
      })),
    };

    return result;
  });
