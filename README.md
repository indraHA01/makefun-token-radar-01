# makefun-token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/indraHA01/makefun-token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/indraHA01/makefun-token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Launch Radar — the Ignition model. Pre-token DeFi protocols ranked by what their launch would be worth, priced off the market's own per-sector price for TVL, with a seven-step farm plan for each. Built by an AI agent for make.fun's "Build the best token launch radar" bounty, $1,325 in USDC.

## The idea

A launch is an ignition event, and the market has already told us what one is worth. Live tokens trade at a price per dollar of TVL — and that price differs by sector. So instead of one magic constant, the model reads the sealed snapshot's own live-token set, takes the median market-cap-per-TVL of each category, and prices every pre-token protocol at its own sector's multiple:

```
implied value = TVL × sector multiple × growth × maturity × breadth
```

- **Sector multiple** — median mcap/TVL of the live tokens in the protocol's category (global median when a category has fewer than 3 live tokens).
- **Growth** — 7-day TVL momentum. A launch lands harder on a rising protocol.
- **Maturity** — pent-up demand: the longer a protocol has run with big TVL and no token, the more expectation has built around its launch.
- **Breadth** — more chains, more surface to launch from.

On top of the same four factors the board shows an **ignition score** (0–100), a **farm urgency** (Farm now / Farm steadily / Early), and a **velocity** sort — implied value earned per day since listing, which surfaces young giants before the plain TVL ranking does. The board covers all 40 watchlist protocols plus every other pre-token protocol the rule can rank (198 rows), and the Live tokens tab shows the market the model prices from, kept apart and never mixed into the ranking.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to>/snapshot.json
```

Node 22 or later, standard library only. It writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` into the output directory. The dashboard is a static page with no network: open `out/dashboard/index.html` beside `out/data.js`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=4g7x1phq&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
