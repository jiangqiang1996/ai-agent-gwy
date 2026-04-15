import { describe, expect, it } from "vitest"

import { enqueueWrite } from "../../plugins/coaching-tools/storage/write-queue.js"

describe("write queue", () => {
  it("serializes writes by key and keeps independent keys usable", async () => {
    const steps: string[] = []

    const slow = enqueueWrite("same-key", async () => {
      steps.push("slow:start")
      await new Promise(resolve => setTimeout(resolve, 10))
      steps.push("slow:end")
    })

    const fast = enqueueWrite("same-key", async () => {
      steps.push("fast")
    })

    const otherKey = enqueueWrite("other-key", async () => {
      steps.push("other")
    })

    await Promise.all([slow, fast, otherKey])

    expect(steps.indexOf("slow:end")).toBeLessThan(steps.indexOf("fast"))
    expect(steps).toContain("other")
  })
})
