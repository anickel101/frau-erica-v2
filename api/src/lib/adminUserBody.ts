// Shared request-body shape for the two admin handlers that both take
// "which user, which person" -- adminApproveUser.ts (create + approve)
// and adminUpdateUser.ts (correct a mistaken person_id). Previously two
// byte-identical interfaces hand-declared in each handler file.
export interface PersonIdUpdateBody {
  email?: string
  personId?: number
}

// Validates and narrows a PersonIdUpdateBody, returning null if either
// field is missing or personId isn't a real integer -- same check both
// handlers need before touching Cognito.
export function parsePersonIdUpdateBody(
  body: PersonIdUpdateBody,
): { email: string; personId: number } | null {
  const { email, personId } = body
  if (!email || typeof personId !== 'number' || !Number.isInteger(personId)) {
    return null
  }
  return { email, personId }
}
