# @azsxdc12356/utils

TypeScript 工具函数和 React Hooks 集合。

## 安装

```bash
npm install @azsxdc12356/utils
```

## 使用

### 异步轮询器

```ts
import { AsyncOnce, AsyncInterval, AsyncTimeout } from '@azsxdc12356/utils'
```
#### 共同特性

三者都继承自 `AsyncPolling` 基类，具有以下特性：

- **重新 `start` 时旧结果不回调**：运行中途重新调用 `start`，上一次请求的结果会被丢弃
- **`stop` 后结果不回调**：调用 `stop` 后，正在执行的请求结果不会回调
- **`setCallback` 动态更新回调**：运行过程中可以替换回调函数


#### `AsyncOnce` — 只取最后一次

快速连续调用同一异步操作时，只回调最后一次的结果，前几次的过期结果会被丢弃。

**解决痛点**：搜索框输入、按钮连点等场景下快速触发同一异步操作，前面请求的结果回来后会覆盖最新结果或导致 UI 闪烁。


```ts
const once = new AsyncOnce<string, string>(
  async (url) => fetch(url).then(r => r.text()),
  (result) => console.log(result)
)

once.start('/api/1')  // 还没返回
once.start('/api/2')  // 还没返回
once.start('/api/3')  // 只有这次的结果会回调
```


#### `AsyncInterval` — 固定间隔轮询（上一个没完不执行下一个）

按固定间隔执行异步操作，如果上一次还没返回则跳过本次，不会并发堆积。

**解决痛点**：原生 `setInterval` 不关心上次请求是否完成，响应慢时请求会并发堆积。AsyncInterval 保证不并发，且 `stop()` 和重新 `start()` 时旧结果不会回调。


```ts
const interval = new AsyncInterval<string, Data>(
  3000,
  async (param) => fetchData(param),
  (result) => console.log(result)
)

interval.start('param')  // 立即执行一次，之后每 3s 执行一次
// ...
interval.stop()          // 停止轮询，正在执行的请求结果不会回调
```

#### `AsyncTimeout` — 上次完成后等固定间隔再执行

上一次异步操作完成后，等待固定间隔再执行下一次，请求之间不会重叠。

**解决痛点**：`setInterval` 不管请求耗时，如果请求耗时 > 间隔就会堆积。AsyncTimeout 保证上一次完成后才开始计时，适合接口响应时间不确定的轮询场景。

```ts
const timeout = new AsyncTimeout<string, Data>(
  3000,
  async (param) => fetchData(param),
  (result) => console.log(result)
)

timeout.start('param')  // 立即执行一次，完成后等 3s 再执行下一次
// ...
timeout.stop()          // 停止轮询
```
### React Hooks

```ts
import { createSharedStateHook } from '@azsxdc12356/utils'
```

#### `createSharedStateHook` — 无需 Provider 的跨组件共享状态

创建一个 hook，多个组件调用同一个 hook 即可共享状态，无需 Context + Provider 包裹。

```tsx
const useUserInfo = createSharedStateHook({ name: '', age: 0 })

function Header() {
  const [user, setUser] = useUserInfo()
  return <Text>{user.name}</Text>
}

function Editor() {
  const [user, setUser] = useUserInfo()
  return (
    <TextInput
      value={user.name}
      onChangeText={(text) => setUser({ ...user, name: text })}
    />
  )
}
```

**`onlyUpdate` 选项**：只获取 setter 不订阅更新，适合只需要写不需要读的场景（避免不必要的重渲染）。

```tsx
const [, setUser] = useUserInfo({ onlyUpdate: true })
```

**解决痛点**：跨组件共享状态通常需要引入 Context + Provider 或状态管理库，对于简单场景太重了。`createSharedStateHook` 在模块顶层创建，组件直接调用即可共享，无需包裹 Provider。

### 工具函数

```ts
import { createCanceledPromise, ConcurrencyQueue, createSinglePromise } from '@azsxdc12356/utils'
```

#### `createCanceledPromise` — 可取消的 Promise

给 Promise 加上 cancel 方法，调用后返回的 promise 会 reject 并携带 `{ canceled: true }`，用户可据此区分取消和正常错误。

```ts
const cancelable = createCanceledPromise(fetchData(), () => abortController.abort())

try {
  const data = await cancelable
} catch (e) {
  if (e?.canceled) {
    // 用户主动取消
  } else {
    // 真正的错误
  }
}

// 需要取消时
cancelable.cancel()
```

**解决痛点**：原生 Promise 一旦创建无法取消。网络请求、页面跳转等场景需要中断正在进行的异步操作，否则结果回来后会更新已不存在的 UI 或引发报错。

#### `ConcurrencyQueue` — 并发控制队列

控制同时执行的任务数量，超出并发上限的任务排队等待，完成一个自动执行下一个。

```ts
const queue = new ConcurrencyQueue('upload', 3)

queue.addItem({
  id: 'file1',
  start: () => uploadFile('file1'),
})
queue.addItem({
  id: 'file2',
  start: () => uploadFile('file2'),
})

// 移除排队中的任务
queue.removeItem('file2')
// 清空所有排队任务
queue.removeAll()
```

**解决痛点**：批量发起网络请求（上传文件、批量下载）时，不加控制会瞬间创建大量并发连接，导致浏览器卡顿或服务端拒绝。ConcurrencyQueue 让并发数始终在可控范围内。

#### `createSinglePromise` — 单例 Promise

多次调用 `get()` 时，如果上一次还没完成，直接返回正在执行的 promise，不会重复执行。

```ts
const single = createSinglePromise(() => fetchConfig())

// 多处同时调用，只会发一次请求
const config1 = await single.get()
const config2 = await single.get()
```

**解决痛点**：多个模块同时请求同一份配置/资源，不加控制会发出多个重复请求。createSinglePromise 保证同一时刻只有一个请求在飞，所有调用者共享同一个 promise。

## License

MIT
