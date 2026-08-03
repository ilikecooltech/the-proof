// ── PROGRESSION BAR GEOMETRY (05-data-and-math.md) ──────────────────────────
// Every position on the bar is computed from {value, scaleTop}. No percentage
// is ever written down, which is what lets the whole app rescale by changing a
// single number.
//
// This lives apart from the component so the arithmetic — and in particular the
// label-collision rules, which are the only part with real edge cases — can be
// exercised at any hp on any scale without a browser.

export const pctOfScale = (v, scaleTop) =>
  Math.max(0, Math.min(100, (Number(v) / scaleTop) * 100));

// One 10px IBM Plex Mono character with .04em tracking measures ~6.4px in the
// rendered labels. Reservations are a PERCENTAGE of the track, and the same bar
// renders at two widths — 366px in the screen gutter and 338px inside the goal
// card — so the divisor has to be the NARROWEST track or the reservation is
// short exactly where the labels are longest: 6.4 / 338 = 1.89%.
//
// Space is reserved from the ACTUAL label text rather than a hand-tuned
// constant, because raising the scale to 1400 made four-digit hp the common
// case and every label a character wider.
export const NARROWEST_TRACK_PX = 338;
export const MONO_CH_PX = 6.4;
export const MONO_CH_PCT = (MONO_CH_PX / NARROWEST_TRACK_PX) * 100;   // ≈1.89
export const shareOf = (text, sizeRatio = 1) =>
  String(text).length * MONO_CH_PCT * sizeRatio + 2;

/**
 * Where every label sits, and which of them have to move to avoid each other.
 *
 * @returns {
 *   fillPct, wishPct, ceilPct, goalPct   positions, all derived
 *   nowShare, topShare                   space each label needs, from its text
 *   stackTop    TOP END drops to its own line because something reached it
 *   nowAtLeft   NOW is pinned left because the fill is too short to hang it off
 *   ceilNearEdge the ceiling tick is at the far end, so its label pins right
 *   overlaps    true only if NOW and TOP END would still collide — an invariant
 *               that must never be true in rendered output
 * }
 */
export function barLayout({
  hp, wishlistHp = 0, ceilingHp, goalHp = null,
  scaleTop, nowLabel = "NOW", hideTopEnd = false,
}) {
  const projected = Math.max(hp, wishlistHp);
  const fillPct = pctOfScale(hp, scaleTop);
  const wishPct = pctOfScale(projected, scaleTop);
  const ceilPct = pctOfScale(ceilingHp, scaleTop);
  const goalPct = goalHp != null ? pctOfScale(goalHp, scaleTop) : null;
  const hasWish = projected > hp;

  const nowShare = shareOf(`${hp} ${nowLabel}`);
  const topShare = shareOf(`${scaleTop}+ TOP END`, 0.9);   // authored at 9px
  const ceilNearEdge = ceilPct > 92;
  const rightMost = Math.max(fillPct, hasWish ? wishPct : 0);
  const stackTop = !hideTopEnd && (ceilNearEdge || rightMost > 100 - topShare);
  const nowAtLeft = fillPct < nowShare;

  // The NOW label ends AT the fill edge (translateX(-100%)) unless pinned left,
  // in which case it starts at 0. TOP END is pinned right.
  const nowRight = nowAtLeft ? nowShare : fillPct;
  const overlaps = !hideTopEnd && !stackTop && nowRight > 100 - topShare;

  return { fillPct, wishPct, ceilPct, goalPct, hasWish,
           nowShare, topShare, ceilNearEdge, stackTop, nowAtLeft, overlaps };
}
