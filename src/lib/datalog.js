// ── DATALOG PARSING (08 §Flow requirements) ─────────────────────────────────
// "If a button says attach datalog, the field exists." This is that field's
// backing logic: a real parser over the delimited logs the 4.0T community
// actually exports — VCDS / OBD11 / Draggy / RaceBox — reading a time column
// and a speed column and timing the 60→130 pull from the samples themselves.
//
// It never guesses. If the columns are not there, or the pull is not in the
// log, it says so and the run keeps whatever the user typed. The file is still
// evidence — a human can open it — so the run is still proven; what is NOT
// claimed is a number the log did not contain.

const TIME_KEYS  = ["time", "timestamp", "t", "sec", "seconds", "elapsed", "zeit"];
const SPEED_KEYS = ["speed", "mph", "vehicle speed", "vss", "kph", "km/h", "kmh", "velocity", "geschwindigkeit"];

const norm = s => String(s || "").trim().toLowerCase().replace(/["']/g, "");

function splitRow(line) {
  // Comma, semicolon or tab — VCDS uses commas, several EU exports use semicolons.
  const delim = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
  return line.split(delim).map(c => c.trim().replace(/^"|"$/g, ""));
}

function findHeader(lines) {
  // Logging tools put a few banner lines above the header; scan the first 40.
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    const cells = splitRow(lines[i]).map(norm);
    if (cells.length < 2) continue;
    const timeIdx  = cells.findIndex(c => TIME_KEYS.some(k => c === k || c.startsWith(k + " ") || c.includes("(s)") && c.includes(k)));
    const speedIdx = cells.findIndex(c => SPEED_KEYS.some(k => c.includes(k)));
    if (timeIdx >= 0 && speedIdx >= 0 && timeIdx !== speedIdx) {
      const unit = cells[speedIdx];
      return { row: i, timeIdx, speedIdx, kph: /kph|km\/h|kmh/.test(unit) };
    }
  }
  return null;
}

const KPH_TO_MPH = 0.621371;

/**
 * @param text raw file contents
 * @returns { ok, samples?, t60130?, splits?, reason? }
 */
export function parseDatalog(text) {
  const lines = String(text || "").split(/\r?\n/).filter(l => l.trim().length);
  if (lines.length < 3) return { ok: false, reason: "the file has no rows to read" };

  const head = findHeader(lines);
  if (!head) return { ok: false, reason: "no time and speed columns found" };

  const samples = [];
  for (let i = head.row + 1; i < lines.length; i++) {
    const cells = splitRow(lines[i]);
    // Decimal commas appear in EU exports; only safe to swap once the row is split.
    const t = Number(String(cells[head.timeIdx]  ?? "").replace(",", "."));
    let v   = Number(String(cells[head.speedIdx] ?? "").replace(",", "."));
    if (!Number.isFinite(t) || !Number.isFinite(v)) continue;
    if (head.kph) v *= KPH_TO_MPH;
    samples.push({ t, v });
  }
  if (samples.length < 10) return { ok: false, reason: "too few readable samples" };

  const pull = findPull(samples, 60, 130);
  if (!pull) return { ok: false, reason: "no 60 to 130 pull in this log", samples: samples.length };

  const splits = {};
  [70, 80, 90, 100, 110, 120, 130].forEach(mph => {
    const at = crossingAfter(samples, pull.startIdx, mph);
    if (at != null) splits[`60_${mph}`] = +(at - pull.t60).toFixed(2);
  });

  return {
    ok: true,
    samples: samples.length,
    duration: +(samples[samples.length - 1].t - samples[0].t).toFixed(1),
    t60130: +(pull.t130 - pull.t60).toFixed(2),
    splits,
  };
}

// The first upward crossing of `from` that reaches `to` without dropping back
// below `from` — a single continuous pull, not two half-pulls stitched together.
function findPull(s, from, to) {
  for (let i = 1; i < s.length; i++) {
    if (!(s[i - 1].v < from && s[i].v >= from)) continue;
    const t60 = interp(s[i - 1], s[i], from);
    for (let j = i; j < s.length; j++) {
      if (s[j].v < from) break;                 // lifted; this is not the pull
      if (s[j].v >= to) return { t60, t130: interp(s[j - 1], s[j], to), startIdx: i - 1 };
    }
  }
  return null;
}

function crossingAfter(s, startIdx, target) {
  for (let i = Math.max(1, startIdx); i < s.length; i++) {
    if (s[i - 1].v < target && s[i].v >= target) return interp(s[i - 1], s[i], target);
  }
  return null;
}

function interp(a, b, v) {
  const dv = b.v - a.v;
  if (!dv) return b.t;
  return a.t + ((v - a.v) / dv) * (b.t - a.t);
}
