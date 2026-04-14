import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

export async function createTempWorktree(prefix = "ai-agent-gwy-"): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix))
}

export async function cleanupTempWorktree(worktree: string): Promise<void> {
  await rm(worktree, { recursive: true, force: true })
}

export async function writeWorktreeFile(worktree: string, relativePath: string, content: string): Promise<void> {
  const filePath = join(worktree, relativePath)
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, content, "utf8")
}

export async function readWorktreeFile(worktree: string, relativePath: string): Promise<string> {
  return readFile(join(worktree, relativePath), "utf8")
}

export async function copyFixtureToWorktree(sourceFile: string, worktree: string, relativePath: string): Promise<void> {
  const destination = join(worktree, relativePath)
  await mkdir(dirname(destination), { recursive: true })
  await cp(sourceFile, destination)
}
