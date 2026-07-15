import { createContext, useContext, RefObject } from 'react'

export const HeaderRefContext = createContext<RefObject<HTMLDivElement | null> | null>(
  null,
)

/** Call this from any page and attach the returned ref to that page's
 * header image wrapper div. Pages with no header image simply don't use
 * this -- Layout will have nothing to measure and the sidebar falls back
 * to its natural height. */
export function useHeaderRef() {
  const ref = useContext(HeaderRefContext)
  if (!ref) {
    throw new Error('useHeaderRef must be used within Layout')
  }
  return ref
}
