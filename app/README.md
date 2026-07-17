# Frau Erica -- Website (Phase 3A scaffold)

React + TypeScript + Tailwind, built with Vite. This is the beginning of
the public-facing site described in the project plan doc, replicating the
visual identity of the original frauerica.org while fixing mobile
responsiveness, which the old site lacked.

## Running locally

```bash
npm install
npm run dev
```

Then open the URL Vite prints (typically `http://localhost:5173`).

## What's here so far (Phase 3A)

- Vite + React + TypeScript + Tailwind v4, configured
- Design tokens defined in `src/index.css` via Tailwind v4's `@theme`
  block, extracted from screenshots of the live site (colors,
  generational color-coding for Family pages)
- `Layout` + `Sidebar` components, with a working mobile hamburger menu
  (the old site did not render well on mobile -- this is a deliberate fix)
- `FamilyPage` built out as the signature page type, using mock data
  (`src/data/mockFamily.ts`) shaped to match the real database schema, so
  swapping in real data later is a drop-in, not a redesign
- Placeholder pages for every other route, so nothing 404s during
  development

## What's NOT here yet

- Real data -- everything currently renders from `mockFamily.ts`. Phase 3C
  will add a build step exporting the SQLite database to JSON and wire
  pages up to it.
- Authentication / gating -- Phase 3D. Right now every route is reachable;
  nothing is actually protected yet.
- The other public page types (Documents, Galleries, Lexicon) -- Phase 3B,
  currently just placeholders.

## Design tokens

Colors live in `src/index.css`, inside a `@theme` block (Tailwind v4's
CSS-native config approach -- there is no `tailwind.config.js` in this
project; v4 replaced that with defining tokens directly in CSS via
`@theme`, paired with the `@tailwindcss/vite` plugin in `vite.config.ts`).
Classes like `bg-fe-bg` or `text-fe-gen-couple` are generated
automatically from those `--color-*` custom properties.

The generational color-coding on Family pages is _meaningful_, not
decorative -- purple for grandparents, gold for the featured couple, green
for children, matching the convention the original site used. Keep this
consistent as new components are added.

## A note on mock data

`src/data/mockFamily.ts` is intentionally shaped to mirror the real
`Persons` / `Families` / `Relationships` schema field names
(`person_id`, `date_of_birth`, etc.) so that wiring real data in later
doesn't require restructuring the components that consume it.

## Dependency versions

All dependencies were deliberately upgraded to their latest major
versions early in the project (before much code existed, to keep the
upgrade cheap). This included React 18→19, Tailwind 3→4, Vite 5→8, and
several others simultaneously -- confirmed working with zero visual
regression against the original site screenshots. If dependencies drift
out of date again later, `npx npm-check-updates -u` will bump
`package.json`, but note it does NOT check cross-package compatibility --
expect to manually resolve peer-dependency conflicts (it does not remember
constraints like "typescript must stay below the version @typescript-eslint
supports") after running it, the same way we had to this time.
