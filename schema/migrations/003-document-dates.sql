-- 003: when is this text from?  (date_display, date_sort)
--
-- NOT YET APPLIED. Written so the columns exist the moment the dating
-- pass starts, rather than being retrofitted onto 153 rows afterwards.
-- Apply it when that pass begins, not before -- see
-- schema/migrations/README.md for the backup-and-rehearse procedure.
--
-- The archive records no date for a document anywhere today, so the
-- Index of Texts can be sorted alphabetically and no other way, and a
-- timeline of what the family wrote and when is impossible to build.
--
-- TWO COLUMNS, because one cannot do both jobs:
--
--   date_display  what a reader sees, in whatever precision the archive
--                 actually knows: "November 8, 1933", "December 1995",
--                 "1867", "c. 1910", "Spring 1948". Free text on
--                 purpose. Most of these documents are not dated to the
--                 day and never will be, and a column that forces a
--                 full date would invent one -- the same mistake
--                 Persons avoids by keeping birth_year alongside
--                 date_of_birth rather than defaulting to January 1st.
--
--   date_sort     the same moment, written so that plain string
--                 comparison is chronological order: "1933-11-08",
--                 "1995-12", "1867". Shorter means less precise, and
--                 because the parts are fixed width and most-
--                 significant-first, "1867" < "1867-03" < "1867-03-04"
--                 < "1868" falls out for free. No date arithmetic is
--                 needed to sort a timeline, which is the only thing
--                 this column is for.
--
-- Both nullable, and expected to stay NULL on a good number of rows. An
-- honest "not dated" bucket is part of the design: around 40 published
-- documents carry no year anywhere in their own text, and inventing
-- dates for them to make a filter look complete would be the worst
-- possible outcome.
--
-- No CHECK on the format of either. date_display is deliberately free
-- text, and a CHECK on date_sort strict enough to be worth having would
-- reject exactly the loose precisions this exists to support.

ALTER TABLE Documents ADD COLUMN date_display TEXT;
ALTER TABLE Documents ADD COLUMN date_sort TEXT;

-- Ordering the whole index by date is the query this enables, and it
-- would otherwise scan every row.
CREATE INDEX IF NOT EXISTS idx_documents_date_sort ON Documents(date_sort);
