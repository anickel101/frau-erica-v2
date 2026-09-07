import { createContext, useContext } from 'react'

type SetNarrowTopBar = (narrow: boolean) => void

export const NarrowTopBarContext = createContext<SetNarrowTopBar | null>(null)

/** Call from FamilyPage to opt into the width-matched top accent bar
 * (flush with the sidebar logo's left edge, flush with the header
 * image's right edge) instead of the default full-page-width bar every
 * other page type keeps. Same shape as useSetFamilyGalleries: a page
 * pushes a signal out to the shared chrome, which Layout owns and acts
 * on -- reset to false on unmount so navigating away restores the
 * default bar. */
export function useSetNarrowTopBar(): SetNarrowTopBar {
  const setNarrowTopBar = useContext(NarrowTopBarContext)
  if (!setNarrowTopBar) {
    throw new Error('useSetNarrowTopBar must be used within Layout')
  }
  return setNarrowTopBar
}
