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
-- This turns it on so relationships must point to real people.
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
    date_of_death DATE
);

-- ------------------------------------------------------------
-- Relationships: links between Persons
--   relationship_type: 'biological_parent', 'step_parent', 'spouse'
--     - for 'biological_parent'/'step_parent': person_id_1 is the
--       parent, person_id_2 is the child
--     - for 'spouse': person_id_1/person_id_2 order doesn't matter
--   status/start_date/end_date only apply to 'spouse' rows:
--     - status: 'married', 'divorced', or 'widowed'
--     - start_date: marriage date
--     - end_date: divorce date, or date of spouse's death if widowed
--   Siblings are NOT stored here — they're derived by querying for
--   people who share a parent, to avoid duplicating data that could
--   drift out of sync.
-- ------------------------------------------------------------
CREATE TABLE Relationships (
    relationship_id   INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    person_id_1       INTEGER NOT NULL,
    person_id_2       INTEGER NOT NULL,
    relationship_type TEXT NOT NULL,
    status            TEXT,
    start_date        DATE,
    end_date          DATE,
    CONSTRAINT Relationships_Persons_FK_1 FOREIGN KEY (person_id_1) REFERENCES Persons(person_id),
    CONSTRAINT Relationships_Persons_FK_2 FOREIGN KEY (person_id_2) REFERENCES Persons(person_id)
);

-- ------------------------------------------------------------
-- Families: couples/partnerships with description/image
-- ------------------------------------------------------------
CREATE TABLE Families (
	family_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	person_id_1 INTEGER,
	person_id_2 INTEGER,
	description TEXT,
	CONSTRAINT Families_Persons_FK FOREIGN KEY (person_id_1) REFERENCES Persons(person_id),
	CONSTRAINT Families_Persons_FK_1 FOREIGN KEY (person_id_2) REFERENCES Persons(person_id)
);

-- ------------------------------------------------------------
-- (planned) Media: photos and documents linked to Persons/Families
-- ------------------------------------------------------------
-- CREATE TABLE Media ( ... );