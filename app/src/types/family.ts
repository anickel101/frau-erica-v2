// Mirrors api/src/lib/types.ts's FamilyDetail exactly (see types/person.ts
// for why these are redeclared rather than imported). person_1/person_2
// are nullable -- schema.sql allows single-parent Families rows -- and
// header_image_url is a raw filename, not a resolved URL (see
// utils/imageUrl.ts's resolveImageUrl).
import { PersonSummary } from './person'

export interface FamilyDetail {
  family_id: number
  person_1: PersonSummary | null
  person_2: PersonSummary | null
  description: string | null
  header_image_url: string | null
  grandparents_1: PersonSummary[]
  grandparents_2: PersonSummary[]
  children: PersonSummary[]
}
