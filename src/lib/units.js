// ── POWER UNITS: ONE ASSUMPTION, STATED ONCE ────────────────────────────────
// The app SHOWS wheel horsepower. It THINKS in crank horsepower, because that
// is the unit the parts catalog, the OEM figures and the power model are all
// authored in — converting the model would mean re-deriving every one of them
// against numbers nobody published.
//
// So the rule is: crank is internal, whp is displayed, and the boundary is
// this file. Nothing else in the app may compute a wheel figure.
//
// Before this existed the conversion lived in three places that disagreed:
//   · calcWhp()                      crank * 0.85
//   · the product card               an inline Math.round(hp * 0.85)
//   · the tune-comparison module     a "15–18% drivetrain loss" range
// Three copies of one assumption is how an app called the-proof ends up
// showing two different answers for the same car.
//
// 15% is the figure the app already used and is the defensible number for this
// drivetrain (ZF8 + Torsen quattro) on a Mustang AWD dyno. It matches the
// community data the estimator was built against: a stock RS7 at 560 crank
// measures ~476 whp, and the SRM1000 kit's measured 992 whp implies ~1,167
// crank. 15–18% is the honest spread across dyno types; 15% is the middle of
// what this platform actually records, and one number beats a range for
// arithmetic a user is going to check.
//
// A flat percentage is a simplification — real loss is a fixed parasitic
// component plus a proportional one, so a flat figure slightly under-states
// loss at low power and over-states it at high. It is the standard shorthand
// in this community and nobody will argue with it, but it is a shorthand.
export const DRIVETRAIN_LOSS = 0.15;

/** Crank hp → wheel hp. The ONLY place this multiplication happens. */
export const toWhp = crankHp => {
  const n = Number(crankHp);
  return Number.isFinite(n) ? Math.round(n * (1 - DRIVETRAIN_LOSS)) : null;
};

/** Wheel hp → crank hp, for turning a displayed target back into model input. */
export const toCrank = whp => {
  const n = Number(whp);
  return Number.isFinite(n) ? Math.round(n / (1 - DRIVETRAIN_LOSS)) : null;
};

/** "15%" — for stating the assumption wherever a converted number is shown. */
export const LOSS_LABEL = `${Math.round(DRIVETRAIN_LOSS * 100)}%`;

/**
 * A crank-hp ceiling restated in whp, keeping its name.
 * The community's ceilings (750 daily, 850 hybrid, 1040 big single) are crank
 * figures; a bar that mixes a whp fill with a crank tick is the exact unit
 * confusion this change exists to remove, so the ticks convert too.
 */
export const whpCeiling = c => ({ hp: toWhp(c.hp), label: c.label });

// Rounding is monotonic over a positive scale factor, so converting a set of
// crank gains to whp can never reorder them — it can only tie two adjacent
// values. That is what lets the parts list keep sorting on the number it
// displays without the order and the figures disagreeing. Asserted in the
// unit suite rather than assumed here.
