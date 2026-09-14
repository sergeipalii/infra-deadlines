# infra-deadlines

**A dated board of what is being switched off in crypto and web3 infrastructure.**
Removed endpoints, retired chains, cut free tiers, end-of-life SDKs — each entry
carries a UTC date, the minimum action it demands, and a link to the primary
source that announced it.

**Русский:** [README.ru.md](README.ru.md) · **Español:** [README.es.md](README.es.md)

## Why this exists

Deprecations are announced once, in a changelog nobody subscribes to, and then
they happen. The failure is never "we could not find a workaround" — it is "we
did not know the date." This board is the reading nobody does, written down.

It is kept by hand, weekly, for the [Infra Graveyard Weekly](https://sepia.software/blog/series/infra-graveyard)
digest, and published here because the dataset is useful on its own:

- English — <https://sepia.software/blog/series/infra-graveyard>
- Русский — <https://ru.sepia.software/blog/series/infra-graveyard>
- Español — <https://es.sepia.software/blog/series/infra-graveyard>

## What is my stack about to lose

```bash
npx infra-deadlines                    # everything still open, soonest first
npx infra-deadlines --days 30          # only the next 30 days
npx infra-deadlines solana chainlink   # only entries mentioning these
npx infra-deadlines --json             # machine-readable
```

In CI, to be told rather than to remember:

```bash
npx infra-deadlines solana --fail-within 30   # exits 1 if something lands inside 30 days
```

## The two rules the board is kept by

**A deadline is not closed because it was announced.** It is closed when the
source was checked again and the thing actually happened. Entries whose
announced date has passed while the switch did not flip stay open and carry
`overdue: true` — they are a live risk, not a stale row. Chainlink announced
three feeds for 2 September 2026; twelve days later all three were still
updating inside their heartbeat, so the entry is still open.

**What the announcement does not cover gets no guess.** If a provider's notice
is silent on what happens to funds in a pool, the board says the announcement is
silent, not what we suppose. An inference dressed as a fact is worse than a gap,
because a gap gets checked.

## Shape of an entry

```yaml
open:
  - id: solana-rent-phase-2
    what: "Solana rent reduction phase 2 (SIMD-0437-2): lamports_per_byte 6,333 -> 5,080…"
    deadline: 2026-09-15
    time: null              # the source gave a date but no time of day
    date_precision: month   # optional: the source said "mid-September"
    action: "Replace hardcoded rent constants with getMinimumBalanceForRentExemption()…"
    source: "https://solana.com/upgrades/reduced-rent"
    source_quality: primary # primary | secondary
    first_issue: 6
```

Closed entries record `effective` (the day it actually happened) instead of
`deadline`, plus `verified` when the check was only partial.

`open` is sorted soonest-first, `closed` newest-first. Both orders are checked.

## Verifying the board

```bash
npm run verify     # report
npm run check      # exit 1 on any problem — for CI
```

It checks structure, date formats, duplicate ids, ordering, and above all
whether anything sits in `open` past its date without a recorded verdict. That
last check exists because on 12 September 2026 four rows had been expired for
weeks while still showing on a public page, and two events had never been
entered at all. Nothing was broken in the code; the board had simply not been
read.

**What it does not do:** re-check each entry against its live source. There is
no generic probe — one entry is an on-chain feed read, the next a REST endpoint,
the next a vendor blog that has since become a JavaScript shell with no text in
it. That verification stays manual and stays the rule above.

## Using the data

```js
import { load, upcoming, daysLeft } from "infra-deadlines";

const board = load();
for (const e of upcoming(board, { within: 30 })) {
  console.log(daysLeft(e), e.id, e.action);
}
```

Or read `deadlines.yaml` directly — it is the whole dataset, and there is
deliberately no database behind it.

## Corrections welcome

A wrong date here is worse than no date. If an entry is stale, an announcement
moved, or a switch never flipped — open an issue with the source, and it will be
checked against that source rather than against the previous entry.

## Licence

Code (`src/`, `bin/`, `scripts/`) — MIT, see [LICENSE](LICENSE).
Data (`deadlines.yaml`) — CC BY 4.0, see [LICENSE-DATA](LICENSE-DATA).
