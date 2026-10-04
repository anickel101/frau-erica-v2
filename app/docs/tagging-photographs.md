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

Two entries at the bottom of the list are not real galleries:

- **Header images** — the photographs that head a family page, a text or
  a collection. Most are scenery or documents, but some are people: the
  gravestones at the top of Wilhelm and Adelheid's page, for instance.
- **Miscellaneous photographs** — everything else that belongs to no
  gallery, including the pictures that appear inside written pieces.

Skipping is especially expected in those two. Many are maps and title
pages with nobody in them at all.

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
AWS_PROFILE=frau-erica-v2-deploy npm run apply-photo-tags
```

That is the whole thing. It reports what has been collected, refuses to
run if any tag names a person or photograph that no longer exists, backs
the archive up, rehearses the change on that backup, applies it, and
re-exports `galleries.json`. Then commit the generated JSON and run
`hosting/deploy-app.sh`.

No snapshot push: photo tags reach the site through the committed
`galleries.json`, not the gated API.

To look before leaping:

```sh
npm run review-photo-tags                     # the report, writes nothing
npm run review-photo-tags -- --gallery=12     # one gallery
npm run review-photo-tags -- --out=/tmp/t.sql # the SQL, to apply by hand
```

Safely re-runnable either way: anything already in `ImageLinks` is
reported as "already in the archive" and left out, so it never writes a
tag twice.
