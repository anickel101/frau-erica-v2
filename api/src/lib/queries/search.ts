import type { Database } from 'sql.js'
import { PERSON_COLUMNS, getFullName, toPersonSummary } from '../personHelpers'
import { queryAll } from '../sqlHelpers'
import type { Person, PersonSummary } from '../types'

// Substring match, so a query can span first and last name ("anna
// mueller"), which no single column LIKE could narrow to -- hence every
// row fetched and filtered in JS. Fine at this data size (~1,300 people).
//
// Matched against every name a person went by, not just the one on
// their record. The archive files a married woman under her birth
// surname, so Nana is "Mary Allison Bigelow" -- and a search for the
// name the family actually knew her by, "Molly McMillan", found only her
// granddaughter of that name. That is how five of Nana's links ended up
// on the granddaughter (photo tags among them, made by searching here).
// So a person also answers to:
//   - their preferred first name ("Molly Bigelow")
//   - each spouse's surname ("Molly McMillan", "Mary Allison Bigelow
//     McMillan")
//
// Married names come from spouse Relationships, which is why this lives
// behind the gated API rather than in the public persons.json export:
// who married whom is family-tree data.
//
// The schema records no sex, so a husband answers to his wife's surname
// too ("Mark McKibbin"). Harmless -- nobody searches a name that never
// existed -- and the alternative is guessing.
interface SearchRow extends Person {
  preferred_first_name: string | null
}

export function namesFor(person: SearchRow, spouseSurnames: Iterable<string>): string[] {
  const full = getFullName(person)
  const given = [person.first_name, person.preferred_first_name].filter(
    (name, i, all): name is string => !!name && all.indexOf(name) === i,
  )
  const names = [full]
  if (person.preferred_first_name && person.preferred_first_name !== person.first_name) {
    names.push(
      getFullName({ ...person, first_name: person.preferred_first_name }),
      `${person.preferred_first_name} ${person.last_name}`,
    )
  }
  for (const surname of spouseSurnames) {
    names.push(`${full} ${surname}`)
    for (const name of given) names.push(`${name} ${surname}`)
  }
  return [...new Set(names)]
}

// Every word typed must appear somewhere in the name, in any order. One
// substring of the whole name used to be the rule, so "Mark Nickel"
// found nobody: the record is Mark *Mueller* Nickel, and almost everyone
// here has a middle name.
export function matchesWords(name: string, query: string): boolean {
  const haystack = name.toLowerCase()
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return words.length > 0 && words.every((word) => haystack.includes(word))
}

export function searchPersons(db: Database, query: string): PersonSummary[] {
  const rows = queryAll<SearchRow>(
    db,
    `SELECT ${PERSON_COLUMNS}, preferred_first_name FROM Persons`,
  )
  const byId = new Map(rows.map((p) => [p.person_id, p]))

  const spouseSurnames = new Map<number, Set<string>>()
  const spouses = queryAll<{ a: number; b: number }>(
    db,
    `SELECT person_id_1 AS a, person_id_2 AS b FROM Relationships
     WHERE relationship_type = 'spouse'`,
  )
  for (const { a, b } of spouses) {
    for (const [self, other] of [
      [a, b],
      [b, a],
    ]) {
      const own = byId.get(self)?.last_name
      const theirs = byId.get(other)?.last_name
      if (!theirs || theirs === own) continue
      const set = spouseSurnames.get(self) ?? new Set<string>()
      set.add(theirs)
      spouseSurnames.set(self, set)
    }
  }

  const results: PersonSummary[] = []
  for (const person of rows) {
    const names = namesFor(person, spouseSurnames.get(person.person_id) ?? [])
    const hits = names.filter((name) => matchesWords(name, query))
    if (hits.length === 0) continue
    // The record's own name if it matched; otherwise the shortest name
    // that did, which is the one closest to what was typed ("Frieda
    // Feiertag", not every middle name plus "Feiertag").
    const matched =
      hits[0] === names[0]
        ? names[0]
        : hits.reduce((a, b) => (b.length < a.length ? b : a))
    // preferred_first_name stays off the summary: PersonSummary carries
    // it only for a Family page's featured couple (see types.ts).
    const summary = toPersonSummary({ ...person, preferred_first_name: null })
    // Only when the hit wasn't the record's own name -- that is the case
    // a reader needs telling why this person came up.
    results.push(matched === names[0] ? summary : { ...summary, also_known_as: matched })
  }
  return results
}
