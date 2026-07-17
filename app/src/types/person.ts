// Canonical person shapes, mirroring api/src/lib/types.ts's Person and
// PersonSummary exactly. api/ and app/ are separate dependency trees (no
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

export interface PersonDetail extends Person {
  // family_id of every Families row where this person is a partner --
  // can be more than one (widowed then remarried, etc).
  familyIdsAsPartner: number[]
  // family_id of the Families row representing this person's own
  // parents, if one exists. Null if they have no recorded parents, or
  // their parents were never paired into a shared Families row.
  familyIdAsChild: number | null
}
