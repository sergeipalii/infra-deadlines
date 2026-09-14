/**
 * Reader for the Infra Deadlines board.
 *
 * The board is a single YAML file kept by hand: every entry carries a UTC date,
 * the action it demands, and a primary source. This module only reads it — the
 * editing happens in `deadlines.yaml` itself, and there is deliberately no
 * writer here. A dataset with two writers is a dataset with two truths.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const HERE = dirname(fileURLToPath(import.meta.url));
export const BOARD_PATH = resolve(HERE, "../deadlines.yaml");

/** Source quality as recorded on an entry. Anything else fails verification. */
export const SOURCE_QUALITY = ["primary", "secondary"];

/**
 * `time: null` means the source gave a date but no time of day. Treating that
 * as midnight would silently make the deadline earlier than anybody announced,
 * so it is treated as the end of that UTC day instead: an entry stops being
 * open only once the whole announced day has passed.
 */
export function deadlineInstant(entry) {
  const time = entry.time ?? "23:59:59";
  return new Date(`${entry.deadline}T${time}Z`);
}

/** Whole days from `now` until the entry's deadline. Negative once it is past. */
export function daysLeft(entry, now = new Date()) {
  return Math.floor((deadlineInstant(entry) - now) / 86_400_000);
}

/**
 * js-yaml resolves an unquoted `2026-09-16` into a JS `Date`, not a string, so
 * every date in the board arrives as an object and prints as
 * "Wed Sep 16 2026 07:00:00 GMT+0700". Left alone that leaks the reader's
 * timezone into a board whose whole contract is UTC. Dates are parsed by YAML
 * as UTC midnight, so taking the ISO date part puts them back exactly as
 * written — and everything downstream can assume plain `YYYY-MM-DD` strings.
 */
function asDateString(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

function normalise(entry) {
  const out = { ...entry };
  for (const key of ["deadline", "effective"]) {
    if (key in out) out[key] = asDateString(out[key]);
  }
  return out;
}

export function load(path = BOARD_PATH) {
  const doc = yaml.load(readFileSync(path, "utf8"));
  return {
    updated: asDateString(doc.updated) ?? null,
    issue: doc.issue ?? null,
    open: (doc.open ?? []).map(normalise),
    closed: (doc.closed ?? []).map(normalise),
  };
}

/** Closed entries record `effective` (the day it happened), not `deadline`. */
export function closedInstant(entry) {
  return new Date(`${entry.effective}T00:00:00Z`);
}

/**
 * Entries that have not passed yet, soonest first.
 *
 * `within` limits the window in days. An entry sitting in `open` whose date has
 * already passed is NOT returned here — it is a bookkeeping error, and the
 * verifier is what reports it. Hiding it behind a filter is how four expired
 * rows once stayed on a public page for weeks.
 */
export function upcoming(board, { within = null, now = new Date() } = {}) {
  return board.open
    .filter((e) => {
      const left = daysLeft(e, now);
      return left >= 0 && (within === null || left <= within);
    })
    .sort((a, b) => deadlineInstant(a) - deadlineInstant(b));
}

/** Entries in `open` whose deadline has already passed — always a problem. */
export function overdue(board, now = new Date()) {
  return board.open
    .filter((e) => daysLeft(e, now) < 0)
    .sort((a, b) => deadlineInstant(a) - deadlineInstant(b));
}

/**
 * Free-text match across the fields that name what an entry is about. Used by
 * the CLI so `infra-deadlines solana` answers "what of mine breaks".
 */
export function match(entries, needles) {
  if (!needles.length) return entries;
  const lowered = needles.map((n) => n.toLowerCase());
  return entries.filter((e) => {
    const hay = `${e.id} ${e.what} ${e.action}`.toLowerCase();
    return lowered.some((n) => hay.includes(n));
  });
}
