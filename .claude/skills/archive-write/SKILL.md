---
name: archive-write
description: Change the canonical SQLite archive safely — adding or editing people, documents, galleries, series, image links, or running a schema migration. Covers the backup/rehearse/apply ritual, reading integrity and foreign-key checks correctly, and what has to happen afterwards for the change to reach the site. Use for any write to frau_erica.db.
---

# Writing to the archive

The canonical database is **one file, in iCloud, with no staging copy**:

```
/Users/ansonnickel/Library/Mobile Documents/com~apple~CloudDocs/frau-erica-db/frau_erica.db
```

There is no undo. The rehearsal *is* the safety net.

## The ritual

Every step matters and every skipped step fails quietly.

```sh
DB="$HOME/Library/Mobile Documents/com~apple~CloudDocs/frau-erica-db/frau_erica.db"
STAMP=$(date +%Y%m%dT%H%M%S)
BK="/tmp/frau_erica.pre-<what>-$STAMP.db"
```

**1. Write the SQL to a file.** Not an inline `sqlite3` one-liner — the
file is what you rehearse, what you apply, and what you can read back
afterwards to see exactly what ran. Wrap it in `PRAGMA foreign_keys =
ON; BEGIN; ... COMMIT;`.

Generate it with a script when quoting is involved. Family text is full
of apostrophes ("Don't come!", "Chicago's South Side") and hand-escaping
them is how a transaction ends up half-written.

**2. Back up — with `.backup`, never `cp`:**

```sh
sqlite3 "$DB" ".backup '$BK'"
```

`cp` on a database with an open write transaction copies a torn file.

**3. Rehearse on the copy, and inspect the result:**

```sh
sqlite3 "$BK" < change.sql
sqlite3 "$BK" "PRAGMA integrity_check;"       # expect: ok
sqlite3 "$BK" "PRAGMA foreign_key_check;"
sqlite3 "$BK" "SELECT ...;"                   # confirm the rows you meant
```

**4. Apply to the real file**, then re-check `integrity_check`.

**5. Publish it** — see "Getting it to the site" below.

Keep the backup until the change is live and seen working.

## Reading the checks correctly

### `foreign_key_check` output is not what it looks like

```
Relationships|385|Persons|0
```

That is: table, **rowid**, parent table, **FK index**. The trailing `0`
is which foreign key on the row, *not* a person_id. I have misread this
and reported a nonexistent "person 0".

More importantly: **always compare against the before state.** The
archive has two long-standing orphans:

```
Relationships|385|Persons|0
Families|854|Persons|0
```

(family 854 is John Bigelow's third marriage, pointing at a missing
person 1198). They appear on every run. The question is never "are there
violations" but "are there *more* than before" — so run the check on the
untouched file too and diff the two.

### The birth-order trigger can't always help

`check_parent_birth_order` compares `date_of_birth` only. A person
recorded with `birth_year` alone — 138 of them as of October 2026, and
the normal case for anyone whose exact date isn't known — slips straight
past it. When inserting a parent relationship for such a person, **check
the order by hand**: `person_id_1` is the parent, `person_id_2` is the
child.

## Schema changes

A schema change is a **migration**, never an edit to `schema.sql` alone.
`schema.sql` rebuilds from scratch and would drop everything.

Both files change, and must say the same thing:

1. `schema/schema.sql` — so a fresh build has the new structure
2. `schema/migrations/NNN-description.sql` — statements extracted
   **verbatim** from that edit, carrying the existing archive across

Where SQLite's `ALTER TABLE` can't express what `schema.sql` says (it
cannot add a table-level CHECK, or reorder columns), say so in the
migration's comments rather than letting the live database quietly
differ. See `001-document-translations.sql` for that pattern.

Then rehearse and apply as above. Confirm the fresh build still works:

```sh
rm -f /tmp/sc.db && sqlite3 /tmp/sc.db < schema/schema.sql
```

CI validates `schema.sql`, and `api/`'s test fixtures build from it — so
a bad schema edit breaks the api suite, which is the fastest signal you
have. Run `cd api && npm run ci` after touching it.

## Getting it to the site

A write to the database changes nothing visible on its own. Which step
depends on what you touched:

| Touched | Needs |
|---|---|
| Documents, Galleries, Lexicon, Images, Series | `npm run export-data` → commit → `deploy-app.sh` |
| Persons, Families, Relationships | **both** of the above *and* `~/scripts/frau-erica-backup.sh` |
| Recipes / Keepers | `~/scripts/frau-erica-backup.sh` only |

Persons are the one that catches people out: they reach public pages
through committed JSON and gated family pages through the S3 snapshot.
Do one and not the other and the site disagrees with itself.

After exporting, **read the diff** before committing:

```sh
git diff app/src/data/generated/
```

A change that touches more rows than you expect is the export telling
you something. A change that touches *none* means the field you set
isn't exported — which is exactly what happened when `author` was
hardcoded to `null` and a database update had no visible effect at all.

## Propose, then apply

The house pattern for anything derived or judged rather than stated:
`splitParallelText.ts`, `proposeDates.ts` and `reviewPhotoTags.ts` all
emit SQL for a human to read instead of writing it themselves.

Prefer it whenever a wrong answer would be *silent* — paragraphs set
against the wrong translation read perfectly well. `--apply` is
reasonable only where a mistake is visible and reversible, which is why
`reviewPhotoTags.ts` has it and the others don't.

Never guess at identity. 97 first-and-last-name pairs in this archive
are shared by two or more people (six Paul Muellers, five Martin
Muellers, four Charles Bigelows), and family nicknames — "Nana", "Opa",
"Tante Fieks" — look nothing like the names in `Persons`. Resolve a
person by evidence, not by string match, and say so when you can't.
