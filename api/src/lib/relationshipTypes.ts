// Relationship rows whose person_id_1 is the parent and person_id_2 is
// the child -- see schema/schema.sql's Relationships comment. 'spouse'
// deliberately excluded, it's not a parent-type row.
export const PARENT_RELATIONSHIP_TYPES = [
  'biological_parent',
  'step_parent',
  'adoptive_parent',
] as const
