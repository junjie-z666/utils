import { useEffect, useState } from 'react'

export const createSharedStateHook = <T>(init: T) => {
  let sharedState = init
  const listeners = new Set<(value: T) => void>()

  const useSharedState = (config?: {
    onlyUpdate: boolean
  }): [T, (v: T | ((prevState: T) => T)) => void] => {
    const [, setState] = useState(sharedState)
    const setSharedState = (newSharedState: T | ((prevState: T) => T)) => {
      if (typeof newSharedState === 'function') {
        sharedState = (newSharedState as (prevState: T) => T)(sharedState)
      } else {
        sharedState = newSharedState
      }
      listeners.forEach((listener) => listener(sharedState))
    }
    useEffect(() => {
      if (config?.onlyUpdate) return

      const listener = (newState: T) => setState(newState)
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }, [])
    return [sharedState, setSharedState]
  }

  return useSharedState
}
