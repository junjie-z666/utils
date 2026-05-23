export type AsyncPollingTimer = ReturnType<typeof setTimeout>
/**
 * 异步轮询工具类，支持interval和timeout.调用run立即执行一次，然后根据传入的间隔轮训，
 *
 * 1. 运行中途重新调用start，上一次的结果不回调
 * 2. 运行过程停止，上一次的结果不回调
 * 3. 上一次的结果未运行完成，不运行下一次，等待运行完成才运行
 */
export abstract class AsyncPolling<T, R> {
  readonly intervalMs: number
  protected func: (params: T) => Promise<R>
  protected callback?: (result: R) => void
  protected runParams?: T
  protected isFinish: boolean
  constructor(intervalMs: number, func: (params: T) => Promise<R>, callback?: (result: R) => void) {
    this.intervalMs = intervalMs
    this.func = func
    this.callback = callback
    this.isFinish = false
  }

  start(params: T) {
    this.isFinish = false
    this.runParams = params
    this.run(this.runParams)
  }
  stop() {
    this.isFinish = true
  }

  setCallback(callback?: (result: R) => void) {
    this.callback = callback
  }
  protected isResultInvaild(params: T) {
    return params !== this.runParams
  }

  protected abstract run(params: T): Promise<void>
}
