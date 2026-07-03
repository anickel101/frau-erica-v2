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
-- (planned) Relationships: links between Persons
--   e.g. biological_parent, step_parent, spouse
-- ------------------------------------------------------------
-- CREATE TABLE Relationships ( ... );

-- ------------------------------------------------------------
-- (planned) Families: family groupings with description/image
-- ------------------------------------------------------------
-- CREATE TABLE Families ( ... );

-- ------------------------------------------------------------
-- (planned) Images: photos linked to Persons and/or Families
-- ------------------------------------------------------------
-- CREATE TABLE Images ( ... );