import { readFile, stat } from "node:fs/promises";
import path from "node:path";

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function isPlainObject(value) {
  return typeOf(value) === "object";
}

export class ValidationError extends Error {
  constructor(path, message) {
    super(`${path}: ${message}`);
    this.name = "ValidationError";
  }
}

function checkField(obj, key, expected, objPath, errors) {
  const value = obj[key];
  if (value === undefined) {
    errors.push(new ValidationError(`${objPath}.${key}`, "is missing (required)"));
    return null;
  }
  if (typeOf(value) !== expected) {
    errors.push(
      new ValidationError(
        `${objPath}.${key}`,
        `must be type ${expected}, got ${typeOf(value)}`
      )
    );
    return null;
  }
  return value;
}

function checkPattern(value, pattern, keyPath, errors) {
  if (!pattern.test(value)) {
    errors.push(
      new ValidationError(keyPath, `must match pattern ${pattern}, got "${value}"`)
    );
  }
}

function checkStringMin(value, min, keyPath, errors) {
  if (typeof value === "string" && value.length < min) {
    errors.push(
      new ValidationError(keyPath, `must be at least ${min} characters long`)
    );
  }
}

function checkIsoDate(value, keyPath, errors) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    errors.push(new ValidationError(keyPath, "must be an ISO date (YYYY-MM-DD)"));
    return;
  }
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    errors.push(new ValidationError(keyPath, `is not a real calendar date: ${value}`));
  }
}

export async function loadAndValidateData(dataPath, schemaPath) {
  const raw = await readFile(dataPath, "utf8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new ValidationError(dataPath, `is not valid JSON: ${err.message}`);
  }
  const errors = validateData(data);
  const schemaStat = await stat(schemaPath).catch(() => null);
  if (schemaStat === null) {
    errors.push(new ValidationError(schemaPath, "schema file is missing"));
  }
  if (errors.length > 0) {
    const summary = errors
      .slice(0, 10)
      .map((e) => `  - ${e.message}`)
      .join("\n");
    throw new Error(`Validation failed with ${errors.length} error(s):\n${summary}`);
  }
  return data;
}

export function validateData(data) {
  const errors = [];

  if (!isPlainObject(data)) {
    return [new ValidationError("data", "must be a JSON object")];
  }

  for (const key of ["meta", "categories", "discounts"]) {
    if (data[key] === undefined) {
      errors.push(new ValidationError(key, "is missing (required)"));
    }
  }
  if (errors.length > 0) return errors;

  const allowedMeta = new Set(["title", "tagline", "lastRechecked", "version"]);
  for (const key of Object.keys(data.meta)) {
    if (!allowedMeta.has(key)) {
      errors.push(new ValidationError(`meta.${key}`, "is not allowed"));
    }
  }
  checkField(data.meta, "title", "string", "meta", errors);
  checkField(data.meta, "tagline", "string", "meta", errors);
  const version = checkField(data.meta, "version", "string", "meta", errors);
  if (version !== null) checkPattern(version, /^\d+\.\d+\.\d+$/, "meta.version", errors);
  const lastRechecked = checkField(data.meta, "lastRechecked", "string", "meta", errors);
  if (lastRechecked !== null) checkIsoDate(lastRechecked, "meta.lastRechecked", errors);

  if (!Array.isArray(data.categories) || data.categories.length < 1) {
    errors.push(new ValidationError("categories", "must be a non-empty array"));
  } else {
    data.categories.forEach((cat, i) => {
      const catPath = `categories[${i}]`;
      if (!isPlainObject(cat)) {
        errors.push(new ValidationError(catPath, "must be an object"));
        return;
      }
      const allowed = new Set(["id", "name", "blurb"]);
      for (const key of Object.keys(cat)) {
        if (!allowed.has(key)) {
          errors.push(new ValidationError(`${catPath}.${key}`, "is not allowed"));
        }
      }
      const id = checkField(cat, "id", "string", catPath, errors);
      if (id !== null) checkPattern(id, /^[a-z0-9-]+$/, `${catPath}.id`, errors);
      const name = checkField(cat, "name", "string", catPath, errors);
      if (name !== null) checkStringMin(name, 1, `${catPath}.name`, errors);
      const blurb = checkField(cat, "blurb", "string", catPath, errors);
      if (blurb !== null) checkStringMin(blurb, 1, `${catPath}.blurb`, errors);
    });
  }

  if (!Array.isArray(data.discounts) || data.discounts.length < 1) {
    errors.push(new ValidationError("discounts", "must be a non-empty array"));
  } else {
    const categoryIds = new Set(
      data.categories.filter((c) => isPlainObject(c) && c.id).map((c) => c.id)
    );
    const seenIds = new Set();
    const allowedFields = new Set([
      "id", "category", "name", "stores", "ageTrigger", "minAge", "deal",
      "whatToShow", "howToAsk", "variesByStore", "variesNote",
      "recheckDate", "enabler",
    ]);
    const requiredFields = [
      "id", "category", "name", "stores", "ageTrigger", "deal",
      "whatToShow", "howToAsk", "variesByStore", "variesNote",
      "recheckDate", "enabler",
    ];

    data.discounts.forEach((disc, i) => {
      const discPath = `discounts[${i}]`;
      if (!isPlainObject(disc)) {
        errors.push(new ValidationError(discPath, "must be an object"));
        return;
      }
      for (const key of Object.keys(disc)) {
        if (!allowedFields.has(key)) {
          errors.push(new ValidationError(`${discPath}.${key}`, "is not allowed"));
        }
      }
      for (const key of requiredFields) {
        if (disc[key] === undefined) {
          errors.push(new ValidationError(`${discPath}.${key}`, "is missing (required)"));
        }
      }
      if (disc.id !== undefined) {
        checkField(disc, "id", "string", discPath, errors);
        checkPattern(disc.id, /^[a-z0-9-]+$/, `${discPath}.id`, errors);
        if (seenIds.has(disc.id)) {
          errors.push(new ValidationError(`${discPath}.id`, `duplicate id "${disc.id}"`));
        }
        seenIds.add(disc.id);
      }
      if (disc.category !== undefined) {
        const cat = checkField(disc, "category", "string", discPath, errors);
        if (cat !== null && !categoryIds.has(cat)) {
          errors.push(
            new ValidationError(
              `${discPath}.category`,
              `"${cat}" does not match any category id`
            )
          );
        }
      }
      for (const key of ["name", "stores", "ageTrigger", "deal", "whatToShow", "howToAsk", "variesNote", "enabler"]) {
        const value = checkField(disc, key, "string", discPath, errors);
        if (value !== null) checkStringMin(value, 1, `${discPath}.${key}`, errors);
      }
      if (disc.variesByStore !== undefined && typeOf(disc.variesByStore) !== "boolean") {
        errors.push(new ValidationError(`${discPath}.variesByStore`, "must be type boolean"));
      }
      if (disc.minAge !== undefined) {
        if (!Number.isInteger(disc.minAge) || disc.minAge < 0 || disc.minAge > 120) {
          errors.push(
            new ValidationError(`${discPath}.minAge`, "must be an integer between 0 and 120")
          );
        }
      }
      if (disc.recheckDate !== undefined) {
        const date = checkField(disc, "recheckDate", "string", discPath, errors);
        if (date !== null) checkIsoDate(date, `${discPath}.recheckDate`, errors);
      }
    });
  }

  return errors;
}

export function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export default { loadAndValidateData, validateData, escapeHtml, ValidationError };
