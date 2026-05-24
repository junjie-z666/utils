/**
 * 创建单例 Promise 工厂，确保同一时刻只有一个 Promise 在运行。
 *
 * 多次调用 `.get()` 时：
 * - 若 Promise 未运行，启动并返回该 Promise
 * - 若 Promise 正在运行，直接返回正在运行的 Promise（不会重复创建）
 *
 * Promise 完成后（无论成功或失败）自动重置，下次调用 `.get()` 会重新启动。
 *
 * @example
 * ```ts
 * const request = createSinglePromise(() => fetch('/api/data').then(r => r.json()))
 * // 多处同时调用，只会发起一次请求
 * request.get().then(console.log)
 * request.get().then(console.log) // 返回同一个 Promise
 * ```
 */
export const createSinglePromise = <T>(promise: () => Promise<T>) => {
  let runningPromise: null | Promise<T> = null
  return {
    get: () => {
      if (runningPromise) return runningPromise
      runningPromise = new Promise(async (resolve, reject) => {
        try {
          resolve(await promise())
        } catch (e) {
          reject(e)
        } finally {
          runningPromise = null
        }
      })
      return runningPromise
    },
  }
}
