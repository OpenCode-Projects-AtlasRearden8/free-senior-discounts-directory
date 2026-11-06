# Worth Asking: A Senior Discounts Directory

A static, offline, single-file directory of **real senior discounts worth asking about** — groceries, pharmacies, restaurants, phone and internet plans, transit and park passes, and eye and dental care. Every card tells you the typical age trigger, what to show, a kind way to ask, an honest "varies by store" note, and a reminder that **asking is allowed**.

Built and maintained by **Asdale Dynamics, LLC** as part of Dylan Asdale's beginner-friendly, plain-English AI and life-admin guides. This project is deliberately *not* an AI-skills guide — it's a life-admin helper. See the companion project **ai-for-grandparents-guide** for AI teaching content; this directory contains no AI instructions at all.

## What this is

- **One HTML file** (`dist/index.html`) that works fully offline — no fonts, no images, no scripts fetched from the network, no tracking, no affiliate links.
- **JSON-driven**: every card comes from `data/discounts.json`, validated against `data/discounts.schema.json`.
- **Age filter**: built into the page — pick "55 and up," "60 and up," etc., and cards that start at a higher age hide.
- **Per-card recheck dates**: every card carries its own `recheckDate` so maintenance is honest and visible; the build warns when any date has passed.
- **Warm, kind tone throughout**: each card ends with an "enabler" reminder that asking is allowed and costs nothing.

The philosophy of the whole project: senior discounts are usually unpublished, store-by-store, and only accessible by asking out loud — so the tool's job is to make asking easy and comfortable.

## Quick start

Requires Node.js 18+ (nothing else — zero dependencies).

```sh
npm run build    # renders data/discounts.json -> dist/index.html
npm test         # runs the 18 render/schema/offline tests
npm run verify   # build + tests together
```

Then open `dist/index.html` in any browser — or copy that single file onto a USB stick, email it, or open it on a phone. It works with no internet connection and stores no data about you.

## Project layout

```
data/discounts.json         the discount cards (the content of the site)
data/discounts.schema.json  schema every card must satisfy
src/build.mjs               zero-dependency renderer -> dist/index.html
src/validate.mjs            shared JSON validator (schema rules, hand-rolled)
tests/render.test.mjs       18 tests: schema, offline purity, age filter, tone
dist/index.html             the finished single file (generated - do not edit)
```

## Maintaining the directory (the important part)

Discounts change. Each card in `data/discounts.json` has a `recheckDate` — **when a card's date passes, the build prints a `WARNING` for it** and the test suite will (correctly) fail until you either re-verify and bump the date, or remove the card. This is intentional maintenance pressure: the page can never silently go stale.

Monthly maintenance routine:

1. Run `npm run build`. Note any `WARNING: ... recheck date is in the past` lines, or run `npm test` to see the failure.
2. For each stale card, call or ask the business whether the discount still exists; update the `deal`, `ageTrigger`, and `variesNote` text as reality dictates.
3. Bump that card's `recheckDate` to roughly one year out.
4. Update `meta.lastRechecked` to today, run `npm run build && npm test`, and commit.

### Field guide for `data/discounts.json`

| Field | Purpose |
|---|---|
| `id` | URL-safe short id, unique across cards |
| `category` | must match one of the category ids (groceries, pharmacies, restaurants, phone-internet, transit-parks, eye-dental) |
| `name` | human card title |
| `stores` | businesses this applies to |
| `ageTrigger` | plain-language age start ("Usually 62-65, varies by state") |
| `minAge` | optional machine-readable youngest age (integers 0-120) that drives the age filter; omit if there's no age gate |
| `deal` | what you actually get |
| `whatToShow` | documents to bring |
| `howToAsk` | a kind, short script for asking out loud |
| `variesByStore` | `true` when the deal is business-by-business |
| `variesNote` | the honest "varies by store" details and caveats |
| `recheckDate` | ISO date when this card must be re-verified |
| `enabler` | one-sentence reminder that asking is allowed and costs nothing |

Rules baked into tests (don't break them):

- **No affiliate links or tracking strings anywhere in the data or output.** If a maintenance edit introduces a URL, `utm_`, `?ref=`, or affiliate code, the build fails. That's the point.
- **The rendered file must stay a truly offline single file**: no external `<link>`, `<script src>`, images, or network calls. The only URL permitted in the output is the plain-text footer credit hyperlink.
- Every card must include an age trigger, what-to-show, how-to-ask, varies note, and enabler reminder — the schema enforces it.

### Adding a card

1. Add an object to `discounts` following the field guide above.
2. Run `npm test` — schema validation will catch missing/mistyped fields.
3. Run `npm run build`, open `dist/index.html`, and read the new card aloud. If the script doesn't sound kind, rewrite it.

## Design notes

- Large serif type, high-contrast palette, single-column mobile layout, and print-friendly styles — designed for comfortable reading rather than traffic.
- The age filter and search box are the only JavaScript on the page, inlined, about 2 KB.
- The sticky "Showing X of Y cards" note gives calm, constant feedback for the filter.

## License

MIT — see `LICENSE`. Copyright (c) 2026 Asdale Dynamics, LLC.
