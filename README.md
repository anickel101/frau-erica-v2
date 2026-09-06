# frau-erica-v2
Redesigned and rebuilt version of the original www.frauerica.org website.

## Repository Practices

This repo uses branch protection to keep `main` safe from accidental
direct pushes and unreviewed changes.

- **No direct pushes to `main`** — all changes go through a Pull Request,
  requiring at least one approval before merging. This applies to
  everyone, including repo admins ("Do not allow bypassing" is enabled).
- **Automated schema validation** — a GitHub Actions workflow
  (`.github/workflows/validate-schema.yml`) runs on every PR that touches
  `schema/schema.sql`. It builds a fresh SQLite database directly from the
  file and confirms all expected tables exist. This catches broken SQL or
  an accidentally-dropped table before it can be merged, rather than after.
- **Branch protection is free here** because this repo is public — GitHub
  only requires a paid plan for branch protection on *private* repos.

### What being a public repo actually means here

Public is a deliberate choice, and it's worth being precise about what
that exposes, because this repo does contain real family data — not just
schema and code.

`app/src/data/generated/persons.json` holds roughly 1,320 people from the
family tree: names, birth dates, and death dates. That includes **full,
exact dates of birth for several hundred people who are still living**,
not just birth years. The same file is also part of the JavaScript bundle
served to every visitor of the site, because public Document and Gallery
pages use it to turn person references into readable names — so this data
is reachable without an account regardless of the repo's visibility, and
the login gate on Family and Person pages does not cover it.

That tradeoff is accepted knowingly: this is a genealogy archive, and
names and dates are the substance of it. It's recorded here so the choice
stays visible rather than becoming an accidental assumption later. Note
also that the file is in this repo's git history, so changing course
later would mean rewriting history, not just deleting the file.

What is deliberately *not* here: the live database itself (see "Backups"
below), which holds more than the site publishes — unpublished records,
internal notes fields, and anything not marked for publication.

### Making a schema change

1. Create a branch, make the change in DBeaver, confirm the DDL via the
   table's DDL tab
2. Update `schema/schema.sql` to match
3. Open a Pull Request — the schema-validation check runs automatically
4. Once approved and the check passes, merge

## Backups

The live database is backed up automatically to a private AWS S3 bucket
(`frau-erica-db-backups`), with versioning enabled for extra protection
against accidental overwrites.

- **How**: a local script on the machine holding the live `.db` file copies
  it to S3 on a schedule (currently daily, via macOS's `launchd`), using a
  dedicated AWS IAM user scoped to write-only access on that one bucket —
  it can't read, delete, or touch anything else in the AWS account.
- **Gotcha worth knowing if recreating this setup**: `launchd` runs scripts
  with a minimal environment that does *not* include your normal shell
  `PATH`. The script must call the `aws` CLI using its full path (e.g.
  `/usr/local/bin/aws`, find yours with `which aws`) — just `aws` on its
  own will silently fail when run by `launchd`, even though it works fine
  when you test the script manually in Terminal.
- **Where the script lives**: locally on that machine only (not in this
  repo), since it's tied to a specific file path and a local AWS CLI
  profile. Not meant to be shared or run from anywhere else.
- **Bucket access**: private, not public. The live database holds
  everything the published site does *plus* unpublished records and notes
  fields, so it stays private even though the published subset is not
  (see "What being a public repo actually means here," above).
- **Retrieving a backup**: any team member with appropriate AWS access can
  list and download backups via `aws s3 ls s3://frau-erica-db-backups` /
  `aws s3 cp`. Ask Anson if you need this set up on a new machine.

This is separate from git — the backup exists purely to protect the real
data, and has no connection to version control or this repository's history.
