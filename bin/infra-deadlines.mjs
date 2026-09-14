#!/usr/bin/env node
/**
 * "What of mine is about to break."
 *
 *   npx infra-deadlines                    # everything still open, soonest first
 *   npx infra-deadlines --days 30          # only the next 30 days
 *   npx infra-deadlines solana chainlink   # only entries mentioning these
 *   npx infra-deadlines --json             # machine-readable, for CI
 *
 * Exit code is 0 unless --fail-within is given: with it the command exits 1 when
 * anything matches inside that window, so a weekly CI job can shout instead of
 * printing into a log nobody opens.
 */
import { load, upcoming, overdue, match, daysLeft } from "../src/index.mjs";

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i > -1 ? argv[i + 1] : null;
};
const has = (name) => argv.includes(`--${name}`);

if (has("help")) {
  console.log(
    [
      "infra-deadlines — dated shutdowns in crypto/web3 infrastructure",
      "",
      "  infra-deadlines [terms…] [--days N] [--fail-within N] [--json] [--all]",
      "",
      "  terms           free text matched against id, description and action",
      "  --days N        only deadlines within N days",
      "  --fail-within N exit 1 if anything falls inside N days (for CI)",
      "  --json          JSON instead of text",
      "  --all           include entries already past their date",
      "",
      "Data: CC BY 4.0. Source and issues: https://github.com/sergeipalii/infra-deadlines",
    ].join("\n"),
  );
  process.exit(0);
}

const board = load();
const terms = argv.filter((a) => !a.startsWith("--") && argv[argv.indexOf(a) - 1] !== "--days" && argv[argv.indexOf(a) - 1] !== "--fail-within");

const within = flag("days") ? Number(flag("days")) : null;
const failWithin = flag("fail-within") ? Number(flag("fail-within")) : null;

let rows = match(upcoming(board, { within }), terms);
const stale = match(overdue(board), terms);
if (has("all")) rows = [...stale, ...rows];

if (has("json")) {
  console.log(JSON.stringify({ updated: board.updated, overdue: stale, upcoming: rows }, null, 2));
} else {
  if (!rows.length && !stale.length) {
    console.log(terms.length ? `Nothing on the board matches: ${terms.join(", ")}` : "Nothing open on the board.");
  }
  // Shown first and always, even unasked. An entry whose announced date has
  // passed while it is still listed open is not noise: either the provider said
  // it would switch something off and did not, which is a live risk you are
  // carrying, or nobody updated the row. The two need different answers, and
  // `overdue: true` is how the board records the first.
  if (stale.length && !has("all")) {
    const announced = stale.filter((e) => e.overdue === true);
    const unchecked = stale.length - announced.length;
    if (announced.length) {
      console.log(`⚠ announced but not yet happened, still live: ${announced.map((e) => e.id).join(", ")}`);
      console.log("  The date passed and the switch did not flip. Treat as pending, not closed.\n");
    }
    if (unchecked) {
      console.log(`⚠ ${unchecked} row(s) past their date with no verdict recorded — run \`npm run verify\`.\n`);
    }
  }
  for (const e of rows) {
    const left = daysLeft(e);
    const when = `${e.deadline}${e.time ? ` ${e.time} UTC` : ""}`;
    const mark = left < 0 ? "PAST" : left === 0 ? "TODAY" : `${left}d`;
    console.log(`[${mark.padStart(5)}] ${when}  ${e.id}`);
    console.log(`        ${e.what}`);
    console.log(`        → ${e.action}`);
    console.log(`        source (${e.source_quality}): ${e.source}`);
    console.log();
  }
  console.log(`Board updated ${board.updated}. ${board.open.length} open, ${board.closed.length} closed.`);
}

if (failWithin !== null) {
  const hits = match(upcoming(board, { within: failWithin }), terms);
  if (hits.length) {
    if (!has("json")) console.error(`\n${hits.length} deadline(s) inside ${failWithin} days.`);
    process.exit(1);
  }
}
