// ── STAGED PARTS MODEL (10-parts-picker-staged.md) ──────────────────────────
// Pure logic for the staged parts list: which stage a slot belongs to, what it
// gains, which slots are ENABLERS, and the order rows render in.
//
// Everything here is dependency-injected — the catalog still lives in App.jsx,
// so this module has no import cycle and can be exercised head-less.
//
// The three exceptions to a pure gain sort, all from the spec:
//   installed → first in group, [✓], excluded from gain ordering
//   enabler   → pinned directly above the slot it gates, [⇪] + "ENABLER"
//   no data   → last in group, displayed —

// ── STAGE PER SLOT ──────────────────────────────────────────────────────────
// The power level at which a slot becomes relevant. This is catalog data, the
// same kind of fact as `cat` — a part's stage is a curatorial statement about
// the part, not something derivable from its hp figure (a $96 set of plugs and
// a $700 wastegate both make ~nothing and belong at opposite ends of the ladder).
// Every slot id in SLOTS must appear here exactly once; assertStageCoverage()
// below is what keeps that true as the catalog grows.
export const SLOT_STAGE = {
  // Stage 0 · stock — supporting mods, maintenance, chassis
  spark_plugs: 0, engine_oil: 0, fuel_lines: 0, bov: 0, resx: 0,
  catback: 0, catback_full: 0, brake_pads: 0, tires_street: 0,
  motor_mounts: 0, coilovers: 0, sway_bars: 0, alignment: 0, diff: 0,
  // Stage 1 — the first tune and the airflow that goes with it
  ecu_s1: 1, cai: 1, downpipe: 1, dsg_tune: 1, tcu_tune: 1, big_brake: 1,
  // Stage 2 — stage 2 tune, fuelling, heat
  ecu_s2: 2, hpfp: 2, flex_fuel: 2, intercooler: 2, tires_drag: 2,
  // Stage 3 · big single — turbos, port injection, built motor
  ecu_custom: 3, turbo_upgrade: 3, wastegate: 3, manifolds: 3,
  port_inj: 3, port_inj_full: 3, oil_cooler: 3,
};

export const STAGE_COUNT = 4;

// inferStage() speaks in build stages; the list speaks in group indices.
export const STAGE_INDEX_BY_BUILD_STAGE = {
  stock: 0, s1: 1, s2: 2, s3_hybrid: 3, big_single: 3,
};

// Returns the ids that carry no stage — empty is the invariant.
export function assertStageCoverage(slots) {
  return slots.filter(s => SLOT_STAGE[s.id] === undefined).map(s => s.id);
}

// ── ENABLERS ────────────────────────────────────────────────────────────────
// A slot that makes essentially no power itself but unlocks a slot that does.
// Derived from the catalog's own `requires` edges — never a hand-kept list —
// so a new part that gates another is classified the moment it is added.
//
// Two edge shapes, both real dependencies:
//   gates    Y.requires includes X   → X is what lets Y exist   (HPFP → flex fuel)
//   supports X.requires includes Y   → X is hardware Y needs    (wastegates → turbo)
//
// A slot only qualifies if its OWN catalog gain is negligible. That is what
// separates a wastegate from a downpipe: both are prerequisites for something
// bigger, but a downpipe makes real power and has to compete on it.
export const ENABLER_MAX_GAIN = 10;   // crank hp a slot can add and still be "no power"
export const GATED_MIN_GAIN   = 20;   // crank hp the gated slot must add to matter

/**
 * Build the enabler lookup for a model.
 * @param slots     the catalog
 * @param gainOf    (slot) => number|null — catalog gain for this model
 * @returns Map slotId → { kind:"gates"|"supports", targetId, targetName, targetGain }
 */
export function enablerMap(slots, gainOf) {
  const byId = new Map(slots.map(s => [s.id, s]));
  const gain = s => {
    const g = gainOf(s);
    return Number.isFinite(g) ? g : 0;
  };
  const out = new Map();

  const consider = (slot, kind, target) => {
    if (!target || gain(target) < GATED_MIN_GAIN) return;
    const prev = out.get(slot.id);
    // Pin against the biggest thing it unlocks — that is the row a user is
    // actually walking toward.
    if (prev && prev.targetGain >= gain(target)) return;
    out.set(slot.id, {
      kind, targetId: target.id, targetName: target.name, targetGain: gain(target),
    });
  };

  slots.forEach(slot => {
    if (gain(slot) > ENABLER_MAX_GAIN) return;      // it makes power; it competes
    // gates: something else names this slot as a prerequisite
    slots.forEach(other => {
      if (other.id === slot.id) return;
      if ((other.requires || []).includes(slot.id)) consider(slot, "gates", other);
    });
    // supports: this slot only exists once its own prerequisite is fitted
    (slot.requires || []).forEach(reqId => consider(slot, "supports", byId.get(reqId)));
  });

  return out;
}

// ── SUB-LINE ────────────────────────────────────────────────────────────────
// Short names for prerequisite text. Must stay under ~34 characters and must
// not wrap, so the long catalog name is not usable here.
const SHORT_NAME = {
  downpipe: "DP", cai: "intake", ecu_s1: "stage 1", ecu_s2: "stage 2",
  ecu_custom: "custom map", turbo_upgrade: "turbo", hpfp: "HPFP",
  flex_fuel: "flex fuel", coilovers: "coilovers", manifolds: "manifolds",
};
export function shortSlotName(slot) {
  if (!slot) return "";
  return SHORT_NAME[slot.id] || slot.name.split(" ")[0].toLowerCase();
}

// ── SORT KEYS ───────────────────────────────────────────────────────────────
// Price appears on every row and orders nothing under the default. `$/hp` and
// `% run` exist because two real people asked for them (10-parts-picker-staged
// §Sort); `Stage` falls back to the community's proven progression.
export const SORT_KEYS = [
  { id: "gain",  label: "Gain ↓", announce: "horsepower gained, highest first" },
  { id: "stage", label: "Stage",  announce: "the proven build order" },
  { id: "cost",  label: "$/hp",   announce: "cost per horsepower, cheapest first" },
  { id: "run",   label: "% run",  announce: "share of builds running it, highest first" },
];

/**
 * Group every slot by stage and order within each group.
 *
 * @param opts.slots          catalog
 * @param opts.rowFor         (slot) => row facts (see buildRow in App.jsx)
 * @param opts.currentStage   0-3, the group that reads "You are here"
 * @param opts.sortKey        one of SORT_KEYS ids
 * @param opts.expanded       Set of stage indices the user has opened
 * @returns [{ idx, isCurrent, collapsed, rows, installedCount, total }]
 */
export function groupByStage({ slots, rowFor, currentStage, sortKey = "gain", expanded }) {
  const groups = Array.from({ length: STAGE_COUNT }, (_, idx) => ({
    idx, rows: [], isCurrent: idx === currentStage, collapsed: false,
    installedCount: 0, total: 0, cats: [],
  }));

  slots.forEach(slot => {
    const idx = SLOT_STAGE[slot.id];
    if (idx === undefined) return;
    const row = rowFor(slot);
    if (row) groups[idx].rows.push(row);
  });

  groups.forEach(g => {
    g.rows = orderRows(g.rows, sortKey);
    g.installedCount = g.rows.filter(r => r.installed).length;
    g.total = g.rows.length;
    g.cats = [...new Set(g.rows.map(r => r.cat))];
    // Groups above the current stage stay expanded — they are the ladder.
    // Only far-future groups collapse, and the current and next never do.
    const farFuture = g.idx > currentStage + 1;
    g.collapsed = farFuture && !(expanded && expanded.has(g.idx));
  });

  return groups;
}

/**
 * Order one stage group. Installed first, then the unfitted remainder by the
 * chosen key, then rows with no measured delta, then enablers lifted to sit
 * directly above the slot each one gates.
 */
export function orderRows(rows, sortKey = "gain") {
  const installed = rows.filter(r => r.installed);
  const rest      = rows.filter(r => !r.installed);

  const withData = rest.filter(r => r.gain !== null);
  const noData   = rest.filter(r => r.gain === null);

  const cmp = {
    // Descending hp gained — the number they came for.
    gain:  (a, b) => (b.gain - a.gain) || (b.runPct ?? -1) - (a.runPct ?? -1),
    // The community's proven progression, then gain.
    stage: (a, b) => (a.pathRank - b.pathRank) || (b.gain - a.gain),
    // Cheapest power first. A gain of 0 has no meaningful $/hp — it sorts last.
    cost:  (a, b) => costPerHp(a) - costPerHp(b),
    // Crowd first; anything with no usage figure trails.
    run:   (a, b) => ((b.runPct ?? -1) - (a.runPct ?? -1)) || (b.gain - a.gain),
  }[sortKey] || ((a, b) => b.gain - a.gain);

  const sorted = [...withData].sort((a, b) => cmp(a, b) || a.name.localeCompare(b.name));
  // Installed parts are settled and keep a stable, name-ordered top block.
  const head = [...installed].sort((a, b) => a.name.localeCompare(b.name));
  const tail = [...noData].sort((a, b) => a.name.localeCompare(b.name));

  return pinEnablers([...head, ...sorted, ...tail]);
}

function costPerHp(r) {
  if (!r.gain || r.gain <= 0 || r.price == null) return Number.POSITIVE_INFINITY;
  return r.price / r.gain;
}

/**
 * Lift every enabler to sit immediately above the slot it gates. An enabler is
 * never sorted below the thing it enables — that inversion is the whole reason
 * the marker exists. Enablers whose target is not in this group keep their
 * sorted position (the target lives on another rung).
 */
export function pinEnablers(rows) {
  const enablers = rows.filter(r => r.enabler);
  if (!enablers.length) return rows;

  const rest = rows.filter(r => !r.enabler);
  const out = [];
  const placed = new Set();

  rest.forEach(row => {
    enablers.forEach(en => {
      if (placed.has(en.slotId)) return;
      if (en.enabler.targetId === row.slotId) { out.push(en); placed.add(en.slotId); }
    });
    out.push(row);
  });

  // Targets on another rung: keep the enabler where the sort put it, at the end
  // of the unfitted block rather than silently dropped.
  enablers.forEach(en => { if (!placed.has(en.slotId)) out.push(en); });
  return out;
}
