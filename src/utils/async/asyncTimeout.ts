import { AsyncPolling, AsyncPollingTimer } from './asyncPolling'

/**
 * 上一个执行完间隔固定时长执行下一次
 */
export class AsyncTimeout<T, R> extends AsyncPolling<T, R> {
  timerId?: AsyncPollingTimer
  startId = 0
  stop() {
    super.stop()
    this.clearTimeout()
  }

  async run(params: T) {
    this.clearTimeout()
    const runId = ++this.startId
    let isInvalid = false
    try {
      const response = await this.func(params)
      // 结果是否过期，参数变了就过期不回调
      isInvalid = this.isFinish || this.isResultInvaild(params) || runId !== this.startId
      if (!isInvalid) {
        this.callback?.(response)
      }
    } catch (e) {
      console.warn(`AsyncTimeout: ${this.timerId} run error: `, e)
    } finally {
      if (!this.isFinish && !isInvalid) {
        this.timerId = setTimeout(() => this.run(params), this.intervalMs)
      }
    }
  }

  private clearTimeout() {
    if (this.timerId) {
      clearTimeout(this.timerId)
    }
    this.timerId = undefined
  }
}
