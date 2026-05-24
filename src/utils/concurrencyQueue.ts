/** 并发队列项，包含唯一标识和返回 Promise 的启动函数 */
export interface ConcurrencyQueueItem {
  /** 任务唯一标识，用于移除指定任务 */
  id: string
  /** 启动任务，返回的 Promise 完成后自动释放并发槽位 */
  start: () => Promise<void>
}

/**
 * 并发控制队列，限制同时执行的任务数量。
 *
 * 当运行中的任务数未达上限时，自动从队列中取出任务执行；
 * 任务完成后自动释放槽位并尝试执行下一个排队任务。
 *
 * @example
 * ```ts
 * const queue = new ConcurrencyQueue('upload', 2)
 * queue.addItem({ id: '1', start: () => upload(file1) })
 * queue.addItem({ id: '2', start: () => upload(file2) })
 * queue.addItem({ id: '3', start: () => upload(file3) }) // 排队，等前两个完成后再执行
 * queue.removeItem('3') // 从排队中移除
 * ```
 */
export default class ConcurrencyQueue {
  maxCount: number
  runningCount: number
  list: ConcurrencyQueueItem[]
  /** 队列标签，用于标识队列用途 */
  tag: string
  /**
   * @param tag - 队列标签
   * @param maxCount - 最大并发数，默认 3
   */
  constructor(tag: string, maxCount = 3) {
    this.tag = tag
    this.maxCount = maxCount
    this.runningCount = 0
    this.list = []
  }

  /** 尝试从队列中取出任务执行，直到达到并发上限或队列为空 */
  private _run = () => {
    while (this.runningCount < this.maxCount && this.list.length > 0) {
      this.runningCount++
      const item = this.list.shift()
      item?.start().finally(() => {
        this.runningCount--
        this._run()
      })
    }
  }

  /** 添加单个任务到队列，并尝试立即执行 */
  public addItem = (item: ConcurrencyQueueItem) => {
    this.list.push(item)
    this._run()
  }

  /** 批量添加任务到队列，并尝试立即执行 */
  public addItems = (items: ConcurrencyQueueItem[]) => {
    this.list = this.list.concat(items)
    this._run()
  }

  /** 从排队中移除指定任务（不影响已运行的任务），移除成功返回 true */
  public removeItem(id: string) {
    const index = this.list.findIndex((value) => value.id === id)
    if (index !== -1) {
      this.list.splice(index, 1)
      return true
    }
    return false
  }

  /** 清空所有排队中的任务（不影响已运行的任务） */
  public removeAll() {
    this.list = []
  }
}