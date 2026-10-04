# Tagging photographs

A short guide for the Archivist. Written to be handed over as-is.

---

## What this is for

The archive knows which gallery a photograph belongs to, but not who is
actually in it. A picture in Anson's gallery showing Anson and his father
only ever said "Anson". Tagging fixes that, one photograph at a time.

Once a photograph is tagged, its people appear underneath it on the
gallery page, each one linking to their family page.

## Getting there

Sign in, then **Tag photographs** in the sidebar. It only appears for
administrators.

Pick a gallery and start. You can stop whenever you like.

## How it works

One photograph at a time, with its caption beside it. The caption usually
names the people, which is often faster than recognising a face.

- **Likely** — a short list of names to tap. These come from people
  already tagged elsewhere in this gallery, whoever the gallery is about,
  and names found in the caption. Each one says why it was suggested.
- **Someone else** — search by name for anyone not on that list.
- **In this photograph** — who you have tagged so far. The ✕ beside a
  name removes it.
- **Skip / Next** — moves on without tagging anything.

## Things worth knowing

**Your work saves the instant you tap a name.** There is no Save button.
You can close the tab mid-gallery and come back later; it reopens at the
first photograph you haven't tagged.

**Tagging the same person twice does nothing.** Each tag is a pair — this
photograph, this person — so tapping a name again just restates the same
fact. There is no duplicate to clean up afterwards. If you aren't sure
whether you already tagged someone, tag them.

**Skipping is fine, and expected.** "I don't know who that is" is a
perfectly good answer. Nothing requires a photograph to be tagged, and
nothing goes wrong if it never is.

**Only tag people who are actually in the picture.** Not the photographer,
not the person who owned the house. If someone matters to the photograph
but isn't in it, that belongs in the caption rather than a tag.

**You cannot break anything.** Tags are collected separately from the
family archive. They are reviewed before anything is added to it, and a
wrong tag is removed with a single tap. Nothing you do here can alter a
person's record, a family page, or a document.

## When someone isn't in the archive

Some people in these photographs have no record at all — a family friend,
a neighbour, an in-law who never got an entry. There is nothing to tag
them with. Skip them, and mention them in the caption if it matters.

## What happens next

The tags sit in their own list until Anson reviews them and adds them to
the archive. After that they appear on the gallery pages. So there is a
gap between your tagging and anything visible changing — that is expected,
not a problem.

The gallery list shows where things stand: how far through each gallery
you are, and, when there is any, a note saying how much is saved but not
yet added to the archive. If that note is there, nothing is wrong — it
just means Anson hasn't done the next step yet.

---

### For Anson: applying the tags

```sh
cd app

# read what has been collected, grouped by photograph
npm run review-photo-tags
npm run review-photo-tags -- --gallery=12

# emit SQL for the ones not already in the archive
npm run review-photo-tags -- --out=/tmp/tags.sql
```

Needs AWS credentials (`AWS_PROFILE=frau-erica-v2-deploy`).

Then the usual: back up, rehearse on the copy, apply, export, and push
the snapshot.

```sh
DB="$HOME/Library/Mobile Documents/com~apple~CloudDocs/frau-erica-db/frau_erica.db"
sqlite3 "$DB" ".backup '/tmp/frau_erica.pre-tags.db'"
sqlite3 /tmp/frau_erica.pre-tags.db < /tmp/tags.sql   # rehearse
sqlite3 "$DB" < /tmp/tags.sql                          # apply
npm run export-data                                    # galleries.json
~/scripts/frau-erica-backup.sh                         # gated pages
```

The script is safely re-runnable: anything already in `ImageLinks` is
reported as "already in the archive" and left out of the SQL, so it never
writes a tag twice.
