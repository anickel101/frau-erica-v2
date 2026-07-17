# Frau Erica — Site (app/)

React + TypeScript + Vite + Tailwind v4. This is the public-facing
rebuild of frauerica.org, replicating the original site's visual
identity while fixing mobile responsiveness (a real gap in the old
site). Built collaboratively with a lot of screenshot-driven visual
iteration against the real live site — treat the current styling as
deliberate, not accidental, unless told otherwise.

## Tech stack, and why

- **Vite + React 19 + TypeScript** — standard, no surprises
- **Tailwind v4** — config lives in `src/index.css` via an `@theme`
  block, NOT `tailwind.config.js` (v4 removed that file entirely; don't
  recreate it). Paired with `@tailwindcss/vite`, not the old PostCSS
  plugin.
- **ESLint 9 (flat config, `eslint.config.js`)** + **Prettier**, with
  `eslint-config-prettier` disabling any ESLint rules that would
  conflict with Prettier's formatting. Format-on-save is configured via
  `.vscode/settings.json`, committed to the repo (not a personal
  setting) — anyone opening this in VS Code gets it automatically,
  provided they have the Prettier extension (`.vscode/extensions.json`
  recommends it).
- **react-router-dom v7**, **react-markdown v10**
- All dependencies were deliberately bumped to current major versions
  early in the project (see git history / commit messages around the
  first major dependency upgrade). If `npx npm-check-updates -u` is
  ever run again: it does NOT check cross-package compatibility, expect
  peer-dependency conflicts to resolve manually (this has happened
  before — TypeScript version vs. `@typescript-eslint`'s supported
  range, ESLint major version vs. `eslint-plugin-react-hooks`'s
  supported range).

## Design system

Colors are defined as CSS custom properties in `src/index.css`'s
`@theme` block: `fe-bg`, `fe-accent`, `fe-accent-dark`, `fe-brown`,
`fe-ink`, plus three **generational colors** —
`fe-gen-grandparent`, `fe-gen-couple`, `fe-gen-child`.

These are the **exact original hex values** from the live site's own
design notes (not screenshot-estimated) — treat them as authoritative:

- Orange accent: `#ff6600`
- Grandparent boxes: `#cc99cc`
- Couple boxes: `#ffcc33`
- Child boxes: `#99cc99`

**The generational colors are meaningful, not decorative.** They come
directly from the original site's convention for Family pages: purple
= grandparent generation, gold = the featured couple, green =
children. Keep this consistent in any new component that touches
family-tree data.

Horizontal accent bars (top and bottom of Family pages) are **24px
tall** (`h-6`), per the original spec. The bottom bar's width matches
the header image/content column (`max-w-4xl`), not the full page.

The German flag (in `Sidebar.tsx`) uses the **official 3:5 ratio**
(height:width), i.e. width:height = 5:3 — implemented via `aspect-[5/3]`,
not a fixed height. This was a deliberate fix; the original scaffold
had it wrong.

### Deliberately NOT replicated from the original site

The original site's design notes described three additional details
that were considered and explicitly declined -- these are intentional
simplifications, not oversights, so don't "fix" them back in without
checking first:

- The 2x spacing ratio between different generations vs. same-generation
  boxes (original used double spacing between generation rows; this
  site uses uniform spacing throughout)
- A black border on the couple's (gold) boxes
- A 1-inch left indent on summary/description text (on both Family and
  Document pages)

## Established component patterns

- **`Layout`** wraps every page: top accent bar (full page width,
  spans above the sidebar/content split — this matters, don't move
  content inside `main` if it needs to span the sidebar too), then a
  flex row of `Sidebar` + `main`.
- **`Sidebar`** is genuinely mobile-responsive (hamburger toggle,
  slide-in drawer, backdrop-tap-to-close) — this is a deliberate
  improvement over the old site, which didn't render well on mobile at
  all. Don't regress this when adding new nav sections.
- **`PersonCard`** renders one person within the generational grid,
  with direction arrows (▲ ancestor / ▼ descendant) that are also
  meaningful, not decorative.
- **`HeaderRefContext`** — a live-measurement system (React context +
  `ResizeObserver`) that keeps the sidebar's logo-block divider aligned
  with the bottom edge of whatever header image the current page has,
  automatically. Any new page with a header image should call
  `useHeaderRef()` and attach the returned ref to the header image's
  wrapper div — see `FamilyPage.tsx` for the pattern. Pages without a
  header image don't need to do anything; the sidebar falls back to
  natural sizing. This replaced an earlier hardcoded-pixel-value
  approach that broke every time padding/margins changed elsewhere —
  don't reintroduce a hardcoded version of this.

## Data model

`src/data/` holds one mock data module per content type (`mockFamily.ts`,
`mockPersons.ts`, `mockGallery.ts`, `mockLexicon.ts`, `mockTexts.ts`) —
there's no real backend yet. Each one's shape deliberately mirrors the
real database schema field names (`person_id`, `date_of_birth`, etc.) —
the real schema lives in `schema/schema.sql` at the repo root (11
tables: Persons, Relationships, Families, Images, Documents, ImageLinks,
DocumentLinks, Galleries, GalleryImages, GalleryLinks, Lexicon). When
wiring real data in (Phase 3C), match this shape rather than
restructuring components.

## Auth / gating plan (decided, not yet built)

- **Gated** (family-tree traversal only): Family pages, Person pages —
  anything using `Persons`/`Families`/`Relationships` data
- **Public**: Documents, Galleries, Lexicon, and eventually a cookbook
- Cognito-based auth (User Pool with `pending`/`approved`/`admin` groups),
  API Gateway + Lambda for gated data, static S3/CloudFront for public
  content
- Logged-out visitors hitting a gated link see a teaser (not a blind
  redirect), with Login / Request Access options. Request Access form
  uses reCAPTCHA v3, notifies the admin via SES, and silently does
  nothing if never approved (no rejection notification)
- Site-wide `noindex` + `robots.txt` disallow-all — the site is
  deliberately excluded from search engine indexing, public tier
  included
- Per-record gating is explicitly NOT needed — gating is by page type
  only, no schema flag for it

## Feature gaps from the original site (not yet scoped into any phase)

Dad's own design notes (4 documents, reviewed but not reproduced here
in full -- ask if they're needed again) surfaced four real features the
original site had that aren't in the Phase 3A-3G plan above. These are
genuine, valuable functionality -- not nice-to-haves to silently drop.

### 1. Germline / Ancestry highlighting (belongs in Phase 3E, gated)

The single most distinctive feature of the original site. Every
logged-in user has a precomputed "germline" -- the full list of their
own **biological** ancestor IDs, going back as far as the data allows.
When browsing the family tree, any person who appears in the current
user's germline gets a **diamond marker instead of the normal
triangle** on their box, letting someone visually trace their own
direct lineage through a large tree.

Critically, germline is **DNA-based only** -- it follows
`biological_parent` links exclusively, never `step_parent` or
`adoptive_parent`. Concrete example from Dad's notes: two adopted
siblings appear on both their adoptive family's page and their
biological family's page, but their germline only includes their
biological line, not their adoptive one.

Our schema already supports this correctly, since `Relationships`
explicitly distinguishes `biological_parent` from `step_parent`/
`adoptive_parent` -- this is a recursive query (walk up the
`biological_parent` chain from the logged-in user's own `Persons` row)
computed at login or on the fly, not a data model change.

### 2. Alternate-family indicator (Phase 3E)

A sideways-pointing triangle on a couple's box, shown when that person
has another marriage/partnership on record (widowed-then-remarried,
etc.) -- clicking it navigates to the other `Families` row. The
underlying data already exists (one person can appear in multiple
`Families` rows); this needs a query ("does this person appear in
another Families row besides the current one") plus a small UI
affordance that doesn't exist yet.

### 3. Divorce indicator (cheap, do alongside normal Relationships wiring)

Three small vertical dashes between the couple's two boxes when
`Relationships.status = 'divorced'` for that pair. Purely a rendering
detail once real relationship data is wired in (Phase 3C) -- no new
data needed.

### 4. "Today in Frau Erica" anniversary calendar (not yet placed in any phase -- needs a decision)

A genuinely new page type, not a fix to an existing one. 12 monthly
pages, each listing every known birth/death/marriage anniversary
falling on that day of the month, sorted chronologically, each entry
linking to the relevant Family page. Also needs a "jump to today"
entry point (was in the "Explorations" nav section on the original
site). No new tables needed -- just a date-grouping query across
`Persons.date_of_birth`/`date_of_death` and `Relationships.start_date`
-- but it doesn't fit neatly into Phase 3B (which is about existing
content types: Documents/Galleries/Lexicon) and hasn't been assigned a
phase. Worth a deliberate decision on when to build this rather than
letting it stay unscoped indefinitely.

## Current phase status

- ✅ **Phase 3A** (foundation, design system, mobile-responsive layout,
  Family page component) — complete and visually verified against the
  real site
- ⏳ **Phase 3B** (Documents, Galleries, Lexicon, Home pages) — Documents
  (Index of Texts + detail page), Galleries, and Lexicon are built (all
  on mock data); Home, `/about` (User's guide), and `/contact` are still
  `PlaceholderPage`s
- ⏳ **Phase 3C** (real data: SQLite → JSON export, wire pages to it)
- ⏳ **Phase 3D** (Cognito auth implementation)
- ⏳ **Phase 3E** (gated pages, protected routes, API layer)
- ⏳ **Phase 3F** (admin approval page for the site's sole approver)
- ⏳ **Phase 3G** (hosting, domain)

## House style

- No semicolons, single quotes, trailing commas (see `.prettierrc.json`)
- TypeScript strict mode is on — don't loosen it to work around a type
  error, fix the actual type
- Prefer editing/extending existing components over creating parallel
  one-off variants, given how much of this site is meant to feel
  visually and structurally consistent
