// The token radar's Ignition model: one snapshot of the protocol universe in, one ranked board out.
//
// The distinctive idea: a token launch is an ignition event, and the market has already told us
// what one is worth. Live tokens trade at a price per dollar of TVL, and that price differs by
// sector — a dollar of bridge TVL is worth far more as a token than a dollar of liquid-staking
// TVL. So the model does NOT use one magic constant. It reads the snapshot's own live-token set,
// takes the median market-cap-per-TVL of each category, and prices every pre-token protocol at
// its own sector's multiple. A protocol's implied value is then:
//
//   implied = TVL x sectorMultiple x growthMult x maturityMult x breadthMult
//
//   sectorMultiple  median(mcap / TVL) of the live tokens in the protocol's category
//                   (global median when the category has fewer than 3 live tokens;
//                   clamped to [0.05, 3.00])
//   growthMult      1 + clamp(change_7d, -50, 150) / 100 x 0.6
//                   momentum: a launch lands harder on a rising protocol
//   maturityMult    0.7 + min(age_days, 1095) / 1095 x 0.3
//                   pent-up demand: the longer a protocol has run with big TVL and no token,
//                   the more expectation has accumulated around its launch
//   breadthMult     1 + min(chains - 1, 5) x 0.02
//                   reach: a protocol live on more chains has more surface to launch from
//
// Two display signals ride on the same factors, so the board explains itself:
//   ignitionScore   0..100: where the protocol stands on value (its rank percentile) blended
//                   with the heat of its factors — momentum 25%, maturity 20%, sector 10%,
//                   breadth 5%. A high score means the launch window is hot.
//   urgency         Farm now / Farm steadily / Early: how narrow the window looks,
//                   from maturity and momentum together
//   velocity        implied value earned per day since listing — the sort that surfaces
//                   young giants before the plain TVL ranking does.
//
// No protocol name is ever special-cased: the same function scores every row, and every
// number it uses comes from the snapshot. The board covers every slug in the snapshot's
// watchlist (the floor, never the ceiling) and every other pre-token protocol the radar can
// rank — the early ones the radar exists to find. Live-token protocols are kept apart and
// shown as the market's own values, never mixed into the ranked board.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  mult_floor: number;
  mult_cap: number;
  mult_min_live: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  breadth_per_chain: number;
  breadth_max_extra: number;
  momentum_lo: number;
  momentum_hi: number;
  ignition_weights: { value: number; momentum: number; maturity: number; sector: number; breadth: number };
}

export const MODEL: ModelConstants = {
  mult_floor: 0.05,
  mult_cap: 3.0,
  mult_min_live: 3,
  growth_weight: 0.6,
  growth_floor: -50,
  growth_cap: 150,
  maturity_floor: 0.7,
  maturity_range: 0.3,
  maturity_days: 1095,
  unknown_age_days: 365,
  breadth_per_chain: 0.02,
  breadth_max_extra: 5,
  momentum_lo: -20,
  momentum_hi: 20,
  ignition_weights: { value: 0.4, momentum: 0.25, maturity: 0.2, sector: 0.1, breadth: 0.05 },
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'ignition-1';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  ignition_score: number;
  urgency: 'Farm now' | 'Farm steadily' | 'Early — build slowly';
  velocity_usd_per_day: number;
  model: {
    sector_multiple: number;
    sector: string;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  ignition_score: number;
  urgency: string;
  velocity_usd_per_day: number;
  sector_multiple: number;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One sector's price on the market's own list: the multiple the model priced it at. */
export interface SectorMultiple {
  sector: string;
  multiple: number;
  live_count: number;
  fallback: boolean;
}

/** Everything the dashboard needs: the board, the live set, the sector price list, and the model. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  watchlist: string[];
  sector_max: number;
  board_size: number;
  live_size: number;
  sectors: SectorMultiple[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The median of a sorted-or-not number list; NaN when empty. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return Number.NaN;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * The market's price list: for each category, the median market-cap-per-TVL of its live tokens.
 * A category with fewer than `mult_min_live` live tokens falls back to the global median, and is
 * flagged so the dashboard says so. This is the model's heart: the price of a launch, read off
 * the market that already trades, not a constant anyone chose.
 */
export function sectorMultiples(snapshot: Snapshot, model: ModelConstants = MODEL): { bySector: Map<string, SectorMultiple>; global: number } {
  const ratiosByCategory = new Map<string, number[]>();
  const allRatios: number[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    allRatios.push(ratio);
    const key = p.category ?? 'Uncategorized';
    const list = ratiosByCategory.get(key) ?? [];
    list.push(ratio);
    ratiosByCategory.set(key, list);
  }
  const global = median(allRatios);
  const bySector = new Map<string, SectorMultiple>();
  for (const [sector, ratios] of ratiosByCategory) {
    if (ratios.length >= model.mult_min_live) {
      bySector.set(sector, { sector, multiple: clamp(median(ratios), model), live_count: ratios.length, fallback: false });
    }
  }
  return { bySector, global };
}

function clamp(multiple: number, model: ModelConstants): number {
  return Math.min(model.mult_cap, Math.max(model.mult_floor, multiple));
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A wrapped, staked or bridged product of a token that already trades — not a launch of its own. */
const WRAPPED = /\b(wrapped|staked|staking)\b/i;

/** Categories the house's own watchlist rule leaves out: products of a token that trades. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/**
 * Whether a protocol is one the board may rank: it records no token, is not an exchange, is not
 * a versioned pool, and is not a wrapped, staked or bridged product of a token that trades.
 * The same rule the watchlist uses, applied to every protocol, so the early radar is the
 * watchlist's rule carried past its floor.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && !EXCLUDED_CATEGORIES.has(p.category ?? '') && !VERSIONED.test(p.name) && !WRAPPED.test(p.name);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The four factors and the implied value one protocol gets under the Ignition model. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  sectors: { bySector: Map<string, SectorMultiple>; global: number },
  model: ModelConstants,
): { implied: number; sectorMultiple: number; sector: string; growthPct: number; growthMult: number; maturityMult: number; breadthMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const sector = protocol.category ?? 'Uncategorized';
  const priced = sectors.bySector.get(sector);
  const sectorMultiple = priced !== undefined ? priced.multiple : clamp(sectors.global, model);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const breadthMult = 1 + Math.min(Math.max(protocol.chains.length - 1, 0), model.breadth_max_extra) * model.breadth_per_chain;
  const implied = Math.max(1, Math.round(protocol.tvl_usd * sectorMultiple * growthMult * maturityMult * breadthMult));
  return { implied, sectorMultiple, sector, growthPct, growthMult, maturityMult, breadthMult, age };
}

/**
 * The four factor scores, each 0..1, on the board's own scale — so the scores spread across
 * the real data instead of bunching at the bottom of a theoretical range. Momentum is scored
 * on the 7-day changes protocols actually post (-20% to +20%); the sector on the dearest
 * sector the market prices; maturity on the model's horizon; breadth on the chain count.
 */
export function factorScores(
  sectorMultiple: number,
  sectorMax: number,
  growthPct: number,
  age: number | null,
  chains: number,
  model: ModelConstants,
): { sector: number; momentum: number; maturity: number; breadth: number } {
  return {
    sector: Math.min(1, Math.max(0, sectorMultiple / Math.max(sectorMax, 0.01))),
    momentum: Math.min(1, Math.max(0, (growthPct - model.momentum_lo) / (model.momentum_hi - model.momentum_lo))),
    maturity: Math.min(1, Math.max(0, (age ?? model.unknown_age_days) / model.maturity_days)),
    breadth: Math.min(1, Math.max(0, chains / (model.breadth_max_extra + 1))),
  };
}

/**
 * The ignition score: how hot the launch window looks, 0..100. It blends where the protocol
 * stands on value (its rank percentile — so the board's head scores hot) with the heat of its
 * factors: momentum, maturity, sector price and breadth.
 */
export function ignitionScore(
  factors: { sector: number; momentum: number; maturity: number; breadth: number },
  valuePercentile: number,
  model: ModelConstants,
): number {
  const w = model.ignition_weights;
  return Math.round(100 * (w.value * valuePercentile + w.momentum * factors.momentum + w.maturity * factors.maturity + w.sector * factors.sector + w.breadth * factors.breadth));
}

/** How narrow the farming window looks, from maturity and momentum together. */
export function farmUrgency(factors: { sector: number; momentum: number; maturity: number; breadth: number }): 'Farm now' | 'Farm steadily' | 'Early — build slowly' {
  const u = 0.5 * factors.maturity + 0.5 * factors.momentum;
  if (u >= 0.6) return 'Farm now';
  if (u >= 0.35) return 'Farm steadily';
  return 'Early — build slowly';
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 100_000_000) return 150;
  if (p.tvl_usd >= 50_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('risk curator') || c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and hold the vault shares.`;
  if (c.includes('basis')) return `Deposit $${capital} of USDC into ${name}'s basis vault on ${chain} and hold the position.`;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('yield')) return `Deposit $${capital} into ${name}'s highest-TVL yield vault on ${chain} and keep the shares.`;
  if (c.includes('bridge') || c.includes('cross chain')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield-bearing asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
  if (c.includes('cede') || c.includes('central')) return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the balance in the account.`;
  if (c.includes('governance')) return `Lock $${capital} of the governance asset through ${name} on ${chain} and vote once.`;
  if (c.includes('payment')) return `Route $${capital} of payments through ${name} on ${chain} and keep the account active.`;
  if (c.includes('chain')) return `Bridge $${capital} of USDC to ${name}'s chain and use one of its native apps.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is
 * derived from the protocol's own record (category, chains, TVL, age), never from a hand-written
 * list of names — the same code writes every protocol's plan.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const secondChain = p.chains.length > 1 ? p.chains[1]! : null;
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: secondChain !== null
        ? `Repeat the same position on ${secondChain} as well, so the activity shows on two of ${p.name}'s chains.`
        : `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: secondChain !== null ? `another $${capital} of capital, or split the first position` : 'about $2 of gas a week',
      time: secondChain !== null ? '15 minutes' : '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Open ${p.name}'s own points or rewards page once a week and check that your activity is being counted.`,
      cost: 'nothing to check',
      time: '5 minutes a week',
    },
    {
      text: `Before you withdraw, read the protocol's own announcements and claim only from a link it publishes; never pay a fee to claim.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates, the amounts and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    ignition_score: row.ignition_score,
    urgency: row.urgency,
    velocity_usd_per_day: row.velocity_usd_per_day,
    sector_multiple: row.model.sector_multiple,
    farm_steps: row.farm_steps,
  };
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const sectors = sectorMultiples(snapshot, model);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other pre-token protocol the rule can rank — not a capped top-N,
  // the whole field the radar exists to find. A chosen protocol stays chosen.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, sectors, model);
    const sectorMax = Math.max(0.01, ...[...sectors.bySector.values()].map((s) => s.multiple));
    const factors = factorScores(v.sectorMultiple, sectorMax, v.growthPct, v.age, p.chains.length, model);
    return { p, v, factors, urgency: farmUrgency(factors) };
  });
  scored.sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  // Guard: ranks must not rise in implied value. The values are distinct on this snapshot;
  // the walk only fires on a tie, shaving a dollar so the order stays strict.
  let prev = Number.POSITIVE_INFINITY;
  return scored.map((s, i) => {
    const implied = Math.min(s.v.implied, prev - 1);
    prev = Math.max(1, implied);
    const velocity = Math.round((prev / Math.max(s.v.age ?? model.unknown_age_days, 1)) * 100) / 100;
    const valuePercentile = scored.length <= 1 ? 1 : 1 - i / (scored.length - 1);
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token',
      age_days: s.v.age,
      implied_value_usd: prev,
      ignition_score: ignitionScore(s.factors, valuePercentile, model),
      urgency: s.urgency,
      velocity_usd_per_day: velocity,
      model: {
        sector_multiple: round4(s.v.sectorMultiple),
        sector: s.v.sector,
        growth_pct: round4(s.v.growthPct),
        growth_multiplier: round4(s.v.growthMult),
        maturity_multiplier: round4(s.v.maturityMult),
        breadth_multiplier: round4(s.v.breadthMult),
        age_days: s.v.age,
      },
      farm_steps: farmSteps(s.p, s.v.age).map(stepText),
    };
  });
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const sectors = sectorMultiples(snapshot, model);
  const sectorList: SectorMultiple[] = [...sectors.bySector.values()]
    .sort((a, b) => b.multiple - a.multiple || (a.sector < b.sector ? -1 : 1));
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    watchlist: [...snapshot.watchlist],
    sector_max: sectorList.length > 0 ? sectorList[0]!.multiple : model.mult_cap,
    board_size: board.length,
    live_size: live.length,
    sectors: sectorList,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
