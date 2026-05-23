import { AsyncPolling, AsyncPollingTimer } from './asyncPolling'

/**
 * 周期性轮询，上一个没执行完不执行，等下一个周期再执行
 */
export class AsyncInterval<T, R> extends AsyncPolling<T, R> {
  timerId?: AsyncPollingTimer
  isWaitResponse = false

  start(params: T) {
    this.clearInterval()
    this.isWaitResponse = false
    super.start(params)
  }

  stop() {
    super.stop()
    this.clearInterval()
    this.isWaitResponse = false
  }

  async run(params: T) {
    if (this.isWaitResponse) {
      return
    }
    let isInvalid = false
    this.isWaitResponse = true
    try {
      if (!this.isFinish && !this.timerId) {
        this.timerId = setInterval(() => this.run(params), this.intervalMs)
      }
      const timerId = this.timerId
      const response = await this.func(params)
      if (this.isFinish) {
        return
      }
      // 结果是否过期，参数变了就过期不回调
      isInvalid = this.isResultInvaild(params) || this.isTimerInvalid(timerId)
      if (!isInvalid) {
        this.callback?.(response)
      }
    } catch (e) {
      console.warn(`AsyncInterval: ${this.timerId} run error: `, e)
    } finally {
      if (isInvalid || this.isFinish) {
        this.isWaitResponse = true
      } else {
        this.isWaitResponse = false
      }
    }
  }

  private isTimerInvalid(timer?: AsyncPollingTimer) {
    return this.timerId !== timer
  }
  private clearInterval() {
    if (this.timerId) {
      clearInterval(this.timerId)
    }
    this.timerId = undefined
  }
}
