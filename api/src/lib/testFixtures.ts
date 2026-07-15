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
  ]
  for (const [id, first, last, dob] of persons) {
    db.run(
      'INSERT INTO Persons (person_id, first_name, last_name, date_of_birth) VALUES (?, ?, ?, ?)',
      [id, first, last, dob],
    )
  }

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

  db.run(
    'INSERT INTO Families (family_id, person_id_1, person_id_2, description, image_id) VALUES (1, 3, 4, ?, 1)',
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
}
