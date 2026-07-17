// Mirrors app/src/data/mockFamily.ts and mockPersons.ts so the frontend's
// eventual swap from mock data to this API is a shape match, not a
// redesign -- same convention app/CLAUDE.md already establishes for the
// mock data itself ("match this shape rather than restructuring
// components"). api/ and app/ are separate dependency trees (no shared
// package), so these are redeclared here rather than imported.
//
// One deliberate deviation from the current mocks: schema/schema.sql's
// Families.person_id_1/person_id_2 are nullable (single-parent families
// are valid data), but mockFamily.ts's FamilyPageData assumes both are
// always present. This API reports the real, honest nullability --
// FamilyPage.tsx will need a small update to handle a null person_2
// before this can be wired in directly.

export interface Person {
  person_id: number
  first_name: string
  middle_name: string
  last_name: string
  suffix: string
  date_of_birth: string | null
  birth_year: number | null
  date_of_death: string | null
  death_year: number | null
}

export interface PersonSummary {
  person_id: number
  first_name: string
  last_name: string
  date_of_birth?: string
}

// PersonSummary plus the family page this person's own card should link
// to (same "partner family, else child family" resolution PersonDetail's
// familyIdsAsPartner/familyIdAsChild expose for a single person) --
// precomputed here so a Family page's PersonCard boxes can link straight
// to /family/:id without a separate GET /persons/:id round trip (and its
// own possible Lambda cold start) per click.
export interface LinkedPersonSummary extends PersonSummary {
  linkedFamilyId: number | null
}

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
  // grandparents/children) -- empty when there are none, meaning the
  // frontend should just not render a galleries section at all.
  galleries: GallerySummary[]
}

export interface PersonDetail extends Person {
  // family_id of every Families row where this person is a partner
  // (person_id_1 or person_id_2) -- a person can have more than one,
  // per schema.sql's comment on widowed-then-remarried cases.
  familyIdsAsPartner: number[]
  // family_id of the Families row representing this person's own
  // parents, if one exists (their parents may not be paired in a
  // Families row at all, or may have more than one -- this picks the
  // first match, since resolving that ambiguity is a frontend/UX
  // decision, not a data one).
  familyIdAsChild: number | null
}

export type AnniversaryEventType = 'birth' | 'death' | 'marriage'

// One birth/death/marriage anniversary, flattened into a single shape
// so the frontend can group/filter/sort a single array client-side
// rather than requesting one month at a time. date is the full
// original ISO date (year/month/day of week are all derivable from it
// client-side -- no need to precompute and ship them separately).
export interface AnniversaryEvent {
  type: AnniversaryEventType
  date: string
  personId: number
  personName: string
  linkedFamilyId: number | null
  // marriage only
  spouseId?: number
  spouseName?: string
}
