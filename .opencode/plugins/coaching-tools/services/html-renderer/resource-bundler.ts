import { copyFile, mkdir, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

export interface BundlePlan {
  htmlContent: string
  htmlPath: string
  assetDir: string
  runtimeAssets: Array<{ srcAbsPath: string; destRelPath: string }>
  localImages: Array<{ srcAbsPath: string; destRelPath: string }>
}

export async function publishBundle(plan: BundlePlan): Promise<void> {
  await mkdir(plan.assetDir, { recursive: true })

  try {
    for (const asset of plan.runtimeAssets) {
      const dest = join(plan.assetDir, "runtime", asset.destRelPath)
      await mkdir(dirname(dest), { recursive: true })
      await copyFile(asset.srcAbsPath, dest)
    }

    for (const img of plan.localImages) {
      const dest = join(plan.assetDir, "content", img.destRelPath)
      await mkdir(dirname(dest), { recursive: true })
      await copyFile(img.srcAbsPath, dest)
    }

    await writeFile(plan.htmlPath, plan.htmlContent, "utf8")
  } catch (error) {
    await cleanupBundle(plan.htmlPath, plan.assetDir)
    throw error
  }
}

export async function cleanupBundle(htmlPath: string, assetDir: string): Promise<void> {
  await Promise.allSettled([
    rm(assetDir, { recursive: true, force: true }),
    rm(htmlPath, { force: true }),
  ])
}
