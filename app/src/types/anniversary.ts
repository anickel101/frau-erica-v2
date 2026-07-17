// Mirrors api/src/lib/types.ts's AnniversaryEvent exactly, same
// "redeclared, not imported" convention as family.ts/person.ts (api/
// and app/ are separate dependency trees).
export type AnniversaryEventType = 'birth' | 'death' | 'marriage'

export interface AnniversaryEvent {
  type: AnniversaryEventType
  date: string
  personId: number
  personName: string
  linkedFamilyId: number | null
  spouseId?: number
  spouseName?: string
}
