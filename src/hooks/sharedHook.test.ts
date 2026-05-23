import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createSharedStateHook } from './sharedHook'

describe('createSharedStateHook', () => {
  it('多个 hook 实例共享同一状态', () => {
    const useShared = createSharedStateHook(0)
    const { result: r1 } = renderHook(() => useShared())
    const { result: r2 } = renderHook(() => useShared())

    expect(r1.current[0]).toBe(0)
    expect(r2.current[0]).toBe(0)

    act(() => r1.current[1](10))
    expect(r1.current[0]).toBe(10)
    expect(r2.current[0]).toBe(10)
  })

  it('支持函数式更新', () => {
    const useShared = createSharedStateHook(1)
    const { result } = renderHook(() => useShared())

    act(() => result.current[1]((prev) => prev + 1))
    expect(result.current[0]).toBe(2)

    act(() => result.current[1]((prev) => prev * 3))
    expect(result.current[0]).toBe(6)
  })

  it('onlyUpdate 模式下不订阅更新但仍可写入', () => {
    const useShared = createSharedStateHook('a')
    const { result: r1 } = renderHook(() => useShared())
    const { result: r2 } = renderHook(() => useShared({ onlyUpdate: true }))

    act(() => r1.current[1]('b'))
    expect(r1.current[0]).toBe('b')
    // r2 是 onlyUpdate，不订阅，仍持有初始值
    expect(r2.current[0]).toBe('a')

    // r2 写入后 r1 应该收到更新
    act(() => r2.current[1]('c'))
    expect(r1.current[0]).toBe('c')
  })

  it('组件卸载后不再收到更新', () => {
    const useShared = createSharedStateHook(0)
    const { result: r1 } = renderHook(() => useShared())
    const { result: r2, unmount } = renderHook(() => useShared())

    unmount()

    act(() => r1.current[1](99))
    expect(r1.current[0]).toBe(99)
  })

  it('支持对象类型状态', () => {
    const useShared = createSharedStateHook({ name: '', age: 0 })
    const { result: r1 } = renderHook(() => useShared())
    const { result: r2 } = renderHook(() => useShared())

    act(() => r1.current[1]({ name: 'tom', age: 20 }))
    expect(r1.current[0]).toEqual({ name: 'tom', age: 20 })
    expect(r2.current[0]).toEqual({ name: 'tom', age: 20 })
  })
})
