/**
 * 可取消的 Promise 包装器。
 *
 * 通过 Promise.race 让原始 promise 与一个可手动 reject 的 cancelPromise 竞争，
 * 调用 `.cancel()` 即可提前拒绝并使原始 promise 的结果不再被消费。
 *
 * @example
 * ```ts
 * const task = createCanceledPromise(fetchData(), () => controller.abort())
 * task.then(console.log).catch(e => { if (e.canceled) console.log('已取消') })
 * task.cancel() // 触发取消
 * ```
 */
interface CancelablePromise<T> extends Promise<T> {
  /** 取消当前 promise，触发 reject({ canceled: true }) */
  cancel: () => void
}

/**
 * 将普通 Promise 包装为可取消的 Promise。
 *
 * @param promise - 需要包装的原始 Promise
 * @param originPromiseCancel - 可选，取消时同步调用的清理函数（如 AbortController.abort）
 * @returns 带有 `.cancel()` 方法的 CancelablePromise
 *
 * 调用 `.cancel()` 后：
 * 1. 调用 originPromiseCancel（如果提供）
 * 2. 以 `{ canceled: true }` reject 竞争 promise
 * 3. 后续再次调用 `.cancel()` 无效（幂等）
 *
 * 无论正常完成还是取消，finally 都会执行。
 */
export const createCanceledPromise = <T>(
  promise: Promise<T>,
  originPromiseCancel?: () => void,
): CancelablePromise<T> => {
  let cancelPromiseReject: ((arg0: { canceled: boolean }) => void) | null = null
  let cancelPromiseResolve: (() => void) | null
  const cancelPromise = new Promise<void>((resolve, reject) => {
    cancelPromiseResolve = resolve
    cancelPromiseReject = reject
  })
  const racePromise = Promise.race([promise, cancelPromise]) as CancelablePromise<T>
  racePromise.cancel = () => {
    if (!cancelPromiseReject) return
    originPromiseCancel?.()
    cancelPromiseReject({ canceled: true })
    cancelPromiseReject = null
  }
  racePromise.finally(() => {
    cancelPromiseResolve?.()
  })
  return racePromise
}
