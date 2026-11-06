import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import { loadAndValidateData, validateData, escapeHtml } from "../src/validate.mjs";
import { buildHtml, warnStale } from "../src/build.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = path.join(rootDir, "data", "discounts.json");
const schemaPath = path.join(rootDir, "data", "discounts.schema.json");

let data;
let html;

test.before(async () => {
  data = await loadAndValidateData(dataPath, schemaPath);
  html = buildHtml(data);
});

test("data file exists and parses as JSON matching the schema", async () => {
  const schemaStat = await stat(schemaPath);
  assert.ok(schemaStat.isFile(), "schema file must exist");
  assert.equal(validateData(data).length, 0, "data must pass schema validation");
});

test("all six goal categories are present", () => {
  const ids = data.categories.map((c) => c.id);
  for (const required of [
    "groceries",
    "pharmacies",
    "restaurants",
    "phone-internet",
    "transit-parks",
    "eye-dental",
  ]) {
    assert.ok(ids.includes(required), `missing category: ${required}`);
  }
});

test("every card states all required fields per the original goal", () => {
  for (const disc of data.discounts) {
    assert.ok(disc.ageTrigger.length >= 1, `${disc.id}: age trigger required`);
    assert.ok(disc.whatToShow.length >= 1, `${disc.id}: what to show required`);
    assert.ok(disc.howToAsk.length >= 1, `${disc.id}: how to ask required`);
    assert.ok(disc.deal.length >= 1, `${disc.id}: deal text required`);
    assert.ok(disc.variesNote.length >= 1, `${disc.id}: varies note required`);
    assert.ok(disc.enabler.length >= 1, `${disc.id}: enabler reminder required`);
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(disc.recheckDate), `${disc.id}: recheck date format`);
  }
});

test("every enabler reminder conveys that asking is allowed", () => {
  const kindWords = [
    "allow", "allowed", "asking", "expect", "routine", "normal",
    "welcome", "fine", "need", "want", "legislat", "published",
    "permitted", "deserve", "entitle", "qualify", "answer ready",
  ];
  for (const disc of data.discounts) {
    const text = disc.enabler.toLowerCase();
    const matches = kindWords.filter((w) => text.includes(w));
    assert.ok(
      matches.length > 0,
      `${disc.id}: enabler should reassure that asking is allowed (no reassuring word found)`
    );
  }
});

test("no affiliate links, tracking, or paid-program references anywhere in data", () => {
  const raw = JSON.stringify(data);
  const banned = [
    /affiliate/i,
    /amzn\./i,
    /amazon\.com/i,
    /clickbank/i,
    /shareasale/i,
    /utm_/i,
    /\?ref=/i,
    /\bt\.co\b/,
    /bit\.ly/i,
    /tinyurl/i,
    /https?:\/\//,
  ];
  for (const pattern of banned) {
    assert.ok(!pattern.test(raw), `banned pattern ${pattern} found in data`);
  }
});

test("no external resources in the rendered single file (truly offline)", () => {
  const external = [
    /<link[^>]+href=/i,
    /<script[^>]+src=/i,
    /<img[^>]+src=/i,
    /srcset=/i,
    /@import/i,
    /fetch\s*\(/i,
    /XMLHttpRequest/i,
    /import\s+\(/,
    /url\(https?:/,
  ];
  for (const pattern of external) {
    assert.ok(!pattern.test(html), `rendered file must not contain external loads matching ${pattern}`);
  }
});

test("output is one self-contained HTML file with inline style and script", () => {
  assert.ok(/<style>/i.test(html), "must have inline <style>");
  assert.ok(/<script>/i.test(html), "must have inline <script>");
  assert.ok(html.trim().startsWith("<!DOCTYPE html>"), "must start with a doctype");
  assert.ok(/<\/html>\s*$/.test(html), "must end with closing html tag");
  // The footer credit hyperlink is the only allowed URL in the output (never auto-loaded).
  const withoutCreditLink = html.replace(
    /<a href="https:\/\/dylanasdale\.github\.io">Dylan Asdale<\/a>/g,
    ""
  );
  assert.ok(
    !/https?:\/\//i.test(withoutCreditLink),
    "no URLs other than the footer credit link in output"
  );
});

test("every card appears in the rendered HTML with its name and recheck date", () => {
  for (const disc of data.discounts) {
    assert.ok(html.includes(`id="${disc.id}"`), `card anchor missing: ${disc.id}`);
    assert.ok(html.includes(escapeHtml(disc.name)), `card name missing: ${disc.name}`);
    assert.ok(html.includes(escapeHtml(disc.recheckDate)), `recheck date missing for: ${disc.id}`);
    assert.ok(html.includes(escapeHtml(disc.howToAsk)), `how-to-ask text missing for: ${disc.id}`);
  }
});

test("age filter UI exists with the expected age options", () => {
  assert.ok(/id="ageFilter"/i.test(html), "age filter select missing");
  for (const opt of ["all", "55", "60", "62", "65"]) {
    assert.ok(html.includes(`value="${opt}"`), `missing age option ${opt}`);
  }
});

test("cards carry machine-readable age attributes for the age filter", () => {
  const expected = {
    "grocery-manager-honor-discount": 55,
    "pharmacy-generic-free": 0,
    "parks-senior-pass": 62,
    "transit-fixed-route": 65,
    "carriers-senior-plans": 55,
  };
  for (const [id, minAge] of Object.entries(expected)) {
    const re = new RegExp(`id="${id}"[\\s\\S]*?data-minage="(\\d+)"`);
    const match = html.match(re);
    assert.ok(match, `data-minage missing for ${id}`);
    assert.equal(Number(match[1]), minAge, `wrong minAge for ${id}`);
  }
});

test("each category renders as a section with its cards inside", () => {
  for (const cat of data.categories) {
    const sectionRe = new RegExp(`id="cat-${cat.id}"[\\s\\S]*?</section>`);
    const sectionMatch = html.match(sectionRe);
    assert.ok(sectionMatch, `section missing for ${cat.id}`);
    const section = sectionMatch[0];
    const cardsInSection = data.discounts.filter((d) => d.category === cat.id);
    for (const disc of cardsInSection) {
      assert.ok(section.includes(escapeHtml(disc.name)), `card ${disc.id} not in its category section`);
    }
  }
});

test("varies-by-store cards are flagged with an honest note badge", () => {
  for (const disc of data.discounts.filter((d) => d.variesByStore)) {
    const re = new RegExp(`id="${disc.id}"[\\s\\S]*?</article>`);
    const match = html.match(re);
    assert.ok(match, `card html missing: ${disc.id}`);
    assert.ok(
      match[0].includes("varies"),
      `${disc.id} should display a varies-by-store flag`
    );
  }
});

test("enabler reminders render on every card", () => {
  for (const disc of data.discounts) {
    assert.ok(
      html.includes(escapeHtml(disc.enabler)),
      `enabler text missing for ${disc.id}`
    );
  }
});

test("recheck dates in the past trigger stale warnings (maintenance honesty)", async () => {
  const stale = {
    ...data,
    discounts: [{ ...data.discounts[0], recheckDate: "2020-01-01" }],
  };
  assert.equal(validateData(stale).length, 0, "fixture itself should validate");
  const warnings = warnStale(stale);
  assert.ok(warnings.length >= 1, "stale recheck dates must be flagged");
  assert.ok(warnings[0].includes("2020-01-01"), "warning should mention the stale date");
});

test("fresh recheck dates produce no warnings for current data", () => {
  assert.ok(warnStale(data).length === 0, "current data should have no stale cards; recheck the data if this fails");
});

test("escapeHtml neutralizes markup", () => {
  assert.equal(escapeHtml(`<img src=x onerror="alert(1)">`).includes("<"), false);
  assert.equal(escapeHtml(`&"`), "&amp;&quot;");
});

test("meta title, tagline and last-rechecked are rendered", () => {
  assert.ok(html.includes(escapeHtml(data.meta.title)));
  assert.ok(html.includes(escapeHtml(data.meta.tagline)));
  assert.ok(html.includes(escapeHtml(data.meta.lastRechecked)));
});

test("validation rejects broken data", () => {
  const broken = { ...data, discounts: [{ id: "bad id with spaces" }] };
  assert.ok(validateData(broken).length > 0, "broken card must fail validation");
  assert.ok(validateData({ meta: {} }).length > 0, "empty meta must fail validation");
});
