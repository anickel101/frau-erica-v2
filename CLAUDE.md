# Frau Erica — Repository

This repo has two main parts:

- **`schema/`** — the SQLite database schema (`schema.sql`). The actual
  `.db` file is never committed, only the schema. See the file's own
  comments for column-level documentation.
- **`app/`** — the React/Vite site. Has its own `CLAUDE.md` with full
  details (design system, component patterns, auth plan, phase status)
  — read that before doing any site work.

## Schema conventions, if touching schema.sql

- SQLite only. `PRAGMA foreign_keys = ON` is required at the top of the
  file for FK enforcement to work.
- Relationships (siblings, grandparents, children) are derived via
  queries wherever possible, not stored redundantly.
- Any column with a known fixed set of values uses a CHECK constraint.
- Add safety triggers for common data-entry mistakes where practical
  (see `check_parent_birth_order` for the existing pattern).
- Schema changes go through a PR — a GitHub Actions workflow
  (`.github/workflows/validate-schema.yml`) validates the schema
  actually builds before merge is allowed.