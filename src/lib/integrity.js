// ── DATA INTEGRITY (09-data-integrity.md) ───────────────────────────────────
// The product's thesis is that a run with proof is real. A board whose order
// contradicts its own times, or whose entries cannot be reconciled with their
// own measured trap speeds, undoes that in one screen.
//
// Two mechanisms, deliberately separate:
//
//   RANKING       rank = ascending sort over VERIFIED runs only. No other
//                 input — not a stored rank column, not insertion order. If
//                 the displayed order and the displayed times ever disagree,
//                 that is a P0.
//
//   PLAUSIBILITY  a logged run outside the expected band for its own evidence
//                 is HELD, not ranked. Held entries still render — hiding one
//                 reads as censorship to the person who posted it — but they
//                 never displace a verified run.
//
// ── WHY THE BAND IS ANCHORED ON TRAP SPEED, NOT ON THE POWER MODEL ──────────
// Checked against the shipped board (see the investigation in the PR):
//   · The app's power model predicts 5.63s for a 1,000 hp RS6 and 5.88s for a
//     1,000 hp S8. The real population runs 4.0–4.4. The model over-predicts
//     above roughly 700 hp, so a band built on it would hold the entire top of
//     the board — the estimator would be indicting reality.
//   · Every board row that carries a trap speed sits a CONSISTENT ~0.5s faster
//     than the 60–130-vs-trap reference curve, which is drawn from a mostly
//     RWD population. That is a systematic offset, not scatter.
// So the band uses each run's OWN measured trap speed against the reference
// curve, with the population's systematic offset removed — both halves are
// measured quantities, and the offset self-calibrates as runs accumulate.
// The power model is the fallback for runs with no trap, where it is the only
// evidence available, and it gets a deliberately wide tolerance.

// Beyond this, the logged time and the logged trap speed are describing two
// different cars. The reference table resolves roughly 0.1s per 1–1.5 mph in
// this range, and DA, fuel and gearing account for a couple of tenths more.
export const TRAP_TOLERANCE_S = 0.6;

// Below this many trap-carrying runs there is no population to calibrate
// against, so the offset is not applied rather than being guessed from two
// points.
export const MIN_CALIBRATION_SAMPLE = 4;

// The power-model fallback. Wide on purpose: the estimator is known to
// over-predict at the top end, so this is sized to catch a units or
// decimal-place error, not to arbitrate a disagreement of a few tenths.
export function modelTolerance(modelTime) {
  return Math.max(1.2, 0.3 * modelTime);
}

// ── NULL IS NOT ZERO ────────────────────────────────────────────────────────
// Number(null) is 0 and 0 is finite, so a plain `Number.isFinite` guard reads
// every MISSING value as a real measurement of zero. On the live board that
// turned four quarter-mile-only entries (t60130 null, trap present) into runs
// "logged at 0.00s", which then (a) rendered as HELD with a blank time and
// (b) poisoned the population calibration badly enough to hold the two
// genuinely fastest cars. Every numeric read in this module goes through here.
const asNumber = v => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const asTrap = asNumber;

const median = xs => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * The population's systematic offset from the reference curve, in seconds.
 * Negative means the population runs FASTER than the curve predicts.
 * Median, not mean, so one bad entry cannot move the band that judges it.
 *
 * @param rows        entries with { t60130, mph }
 * @param timeForTrap (mph) => expected 60–130, or null
 */
export function trapOffset(rows, timeForTrap) {
  const deltas = [];
  (rows || []).forEach(r => {
    const t = asNumber(r.t60130), mph = asTrap(r.mph);
    if (t === null || mph === null) return;   // no time = nothing to calibrate on
    const expected = timeForTrap(mph);
    if (Number.isFinite(expected)) deltas.push(t - expected);
  });
  if (deltas.length < MIN_CALIBRATION_SAMPLE) return { offset: 0, sample: deltas.length };
  return { offset: +median(deltas).toFixed(3), sample: deltas.length };
}

/**
 * Judge one 60–130 time against whatever evidence it carries.
 *
 * @returns {
 *   checked   false when there is nothing to check it against — an unverifiable
 *             run is never held; we do not hold what we cannot check.
 *   held      true when it falls outside the band
 *   expected  the time its own evidence implies
 *   delta     logged − expected (negative = faster than expected)
 *   basis     "trap" | "model"
 * }
 */
export function judgeTime({ t60130, mph, modelTime, offset = 0, timeForTrap }) {
  const t = asNumber(t60130);
  // No time is not a slow time. An entry with nothing in this metric is
  // neither plausible nor implausible — it is simply not a 60–130 run.
  if (t === null) return { checked: false, held: false, noTime: true };

  const trap = asTrap(mph);
  if (trap !== null && typeof timeForTrap === "function") {
    const raw = timeForTrap(trap);
    if (Number.isFinite(raw)) {
      const expected = +(raw + offset).toFixed(2);
      const delta = +(t - expected).toFixed(2);
      return {
        checked: true, basis: "trap", expected, delta,
        tolerance: TRAP_TOLERANCE_S,
        held: Math.abs(delta) > TRAP_TOLERANCE_S,
      };
    }
  }

  const m = asNumber(modelTime);
  if (m !== null) {
    const tol = modelTolerance(m);
    const delta = +(t - m).toFixed(2);
    return {
      checked: true, basis: "model", expected: +m.toFixed(2), delta,
      tolerance: +tol.toFixed(2),
      held: Math.abs(delta) > tol,
    };
  }

  return { checked: false, held: false };
}

/**
 * Rank a board. Rank is an ascending sort over verified rows ONLY — a stored
 * rank column is never trusted, because that is exactly how the shipped board
 * came to place 4.33 above 4.10.
 *
 * @param rows    entries carrying at least { t60130 }
 * @param judge   (row) => the judgeTime result for that row
 * @returns { ranked, held, noTime, all }
 *   ranked  verified rows in time order, carrying their derived rank
 *   held    implausible rows — no rank, so they displace nothing
 *   noTime  rows with no 60–130 time at all. NOT held: a quarter-mile-only
 *           entry has not made an implausible claim, it has made none. It is
 *           kept as its own bucket so the caller can be honest about it
 *           instead of flagging it or silently dropping it.
 */
export function rankBoard(rows, judge) {
  const judged = (rows || []).map(r => ({ row: r, verdict: judge(r) }));
  const t = j => asNumber(j.row.t60130) ?? Infinity;
  const asc = (a, b) => t(a) - t(b);

  const timed = judged.filter(j => !j.verdict.noTime);
  const noTime = judged.filter(j => j.verdict.noTime)
    .map(j => ({ ...j, rank: null, held: false, noTime: true }));

  const ranked = timed.filter(j => !j.verdict.held).sort(asc)
    .map((j, i) => ({ ...j, rank: i + 1, held: false }));
  const held = timed.filter(j => j.verdict.held).sort(asc)
    .map(j => ({ ...j, rank: null, held: true }));

  return { ranked, held, noTime, all: [...ranked, ...held, ...noTime] };
}

/**
 * The reason line, in the user's terms rather than the model's.
 * "4.6s faster than the 9.59s model for 465 hp — verify units or attach a datalog"
 */
export function heldReason(verdict, { hp } = {}) {
  if (!verdict?.checked) return "";
  const gap = Math.abs(verdict.delta).toFixed(verdict.delta % 1 === 0 ? 0 : 1);
  const dir = verdict.delta < 0 ? "faster" : "slower";
  if (verdict.basis === "model") {
    return `${gap}s ${dir} than the ${verdict.expected}s model for ${hp} whp — verify units or attach a datalog`;
  }
  return `${gap}s ${dir} than its own ${verdict.expected}s trap speed implies — verify units or attach a datalog`;
}
