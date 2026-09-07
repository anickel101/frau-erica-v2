# Frau Erica -- Website

React 19 + TypeScript + Tailwind v4, built with Vite. The public-facing
rebuild of frauerica.org, replicating the original site's visual identity
while fixing mobile responsiveness, which the old site lacked.

## Running locally

```bash
npm install
npm run dev
```

Then open the URL Vite prints (typically `http://localhost:5173`).

Note that gated pages talk to the **real deployed API** even in local
development -- the API base URL and Cognito pool are hardcoded in
`src/config/cognito.ts` (deliberately: none of it is secret). So logging
in locally uses real accounts against the real user pool, not a mock.

## What's here

Public (no account needed):

- **Home**, **User's Guide**, **Contact the Archivist**
- **Index of Texts** + document pages -- long-form archival text with
  embedded photos via the `{{image:ID}}` shortcode (see
  `data-access/public/documents.ts`; `:wide` and `:300`-style modifiers
  control layout)
- **Index of Galleries** + gallery pages
- **The Mueller Lexicon**

Gated (Cognito account in the `approved` or `admin` group):

- **Family pages** -- the signature page type, including germline
  (direct-ancestor) diamond markers for the logged-in user's own line
- **Index of Persons**, and person links that resolve to the right family
- **Today in Frau Erica** -- the anniversary calendar
- **Admin** -- approve access requests, manage users (`admin` group only)

Auth is live: SRP sign-in via `aws-amplify` v6 (`components/AuthProvider.tsx`),
route gating via `RequireApproved` / `RequireAdmin`, and a full
self-service account lifecycle (request access → admin approval →
first-sign-in password set → forgot password).

## Where the data comes from

Two different paths, deliberately:

- **Public content** (Documents, Galleries, Lexicon) is exported from the
  canonical SQLite database to static JSON in `src/data/generated/`,
  committed to the repo, and imported directly -- no network call. Run
  `npm run export-data` to regenerate after editing the database.
- **Gated content** (Persons, Families, search, germline, anniversaries)
  is fetched at runtime from the `api/` Lambda, which authorizes the
  caller's Cognito token before returning anything.

## Scripts

| Script                | What it does                                                    |
| --------------------- | --------------------------------------------------------------- |
| `npm run dev`         | Vite dev server                                                 |
| `npm run build`       | Typecheck + production build to `dist/`                         |
| `npm run preview`     | Serve the production build locally                              |
| `npm run export-data` | Regenerate `src/data/generated/*.json` from the SQLite database |
| `npm run ci`          | lint + typecheck + format:check + test + build (what CI runs)   |

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

## Dependency versions

All dependencies were deliberately upgraded to their latest major
versions early in the project (before much code existed, to keep the
upgrade cheap). This included React 18→19, Tailwind 3→4, and Vite 5→8.
If dependencies drift out of date later, `npx npm-check-updates -u` will
bump `package.json`, but note it does NOT check cross-package
compatibility -- expect to manually resolve peer-dependency conflicts
afterward, the same way we had to that time.
