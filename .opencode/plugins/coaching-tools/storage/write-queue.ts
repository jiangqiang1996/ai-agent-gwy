const queues = new Map<string, Promise<void>>()
const MAX_QUEUE_SIZE = 1024

export function enqueueWrite<T>(key: string, task: () => Promise<T> | T): Promise<T> {
  if (queues.size > MAX_QUEUE_SIZE) {
    for (const [k, v] of queues) {
      if (v !== undefined) {
        queues.delete(k)
      }
      if (queues.size <= MAX_QUEUE_SIZE / 2) break
    }
  }

  const previous = queues.get(key) ?? Promise.resolve()
  const run = previous.catch(() => undefined).then(task)
  const tail = run.then(() => undefined, () => undefined)

  queues.set(key, tail)

  return run.finally(() => {
    if (queues.get(key) === tail) {
      queues.delete(key)
    }
  })
}
