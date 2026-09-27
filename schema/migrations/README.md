# Migrations

`schema.sql` builds a **fresh, empty** database. It is the source of
truth for what the structure *should* be, and it is the file the
`validate-schema` workflow checks. It is not, and cannot be, the thing
you run against the real archive: running it rebuilds from scratch and
would drop every document, person and photo in it.

So a structural change to the live database is made twice, in two
places that must say the same thing:

1. **`schema.sql`** — edited so a database built from scratch tomorrow
   has the new structure.
2. **A migration here** — the statements that carry the *existing*
   database from the old structure to the new one.

Extract the migration's statements **verbatim** from the `schema.sql`
edit, so the two cannot drift. Where SQLite's `ALTER TABLE` can't
express what `schema.sql` says (it cannot add a constraint to an
existing table, or reorder columns), say so in the migration's own
comments rather than quietly letting the live database differ.

## Naming

`NNN-short-description.sql`, numbered in the order they must run.

## Running one, against the real archive

The canonical database is a single file in iCloud Drive. There is no
staging copy of it, so the rehearsal *is* the safety net:

```sh
DB="$HOME/Library/Mobile Documents/com~apple~CloudDocs/frau-erica-db/frau_erica.db"

# 1. Back up. Use SQLite's own .backup, not `cp` -- cp of a database
#    with an open write transaction copies a torn file.
sqlite3 "$DB" ".backup '/tmp/frau_erica.pre-NNN.db'"

# 2. Rehearse on the copy, and check it came out right.
sqlite3 /tmp/frau_erica.pre-NNN.db < schema/migrations/NNN-....sql

# 3. Only then, the real file.
sqlite3 "$DB" < schema/migrations/NNN-....sql

# 4. Push the snapshot the API reads, or gated pages keep serving the
#    old structure.
~/scripts/frau-erica-backup.sh
```

Keep the backup until the change has been exported, deployed and seen
working on the live site.
