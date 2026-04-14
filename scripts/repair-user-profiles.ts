import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"

import { migrateProfileRecord } from "../.opencode/plugins/coaching-tools/migrations/profile-schema.js"

interface RepairRecordReport {
  sourceFile: string
  classification: "lazy" | "blocked" | "quarantine"
  targetFile: string | null
  issues: string[]
  wouldWrite: boolean
}

interface RepairReport {
  generatedAt: string
  worktree: string
  apply: boolean
  summary: {
    scanned: number
    lazy: number
    blocked: number
    quarantine: number
    written: number
  }
  records: RepairRecordReport[]
}

function getArg(flag: string): string | null {
  const index = process.argv.indexOf(flag)
  if (index === -1) return null
  return process.argv[index + 1] ?? null
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function main(): Promise<void> {
  const worktree = resolve(getArg("--worktree") ?? process.cwd())
  const apply = hasFlag("--apply")
  const usersDir = join(worktree, "data", "users")
  const outputDir = join(worktree, "output")
  const reportPath = resolve(getArg("--report") ?? join(outputDir, "repair-user-profiles-report.json"))

  const report: RepairReport = {
    generatedAt: new Date().toISOString(),
    worktree,
    apply,
    summary: {
      scanned: 0,
      lazy: 0,
      blocked: 0,
      quarantine: 0,
      written: 0,
    },
    records: [],
  }

  if (!(await pathExists(usersDir))) {
    await mkdir(outputDir, { recursive: true })
    await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8")
    console.log(`No user directory found at ${usersDir}. Empty report written to ${reportPath}.`)
    return
  }

  const files = (await readdir(usersDir)).filter(file => file.endsWith(".json"))

  for (const fileName of files) {
    const sourceFile = join(usersDir, fileName)
    report.summary.scanned += 1

    try {
      const rawText = await readFile(sourceFile, "utf8")
      const rawValue = JSON.parse(rawText) as unknown
      const migrated = migrateProfileRecord(rawValue)
      const issues = migrated.issues.map(issue => `${issue.code}: ${issue.message}`)

      if (migrated.classification === "lazy" && migrated.profile) {
        report.summary.lazy += 1
        const targetFile = join(usersDir, `${migrated.profile.id}.json`)
        report.records.push({
          sourceFile,
          classification: "lazy",
          targetFile,
          issues,
          wouldWrite: apply,
        })

        if (apply) {
          await writeFile(targetFile, JSON.stringify(migrated.profile, null, 2), "utf8")
          if (targetFile !== sourceFile) {
            await rm(sourceFile, { force: true })
          }
          report.summary.written += 1
        }
        continue
      }

      if (migrated.classification === "blocked") {
        report.summary.blocked += 1
        report.records.push({
          sourceFile,
          classification: "blocked",
          targetFile: null,
          issues,
          wouldWrite: false,
        })
        continue
      }

      report.summary.quarantine += 1
      report.records.push({
        sourceFile,
        classification: "quarantine",
        targetFile: null,
        issues,
        wouldWrite: false,
      })
    } catch (error) {
      report.summary.quarantine += 1
      report.records.push({
        sourceFile,
        classification: "quarantine",
        targetFile: null,
        issues: [`invalid-json: ${error instanceof Error ? error.message : String(error)}`],
        wouldWrite: false,
      })
    }
  }

  await mkdir(outputDir, { recursive: true })
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8")
  console.log(`Repair report written to ${reportPath}`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
