# Frau Erica — Repository

This repo has three main parts:

- **`schema/`** — the SQLite database schema (`schema.sql`). The actual
  `.db` file is never committed, only the schema. See the file's own
  comments for column-level documentation.
- **`app/`** — the React/Vite site. Has its own `CLAUDE.md` with full
  details (design system, component patterns, auth plan, phase status)
  — read that before doing any site work.
- **`api/`** — the AWS Lambda + API Gateway backend for gated content
  (Persons/Families/search) and the account lifecycle (request access,
  admin approval, login support). Has its own `CLAUDE.md` with the AWS
  architecture, IAM/testing conventions, and a full list of AWS services
  in use and why — read that before touching anything in `api/`.

## How the three parts fit together

- `schema/schema.sql` is the single source of truth for the family-tree
  data model. The real, editable `.db` file lives outside this repo (on
  the archivist's machine, in iCloud Drive) and is never committed.
- Public content (Documents, Galleries, Lexicon) is exported from that
  database to static JSON committed into `app/src/data/generated/` —
  `app/` reads it directly, no live queries, no `api/` involvement.
- Gated content (Persons, Families) and everything account-related
  (login, request access, admin approval) goes through `api/`, which
  reads a periodically-synced read-only snapshot of the same database
  from S3 — see `api/CLAUDE.md` for exactly how that sync works.

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
