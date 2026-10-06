# Review brief — Frau Erica

For an agent doing one area of a comprehensive review. Read this whole
file before opening any code. It exists to stop you spending your window
re-deriving what is already settled, and to stop you reporting decisions
that were made on purpose.

Written 2026-10-06, against `main`.

---

## What this is

A family archive for the Mueller/Nickel family, live at frauerica.org
since 2026-09-06. Real users: perhaps a few dozen relatives, skewing
elderly and toward older devices. Low traffic, long life — this is meant
to outlast its author, and it holds material nobody else has copies of.

Three independent parts, each with its own `CLAUDE.md` you should read
for your area:

| | |
|---|---|
| `schema/` | SQLite schema + migrations. The `.db` file is never committed. |
| `app/` | React 19 + Vite + Tailwind v4. 120 files, ~10,700 lines. |
| `api/` | AWS SAM: 17 Lambdas, one per route. 71 files, ~6,400 lines. |

`npm run ci` in `app/` (15 test files) and `api/` (28 test files) must
pass. Both were green at the time of writing.

## How data reaches the site — the thing to understand first

Misreading this produces confident, wrong findings.

- **Public content** (Documents, Galleries, Lexicon, Images, Persons) is
  exported from the canonical database to **static JSON committed into
  `app/src/data/generated/`**. The app imports it directly. No API call,
  no live query.
- **Gated content** (Families, search, germline, Keepers/recipes) goes
  through `api/`, which reads a **read-only S3 snapshot** of the same
  database using sql.js.
- **Photo tags** are collected into a **separate DynamoDB table** and
  applied to the archive later in a reviewed batch.

Consequences worth holding in mind: the canonical database lives on the
archivist's laptop, the API can only ever read, and `RequireApproved` is
a **render** guard, not a data guard.

## Decisions already made — do not report these

Each was deliberate, is documented, and re-raising it costs the reader
attention that a real finding needs.

1. **`persons.json` is public.** 1,321 real people — names and birth
   *years*, no full dates for anyone plausibly living — ship to every
   browser from a public repo. This was examined in the 2026-09-05
   review, decided as an accepted trade-off for a genealogy archive, and
   `README.md` now carries a section stating precisely what is and isn't
   exposed. Do not re-litigate. *Do* report any new leak of something
   that section says is **not** published (notes fields, unpublished
   documents, recipes, exact dates of birth).
2. **Static-vs-API split.** Settled. Keepers is gated *because* the
   generated JSON ships to every browser.
3. **Propose-then-apply.** `splitParallelText.ts`, `proposeDates.ts` emit
   SQL for a human rather than writing it. Deliberate.
   `reviewPhotoTags.ts --apply` is the deliberate exception, reasoned in
   its header.
4. **Verdana**, the 1-inch summary indent, and other old-site visual
   choices. Requested by the archivist. Not dated styling to modernise.
5. **No component tests in `app/`.** Every test is a pure function; UI is
   verified in a browser. You may argue a specific component is complex
   enough to deserve one — don't report the absence as a blanket gap.
6. **Provisioned concurrency deferred**, cold starts accepted.
7. **DynamoDB separate from `ImageLinks`.** See `api/CLAUDE.md`.
8. **Web-based editing deliberately not built.** Designed in full and
   shelved.

## Already fixed — confirm, don't rediscover

The 2026-09-05 pre-launch review has largely been acted on. Present and
working as of this brief: `ErrorBoundary`, the catch-all 404 route,
`role="dialog"` on `Modal`, the `--color-fe-link` contrast token
(#b34700, 4.70:1), `robots.txt`, request-time token refresh in
`apiClient`, `AbortSignal`-equivalent request timeout, input validation
and length caps on `/request-access`, ETag freshness checking on the
snapshot cache.

If one of these is present but **wrong or incomplete**, that is a real
finding. Its mere existence is not.

## The 17 routes

```
POST   /request-access          <- the ONLY unauthenticated route
GET    /me                      GET /me/germline
GET    /persons/{id}            GET /families/{id}
GET    /search                  GET /anniversaries
GET    /recipes                 GET /recipes/{slug}
GET    /photo-tags              POST /photo-tags
DELETE /photo-tags/{imageId}/{personId}
POST   /admin/approve           GET /admin/users
PATCH  /admin/users             DELETE /admin/users/{email}
PATCH  /admin/users/{email}/group
```

Groups: `pending` → `approved` → `admin`. `admin` must be strictly
narrower than `approved`, never a superset shortcut.

## What good looks like

**Verify before you report.** Open the file, read the surrounding code,
confirm the claim. A plausible-sounding finding that turns out to be
wrong is worse than silence here, because the next reader stops trusting
the list. Say explicitly when you could not verify something.

**Give a failure scenario.** Concrete inputs or state → the wrong output,
the crash, the exposure. "This could be a problem" is not a finding.
"A user who leaves the tab open past the token's 60-minute expiry sees
*Something went wrong* on every gated page, and `RequireApproved` still
lets them through, so they never see a login prompt" is.

**Rank honestly, and be willing to come back nearly empty.** This
codebase has been reviewed before and the obvious problems are gone.
Three real findings beat thirty padded ones. If your area is genuinely
in good shape, say so and name what you checked.

**Comments are load-bearing here.** The house style explains *why*, often
at length. That means a comment which has become **false** is a defect,
not a nitpick — `export-data` hardcoded `author: null` with an honest
comment ("no document has one"), the comment outlived the fact, and a
database change silently did nothing for weeks. Check claims in comments
against the code they describe.

**Judge against the real audience.** Elderly relatives on old devices,
occasionally on bad connections. A failure mode they can't recover from
without being told to reload matters more than an elegance problem.

## Known-open, if you find yourself here

Not your job to fix, and not findings — but don't report them as
discoveries: the authorship pass across 242 documents (tiers in a
separate artifact), several archive-housekeeping items (duplicate
documents 67/114 and 112/243, 180 uncatalogued S3 files), and one FK
orphan (family 854 → missing person 1198, which `foreign_key_check`
reports on every run).

One that *is* worth confirming, because it is live: **six documents have
empty content and five of them are published** — 98, 119, 186, 188, 190
published, 203 not. If the site renders those as a title and a byline
with nothing under it, say so and say what a reader sees.

## Your area

You will be told which **one** of these you own. Stay in it; another
agent has the others, and overlap wastes both windows.

1. **api/ — security and correctness.** Every route guarded before any
   side effect. Authorization narrower than authentication. Input
   validation on the unauthenticated route. IAM scope per function.
   Cognito and SES flows. SQL parameterisation. What a half-failed
   multi-step handler leaves behind.
2. **app/ — React correctness and robustness.** Effects and cleanup,
   stale state, race conditions, error and empty and loading states.
   What a real user sees when a request fails, a param is malformed, or
   a deploy changes chunk hashes under an open tab.
3. **Accessibility.** Keyboard paths, focus management, semantics,
   contrast, target sizes, screen-reader labelling. Weight this for the
   actual audience, and check the fixes listed above are complete rather
   than nominal.
4. **Data pipeline and schema.** `export-data.ts`, the publish loops,
   `schema.sql` versus `schema/migrations/`, the `scripts/` directory.
   Silent-wrong-output risks. Anything that can make the exported JSON
   disagree with the archive.
5. **Clarity and cleanliness.** Dead code, unreachable branches,
   duplication worth removing, naming, and — specifically — comments and
   docs that no longer match the code.

## Reporting

Return findings only. Do not paste file contents back; cite
`path/to/file.ts:42`. For each: what is wrong, the failure scenario, how
confident you are and why, and a suggested fix if you have one worth
stating. Most severe first.
