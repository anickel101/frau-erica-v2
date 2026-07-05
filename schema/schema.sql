-- ============================================================
-- Family Tree Database — Schema
-- ============================================================
-- This file defines the STRUCTURE of the database only.
-- It does not contain any actual family data — that lives in
-- the .db file, which is kept out of version control.
--
-- To (re)build a fresh, empty database from this file:
--   sqlite3 new_family_tree.db < schema.sql
-- ============================================================

-- SQLite disables foreign key enforcement by default.
-- This turns it on so relationships must point to real records.
PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------
-- Persons: one row per individual in the family tree
-- ------------------------------------------------------------
CREATE TABLE Persons (
    person_id     INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    first_name    TEXT NOT NULL,
    last_name     TEXT NOT NULL,
    middle_name   TEXT,
    date_of_birth DATE,
    date_of_death DATE,
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
    is_published INTEGER NOT NULL DEFAULT 0
);

-- ------------------------------------------------------------
-- Documents: written pieces (biographies, articles, etc.)
-- ------------------------------------------------------------
CREATE TABLE Documents (
    document_id  INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    title        TEXT NOT NULL,
    author       TEXT,
    summary      TEXT,
    genre        TEXT,
    tags         TEXT,
    content_url  TEXT NOT NULL,
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
--   Documents (e.g. a header image illustrating a document).
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
    document_id       INTEGER NOT NULL,
    person_id         INTEGER,
    family_id         INTEGER,
    CONSTRAINT DocumentLinks_Documents_FK FOREIGN KEY (document_id) REFERENCES Documents(document_id),
    CONSTRAINT DocumentLinks_Persons_FK   FOREIGN KEY (person_id)   REFERENCES Persons(person_id),
    CONSTRAINT DocumentLinks_Families_FK  FOREIGN KEY (family_id)   REFERENCES Families(family_id)
);