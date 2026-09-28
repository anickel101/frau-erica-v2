-- 002: Series -- give each collection of texts a real name
--
-- Documents.series_key groups chapters into a series, but nothing in the
-- database ever says what a series IS. The website has been deriving a
-- display name from series_title, which is a different field doing a
-- different job: it is the per-chapter kicker TextPage prints above each
-- title, which is why so many of them end in a colon. Reading it as a
-- name produced a 28-letter run called "Christmas 1995:" and a 17-part
-- memoir called "Opened Doors -- Walking Through", both of which are
-- chapter kickers that happened to belong to whichever document was
-- encountered first.
--
-- This table holds the thing that was missing. It also frees
-- series_title to be only what it already is.
--
--   slug     what the URL says (/collections/christmas-letters), kept
--            separate from series_key because the keys are internal
--            CamelCase ("MarkAlliChristmas") and these links get emailed
--            around the family.
--   kind     the three genuinely different things currently all called
--            "series" -- see the CHECK's own comment below.
--   blurb    a sentence or two for the collection's card and page.
--   cover_image_url  optional; the website falls back to the header
--            image of the first chapter, which every document has.
--   sort_key optional override for shelf order; name is used when NULL.

CREATE TABLE Series (
    series_key      TEXT NOT NULL PRIMARY KEY,
    slug            TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    -- 'work'   one work in several chapters, read in order: a memoir, a
    --          travel journal, a translated booklet.
    -- 'annual' a run of the same thing once a year -- the Christmas
    --          letters, 1995 to 2023. Reads by date, newest first.
    -- 'person' everything the archive holds about one person, written
    --          by different hands at different times. No reading order.
    kind            TEXT NOT NULL CHECK (kind IN ('work', 'annual', 'person')),
    blurb           TEXT,
    cover_image_url TEXT,
    sort_key        TEXT
);

-- No foreign key from Documents.series_key to here. SQLite cannot add
-- one to an existing table without rebuilding it, and Documents is
-- pointed at by every ImageLinks and DocumentLinks row. The export
-- checks the relationship instead, and says so when a series_key has no
-- Series row.
