// Canonical person shapes. PersonSummary/LinkedPersonSummary/PersonDetail
// mirror api/src/lib/types.ts exactly; Person deliberately diverges (see
// its own comment below). api/ and app/ are separate dependency trees (no
// shared package), so these are redeclared here rather than imported --
// same convention api/'s own types.ts documents for its relationship to
// this file. Previously three independent, silently-drifting copies
// (data/mockFamily.ts, data/mockPersons.ts, data-access/gated/search.ts).

export interface PersonSummary {
  person_id: number
  first_name: string
  last_name: string
  date_of_birth?: string // ISO date, e.g. '1987-10-24'
}

// PersonSummary plus the family page this person's own PersonCard box
// should link to -- precomputed server-side (same "partner family, else
// child family" resolution as PersonDetail's own familyIdsAsPartner/
// familyIdAsChild) so a Family page click goes straight to /family/:id
// instead of a separate GET /persons/:id round trip.
export interface LinkedPersonSummary extends PersonSummary {
  linkedFamilyId: number | null
  // The OTHER family_id this person partners in, besides the one this
  // LinkedPersonSummary is embedded in (widowed/remarried, etc.) --
  // only ever populated for FamilyDetail's person_1/person_2, never
  // grandparents_1/grandparents_2/children. undefined (not null) for
  // every other use -- distinguishes "not computed here" from
  // "computed, and there isn't one" (null).
  otherFamilyId?: number | null
}

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
  // Deliberate divergence from api/'s Person: this is the shape of a row
  // in the static generated/persons.json export (see
  // scripts/export-data.ts), which bakes in each person's own family
  // page link at export time -- same "partner family, else child
  // family" resolution api/ computes live for Family pages, just
  // precomputed here since the Index of Persons page reads this export
  // directly rather than calling the gated API.
  linkedFamilyId: number | null
}

export interface PersonDetail extends Person {
  // family_id of every Families row where this person is a partner --
  // can be more than one (widowed then remarried, etc).
  familyIdsAsPartner: number[]
  // family_id of the Families row representing this person's own
  // parents, if one exists. Null if they have no recorded parents, or
  // their parents were never paired into a shared Families row.
  familyIdAsChild: number | null
}
