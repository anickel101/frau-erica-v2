import { useMemo, useState } from 'react'

// Shared by GalleriesPage and TextsPage: a controlled search query, a
// filterFn applied to it, and a "Show more/less" cap that collapses back
// down on every new query. filterFn is expected to be a stable,
// module-level function (not redefined per render) -- both current callers
// already define theirs that way, so this memoizes correctly without extra
// wrapping at the call site.
export function usePaginatedSearch<TItem, TResult>(
  items: TItem[],
  filterFn: (items: TItem[], query: string) => TResult[],
  pageSize: number,
) {
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)

  // Each new search starts collapsed at pageSize again.
  const [renderedQuery, setRenderedQuery] = useState(query)
  if (renderedQuery !== query) {
    setRenderedQuery(query)
    setShowAll(false)
  }

  const filtered = useMemo(() => filterFn(items, query), [items, query, filterFn])
  const visible = showAll ? filtered : filtered.slice(0, pageSize)

  return { query, setQuery, filtered, visible, showAll, setShowAll }
}
