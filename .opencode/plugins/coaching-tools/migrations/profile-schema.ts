import { randomUUID } from "crypto"

import { REGIONS } from "../shared/constants.js"
import { normalizeExamTypes } from "../shared/formatters.js"
import type { StudyPlan, UserProfile } from "../shared/types.js"

export const PROFILE_SCHEMA_VERSION = 1

export type ProfileMigrationClassification = "lazy" | "blocked" | "quarantine"

export interface ProfileMigrationIssue {
  code: string
  message: string
}

export interface ProfileMigrationResult {
  classification: ProfileMigrationClassification
  issues: ProfileMigrationIssue[]
  profile: UserProfile | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseStudyPlan(value: unknown): StudyPlan | null | "blocked" {
  if (value === undefined || value === null) return null
  if (!isRecord(value)) return "blocked"
  if (typeof value.content !== "string" || typeof value.createdAt !== "string") return "blocked"
  return { content: value.content, createdAt: value.createdAt }
}

function hasValidStreak(value: unknown): value is { current: number; best: number } {
  return isRecord(value) && typeof value.current === "number" && typeof value.best === "number"
}

function hasValidMastery(value: unknown): value is UserProfile["mastery"] {
  return isRecord(value)
}

function hasValidHistory(value: unknown): value is UserProfile["history"] {
  return Array.isArray(value)
}

export function migrateProfileRecord(raw: unknown): ProfileMigrationResult {
  if (!isRecord(raw)) {
    return {
      classification: "quarantine",
      issues: [{ code: "invalid-root", message: "用户档案根节点必须是对象" }],
      profile: null,
    }
  }

  const issues: ProfileMigrationIssue[] = []

  if (typeof raw.name !== "string" || raw.name.trim() === "") {
    return {
      classification: "quarantine",
      issues: [{ code: "missing-name", message: "用户档案缺少有效 name 字段" }],
      profile: null,
    }
  }

  if (typeof raw.createdAt !== "string" || typeof raw.points !== "number" || typeof raw.level !== "number") {
    return {
      classification: "quarantine",
      issues: [{ code: "missing-core-fields", message: "用户档案缺少 createdAt/points/level 等核心字段" }],
      profile: null,
    }
  }

  if (!hasValidStreak(raw.streak) || !hasValidMastery(raw.mastery) || !hasValidHistory(raw.history)) {
    return {
      classification: "quarantine",
      issues: [{ code: "invalid-core-shape", message: "用户档案的 streak/mastery/history 结构无效" }],
      profile: null,
    }
  }

  const examTypes = raw.examTypes === undefined ? [] : raw.examTypes
  if (!Array.isArray(examTypes) || examTypes.some(type => typeof type !== "string")) {
    return {
      classification: "blocked",
      issues: [{ code: "invalid-exam-types", message: "examTypes 必须是字符串数组" }],
      profile: null,
    }
  }

  const normalizedExamTypes = normalizeExamTypes(examTypes)
  if (examTypes.length !== normalizedExamTypes.length) {
    return {
      classification: "blocked",
      issues: [{ code: "unknown-exam-type", message: "examTypes 包含未知考试类型，需人工修复" }],
      profile: null,
    }
  }

  let region: string | null = null
  if (raw.region !== undefined && raw.region !== null && raw.region !== "") {
    if (typeof raw.region !== "string" || !REGIONS.includes(raw.region)) {
      return {
        classification: "blocked",
        issues: [{ code: "invalid-region", message: "region 不是有效地区，需人工修复" }],
        profile: null,
      }
    }
    region = raw.region
  }

  const studyPlan = parseStudyPlan(raw.studyPlan)
  if (studyPlan === "blocked") {
    return {
      classification: "blocked",
      issues: [{ code: "invalid-study-plan", message: "studyPlan 结构不合法，需人工修复" }],
      profile: null,
    }
  }

  if (typeof raw.id !== "string" || raw.id.trim() === "") {
    issues.push({ code: "missing-id", message: "旧档案缺少 id，可安全补齐" })
  }

  if (raw.examTypes === undefined) {
    issues.push({ code: "missing-exam-types", message: "旧档案缺少 examTypes，可安全补齐为空数组" })
  }

  if (raw.region === undefined) {
    issues.push({ code: "missing-region", message: "旧档案缺少 region，可安全补齐为空值" })
  }

  if (raw.studyPlan === undefined) {
    issues.push({ code: "missing-study-plan", message: "旧档案缺少 studyPlan，可安全补齐为空值" })
  }

  return {
    classification: "lazy",
    issues,
    profile: {
      schemaVersion: PROFILE_SCHEMA_VERSION,
      profileVersion: typeof raw.profileVersion === "number" ? raw.profileVersion : 0,
      id: typeof raw.id === "string" && raw.id.trim() !== "" ? raw.id : randomUUID(),
      name: raw.name,
      createdAt: raw.createdAt,
      points: raw.points,
      level: raw.level,
      streak: raw.streak,
      mastery: raw.mastery,
      history: raw.history,
      examTypes: normalizedExamTypes,
      region,
      studyPlan,
    },
  }
}
