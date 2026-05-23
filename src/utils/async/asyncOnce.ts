import { AsyncPolling } from './asyncPolling'

/**
 * 只执行一次，多次调用，只返回最后一次调用的结果，需要外部自己try,catch run函数
 */
export class AsyncOnce<T, R> extends AsyncPolling<T, R> {
  startId = 0

  constructor(func: (params: T) => Promise<R>, callback?: (result: R) => void) {
    super(0, func, callback)
  }

  async run(params: T) {
    const runId = ++this.startId
    try {
      const response = await this.func(params)
      // 结果是否过期，参数变了就过期不回调
      if (!this.isFinish && !this.isResultInvaild(params) && runId === this.startId) {
        this.callback?.(response)
      }
    } catch {
      console.warn('AsyncOnce run error , not catch outsize  , params: ', params)
    }
  }
}
