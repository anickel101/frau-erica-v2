---
name: preview
description: Look at a page in a real browser before shipping it — screenshot it, click through it, check a link actually goes where it should. Covers driving the local dev server with Playwright, reaching admin and gated pages without an account, and reverting the stubs afterwards. Use when a change affects what someone sees, or when verifying a UI change landed.
---

# Looking at the page

Typecheck, lint and 150 passing tests say nothing about whether a byline
renders the right name. This project has no component-testing setup at
all — every test is a pure function — so the browser is the only thing
that sees the UI.

Worth the trouble: driving the real page is what caught a byline reading
"Joel Thomas Nickel" instead of "Joel Nickel" (the component preferred
the Persons record over the archive's own author string), and a
collection blurb whose three paragraphs HTML had collapsed into one.

## The setup

Playwright is already installed in the session scratchpad — don't add it
to `app/`:

```
<scratchpad>/node_modules/playwright
```

Run the dev server from `app/`, backgrounded, and give it a few seconds:

```sh
cd app && (npm run dev >/tmp/vite.log 2>&1 &) ; sleep 4 ; tail -3 /tmp/vite.log
```

Then a script in the scratchpad:

```js
import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1000, height: 760 } })
p.on('console', m => { if (m.type() === 'error') console.log('ERR', m.text()) })
await p.goto('http://localhost:5173/documents/36', { waitUntil: 'networkidle' })
await p.waitForTimeout(800)
await p.screenshot({ path: 'shot.png' })
await b.close()
```

Kill the server when done: `pkill -f vite`.

## Assert, don't only look

A screenshot shows you a page; a locator proves a fact. Do both — the
counts catch what the eye slides over.

```js
console.log('links:', await p.locator('a[href="/family/27"]').count())
console.log('label:', await p.locator('a[href="/family/27"]').first().innerText())
```

And actually exercise the interaction rather than reasoning about it:

```js
for (let i = 0; i < total; i++) await p.getByRole('button', { name: /Next/ }).click()
console.log('wrapped to:', await p.locator('text=/Photograph \\d+ of/').innerText())
```

For a tight crop of one element, measure it rather than guessing at
pixel offsets — a hand-picked `clip` usually misses:

```js
const box = await p.locator('h1').first().boundingBox()
await p.screenshot({ clip: { x: box.x - 10, y: box.y - 36, width: 620, height: 115 } })
```

## Gated and admin pages

`/admin/*` sits behind `RequireAdmin`, and gated pages call the live
API. To see them locally, stub both — **and back the files up first**:

```sh
cp src/App.tsx /tmp/App.bak
cp src/data-access/gated/photoTags.ts /tmp/pt.bak
```

Then remove the guard wrapper and short-circuit the API call:

```js
// App.tsx: <RequireAdmin><TagPhotosPage /></RequireAdmin>  ->  <TagPhotosPage />
// the data-access module: return [] instead of calling the API
```

**Restore immediately afterwards, before anything else:**

```sh
cp /tmp/App.bak src/App.tsx
cp /tmp/pt.bak src/data-access/gated/photoTags.ts
git status --short     # must show only the files you meant to change
```

That `git status` is the point of the whole section. A stubbed-out auth
guard committed by accident publishes an admin page to the world. Check
it before staging, every time.

Never create a real test account to look at a page. If one is ever
genuinely needed, use a `+alias` address and delete it the same session
— and check `pending`/`approved` afterwards to confirm it's gone.

## Checking the live site

Same tooling, just a different URL, with a cache-buster:

```js
await p.goto('https://frauerica.org/documents/36?t=' + Date.now(),
             { waitUntil: 'networkidle' })
```

Pair it with the hash comparison in the `deploy` skill. The browser
tells you what the page looks like; the hashes tell you whether it's the
build you think it is. A wrong-branch deploy looks completely normal.

## Budget

One look, one pass of fixes, then ship. Don't build a screenshot loop —
re-rendering the same page to admire it burns the session while the user
waits. The exception is a real reported defect: fix it, look once more,
done.
