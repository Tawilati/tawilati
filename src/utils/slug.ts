import { randomBytes } from "node:crypto";

// Lowercase words of a-z and 0-9 joined by single hyphens, e.g. "tawilati-demo-cafe".
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MAX_LENGTH = 60;

// "Tawilati Demo Café" → "tawilati-demo-cafe". Returns "" if no Latin letters or digits are left.
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // accents: é → e
    .toLowerCase()
    .replace(/['’]/g, "") // Za'atar → zaatar, not za-atar
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, "");
}

// Slug for a new business or table. Names with no Latin letters (e.g. Arabic) get "{prefix}-{6 hex}".
// Set once at creation and never recomputed, so printed QR links survive a rename.
export function makeSlug(text: string, fallbackPrefix: string): string {
  return slugify(text) || `${fallbackPrefix}-${randomBytes(3).toString("hex")}`;
}
