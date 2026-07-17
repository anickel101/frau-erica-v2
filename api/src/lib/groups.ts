// Single source of truth for Cognito group names -- every group-name
// string literal in this project should trace back to this file rather
// than being independently hand-typed in multiple places and risking
// drift (e.g. 'approved' vs 'Approved').
export const GROUPS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  ADMIN: 'admin',
} as const

export type Group = (typeof GROUPS)[keyof typeof GROUPS]
