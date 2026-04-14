export type QuestionArtifactLayoutType = "text" | "table-heavy" | "mixed"
export type QuestionArtifactConfidence = "high" | "medium" | "low"
export type QuestionArtifactCompleteness = "complete" | "partial" | "insufficient"

export interface QuestionArtifact {
  content: string
  layoutType: QuestionArtifactLayoutType
  confidence: QuestionArtifactConfidence
  completeness: QuestionArtifactCompleteness
  unresolvedRegions: string[]
}

export function isQuestionArtifact(value: unknown): value is QuestionArtifact {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false

  const candidate = value as Record<string, unknown>
  return typeof candidate.content === "string"
    && ["text", "table-heavy", "mixed"].includes(String(candidate.layoutType))
    && ["high", "medium", "low"].includes(String(candidate.confidence))
    && ["complete", "partial", "insufficient"].includes(String(candidate.completeness))
    && Array.isArray(candidate.unresolvedRegions)
    && candidate.unresolvedRegions.every(item => typeof item === "string")
}
