import { createContext, useContext } from 'react'
import { GallerySummary } from '../types/family'

type SetFamilyGalleries = (galleries: GallerySummary[] | null) => void

export const FamilyGalleriesContext = createContext<SetFamilyGalleries | null>(null)

/** Call from FamilyPage once its data loads, passing the galleries
 * linked to the featured couple (or null when there are none/on
 * unmount) -- Sidebar renders a "Galleries" section from this via
 * Layout, which owns the actual state. Same shape as useHeaderRef: a
 * page pushes page-specific data out to the shared chrome, rather than
 * Sidebar reaching into route params to re-fetch it itself. */
export function useSetFamilyGalleries(): SetFamilyGalleries {
  const setFamilyGalleries = useContext(FamilyGalleriesContext)
  if (!setFamilyGalleries) {
    throw new Error('useSetFamilyGalleries must be used within Layout')
  }
  return setFamilyGalleries
}
