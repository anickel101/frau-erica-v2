-- 001: parallel-text documents (language, parallel_of)
--
-- Several works in the archive are held as a single document with the
-- German and its English translation interleaved, paragraph by
-- paragraph -- Fritz Mueller's journal (documents 87-92), Ludwig
-- Knief's memoir (134-140), and a handful of standalone pieces. This
-- pair of columns lets the two languages live as two documents, linked,
-- so the site can set them side by side instead of one after the other.
--
-- Both columns are NULL for every existing row, which means "not part
-- of a pair" -- so all 225 documents behave exactly as they did before
-- this ran, until a document is deliberately split.
--
-- See schema.sql's note under Documents for what the columns mean and
-- why this is two columns rather than a Translations join table. The
-- statements below are verbatim from that same-dated schema.sql edit,
-- less its inline comments.

ALTER TABLE Documents ADD COLUMN language TEXT CHECK (language IN ('en', 'de'));

-- No DEFAULT, so this is NULL on every existing row. SQLite requires a
-- NULL default when adding a column that carries a REFERENCES clause,
-- which is what is wanted here anyway.
ALTER TABLE Documents ADD COLUMN parallel_of INTEGER REFERENCES Documents(document_id);

-- Finding the other half of a pair is the lookup the export does for
-- every parallel-text document.
CREATE INDEX IF NOT EXISTS idx_documents_parallel_of ON Documents(parallel_of);

-- One thing schema.sql states that SQLite's ALTER TABLE cannot add to
-- an existing table, so the live database honours it by convention
-- only:
--
--   CONSTRAINT Documents_parallel_not_self
--     CHECK (parallel_of IS NULL OR parallel_of <> document_id)
--
-- Adding a table-level CHECK means rebuilding the table, and Documents
-- is pointed at by every ImageLinks and DocumentLinks row. Not worth a
-- rebuild to enforce a rule that the export-time validation already
-- covers and that nothing writes by hand. A database built fresh from
-- schema.sql does get the constraint.
