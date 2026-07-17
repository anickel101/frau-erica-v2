import { useEffect, useState } from 'react'

// Returns `value`, but only after it's stopped changing for `delayMs` --
// the initial value is returned immediately (no delay), only subsequent
// changes are debounced. Used to avoid firing a network request on every
// keystroke in a live-search input.
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timeout)
  }, [value, delayMs])

  return debounced
}
