import { useEffect, useState } from 'react'
import { loadPersonLinks, type PersonLinksIndex } from '../data-access/public/personLinks'

// The person-links index once it has loaded, null until then. A failed
// load leaves it null for good: the page still works, it just shows no
// More info icons, which is better than an error over a family tree.
export function usePersonLinks(): PersonLinksIndex | null {
  const [index, setIndex] = useState<PersonLinksIndex | null>(null)
  useEffect(() => {
    let cancelled = false
    loadPersonLinks()
      .then((loaded) => {
        if (!cancelled) setIndex(() => loaded)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  return index
}
