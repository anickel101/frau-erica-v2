-- 004: link a document's author to their Persons record
--
-- The site already knows how to render an author as a link to their
-- family page -- TextByline has had that branch since the byline was
-- first shared between the index rows and the text page -- but the
-- branch was unreachable, because nothing in the archive ever said
-- WHICH person an author string referred to. The export hardcoded the
-- field to null and the byline always took the plain-text path.
--
-- This is the missing column. See schema.sql's "Authorship" note for
-- why the archive keeps both the name and the id rather than matching
-- one to the other: the name does not identify anybody (two Mark
-- Nickels, several Friedrich Muellers), and much of what the family
-- actually calls its authors -- "Nana", "Opa", "Tante Fieks" -- is
-- nothing like the name in Persons.
--
-- NULL on every existing row, which means "no record, or not yet
-- identified". All 242 documents behave exactly as they did before this
-- ran until a row is deliberately set. The statements are verbatim from
-- the same-dated schema.sql edit, less its comments.

-- No DEFAULT: SQLite requires a NULL default when adding a column that
-- carries a REFERENCES clause, which is what is wanted here anyway.
ALTER TABLE Documents ADD COLUMN author_person_id INTEGER REFERENCES Persons(person_id);

-- "Everything this person wrote" is the lookup worth having an index
-- for -- it is what a future author page, or a family page listing
-- someone's own writing, would ask.
CREATE INDEX IF NOT EXISTS idx_documents_author_person ON Documents(author_person_id);
