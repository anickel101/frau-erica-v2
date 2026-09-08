import { apiFetch } from './apiClient'
import { LinkedPersonSummary } from '../../types/person'

export interface AncestralLine {
  // The person this line is traced through -- a GRANDparent in the
  // normal case, hence "via" rather than "parent".
  viaId: number
  // Just the first name -- matches the sidebar link text exactly
  // ("First Bigelow (via Hans)"), not a full name.
  viaName: string
  furthestAncestor: LinkedPersonSummary
}

export interface GermlineResponse {
  personIds: number[]
  // One entry per biological GRANDparent on record -- up to four, not
  // two. There's no gender field anywhere in the schema, so these can't
  // be split into "father's side"/"mother's side"; each line is instead
  // labeled by the name of the person it runs through. A parent with no
  // recorded parents falls back to a line for that parent, so half the
  // tree never silently disappears.
  ancestralLines: AncestralLine[]
}

export function getMyGermline(): Promise<GermlineResponse> {
  return apiFetch('/me/germline')
}
