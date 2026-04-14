const queues = new Map<string, Promise<void>>()

export function enqueueWrite<T>(key: string, task: () => Promise<T> | T): Promise<T> {
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
