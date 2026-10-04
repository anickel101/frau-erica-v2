import type { Person } from '../types/person'
import { getFullName } from './personDisplay'

// Who to offer as a one-tap button when tagging a photograph.
//
// This is the difference between the tagging tool being pleasant and
// being a chore. Searching 1,320 people by name for every face in 337
// photographs is the version nobody finishes; tapping a name that is
// already on screen is the version that gets done.
//
// Three sources, strongest first:
//
//   1. People already tagged elsewhere in THIS gallery. By far the best
//      signal in practice -- a gallery is usually one family, one event,
//      or one person's life, so the same handful of faces recur. It also
//      improves as the archivist works: the tenth photograph in a
//      gallery suggests better than the first.
//   2. The gallery's own linked people -- whose gallery this is.
//   3. Names read out of the caption. 444 published photographs have
//      captions and they name people outright ("Anson, not quite three,
//      with Uncle Binyon and Aunt Ting").
//
// Nothing here guesses. A suggestion is a shortcut to a name the
// archivist still has to choose, and every one carries the reason it was
// offered so a wrong suggestion is obvious rather than plausible.

export interface Suggestion {
  person: Person
  // Shown on the button, so a suggestion is never mysterious.
  reason: string
}

// Words that start with a capital in a caption but are not names. Kept
// deliberately short: a false negative here costs one extra search,
// while a false positive puts a nonsense name on a button.
const NOT_NAMES = new Set([
  'the',
  'a',
  'an',
  'in',
  'on',
  'at',
  'of',
  'and',
  'with',
  'from',
  'to',
  'for',
  'uncle',
  'aunt',
  'grandpa',
  'grandma',
  'opa',
  'oma',
  'nana',
  'mother',
  'father',
  'mom',
  'dad',
  'cousin',
  'brother',
  'sister',
  'son',
  'daughter',
  'wife',
  'husband',
  'christmas',
  'easter',
  'thanksgiving',
  'summer',
  'winter',
  'spring',
  'autumn',
  'fall',
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
  // Capitalised only because they start a sentence.
  'he',
  'she',
  'it',
  'they',
  'we',
  'his',
  'her',
  'their',
  'our',
  'this',
  'that',
  'there',
  'here',
  'when',
  'where',
  'what',
  'after',
  'before',
  'during',
  'by',
])

// Capitalised words from a caption, which is where the names are.
// Markdown emphasis and punctuation are stripped first so *Charlotte's
// Web* doesn't arrive as "*Charlotte".
//
// Measured across the real archive: of 2,455 capitalised caption words
// (stop words already removed), 916 -- about 37% -- match a name in
// Persons. The rest are places (Minnesota, Chicago), abbreviations, and
// people outside the family (a recurring "Archie", an Uncle Binyon and
// an Aunt Ting who are on nobody's family page).
//
// That noise is harmless by construction rather than by filtering:
// suggestPeople only offers a name matching exactly ONE person, and
// unresolvedCaptionNames only reports a name matching somebody. A word
// like "Minnesota" therefore reaches neither. The list below exists to
// keep the obvious cases out, not to be exhaustive -- it cannot be.
export function captionNames(caption: string | null | undefined): string[] {
  if (!caption) return []
  const words = caption.replace(/[*_`]/g, ' ').match(/\b[A-ZÄÖÜ][a-zäöüß]+\b/g)
  if (!words) return []
  return [...new Set(words.filter((w) => !NOT_NAMES.has(w.toLowerCase())))]
}

function matchesName(person: Person, name: string): boolean {
  const n = name.toLowerCase()
  return (
    person.first_name.toLowerCase() === n ||
    person.last_name.toLowerCase() === n ||
    (person.middle_name ?? '').toLowerCase() === n
  )
}

export function suggestPeople({
  caption,
  galleryPersonIds,
  taggedElsewhereInGallery,
  alreadyOnThisPhoto,
  persons,
  limit = 12,
}: {
  caption: string | null | undefined
  galleryPersonIds: number[]
  taggedElsewhereInGallery: number[]
  alreadyOnThisPhoto: number[]
  persons: Person[]
  limit?: number
}): Suggestion[] {
  const byId = new Map(persons.map((p) => [p.person_id, p]))
  const taken = new Set(alreadyOnThisPhoto)
  const out: Suggestion[] = []
  const seen = new Set<number>()

  const push = (person: Person | undefined, reason: string) => {
    if (!person || taken.has(person.person_id) || seen.has(person.person_id)) return
    seen.add(person.person_id)
    out.push({ person, reason })
  }

  for (const id of taggedElsewhereInGallery) push(byId.get(id), 'in this gallery')
  for (const id of galleryPersonIds) push(byId.get(id), 'this gallery is about them')

  // Caption names, but only where the name picks out ONE person. "Mark"
  // matching four Marks is not a suggestion, it is a quiz -- those
  // surface as a search hint instead (see unresolvedCaptionNames).
  for (const name of captionNames(caption)) {
    const matches = persons.filter((p) => matchesName(p, name))
    if (matches.length === 1) push(matches[0], `named in the caption`)
  }

  return out.slice(0, limit)
}

// Caption names that did NOT resolve to exactly one person -- either
// several people share the name, or nobody on record has it.
//
// Worth showing rather than hiding: the caption is the archivist's own
// text, and "the caption says Mark, which Mark?" is a question only he
// can answer. Offered as a tap-to-search rather than a tap-to-tag, so an
// ambiguous name costs one tap instead of being silently dropped.
export function unresolvedCaptionNames(
  caption: string | null | undefined,
  persons: Person[],
  suggested: Suggestion[],
): string[] {
  const suggestedNames = new Set(
    suggested.flatMap((s) => [
      s.person.first_name.toLowerCase(),
      s.person.last_name.toLowerCase(),
    ]),
  )
  return captionNames(caption).filter((name) => {
    if (suggestedNames.has(name.toLowerCase())) return false
    return persons.some((p) => matchesName(p, name))
  })
}

// Name plus years, because a list of suggestions is often several people
// who share a name and differ only by when they lived.
export function personLabel(person: Person): string {
  const born = person.birth_year ?? person.date_of_birth?.slice(0, 4)
  const died = person.death_year ?? person.date_of_death?.slice(0, 4)
  if (!born && !died) return getFullName(person)
  return `${getFullName(person)} (${born ?? '?'}–${died ?? ''})`
}
