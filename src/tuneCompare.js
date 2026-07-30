// ── OTS vs CUSTOM TUNE PAIRING ───────────────────────────────────────────────
// Times from different run types are NOT commensurable. Picking the fastest
// OTS run and the fastest Custom run across the whole log let a 0–60 tagged
// "Custom" (~4s) be compared against a 60–130 tagged "OTS" (~10s), reporting a
// −6.1s / +43.7 mph "gain" that was really just the run-type gap.
//
// So: group runs by run type, and only ever pair an OTS with a Custom from the
// SAME type. Lives in its own module (no JSX) so it can be unit-tested directly.

// When several run types have a complete OTS+Custom pair, prefer the platform's
// headline metric first, then fall back in order of how comparable the metric is.
export const TUNE_TYPE_PREFERENCE = ["60-130", "Roll Race", "0-60"];

// Returns { type, ots, custom } for the best same-type pair, or null when no
// single run type has both an OTS-tagged and a Custom-tagged run.
export function pickTunePair(runs) {
  const withTime = (runs || []).filter(r => r.time != null && !isNaN(parseFloat(r.time)));

  const bestIn = (rows, tag) => rows
    .filter(r => r.tuneType === tag)
    .reduce((best, r) => (best == null || parseFloat(r.time) < parseFloat(best.time)) ? r : best, null);

  const byType = new Map();
  withTime.forEach(r => {
    if (!byType.has(r.type)) byType.set(r.type, []);
    byType.get(r.type).push(r);
  });

  for (const type of [...TUNE_TYPE_PREFERENCE, ...byType.keys()]) {
    const rows = byType.get(type);
    if (!rows) continue;
    const ots = bestIn(rows, "OTS"), custom = bestIn(rows, "Custom");
    if (ots && custom) return { type, ots, custom };
  }
  return null;
}
