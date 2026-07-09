# frau-erica-v2
Redesigned and rebuilt version of the original www.frauerica.org website.

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
- **Bucket access**: private, not public — this data includes real names
  and birthdates for living people, unlike the schema in this repo.
- **Retrieving a backup**: any team member with appropriate AWS access can
  list and download backups via `aws s3 ls s3://frau-erica-db-backups` /
  `aws s3 cp`. Ask Anson if you need this set up on a new machine.

This is separate from git — the backup exists purely to protect the real
data, and has no connection to version control or this repository's history.
