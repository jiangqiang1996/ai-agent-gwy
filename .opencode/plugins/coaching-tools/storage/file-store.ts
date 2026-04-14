import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "fs"
import { dirname, join } from "path"

import { USERS_DIR } from "../shared/constants.js"

export function getProfilePathById(worktree: string, id: string): string {
  return join(worktree, USERS_DIR, `${id}.json`)
}

export function atomicWriteFile(filePath: string, data: string): void {
  const directory = dirname(filePath)
  mkdirSync(directory, { recursive: true })
  const temporaryFile = `${filePath}.tmp`
  writeFileSync(temporaryFile, data, "utf8")
  if (existsSync(filePath)) {
    unlinkSync(filePath)
  }
  renameSync(temporaryFile, filePath)
}

export function fileExists(filePath: string): boolean {
  return existsSync(filePath)
}

export function listJsonFiles(directory: string): string[] {
  if (!existsSync(directory)) return []
  return readdirSync(directory).filter(file => file.endsWith(".json"))
}

export function readTextFile(filePath: string): string {
  return readFileSync(filePath, "utf8")
}

export function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readTextFile(filePath)) as T
}

export function writeJsonFile(filePath: string, value: unknown): void {
  atomicWriteFile(filePath, JSON.stringify(value, null, 2))
}

export function removeFile(filePath: string): void {
  if (!existsSync(filePath)) return
  try {
    unlinkSync(filePath)
  } catch {
    // Ignore best-effort cleanup failures for legacy file names.
  }
}
