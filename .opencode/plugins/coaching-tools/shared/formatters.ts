import {
  EXAM_CONFIGS,
  EXAM_LABELS,
  EXAM_TYPE_MAP,
  LEVEL_THRESHOLDS,
  REGION_SPECIAL_SUBJECTS,
  XINGCE_LEAF_TOPICS,
  XINGCE_SUBJECTS,
} from "./constants.js"
import { EXAM_TYPES, type ExamType } from "./types.js"

export function calcLevel(points: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (points >= LEVEL_THRESHOLDS[i]) return i + 1
  }
  return 1
}

export function normalizeExamTypes(raw: string[]): string[] {
  return raw
    .map(type => EXAM_TYPE_MAP[type] || type)
    .filter((type): type is ExamType => (EXAM_TYPES as readonly string[]).includes(type))
}

export function formatExamTypes(types: string[]): string {
  return types.length === 0 ? "未设置" : types.map(type => EXAM_LABELS[type] || type).join(",")
}

export function getValidSubjects(examTypes: string[], region: string | null): string[] {
  const subjects = new Set<string>()

  if (examTypes.length === 0) {
    for (const subject of XINGCE_SUBJECTS) subjects.add(subject)
  } else {
    for (const examType of examTypes) {
      const config = EXAM_CONFIGS[examType as ExamType]
      if (config) {
        for (const subject of config.subjects) subjects.add(subject)
      }
    }
  }

  if (region && REGION_SPECIAL_SUBJECTS[region]) {
    for (const subjectConfig of REGION_SPECIAL_SUBJECTS[region]) {
      subjects.add(subjectConfig.subject)
    }
  }

  return Array.from(subjects)
}

export function getLeafTopics(subject: string, region: string | null): string[] {
  if (XINGCE_LEAF_TOPICS[subject]) return XINGCE_LEAF_TOPICS[subject]

  if (region && REGION_SPECIAL_SUBJECTS[region]) {
    const found = REGION_SPECIAL_SUBJECTS[region].find(subjectConfig => subjectConfig.subject === subject)
    if (found) return found.leafTopics
  }

  return []
}
