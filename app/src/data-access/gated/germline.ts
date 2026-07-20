import { apiFetch } from './apiClient'
import { LinkedPersonSummary } from '../../types/person'

export interface AncestralLine {
  parentId: number
  // Just the first name -- matches the sidebar link text exactly
  // ("Furthest Ancestor (via Hans)"), not a full name.
  parentName: string
  furthestAncestor: LinkedPersonSummary
}

export interface GermlineResponse {
  personIds: number[]
  // One entry per immediate biological parent on record (0, 1, or 2 --
  // there's no gender field anywhere in the schema, so this can't be
  // split into "father's side"/"mother's side"; each line is instead
  // labeled by that parent's own name).
  ancestralLines: AncestralLine[]
}

export function getMyGermline(idToken: string): Promise<GermlineResponse> {
  return apiFetch('/me/germline', idToken)
}
