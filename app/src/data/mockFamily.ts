// Mock data shaped to match the real database schema (Persons, Families,
// Relationships) so swapping this for real data in Phase 3C is a
// straightforward drop-in, not a redesign.

export interface PersonSummary {
  person_id: number
  first_name: string
  last_name: string
  date_of_birth?: string // ISO date, e.g. '1987-10-24'
}

export interface FamilyPageData {
  family_id: number
  person_1: PersonSummary
  person_2: PersonSummary
  description: string // Markdown
  header_image_url?: string
  grandparents_1: PersonSummary[] // person_1's own parents
  grandparents_2: PersonSummary[] // person_2's own parents
  children: PersonSummary[]
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatBirthDate(iso?: string): string {
  return iso ? `Born ${formatDate(iso)}` : ''
}

export { formatDate, formatBirthDate }

export const sampleFamily: FamilyPageData = {
  family_id: 19,
  person_1: {
    person_id: 23,
    first_name: 'Anson',
    last_name: 'Nickel',
    date_of_birth: '1987-10-24',
  },
  person_2: {
    person_id: 1189,
    first_name: 'Reva',
    last_name: 'Gaur',
    date_of_birth: '1985-01-05',
  },
  description:
    "Anson '09 and Reva '07 met at Brown University. There was much commuting between Manhattan and Providence from May 2007 until May 2009. Then life in Manhattan and Brooklyn, graduate studies at NYU (Reva) and Pratt Institute (Anson), and a wedding at the Green Building in Brooklyn on June 20, 2015.",
  header_image_url: undefined,
  grandparents_1: [
    {
      person_id: 18,
      first_name: 'Mark',
      last_name: 'Nickel',
      date_of_birth: '1948-11-02',
    },
    {
      person_id: 19,
      first_name: 'Mary Allison',
      last_name: 'McMillan',
      date_of_birth: '1952-04-21',
    },
  ],
  grandparents_2: [
    {
      person_id: 2001,
      first_name: 'Umesh',
      last_name: 'Gaur',
      date_of_birth: '1952-08-13',
    },
    {
      person_id: 2002,
      first_name: 'Sunanda',
      last_name: 'Mani',
      date_of_birth: '1956-04-11',
    },
  ],
  children: [
    {
      person_id: 1062,
      first_name: 'Archer',
      last_name: 'Nickel',
      date_of_birth: '2018-05-02',
    },
    {
      person_id: 1159,
      first_name: 'Leia',
      last_name: 'Nickel',
      date_of_birth: '2020-12-10',
    },
  ],
}
