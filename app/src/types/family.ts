// Mirrors api/src/lib/types.ts's FamilyDetail exactly (see types/person.ts
// for why these are redeclared rather than imported). person_1/person_2
// are nullable -- schema.sql allows single-parent Families rows -- and
// header_image_url is a raw filename, not a resolved URL (see
// utils/imageUrl.ts's resolveImageUrl).
import { LinkedPersonSummary } from './person'

export interface GallerySummary {
  gallery_id: number
  name: string
}

export interface FamilyDetail {
  family_id: number
  person_1: LinkedPersonSummary | null
  person_2: LinkedPersonSummary | null
  description: string | null
  header_image_url: string | null
  grandparents_1: LinkedPersonSummary[]
  grandparents_2: LinkedPersonSummary[]
  children: LinkedPersonSummary[]
  // Galleries linked to either half of the featured couple (not
  // grandparents/children) -- empty when there are none.
  galleries: GallerySummary[]
  // The featured couple's own spouse Relationships row status, if one
  // exists -- the raw schema value ('married'/'divorced'/'widowed'/
  // 'separated'), not narrowed to a boolean. null when either half of
  // the couple is missing, or no Relationships row is on record. The
  // only UI behavior built on this today is the divorce dashes.
  coupleStatus: string | null
}
