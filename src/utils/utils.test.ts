import { describe, it, expect, vi } from 'vitest'
import { createCanceledPromise } from './cancelablePromise'
import ConcurrencyQueue, { ConcurrencyQueueItem } from './concurrencyQueue'
import { createSinglePromise } from './singlePromise'

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('createCanceledPromise', () => {
  it('正常 resolve 时返回结果', async () => {
    const promise = Promise.resolve(42)
    const cancelable = createCanceledPromise(promise)
    await expect(cancelable).resolves.toBe(42)
  })

  it('cancel 后 reject 且携带 canceled 标志', async () => {
    const promise = delay(500).then(() => 1)
    const cancelable = createCanceledPromise(promise)
    cancelable.cancel()
    await expect(cancelable).rejects.toEqual({ canceled: true })
  })

  it('cancel 时调用 originPromiseCancel', async () => {
    const onCancel = vi.fn()
    const promise = delay(500).then(() => 1)
    const cancelable = createCanceledPromise(promise, onCancel)
    cancelable.cancel()
    expect(onCancel).toHaveBeenCalled()
  })

  it('多次调用 cancel 不报错，originPromiseCancel 只触发一次', async () => {
    const onCancel = vi.fn()
    const promise = delay(500).then(() => 1)
    const cancelable = createCanceledPromise(promise, onCancel)
    delay(100).then(() => {
      cancelable.cancel()
      cancelable.cancel()
      cancelable.cancel()
    })
    try {
      await promise
    } catch (e) {
      expect(e).toEqual({ canceled: true })
    }
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('正常 reject 时透传错误', async () => {
    const promise = delay(10).then(() => Promise.reject(111))
    const cancelable = createCanceledPromise(promise)
    try {
      await cancelable
    } catch (e) {
      expect(e).toEqual(111)
    }
  })
})

describe('ConcurrencyQueue', () => {
  it('按顺序执行任务', async () => {
    const results: string[] = []
    const queue = new ConcurrencyQueue('test', 1)

    const createTask = (id: string, ms: number): ConcurrencyQueueItem => ({
      id,
      start: () =>
        delay(ms).then(() => {
          results.push(id)
        }),
    })

    queue.addItem(createTask('a', 10))
    queue.addItem(createTask('b', 10))
    queue.addItem(createTask('c', 10))

    await delay(50)
    expect(results).toEqual(['a', 'b', 'c'])
  })

  it('并发数不超过 maxCount', async () => {
    let maxRunning = 0
    let running = 0
    const queue = new ConcurrencyQueue('test', 2)

    const createTask = (id: string): ConcurrencyQueueItem => ({
      id,
      start: async () => {
        running++
        if (running > maxRunning) maxRunning = running
        await delay(30)
        running--
      },
    })

    queue.addItems([createTask('1'), createTask('2'), createTask('3'), createTask('4')])

    await delay(150)
    expect(maxRunning).toBeLessThanOrEqual(2)
  })

  it('removeItem 移除排队中的任务', async () => {
    const results: string[] = []
    const queue = new ConcurrencyQueue('test', 1)

    queue.addItem({
      id: 'a',
      start: async () => {
        results.push('a')
      },
    })
    queue.addItem({
      id: 'b',
      start: async () => {
        results.push('b')
      },
    })
    queue.removeItem('b')

    await delay(20)
    expect(results).toEqual(['a'])
  })

  it('removeAll 清空所有排队任务', async () => {
    const results: string[] = []
    const queue = new ConcurrencyQueue('test', 1)

    queue.addItem({
      id: 'a',
      start: async () => {
        results.push('a')
      },
    })
    queue.addItem({
      id: 'b',
      start: async () => {
        results.push('b')
      },
    })
    queue.removeAll()

    await delay(20)
    expect(results).toEqual(['a'])
  })
})

describe('createSinglePromise', () => {
  it('首次调用执行 promise', async () => {
    let callCount = 0
    const single = createSinglePromise(async () => {
      callCount++
      return 'result'
    })

    const result = await single.get()
    expect(result).toBe('result')
    expect(callCount).toBe(1)
  })

  it('运行中再次调用返回同一个 promise', async () => {
    let callCount = 0
    const single = createSinglePromise(async () => {
      callCount++
      await delay(50)
      return 'result'
    })

    const p1 = single.get()
    const p2 = single.get()
    const [r1, r2] = await Promise.all([p1, p2])

    expect(r1).toBe('result')
    expect(r2).toBe('result')
    expect(callCount).toBe(1)
  })

  it('完成后再次调用重新执行', async () => {
    let callCount = 0
    const single = createSinglePromise(async () => {
      callCount++
      return callCount
    })

    const r1 = await single.get()
    const r2 = await single.get()
    expect(r1).toBe(1)
    expect(r2).toBe(2)
  })

  it('异常时 runningPromise 清空，下次可重新调用', async () => {
    let callCount = 0
    const single = createSinglePromise(async () => {
      callCount++
      if (callCount === 1) throw new Error('fail')
      return 'ok'
    })

    await expect(single.get()).rejects.toThrow('fail')
    const result = await single.get()
    expect(result).toBe('ok')
  })
})
