import { loadSessionPointer, saveSessionPointer } from "../storage/session-pointer-repository.js"

export async function switchSessionProfile(worktree: string, input: {
  sessionId: string
  profileId: string
}): Promise<{ status: "switched"; epoch: number }> {
  const previousPointer = await loadSessionPointer(worktree, input.sessionId)
  const epoch = (previousPointer?.epoch ?? 0) + 1

  await saveSessionPointer(worktree, {
    sessionId: input.sessionId,
    profileId: input.profileId,
    epoch,
    updatedAt: new Date().toISOString(),
  })

  return { status: "switched", epoch }
}
