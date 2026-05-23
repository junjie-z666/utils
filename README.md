# @azsxdc12356/utils

TypeScript 工具函数和 React Hooks 集合。

## 安装

```bash
npm install @azsxdc12356/utils
```

## 使用

### 工具函数

```ts
import { sleep, timeout } from '@azsxdc12356/utils'

// 延迟执行
await sleep(1000)

// 带超时的 Promise
const result = await timeout(fetch('/api'), 5000)
```

### 异步轮询器

```ts
import { AsyncOnce, AsyncInterval, AsyncTimeout } from '@azsxdc12356/utils'
```

#### `AsyncOnce` — 只取最后一次

快速连续调用同一异步操作时，只回调最后一次的结果，前几次的过期结果会被丢弃。

```ts
const once = new AsyncOnce<string, string>(
  async (url) => fetch(url).then(r => r.text()),
  (result) => console.log(result)
)

once.start('/api/1')  // 还没返回
once.start('/api/2')  // 还没返回
once.start('/api/3')  // 只有这次的结果会回调
```

**解决痛点**：搜索框输入、按钮连点等场景下快速触发同一异步操作，前面请求的结果回来后会覆盖最新结果或导致 UI 闪烁。

#### `AsyncInterval` — 固定间隔轮询（上一个没完不执行下一个）

按固定间隔执行异步操作，如果上一次还没返回则跳过本次，不会并发堆积。

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

**解决痛点**：原生 `setInterval` 不关心上次请求是否完成，响应慢时请求会并发堆积。AsyncInterval 保证不并发，且 `stop()` 和重新 `start()` 时旧结果不会回调。

#### `AsyncTimeout` — 上次完成后等固定间隔再执行

上一次异步操作完成后，等待固定间隔再执行下一次，请求之间不会重叠。

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

**解决痛点**：`setInterval` 不管请求耗时，如果请求耗时 > 间隔就会堆积。AsyncTimeout 保证上一次完成后才开始计时，适合接口响应时间不确定的轮询场景。

#### 共同特性

三者都继承自 `AsyncPolling` 基类，具有以下特性：

- **重新 `start` 时旧结果不回调**：运行中途重新调用 `start`，上一次请求的结果会被丢弃
- **`stop` 后结果不回调**：调用 `stop` 后，正在执行的请求结果不会回调
- **`setCallback` 动态更新回调**：运行过程中可以替换回调函数

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

## License

MIT
