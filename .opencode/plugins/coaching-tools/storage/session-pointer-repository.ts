import { join } from "path"

import { SESSION_POINTERS_DIR } from "../shared/constants.js"
import type { SessionPointerRecord } from "../shared/types.js"
import { readJsonFile, writeJsonFile } from "./file-store.js"
import { enqueueWrite } from "./write-queue.js"

function getSessionPointerPath(worktree: string, sessionId: string): string {
  return join(worktree, SESSION_POINTERS_DIR, `${sessionId}.json`)
}

export function loadSessionPointer(worktree: string, sessionId: string): SessionPointerRecord | null {
  try {
    return readJsonFile<SessionPointerRecord>(getSessionPointerPath(worktree, sessionId))
  } catch {
    return null
  }
}

export async function saveSessionPointer(worktree: string, pointer: SessionPointerRecord): Promise<void> {
  const filePath = getSessionPointerPath(worktree, pointer.sessionId)
  await enqueueWrite(filePath, async () => {
    writeJsonFile(filePath, pointer)
  })
}
