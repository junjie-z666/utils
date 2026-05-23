import { describe, it, expect, vi } from 'vitest'
import { AsyncOnce } from './asyncOnce'
import { AsyncInterval } from './asyncInterval'
import { AsyncTimeout } from './asyncTimeout'

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('AsyncOnce', () => {
  it('执行一次异步调用并回调结果', async () => {
    const callback = vi.fn()
    const once = new AsyncOnce<string, number>(async (url) => url.length, callback)
    once.start('hello')
    await delay(10)
    expect(callback).toHaveBeenCalledWith(5)
  })

  it('多次 start 只回调最后一次的结果', async () => {
    const callback = vi.fn()
    const once = new AsyncOnce<string, string>(async (url) => url, callback)
    once.start('first')
    once.start('second')
    once.start('third')
    await delay(10)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith('third')
  })

  it('stop 后不回调', async () => {
    const callback = vi.fn()
    const once = new AsyncOnce<string, string>(async (url) => {
      await delay(50)
      return url
    }, callback)
    once.start('hello')
    once.stop()
    await delay(100)
    expect(callback).not.toHaveBeenCalled()
  })

  it('setCallback 可动态更新回调', async () => {
    const callback2 = vi.fn()
    const once = new AsyncOnce<string, string>(async (url) => url)
    once.setCallback(callback2)
    once.start('hello')
    await delay(10)
    expect(callback2).toHaveBeenCalledWith('hello')
  })
})

describe('AsyncInterval', () => {
  it('按间隔周期性执行', async () => {
    const callback = vi.fn()
    const interval = new AsyncInterval<string, string>(50, async (url) => url, callback)
    interval.start('hello')
    // 首次立即执行一次
    await delay(10)
    expect(callback).toHaveBeenCalledTimes(1)
    // 等待第二次 interval 触发
    await delay(60)
    expect(callback).toHaveBeenCalledTimes(2)
    // 等待第三次
    await delay(60)
    expect(callback).toHaveBeenCalledTimes(3)
    interval.stop()
  })

  it('stop 后不再回调', async () => {
    const callback = vi.fn()
    const interval = new AsyncInterval<string, string>(50, async (url) => url, callback)
    interval.start('hello')
    await delay(10)
    const count = callback.mock.calls.length
    interval.stop()
    await delay(200)
    expect(callback.mock.calls.length).toBe(count)
  })

  it('重新 start 后上次结果不回调', async () => {
    const callback = vi.fn()
    const interval = new AsyncInterval<string, string>(
      50,
      async (url) => {
        await delay(30)
        return url
      },
      callback,
    )
    interval.start('first')
    // 在第一次还没执行完时重新 start
    await delay(10)
    interval.start('second')
    await delay(100)
    // first 的结果不应回调
    expect(callback).not.toHaveBeenCalledWith('first')
    // second 的结果应该回调
    expect(callback).toHaveBeenCalledWith('second')
    interval.stop()
  })

  it('上一个没执行完跳过本次，不并发', async () => {
    const callback = vi.fn()
    let running = false
    let maxConcurrency = 0
    const interval = new AsyncInterval<string, number>(
      30,
      async () => {
        if (running) maxConcurrency++
        running = true
        await delay(50)
        running = false
        return 1
      },
      callback,
    )
    interval.start('hello')
    await delay(250)
    interval.stop()
    // 不应有并发执行
    expect(maxConcurrency).toBe(0)
  })
})

describe('AsyncTimeout', () => {
  it('上一次执行完后间隔固定时长再执行下一次', async () => {
    const callback = vi.fn()
    const timeout = new AsyncTimeout<string, string>(50, async (url) => url, callback)
    timeout.start('hello')
    // 首次立即执行
    await delay(10)
    expect(callback).toHaveBeenCalledTimes(1)
    // 等间隔后第二次
    await delay(60)
    expect(callback).toHaveBeenCalledTimes(2)
    timeout.stop()
  })

  it('stop 后不再回调', async () => {
    const callback = vi.fn()
    const timeout = new AsyncTimeout<string, string>(50, async (url) => url, callback)
    timeout.start('hello')
    await delay(10)
    const count = callback.mock.calls.length
    timeout.stop()
    await delay(200)
    expect(callback.mock.calls.length).toBe(count)
  })

  it('重新 start 后上次结果不回调', async () => {
    const callback = vi.fn()
    const timeout = new AsyncTimeout<string, string>(
      50,
      async (url) => {
        await delay(30)
        return url
      },
      callback,
    )
    timeout.start('first')
    await delay(10)
    timeout.start('second')
    await delay(150)
    expect(callback).not.toHaveBeenCalledWith('first')
    expect(callback).toHaveBeenCalledWith('second')
    timeout.stop()
  })

  it('多次快速 start 只回调最后一次', async () => {
    const callback = vi.fn()
    const timeout = new AsyncTimeout<string, string>(50, async (url) => url, callback)
    timeout.start('a')
    timeout.start('b')
    timeout.start('c')
    await delay(10)
    expect(callback).not.toHaveBeenCalledWith('a')
    expect(callback).not.toHaveBeenCalledWith('b')
    expect(callback).toHaveBeenCalledWith('c')
    timeout.stop()
  })

  it('执行耗时 > 间隔时，上一次完成后才开始下一次（不重叠）', async () => {
    const callback = vi.fn()
    let running = false
    let maxConcurrency = 0
    const timeout = new AsyncTimeout<string, number>(
      30,
      async () => {
        if (running) maxConcurrency++
        running = true
        await delay(50)
        running = false
        return 1
      },
      callback,
    )
    timeout.start('hello')
    await delay(250)
    timeout.stop()
    expect(maxConcurrency).toBe(0)
  })
})
