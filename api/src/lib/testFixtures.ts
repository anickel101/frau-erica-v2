import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import initSqlJs, { type Database } from 'sql.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCHEMA_PATH = path.join(__dirname, '../../../schema/schema.sql')

// Builds a real, schema-validated in-memory database (via sql.js itself,
// the same engine the Lambda uses in production) rather than mocking the
// query layer -- proves the actual SQL against the actual schema,
// including its foreign keys and the check_parent_birth_order trigger.
export async function createTestDb(): Promise<Database> {
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  db.exec(readFileSync(SCHEMA_PATH, 'utf8'))
  return db
}

// One small, hand-traceable family tree, reused across families/persons/
// search query tests:
//
//   Hans Mueller ── Greta Mueller (family_id 2)      Otto Schmidt ── Ida Schmidt (family_id 3)
//         \\                                                   /
//          \\_________________ children of ______________ ___/
//                              \\                    /
//                        Anna Mueller ── Karl Schmidt  (family_id 1, the one under test)
//                                    \\        /
//                                Lena Schmidt  Max Schmidt
//
//   family_id 4 is a single-parent family (Hans, no partner) to exercise
//   the nullable person_id_2 path. Wilhelm Standalone (9) -> Orphan
//   Standalone (10) is a separate, disconnected pair: Wilhelm has no
//   Families row of his own, to exercise the "parents on record but not
//   paired in any Families row" case.
//
//   A second, unconnected pair of fixtures exists purely for
//   anniversaries.ts's marriage-query tests, deliberately NOT touching
//   Anna/Karl/family_id 1 so existing assertions elsewhere stay stable:
//   Klaus Twice (13) is a partner in two Families rows (6 and 7) --
//   family_id 6 is Wife One being irrelevant, family_id 7 is a real
//   spouse Relationships row (Klaus + Wife Two) that must resolve to
//   family_id 7 specifically, not just "the first Families row Klaus
//   happens to be a partner in". Wilhelm (9) also gets a spouse
//   Relationships row, to Frieda Standalone (12), with no matching
//   Families row at all -- the linkedFamilyId: null case for marriages.
export async function seedFixtures(db: Database): Promise<void> {
  const persons: Array<[number, string, string, string | null]> = [
    [1, 'Hans', 'Mueller', '1920-03-01'],
    [2, 'Greta', 'Mueller', '1922-07-14'],
    [3, 'Anna', 'Mueller', '1950-05-10'],
    [5, 'Otto', 'Schmidt', '1918-01-01'],
    [6, 'Ida', 'Schmidt', '1921-09-30'],
    [4, 'Karl', 'Schmidt', '1949-11-02'],
    [7, 'Lena', 'Schmidt', '1980-02-20'],
    [8, 'Max', 'Schmidt', '1982-06-18'],
    [9, 'Wilhelm', 'Standalone', '1919-04-04'],
    [10, 'Orphan', 'Standalone', '1948-08-08'],
    // Wilhelm's wife -- deliberately NOT paired with him in any Families
    // row, to exercise the "spouse relationship with no matching
    // Families row" (linkedFamilyId: null) case for marriages.
    [12, 'Frieda', 'Standalone', '1921-02-02'],
    // Klaus is a partner in two Families rows (6 and 7 below) -- see the
    // top-of-file comment for why.
    [13, 'Klaus', 'Twice', '1930-03-15'],
    [14, 'Wife', 'One', '1932-01-01'],
    [15, 'Wife', 'Two', '1955-04-20'],
    // No date_of_birth -- only birth_year is known (set below via
    // UPDATE), per schema.sql's documented convention. Exercises
    // anniversaries.ts's "only full dates are placeable on a specific
    // day-of-month" exclusion.
    [16, 'YearOnly', 'Standalone', null],
  ]
  for (const [id, first, last, dob] of persons) {
    db.run(
      'INSERT INTO Persons (person_id, first_name, last_name, date_of_birth) VALUES (?, ?, ?, ?)',
      [id, first, last, dob],
    )
  }

  // Death dates on a couple of existing fixture people, for the
  // anniversaries "death" event tests.
  db.run("UPDATE Persons SET date_of_death = '1995-01-01' WHERE person_id = 1") // Hans
  db.run("UPDATE Persons SET date_of_death = '1998-09-30' WHERE person_id = 5") // Otto Schmidt
  db.run('UPDATE Persons SET birth_year = 1900 WHERE person_id = 16') // YearOnly

  const parentLinks: Array<[number, number]> = [
    [1, 3], // Hans -> Anna
    [2, 3], // Greta -> Anna
    [5, 4], // Otto -> Karl
    [6, 4], // Ida -> Karl
    [3, 7], // Anna -> Lena
    [4, 7], // Karl -> Lena
    [3, 8], // Anna -> Max
    [4, 8], // Karl -> Max
    [9, 10], // Wilhelm -> Orphan (Wilhelm has no Families row of his own)
  ]
  for (const [parentId, childId] of parentLinks) {
    db.run(
      "INSERT INTO Relationships (person_id_1, person_id_2, relationship_type) VALUES (?, ?, 'biological_parent')",
      [parentId, childId],
    )
  }

  db.run("INSERT INTO Images (image_id, url, is_published) VALUES (1, 'family1.jpg', 1)")
  // Unpublished -- linked to family 3 below to exercise the
  // is_published filter on the header-image lookup.
  db.run("INSERT INTO Images (image_id, url, is_published) VALUES (2, 'unpub.jpg', 0)")

  db.run(
    'INSERT INTO Families (family_id, person_id_1, person_id_2, description) VALUES (1, 3, 4, ?)',
    ['Anna and Karl'],
  )
  db.run(
    'INSERT INTO Families (family_id, person_id_1, person_id_2, description) VALUES (2, 1, 2, ?)',
    ['Hans and Greta'],
  )
  db.run(
    'INSERT INTO Families (family_id, person_id_1, person_id_2, description) VALUES (3, 5, 6, ?)',
    ['Otto and Ida'],
  )
  db.run(
    'INSERT INTO Families (family_id, person_id_1, person_id_2, description) VALUES (4, 1, NULL, ?)',
    ['Hans, single parent (fixture for nullable person_2)'],
  )
  db.run(
    'INSERT INTO Families (family_id, person_id_1, person_id_2, description) VALUES (6, 13, 14, ?)',
    ['Klaus and Wife One'],
  )
  db.run(
    'INSERT INTO Families (family_id, person_id_1, person_id_2, description) VALUES (7, 13, 15, ?)',
    ['Klaus and Wife Two'],
  )

  // Spouse relationships, for the anniversaries "marriage" event tests.
  // Klaus is a partner in two Families rows (6 and 7 above) -- this
  // Relationships row is specifically about his marriage to Wife Two,
  // so it must resolve to family_id 7, not 6.
  db.run(
    `INSERT INTO Relationships (person_id_1, person_id_2, relationship_type, status, start_date)
     VALUES (13, 15, 'spouse', 'married', '1975-06-14')`,
  )
  // Wilhelm and Frieda: a spouse relationship with no matching Families
  // row at all, for the linkedFamilyId: null case.
  db.run(
    `INSERT INTO Relationships (person_id_1, person_id_2, relationship_type, status, start_date)
     VALUES (9, 12, 'spouse', 'married', '1945-09-01')`,
  )

  // Header images are linked via ImageLinks.family_id, not
  // Families.image_id (confirmed against the real DB -- see
  // queries/families.ts's getFamilyById comment).
  db.run('INSERT INTO ImageLinks (image_id, family_id) VALUES (1, 1)')
  db.run('INSERT INTO ImageLinks (image_id, family_id) VALUES (2, 3)')

  // Three galleries exercising getLinkedGalleries' rules: linked via
  // GalleryLinks.person_id (family_id is never populated in the real
  // DB), only counted for the couple (not grandparents), and only if
  // the gallery has at least one published photo.
  db.run("INSERT INTO Galleries (gallery_id, name) VALUES (1, 'Family Reunion 2020')")
  db.run('INSERT INTO GalleryImages (gallery_id, image_id) VALUES (1, 1)') // published
  db.run('INSERT INTO GalleryLinks (gallery_id, person_id) VALUES (1, 3)') // Anna -- couple

  db.run("INSERT INTO Galleries (gallery_id, name) VALUES (2, 'Unpublished Only')")
  db.run('INSERT INTO GalleryImages (gallery_id, image_id) VALUES (2, 2)') // unpublished
  db.run('INSERT INTO GalleryLinks (gallery_id, person_id) VALUES (2, 4)') // Karl -- couple

  db.run("INSERT INTO Galleries (gallery_id, name) VALUES (3, 'Hans Solo')")
  db.run('INSERT INTO GalleryImages (gallery_id, image_id) VALUES (3, 1)') // published
  db.run('INSERT INTO GalleryLinks (gallery_id, person_id) VALUES (3, 1)') // Hans -- grandparent, not couple
}
