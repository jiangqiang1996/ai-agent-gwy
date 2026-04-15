import { join } from "path"

import { readFile } from "fs/promises"

import { SESSION_POINTERS_DIR } from "../shared/constants.js"
import type { SessionPointerRecord } from "../shared/types.js"
import { fileExists } from "./file-store.js"
import { writeJsonFile } from "./file-store.js"
import { enqueueWrite } from "./write-queue.js"

function getSessionPointerPath(worktree: string, sessionId: string): string {
  return join(worktree, SESSION_POINTERS_DIR, `${sessionId}.json`)
}

export async function loadSessionPointer(worktree: string, sessionId: string): Promise<SessionPointerRecord | null> {
  const filePath = getSessionPointerPath(worktree, sessionId)
  if (!fileExists(filePath)) return null
  try {
    const raw = await readFile(filePath, "utf8")
    return JSON.parse(raw) as SessionPointerRecord
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
