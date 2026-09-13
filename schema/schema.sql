-- ============================================================
-- Family Tree Database — Schema
-- ============================================================
-- This file defines the STRUCTURE of the database only.
-- It does not contain any actual family data — that lives in
-- the .db file, which is kept out of version control.
--
-- To (re)build a fresh, empty database from this file:
--   sqlite3 new_family_tree.db < schema.sql
--
-- COLUMN ORDER differs from the live database in places, and that is
-- expected rather than drift. Columns added to the real database over
-- time arrived via ALTER TABLE, which can only append -- so Persons has
-- suffix, birth_year, death_year and preferred_first_name in a
-- different order there than here, where they are grouped by meaning.
-- Nothing depends on ordinal position: every query names its columns
-- and nothing uses SELECT *. Column *names* were verified to match the
-- live database exactly (2026-09-08).
-- ============================================================

-- SQLite disables foreign key enforcement by default.
-- This turns it on so relationships must point to real records.
PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------
-- Persons: one row per individual in the family tree
--   date_of_birth/date_of_death hold a full date when known.
--   birth_year/death_year hold just the year when that's all
--   that's known (common for older/distant relatives) — avoids
--   fabricating a fake full date (e.g. defaulting to Jan 1st).
--   When the full date is known, the matching _year column is
--   left blank; when only a year is known, the full date column
--   is left blank instead.
--   suffix: e.g. 'Jr.', 'Sr.', 'II', 'III', 'IV'
-- ------------------------------------------------------------
CREATE TABLE Persons (
    person_id     INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    first_name    TEXT NOT NULL,
    last_name     TEXT NOT NULL,
    middle_name   TEXT,
    -- The name this person actually went by, where it differs from their
    -- legal first name -- "Allison" for Mary Allison McMillan, "Molly"
    -- for Mary Allison Bigelow. NOT a nickname: "Nana" and "Dick" are family
    -- pet names and don't belong here, only what passed for a genuine
    -- first name.
    --
    -- Replaces the whole given-name part when displayed, not just the
    -- first name, so "Allison" renders "Allison McMillan" rather than
    -- "Allison Allison McMillan" -- for both people this was added for,
    -- the preferred name IS their middle name.
    --
    -- Used only for the Family page headline; the lilac/gold/green name
    -- blocks continue to show the full legal name, so nothing here
    -- hides what's on record. NULL means "no different from
    -- first_name", which is the case for almost everyone.
    preferred_first_name TEXT,
    suffix        TEXT,
    date_of_birth DATE,
    birth_year    INTEGER,
    date_of_death DATE,
    death_year    INTEGER,
    notes         TEXT
);

-- ------------------------------------------------------------
-- Relationships: links between Persons
--   relationship_type: 'biological_parent', 'step_parent',
--     'adoptive_parent', 'spouse'
--     - for parent types: person_id_1 is the parent, person_id_2
--       is the child
--     - for 'spouse': person_id_1/person_id_2 order doesn't matter
--   status/start_date/end_date only apply to 'spouse' rows:
--     - status: 'married', 'divorced', 'widowed', or 'separated'
--     - start_date: marriage date
--     - end_date: divorce date, or date of spouse's death if widowed
--   Siblings are NOT stored here — they're derived by querying for
--   people who share a parent, to avoid duplicating data that could
--   drift out of sync. Full vs. half sibling is likewise derivable
--   by checking how many parents two people have in common.
-- ------------------------------------------------------------
CREATE TABLE Relationships (
    relationship_id   INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    person_id_1       INTEGER NOT NULL,
    person_id_2       INTEGER NOT NULL,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN ('biological_parent', 'step_parent', 'adoptive_parent', 'spouse')),
    status            TEXT CHECK (status IN ('married', 'divorced', 'widowed', 'separated')),
    start_date        DATE,
    end_date          DATE,
    CONSTRAINT Relationships_Persons_FK_1 FOREIGN KEY (person_id_1) REFERENCES Persons(person_id),
    CONSTRAINT Relationships_Persons_FK_2 FOREIGN KEY (person_id_2) REFERENCES Persons(person_id)
);

-- ------------------------------------------------------------
-- Safety check: for parent-type relationships, catches the most
-- common data-entry mistake — person_id_1/person_id_2 reversed —
-- by checking that the parent's birth date precedes the child's.
-- Only fires when both birth dates are known; can't catch every
-- reversal (e.g. when a birth date is missing), but catches the
-- common case for free.
-- ------------------------------------------------------------
CREATE TRIGGER check_parent_birth_order
BEFORE INSERT ON Relationships
WHEN NEW.relationship_type IN ('biological_parent', 'step_parent', 'adoptive_parent')
BEGIN
    SELECT RAISE(ABORT, 'Parent must be born before child — check person_id_1/person_id_2 order')
    WHERE (SELECT date_of_birth FROM Persons WHERE person_id = NEW.person_id_1) IS NOT NULL
      AND (SELECT date_of_birth FROM Persons WHERE person_id = NEW.person_id_2) IS NOT NULL
      AND (SELECT date_of_birth FROM Persons WHERE person_id = NEW.person_id_1) >
          (SELECT date_of_birth FROM Persons WHERE person_id = NEW.person_id_2);
END;

-- ------------------------------------------------------------
-- Images: photos, with metadata
--   url: just the filename (e.g. 'Addie1.jpg'), not a full URL.
--     The website builds the actual link at display time (base
--     URL lives in app config, not the database) — this way the
--     hosting location (S3, a custom domain, CloudFront, etc.)
--     can change without touching any data.
-- ------------------------------------------------------------
CREATE TABLE Images (
    image_id     INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    caption      TEXT,
    credit       TEXT,
    tags         TEXT,
    year_taken   INTEGER,
    location     TEXT,
    width        INTEGER,
    height       INTEGER,
    url          TEXT NOT NULL,
    notes        TEXT,
    is_published INTEGER NOT NULL DEFAULT 0,
    title TEXT
);

-- ------------------------------------------------------------
-- Documents: written pieces (biographies, articles, letters, etc.)
--   content: the body text, stored as Markdown. Embedded images
--     use a {{image:ID}} placeholder referencing a real Images row
--     (resolved at render time by the website, not by the database).
--   series_key/series_title/series_order: for multi-chapter pieces
--     (e.g. a memoir split across several pages). series_key is a
--     shared value across all chapters of the same work; series_order
--     gives their sequence. A standalone document leaves all three
--     blank. This replaces the old site's approach of hand-maintained
--     "table of contents" links copy-pasted into every chapter file,
--     which had already drifted out of sync in the original source.
--   genre: closed set, taken directly from the original site's own
--     genre index page.
-- ------------------------------------------------------------
CREATE TABLE Documents (
    document_id  INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    series_key   TEXT,
    series_title TEXT,
    series_order INTEGER,
    title        TEXT NOT NULL,
    author       TEXT,
    summary      TEXT,
    content      TEXT,
    genre        TEXT CHECK (genre IN ('Biography', 'Memoir', 'History', 'Literary', 'Letter', 'Recipe', 'Other')),
    tags         TEXT,
    notes        TEXT,
    is_published INTEGER NOT NULL DEFAULT 0
);

-- ------------------------------------------------------------
-- Families: couples/partnerships with description and photo
--   person_id_1/person_id_2 are nullable to support single-parent
--   families. The same person can appear across multiple Families
--   rows (e.g. widowed then remarried) — each row is one pairing,
--   not a lifelong assignment.
--   Children are NOT stored here — they're derived via Relationships
--   (anyone whose parent is person_id_1 or person_id_2).
--   tags: free-text, comma-separated (e.g. 'Mayflower').
-- ------------------------------------------------------------
CREATE TABLE Families (
    family_id    INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    person_id_1  INTEGER,
    person_id_2  INTEGER,
    description  TEXT,
    image_id     INTEGER REFERENCES Images(image_id),
    tags         TEXT,
    CONSTRAINT Families_Persons_FK   FOREIGN KEY (person_id_1) REFERENCES Persons(person_id),
    CONSTRAINT Families_Persons_FK_1 FOREIGN KEY (person_id_2) REFERENCES Persons(person_id)
);

-- ------------------------------------------------------------
-- ImageLinks: connects Images to Persons, Families, and/or
--   Documents (e.g. a header image illustrating a document, or
--   an image embedded partway through a document's content).
--   person_id/family_id/document_id are all nullable — typically
--   only one is set per row. One image can have many link rows
--   (e.g. a group photo linked to 5 people).
-- ------------------------------------------------------------
CREATE TABLE ImageLinks (
    image_link_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    image_id      INTEGER NOT NULL,
    person_id     INTEGER,
    family_id     INTEGER,
    document_id   INTEGER,
    CONSTRAINT ImageLinks_Images_FK    FOREIGN KEY (image_id)    REFERENCES Images(image_id),
    CONSTRAINT ImageLinks_Persons_FK   FOREIGN KEY (person_id)   REFERENCES Persons(person_id),
    CONSTRAINT ImageLinks_Families_FK  FOREIGN KEY (family_id)   REFERENCES Families(family_id),
    CONSTRAINT ImageLinks_Documents_FK FOREIGN KEY (document_id) REFERENCES Documents(document_id)
);

-- ------------------------------------------------------------
-- DocumentLinks: connects Documents to Persons and/or Families.
--   Same nullable pattern as ImageLinks.
-- ------------------------------------------------------------
CREATE TABLE DocumentLinks (
    document_link_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    document_id      INTEGER NOT NULL,
    person_id         INTEGER,
    family_id         INTEGER,
    CONSTRAINT DocumentLinks_Documents_FK FOREIGN KEY (document_id) REFERENCES Documents(document_id),
    CONSTRAINT DocumentLinks_Persons_FK   FOREIGN KEY (person_id)   REFERENCES Persons(person_id),
    CONSTRAINT DocumentLinks_Families_FK  FOREIGN KEY (family_id)   REFERENCES Families(family_id)
);

-- ------------------------------------------------------------
-- Galleries: named, described collections of photos
--   (source: FileMaker's $arrayGalleries, e.g. "Thomas Crawley
--   Knowles: Year One") — distinct from a simple 'Gallery' tag,
--   these have their own name, summary text, and a designated
--   lead/cover image.
-- ------------------------------------------------------------
CREATE TABLE Galleries (
    gallery_id    INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    summary       TEXT,
    lead_image_id INTEGER REFERENCES Images(image_id)
);

-- ------------------------------------------------------------
-- GalleryImages: which Images belong to which Gallery, in order.
--   sort_order preserves the original display sequence from the
--   source data (not alphabetical or arbitrary).
-- ------------------------------------------------------------
CREATE TABLE GalleryImages (
    gallery_image_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    gallery_id        INTEGER NOT NULL,
    image_id          INTEGER NOT NULL,
    sort_order         INTEGER,
    CONSTRAINT GalleryImages_Galleries_FK FOREIGN KEY (gallery_id) REFERENCES Galleries(gallery_id),
    CONSTRAINT GalleryImages_Images_FK    FOREIGN KEY (image_id)   REFERENCES Images(image_id)
);

-- ------------------------------------------------------------
-- GalleryLinks: connects Galleries to Persons and/or Families.
--   Same nullable pattern as ImageLinks/DocumentLinks. A gallery
--   with no rows here is simply a general gallery, not tied to
--   any specific person or family — no sentinel value needed.
-- ------------------------------------------------------------
CREATE TABLE GalleryLinks (
    gallery_link_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    gallery_id       INTEGER NOT NULL,
    person_id        INTEGER,
    family_id        INTEGER,
    -- A denormalized copy of Galleries.name for the linked gallery.
    --
    -- Declared here because it exists in the real database and this file
    -- is meant to describe it faithfully -- it was present for months
    -- without being declared, which is how it went unnoticed until a
    -- database-wide scan turned up mojibake in a column the schema said
    -- didn't exist.
    --
    -- Redundant by nature: it duplicates data that Galleries already
    -- owns, and can therefore disagree with it. Checked across all 36
    -- rows and every one currently matches Galleries.name exactly,
    -- including through the mojibake repair, which corrected both copies.
    -- Nothing in this repository reads it -- not api/, not app/, not the
    -- export script; gallery names are always resolved by joining
    -- Galleries on gallery_id. It appears to be maintained by the
    -- FileMaker side.
    --
    -- Treat Galleries.name as authoritative if the two ever disagree.
    gallery_name     TEXT,
    CONSTRAINT GalleryLinks_Galleries_FK FOREIGN KEY (gallery_id) REFERENCES Galleries(gallery_id),
    CONSTRAINT GalleryLinks_Persons_FK   FOREIGN KEY (person_id)  REFERENCES Persons(person_id),
    CONSTRAINT GalleryLinks_Families_FK  FOREIGN KEY (family_id)  REFERENCES Families(family_id)
);


-- ------------------------------------------------------------
-- Lexicon: a glossary of family German phrases, in-jokes, and
--   terms, with pronunciation and definition. Standalone reference
--   content, not linked to Persons/Families/Documents.
-- ------------------------------------------------------------
CREATE TABLE Lexicon (
    lexicon_id     INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    term           TEXT NOT NULL,
    pronunciation  TEXT,
    part_of_speech TEXT,
    definition     TEXT,
    notes          TEXT
);


-- ------------------------------------------------------------
-- Recipes: the Keepers cookbook — "An Index to the Foods of
--   Gideon Lawton Lane" on the original site. Imported from ~55
--   hand-written PHP pages (see app/scripts/importKeepers.ts).
--
--   Unlike Documents, this content is GATED: it is served through
--   api/ to the 'approved' group, not exported to static JSON.
--   Recipes are the first gated content that isn't family-tree data.
--
--   genre: the closed set the original cookbook's index used. Note
--     "Little Plates" is stored AND displayed -- the old site stored
--     that but displayed "Hors d'oeuvres"; the Archivist chose the
--     former. Unlike Documents.genre (94% 'Other'), this arrives
--     fully populated and evenly spread, so it is the organizing
--     dimension the index page and its filters are built on.
--   slug: URL identity, e.g. 'blueberry-buckle'. Verified collision
--     -free across all 50 indexed recipes at import time.
--   header_image_id: shared, not one-per-recipe -- 36 images serve
--     51 recipe pages (hdr.Blueberries.jpg alone serves 5), hence a
--     plain many-to-one FK with no uniqueness constraint.
--   source_note: for the five recipes that credit an outside source
--     (James Beard, the New York Times, the Minnesota Centennial
--     Cookbook, Frau Erica's own 1903 Deutsch-Amerikanisches
--     Kochbuch, Cuisinart).
-- ------------------------------------------------------------
CREATE TABLE Recipes (
    recipe_id       INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    slug            TEXT NOT NULL UNIQUE,
    title           TEXT NOT NULL,
    genre           TEXT CHECK (genre IN ('Jams / Canning', 'Bakery / Desserts',
                                          'Little Plates', 'Soups', 'Main Dishes',
                                          'Vegetables / Sides')),
    summary         TEXT,
    header_image_id INTEGER,
    source_note     TEXT,
    notes           TEXT,
    is_published    INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT Recipes_Images_FK FOREIGN KEY (header_image_id) REFERENCES Images(image_id)
);


-- ------------------------------------------------------------
-- RecipeSections: a recipe is a SEQUENCE of sections, not a single
--   "ingredients then steps" pair. The source pages interleave them
--   -- Blueberry Buckle runs streusel ingredients, streusel steps,
--   buckle ingredients, buckle steps; Sour Cherry Tart does it four
--   times. 42 of the 50 indexed recipes have one (usually unlabeled)
--   section, 8 have two to four.
--
--   Sections also carry the two other groupings found in the source:
--   Molly's Fruitcake uses them for batch scales ("The basic recipe",
--   "To triple", "To quadruple"), and Eierschwer for its 1903
--   original vs. its modern adaptation.
--
--   label: NULL for a single-section recipe.
-- ------------------------------------------------------------
CREATE TABLE RecipeSections (
    section_id  INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    recipe_id   INTEGER NOT NULL,
    label       TEXT,
    sort_order  INTEGER NOT NULL,
    CONSTRAINT RecipeSections_Recipes_FK FOREIGN KEY (recipe_id) REFERENCES Recipes(recipe_id)
);


-- ------------------------------------------------------------
-- RecipeIngredients: one line per ingredient.
--
--   column_no: which of the source's two ingredient columns this
--     line belongs to. This is CONTENT, not layout. The split is
--     frequently semantic -- Carrot Muffins puts wet in column 1 and
--     dry in column 2; Boeuf Bourguignon solids then liquids;
--     Butternut Soup components then seasonings -- and the columns
--     are uneven (3/4, 8/10, 5/4), which pure overflow would not
--     produce. Renderers must honor it explicitly; CSS `columns: 2`
--     would reflow and scramble the grouping.
--   lang: NULL for the monolingual majority. Three recipes are
--     bilingual, all from Frau Erica's 1903 Deutsch-Amerikanisches
--     Kochbuch -- Sauerbraten, Johann im Sack, Eierschwer. Their
--     German and English halves share a sort_order and differ only
--     by lang, which gives the paragraph-by-paragraph pairing the
--     Archivist asked for and collapses to one column on a phone.
-- ------------------------------------------------------------
CREATE TABLE RecipeIngredients (
    ingredient_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    section_id    INTEGER NOT NULL,
    text          TEXT NOT NULL,
    column_no     INTEGER NOT NULL DEFAULT 1 CHECK (column_no IN (1, 2)),
    lang          TEXT CHECK (lang IN ('de', 'en')),
    sort_order    INTEGER NOT NULL,
    CONSTRAINT RecipeIngredients_RecipeSections_FK FOREIGN KEY (section_id) REFERENCES RecipeSections(section_id)
);


-- ------------------------------------------------------------
-- RecipeSteps: one markdown paragraph per step, belonging to a
--   section rather than to the recipe -- see RecipeSections above
--   for why.
--
--   lang: same pairing rule as RecipeIngredients.
-- ------------------------------------------------------------
CREATE TABLE RecipeSteps (
    step_id     INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    section_id  INTEGER NOT NULL,
    body        TEXT NOT NULL,
    lang        TEXT CHECK (lang IN ('de', 'en')),
    sort_order  INTEGER NOT NULL,
    CONSTRAINT RecipeSteps_RecipeSections_FK FOREIGN KEY (section_id) REFERENCES RecipeSections(section_id)
);
