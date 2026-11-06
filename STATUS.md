# STATUS.md — Worth Asking: A Senior Discounts Directory

Last updated: 2026-11-06
Maintained by: Asdale Dynamics, LLC

## What was built

A static, offline, single-file directory of real senior discounts worth asking about, covering all six goal categories:

1. **Groceries** — store senior days/manager discounts, pharmacy-housed grocery programs
2. **Pharmacies** — free/low-cost generic lists, vaccine pricing/savings programs
3. **Restaurants** — chain senior percentages, early-bird/senior menus
4. **Phone & internet** — carrier 55+/senior plans, low-cost home internet programs
5. **Transit & park passes** — reduced-fare transit, America the Beautiful senior pass, state park passes
6. **Eye & dental** — vision-help programs, dental school clinics, office senior discounts

Every card states the **typical age trigger**, **what to show**, a **kind how-to-ask script**, an honest **"varies by store" note**, and an **enabler reminder that asking is allowed**. Cards carry per-card `recheckDate` values, and the build warns when any date goes stale.

Key features as originally specced:

- **JSON-driven cards** (`data/discounts.json`, 14 cards) validated against a JSON schema (`data/discounts.schema.json`)
- **Age filter** built into the HTML (Any / 55+ / 60+ / 62+ / 65+), driven by machine-readable `minAge` fields
- **Offline single file**: `dist/index.html` has zero external resources — inline CSS and JS only, no images, no fonts, no tracking, **no affiliate links**
- **Deliberately distinct from ai-for-grandparents-guide**: no AI-teaching content here — it's purely a life-admin helper
- Maintenance **README** covering the build, the JSON field guide, and the monthly recheck routine

## How to run it

Node.js 18+, zero dependencies:

```sh
npm run build    # renders data/discounts.json -> dist/index.html
npm test         # 18 render/schema/offline tests
npm run verify   # build + tests
```

Open `dist/index.html` in any browser, on any device, with no internet. Share it by copying the one file (USB, email, chat).

## Verification results

- `npm run build` → `OK: rendered 14 cards across 6 categories -> dist/index.html` with **no stale-recheck warnings**
- `npm test` → **18/18 pass, 0 fail** via `node --test`
- Builds/tests re-run after every fix; final state green
- Spot checks:
  - Age-filter band math verified programmatically: any=14, 55+=9, 60+=11, 62+=13, 65+=14
  - Inline HTML `<script>` compiles without syntax errors (`new Function` check)
  - Offline purity tests ban external `<link>`/`<script src>`/images/fetch and ban affiliate/tracking patterns (`utm_`, `?ref=`, affiliate networks) in both data and output
  - Schema validation rejects broken fixtures (missing fields, bad ids, wrong types)

## Known gaps

- **14 cards is a solid start, not exhaustive.** The design goal was quality/verifiability over volume; more cards are welcome via the README's field guide. A "catch-all ask anywhere" card is built into the page as a closing section since most discounts are unpublishable one-off deals.
- **Specific dollar figures and phone prices move often.** Cards deliberately describe ranges rather than exact prices; the "varies by store" notes call this out. Annual rechecks are the responsibility of the maintenance routine.
- **State-park pass details are generalized.** Each state parks agency has its own rule; the card directs readers to ask at the gate.
- **No search index/keyboard shortcuts beyond the browser default.** A text search box and age filter are included; anything fancier (pinned cards, favorites, print selection) isn't yet built.
- **Render tests are schema/structure/offline checks, not visual snapshots.** Layout is verified by inspection at standard widths; no screenshot-diff dependency is installed on purpose (keeps build dependency-free).

## Not a risk register, but honest notes

- All content is educational guidance, not financial, legal, or medical advice; the footer says so.
- No secrets, API keys, or personal data appear in any file in this repository.
- Nothing is published or pushed anywhere by this workflow; distribution is manual (share the single file).
