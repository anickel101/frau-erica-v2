-- 005: add 'Obituary' to the Documents.genre closed set
--
-- The archive holds a good many obituaries -- newspaper notices,
-- church-paper death notices -- and with no category for them they all
-- sat in 'Other', the bucket that says nothing. Added on the
-- archivist's instruction, 2026-10-19.
--
-- WHY THIS REBUILDS THE TABLE
--
-- genre's closed set is a column CHECK, and SQLite's ALTER TABLE cannot
-- modify a constraint on an existing table. The only way to widen it is
-- the documented twelve-step rebuild: create the table afresh, copy
-- every row, drop the original, rename. Migration 001 anticipated this
-- exact situation in its closing note and deferred the work; this is
-- that rebuild.
--
-- Since the table is being rebuilt anyway, it is rebuilt to match
-- schema.sql EXACTLY rather than merely widening the CHECK, which
-- closes two divergences that 001 and 004 had to leave open:
--
--   1. Column order. language, parallel_of and author_person_id were
--      added by ALTER TABLE and so sat at the end, after is_published,
--      where schema.sql has always declared them in the middle. Safe to
--      correct: nothing in the repo does SELECT * against Documents, so
--      no caller depends on ordinal position.
--   2. CONSTRAINT Documents_parallel_not_self. schema.sql has declared
--      it since 001; the live table never had it, because adding a
--      table-level CHECK is this same rebuild. Verified before writing
--      this: zero rows have parallel_of = document_id.
--
-- The CREATE TABLE below is schema.sql's Documents block verbatim, less
-- its inline comments, with 'Obituary' added before 'Other' so the
-- catch-all stays last.
--
-- Documents is pointed at by ImageLinks, DocumentLinks and by itself
-- (parallel_of), so foreign keys are disabled for the swap and
-- foreign_key_check is run afterwards to prove nothing was orphaned.
-- PRAGMA foreign_keys cannot change inside a transaction, hence its
-- position outside BEGIN.

PRAGMA foreign_keys = OFF;

BEGIN;

CREATE TABLE Documents_new (
    document_id  INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    series_key   TEXT,
    series_title TEXT,
    series_order INTEGER,
    title        TEXT NOT NULL,
    author       TEXT,
    author_person_id INTEGER REFERENCES Persons(person_id),
    summary      TEXT,
    content      TEXT,
    genre        TEXT CHECK (genre IN ('Biography', 'Memoir', 'History', 'Literary', 'Letter', 'Recipe', 'Obituary', 'Other')),
    tags         TEXT,
    notes        TEXT,
    language     TEXT CHECK (language IN ('en', 'de')),
    parallel_of  INTEGER REFERENCES Documents(document_id),
    is_published INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT Documents_parallel_not_self CHECK (parallel_of IS NULL OR parallel_of <> document_id)
);

-- Columns named explicitly on both sides, so the copy cannot depend on
-- the ordering that is being changed.
INSERT INTO Documents_new
  (document_id, series_key, series_title, series_order, title, author,
   author_person_id, summary, content, genre, tags, notes, language,
   parallel_of, is_published)
SELECT
   document_id, series_key, series_title, series_order, title, author,
   author_person_id, summary, content, genre, tags, notes, language,
   parallel_of, is_published
FROM Documents;

DROP TABLE Documents;

ALTER TABLE Documents_new RENAME TO Documents;

-- Dropped with the old table; both are verbatim from schema.sql.
CREATE INDEX IF NOT EXISTS idx_documents_author_person ON Documents(author_person_id);
CREATE INDEX IF NOT EXISTS idx_documents_parallel_of ON Documents(parallel_of);

COMMIT;

-- Expected to report only the two long-standing orphans this archive
-- has always had, both in other tables: Relationships|385|Persons|0 and
-- Families|854|Persons|0. Anything naming Documents is a failure.
PRAGMA foreign_key_check;

PRAGMA foreign_keys = ON;
