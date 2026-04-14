import { randomUUID } from "crypto"

import { REGIONS } from "../shared/constants.js"
import { normalizeExamTypes } from "../shared/formatters.js"
import type { StudyPlan, UserIdentity, UserProfile } from "../shared/types.js"
import { getNameClaim, saveNameClaim } from "../storage/identity-index-repository.js"
import { deleteProfileRecord, findProfilesByName, saveProfileRecord } from "../storage/profile-repository.js"

export interface ProfileServiceInput {
  username: string
  examTypes?: string[]
  region?: string
  identity?: UserIdentity | null
}

export interface ProfileUpdateInput {
  username: string
  newName?: string
  examTypes?: string[]
  region?: string
  identity?: UserIdentity | null
}


function normalizeRegion(region: string | undefined): string | null {
  if (region === undefined || region === "") return null
  if (!REGIONS.includes(region)) {
    throw new Error(`invalid region: ${region}`)
  }
  return region
}

function buildFreshProfile(input: ProfileServiceInput): UserProfile {
  return {
    schemaVersion: 1,
    profileVersion: 0,
    id: randomUUID(),
    name: input.username,
    createdAt: new Date().toISOString(),
    identity: input.identity ?? null,
    mastery: {},
    history: [],
    examTypes: normalizeExamTypes(input.examTypes ?? []),
    region: normalizeRegion(input.region),
    studyPlan: null,
  }
}

export async function checkNameAvailability(worktree: string, username: string): Promise<{
  status: "available" | "existing" | "blocked"
  profile?: UserProfile
  reason?: string
}> {
  const claim = getNameClaim(worktree, username)
  if (claim?.state === "blocked") {
    return { status: "blocked", reason: claim.reason ?? "identity blocked" }
  }

  const matches = await findProfilesByName(worktree, username)
  if (matches.some(match => match.status === "blocked")) {
    return { status: "blocked", reason: "duplicate identity requires repair" }
  }

  const loaded = matches.find(match => match.status === "loaded" && match.profile)
  if (loaded?.profile) {
    return { status: "existing", profile: loaded.profile }
  }

  return { status: "available" }
}

export async function createProfile(worktree: string, input: ProfileServiceInput): Promise<{
  status: "created" | "blocked" | "exists"
  profile?: UserProfile
  reason?: string
}> {
  const availability = await checkNameAvailability(worktree, input.username)
  if (availability.status === "blocked") {
    return { status: "blocked", reason: availability.reason }
  }
  if (availability.status === "existing") {
    return { status: "exists", profile: availability.profile }
  }

  const profile = buildFreshProfile(input)
  await saveProfileRecord(worktree, profile)
  await saveNameClaim(worktree, {
    displayName: profile.name,
    state: "claimed",
    profileId: profile.id,
    reason: null,
    updatedAt: new Date().toISOString(),
  })

  return { status: "created", profile }
}

export async function loadProfile(worktree: string, username: string): Promise<{
  status: "loaded" | "not_found" | "blocked"
  profile?: UserProfile
  reason?: string
}> {
  const availability = await checkNameAvailability(worktree, username)
  if (availability.status === "available") return { status: "not_found" }
  if (availability.status === "blocked") return { status: "blocked", reason: availability.reason }
  return { status: "loaded", profile: availability.profile }
}

export async function overwriteProfile(worktree: string, input: ProfileServiceInput): Promise<{
  status: "overwritten" | "not_found" | "blocked"
  profile?: UserProfile
  reason?: string
}> {
  const current = await loadProfile(worktree, input.username)
  if (current.status === "not_found") return { status: "not_found" }
  if (current.status === "blocked") return { status: "blocked", reason: current.reason }

  await deleteProfileRecord(worktree, current.profile!.id)

  const profile = buildFreshProfile(input)
  await saveProfileRecord(worktree, profile)
  await saveNameClaim(worktree, {
    displayName: profile.name,
    state: "claimed",
    profileId: profile.id,
    reason: null,
    updatedAt: new Date().toISOString(),
  })

  return { status: "overwritten", profile }
}

export async function saveStudyPlanForProfile(worktree: string, username: string, planContent: string): Promise<{
  status: "saved" | "not_found" | "blocked"
  profile?: UserProfile
  studyPlan?: StudyPlan
  reason?: string
}> {
  const current = await loadProfile(worktree, username)
  if (current.status === "not_found") return { status: "not_found" }
  if (current.status === "blocked") return { status: "blocked", reason: current.reason }

  const profile = current.profile!
  const studyPlan = {
    content: planContent.substring(0, 5000),
    createdAt: new Date().toISOString(),
  }
  profile.studyPlan = studyPlan

  await saveProfileRecord(worktree, profile)
  return { status: "saved", profile, studyPlan }
}

export async function updateProfileDetails(worktree: string, input: ProfileUpdateInput): Promise<{
  status: "updated" | "not_found" | "blocked" | "conflict"
  profile?: UserProfile
  changes?: string[]
  reason?: string
}> {
  const current = await loadProfile(worktree, input.username)
  if (current.status === "not_found") return { status: "not_found" }
  if (current.status === "blocked") return { status: "blocked", reason: current.reason }

  const profile = current.profile!
  const changes: string[] = []
  const nextName = input.newName?.trim()

  if (nextName && nextName !== profile.name) {
    const availability = await checkNameAvailability(worktree, nextName)
    if (availability.status === "blocked") {
      return { status: "blocked", reason: availability.reason }
    }
    if (availability.status === "existing" && availability.profile?.id !== profile.id) {
      return { status: "conflict", reason: `名字 "${nextName}" 已被其他用户使用` }
    }
    const previousName = profile.name
    profile.name = nextName
    changes.push(`名字→${profile.name}`)

    await saveProfileRecord(worktree, profile)
    await saveNameClaim(worktree, {
      displayName: previousName,
      state: "released",
      profileId: null,
      reason: null,
      updatedAt: new Date().toISOString(),
    })
    await saveNameClaim(worktree, {
      displayName: profile.name,
      state: "claimed",
      profileId: profile.id,
      reason: null,
      updatedAt: new Date().toISOString(),
    })
  }

  if (input.examTypes !== undefined) {
    profile.examTypes = normalizeExamTypes(input.examTypes)
    changes.push(`考试类型→${profile.examTypes.length > 0 ? profile.examTypes.join("/") : "未设置"}`)
  }

  if (input.region !== undefined) {
    profile.region = normalizeRegion(input.region)
    changes.push(`地区→${profile.region || "未设置"}`)
  }

  if (input.identity !== undefined && input.identity !== profile.identity) {
    profile.identity = input.identity
    changes.push(`身份→${profile.identity === "working" ? "在职" : profile.identity === "campus" ? "应届生" : "未设置"}`)
  }

  if (changes.length === 0) {
    return { status: "updated", profile, changes }
  }

  await saveProfileRecord(worktree, profile)
  return { status: "updated", profile, changes }
}
