export interface InterviewQuestion {
  id: string;
  text: string;
  vector: string;
  followUps: string[];
}

export interface QuestionAnswer {
  questionId: string;
  question: string;
  answer: string;
}

export type ClaimVerdict = "supports" | "contradicts" | "neutral";

export interface ExtractedClaim {
  id: string;
  claim: string;
  quote: string;
  questionId: string;
  question: string;
  verdict: ClaimVerdict;
  reasoning: string;
}

export type FinalVerdict = "supported" | "rejected" | "inconclusive";

export interface AnalysisResult {
  verdict: FinalVerdict;
  confidence: number;
  rationale: string;
  claims: ExtractedClaim[];
}
