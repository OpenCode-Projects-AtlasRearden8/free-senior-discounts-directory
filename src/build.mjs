#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAndValidateData, escapeHtml, validateData } from "./validate.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = path.join(rootDir, "data", "discounts.json");
const schemaPath = path.join(rootDir, "data", "discounts.schema.json");
const distPath = path.join(rootDir, "dist", "index.html");

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function warnStale(data) {
  const today = todayIso();
  const warnings = [];
  for (const disc of data.discounts) {
    if (disc.recheckDate < today) {
      warnings.push(
        `  WARNING: "${disc.id}" recheck date ${disc.recheckDate} is in the past. Please re-verify this discount.`
      );
    }
  }
  if (data.meta.lastRechecked < today) {
    // Informational only; lastRechecked is intentionally the last manual review date.
  }
  return warnings;
}

function cardHtml(disc, categories) {
  const cat = categories.find((c) => c.id === disc.category);
  const catName = cat ? cat.name : disc.category;
  const e = escapeHtml;
  const minAge = typeof disc.minAge === "number" ? disc.minAge : 0;
  const ageAttr = disc.variesByStore ? "1" : "0";

  return `
      <article class="card" id="${e(disc.id)}" data-minage="${minAge}" data-varies="${ageAttr}" data-cat="${e(disc.category)}">
        <header class="card-head">
          <span class="cat-chip">${e(catName)}</span>
          <h3>${e(disc.name)}</h3>
          <p class="stores"><strong>Where:</strong> ${e(disc.stores)}</p>
        </header>
        <dl class="card-body">
          <div class="row"><dt>Typical age trigger</dt><dd>${e(disc.ageTrigger)}</dd></div>
          <div class="row"><dt>The deal</dt><dd>${e(disc.deal)}</dd></div>
          <div class="row"><dt>What to show</dt><dd>${e(disc.whatToShow)}</dd></div>
          <div class="row say-this"><dt>How to ask kindly</dt><dd>&ldquo;&hellip;${e(disc.howToAsk)}&rdquo;</dd></div>
          <div class="row varies"><dt>Honest note${disc.variesByStore ? ' <em class="varies-flag">(varies by store)</em>' : ""}</dt><dd>${e(disc.variesNote)}</dd></div>
          <div class="row"><dt>Recheck date</dt><dd><time datetime="${e(disc.recheckDate)}">${e(disc.recheckDate)}</time></dd></div>
        </dl>
        <p class="enabler" role="note">You&rsquo;re allowed to ask this. ${e(disc.enabler)}</p>
      </article>`;
}

function buildHtml(data) {
  const e = escapeHtml;
  const categorySections = data.categories
    .map((cat) => {
      const cards = data.discounts
        .filter((d) => d.category === cat.id)
        .map((d) => cardHtml(d, data.categories))
        .join("\n");
      return `
    <section class="category" id="cat-${e(cat.id)}" data-cat="${e(cat.id)}">
      <h2>${e(cat.name)}</h2>
      <p class="cat-blurb">${e(cat.blurb)}</p>
      <div class="card-grid">${cards}
      </div>
    </section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(data.meta.title)}</title>
<meta name="description" content="${e(data.meta.tagline)}">
<style>
  :root {
    --ink: #262019;
    --paper: #fdfbf7;
    --card: #ffffff;
    --accent: #2a6f4e;
    --accent-soft: #e8f3ed;
    --warn-bg: #fdf3e3;
    --warn-ink: #7a4a12;
    --border: #ded6c8;
    --big: 1.0625rem;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    font-family: Georgia, "Times New Roman", serif;
    font-size: var(--big);
    line-height: 1.55;
  }
  header.page-head {
    max-width: 60rem;
    margin: 0 auto;
    padding: 2.5rem 1.25rem 1rem;
  }
  h1 { font-size: 2rem; line-height: 1.2; margin: 0 0 .5rem; }
  .tagline { font-size: 1.15rem; margin: 0 0 1rem; color: #5a5142; }
  .intro {
    background: var(--accent-soft);
    border-left: 5px solid var(--accent);
    padding: .9rem 1.1rem;
    border-radius: 0 .5rem .5rem 0;
  }
  .intro p { margin: .4rem 0; }
  nav.toc { max-width: 60rem; margin: 1rem auto 0; padding: 0 1.25rem; display: flex; flex-wrap: wrap; gap: .55rem; }
  nav.toc a {
    display: inline-block;
    padding: .35rem .8rem;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 999px;
    text-decoration: none;
    color: var(--accent);
    font-weight: bold;
    font-size: 1rem;
  }
  nav.toc a:hover { background: var(--accent-soft); }
  .controls {
    position: sticky; top: 0; z-index: 5;
    background: var(--paper);
    border-bottom: 2px solid var(--border);
    padding: .75rem 1.25rem;
    display: flex; flex-wrap: wrap; gap: 1rem; align-items: center;
    max-width: 60rem; margin: 1.25rem auto 0;
  }
  .controls label { font-weight: bold; }
  .controls select, .controls input[type="search"] {
    font: inherit;
    padding: .45rem .6rem;
    border: 2px solid var(--border);
    border-radius: .4rem;
    background: var(--card);
    color: var(--ink);
  }
  #ageFilter { min-width: 12rem; }
  #searchFilter { flex: 1 1 14rem; }
  .count-note { font-size: .95rem; color: #5a5142; }
  main { max-width: 60rem; margin: 0 auto; padding: 1rem 1.25rem 3rem; }
  section.category h2 {
    font-size: 1.5rem;
    margin: 2rem 0 .25rem;
    padding-bottom: .3rem;
    border-bottom: 3px solid var(--accent);
  }
  .cat-blurb { color: #5a5142; margin-top: .5rem; }
  .card-grid { display: grid; gap: 1.25rem; margin-top: 1rem; }
  article.card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: .6rem;
    padding: 1.1rem 1.25rem;
    box-shadow: 0 1px 3px rgba(60, 45, 25, 0.08);
  }
  article.card.hidden { display: none; }
  section.category.no-cards h2, section.category.no-cards .cat-blurb { color: #a09884; }
  .cat-chip {
    display: inline-block;
    background: var(--accent-soft);
    color: var(--accent);
    font-family: Arial, Helvetica, sans-serif;
    font-size: .8rem;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: .05em;
    padding: .2rem .6rem;
    border-radius: 999px;
    margin-bottom: .4rem;
  }
  article.card h3 { margin: .2rem 0 .3rem; font-size: 1.3rem; }
  .stores { margin: 0 0 .6rem; color: #453c2e; }
  dl.card-body { margin: 0; }
  dl.card-body .row {
    display: grid;
    grid-template-columns: 10.5rem 1fr;
    gap: .25rem .9rem;
    padding: .4rem 0;
    border-top: 1px dotted var(--border);
  }
  dl.card-body dt { font-weight: bold; color: #453c2e; }
  dl.card-body dd { margin: 0; }
  .say-this dd { color: var(--accent); font-weight: bold; }
  .varies-flag { color: var(--warn-ink); font-size: .9rem; }
  .varies dd { color: var(--warn-ink); background: var(--warn-bg); padding: .35rem .6rem; border-radius: .35rem; }
  .enabler {
    margin: .8rem 0 0;
    background: var(--accent-soft);
    border-left: 5px solid var(--accent);
    padding: .55rem .8rem;
    border-radius: 0 .35rem .35rem 0;
    font-style: italic;
  }
  .closing {
    max-width: 60rem; margin: 2.5rem auto 0; padding: 1.25rem;
    border: 2px solid var(--accent); border-radius: .6rem;
    background: var(--accent-soft);
  }
  .closing h2 { margin-top: 0; }
  footer.page-foot {
    max-width: 60rem; margin: 2rem auto; padding: 0 1.25rem 2rem;
    color: #7a7263; font-size: .95rem;
    border-top: 1px solid var(--border); padding-top: 1rem;
  }
  footer.page-foot a { color: var(--accent); }
  .empty-note { display: none; margin: 2rem 0; text-align: center; color: #5a5142; }
  .empty-note.show { display: block; }
  @media (max-width: 40rem) {
    dl.card-body .row { grid-template-columns: 1fr; }
    .row dt { margin-bottom: .15rem; }
  }
  @media print {
    .controls, nav.toc { display: none; }
    article.card { break-inside: avoid; }
    body { font-size: 11pt; }
  }
</style>
</head>
<body>
  <header class="page-head">
    <h1>${e(data.meta.title)}</h1>
    <p class="tagline">${e(data.meta.tagline)}</p>
    <div class="intro">
      <p>Every card below tells you the <strong>typical age</strong> a discount starts, <strong>what to show</strong> at the counter, and a <strong>kind way to ask</strong> that keeps you feeling comfortable. Nothing here is a secret, a membership club, or an internet thing;&nbsp; it&rsquo;s just words to say out loud.</p>
      <p><strong>One honest truth:</strong> many of these discounts change store by store. That&rsquo;s why every card says what varies &mdash; and why <strong>asking is the whole trick</strong>. If the answer is no today, try again in a few months. You are always allowed to ask.</p>
    </div>
  </header>

  <nav class="toc" aria-label="Jump to a category">
    ${data.categories.map((c) => `<a href="#cat-${e(c.id)}">${e(c.name)}</a>`).join("\n    ")}
  </nav>

  <div class="controls">
    <label for="ageFilter">Show discounts for age:</label>
    <select id="ageFilter">
      <option value="all" selected>Any age (show all)</option>
      <option value="55">55 and up</option>
      <option value="60">60 and up</option>
      <option value="62">62 and up</option>
      <option value="65">65 and up</option>
    </select>
    <label for="searchFilter" class="sr-only" style="position:absolute;left:-9999px;">Search cards</label>
    <input type="search" id="searchFilter" placeholder="Search cards (e.g. dentist, bus, phone&hellip;)" aria-label="Search cards">
    <span class="count-note" id="countNote" role="status" aria-live="polite"></span>
  </div>

  <main>
${categorySections}
    <p class="empty-note" id="emptyNote">No cards match that filter. Try a younger age or clearer words in the search box.</p>

    <section class="closing">
      <h2>The catch-all: just ask, anywhere</h2>
      <p>There is no national list of all senior discounts, because most are decided <strong>business by business</strong> &mdash; sometimes not even written down anywhere. At any store, restaurant, museum, or service counter, it&rsquo;s fine to say:</p>
      <p><strong>&ldquo;Do you offer a senior discount here?&rdquo;</strong></p>
      <p>Bring a photo ID with your birth year. <strong>You choose when to ask</strong> &mdash; usually it starts somewhere between 55 and 65, but the worst possible result is one small &ldquo;no.&rdquo;</p>
      <p class="enabler" role="note">Asking costs nothing but one gentle sentence. If the answer is &ldquo;yes, 10% off,&rdquo; you&rsquo;ve just handed yourself money for free. That&rsquo;s a good trade every single day.</p>
      <h2>The golden rules of asking kindly</h2>
      <ol>
        <li><strong>Ask at the register or before you order</strong> &mdash; quietly, before the line gets long behind you.</li>
        <li><strong>Accept a no gracefully.</strong> &ldquo;No problem, thanks anyway&rdquo; ends every conversation kindly.</li>
        <li><strong>Never argue.</strong> A discount turned down today might be there next visit, with a different manager or a new policy.</li>
        <li><strong>Keep it to one sentence.</strong> People answer short, warm questions better than long ones.</li>
        <li><strong>Take notes.</strong> Jot down where you were told &ldquo;yes&rdquo; &mdash; your own list becomes the only senior-discount list that&rsquo;s 100% true.</li>
      </ol>
    </section>
  </main>

  <footer class="page-foot">
    <p>Data last rechecked: <strong>${e(data.meta.lastRechecked)}</strong>. Each card also shows its own recheck date &mdash; if a card is older than a year, please double-check with the store first.</p>
    <p>This page is a plain educational directory, not legal, financial, or medical advice; offer details change and are controlled by each business. Built by <a href="https://dylanasdale.github.io">Dylan Asdale</a> / <strong>Asdale Dynamics, LLC</strong>. No affiliate links, no tracking, works offline from one file.</p>
  </footer>

<script>
(function () {
  "use strict";
  var ageSelect = document.getElementById("ageFilter");
  var searchInput = document.getElementById("searchFilter");
  var countNote = document.getElementById("countNote");
  var emptyNote = document.getElementById("emptyNote");
  var cards = Array.prototype.slice.call(document.querySelectorAll("article.card"));
  var sections = Array.prototype.slice.call(document.querySelectorAll("section.category"));

  function normalize(text) {
    return (text || "").toLowerCase().replace(/\\s+/g, " ").trim();
  }

  function cardText(card) {
    return normalize(card.textContent);
  }

  function applyFilters() {
    var age = ageSelect.value === "all" ? Infinity : parseInt(ageSelect.value, 10);
    var query = normalize(searchInput.value);
    var visible = 0;

    cards.forEach(function (card) {
      var minAge = parseInt(card.getAttribute("data-minage") || "0", 10);
      var passAge = isNaN(age) ? true : minAge <= age;
      var passText = query === "" || cardText(card).indexOf(query) >= 0;
      var show = passAge && passText;
      card.classList.toggle("hidden", !show);
      if (show) visible++;
    });

    sections.forEach(function (section) {
      var anyVisible = section.querySelectorAll("article.card:not(.hidden)").length > 0;
      section.classList.toggle("no-cards", !anyVisible);
      section.querySelector(".card-grid").style.display = anyVisible ? "" : "none";
      if (!anyVisible) { section.querySelector(".cat-blurb").textContent = "Nothing matches your current filter in this category."; }
      else { section.querySelector(".cat-blurb").textContent = section.getAttribute("data-blurb"); }
    });

    countNote.textContent = "Showing " + visible + " of " + cards.length + " cards.";
    emptyNote.classList.toggle("show", visible === 0);
  }

  // Stash blurbs so the filter can swap them in/out without losing the original text.
  sections.forEach(function (section) {
    section.setAttribute("data-blurb", section.querySelector(".cat-blurb").textContent);
  });

  ageSelect.addEventListener("change", applyFilters);
  searchInput.addEventListener("input", applyFilters);
  applyFilters();
})();
</script>
</body>
</html>
`;
}

async function main() {
  const data = await loadAndValidateData(dataPath, schemaPath);
  const html = buildHtml(data);
  await mkdir(path.dirname(distPath), { recursive: true });
  await writeFile(distPath, html, "utf8");
  const warnings = warnStale(data);
  for (const w of warnings) console.log(w);
  console.log(
    `OK: rendered ${data.discounts.length} cards across ${data.categories.length} categories -> dist/index.html`
  );
  if (warnings.length > 0) {
    console.log(`Done with ${warnings.length} recheck warning(s). See above.`);
  }
}

const forTest = { buildHtml, warnStale, todayIso };

export { main, buildHtml, warnStale, todayIso, forTest };

import process from "node:process";
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  });
}
