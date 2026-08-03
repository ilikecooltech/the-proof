import { useId } from "react";
import { SORT_KEYS } from "../lib/stages.js";

// ── STAGED PARTS LIST (10-parts-picker-staged.md · #8a) ─────────────────────
// Every slot on one screen, grouped by stage and ranked WITHIN each stage by
// hp gained. Price rides along on every row and orders nothing.
//
// The parent owns the catalog and hands this component finished rows, so the
// ordering rules live in ../lib/stages.js where they can be exercised without
// a browser.

function Marker({ row }) {
  if (row.installed) return <span className="sp-mark sp-mark-inst" aria-hidden="true">{row.mark || "[✓]"}</span>;
  if (row.isNext)    return <span className="sp-mark sp-mark-next" aria-hidden="true">[→]</span>;
  if (row.enabler)   return <span className="sp-mark sp-mark-enabler" aria-hidden="true">[⇪]</span>;
  return <span className="sp-mark sp-mark-open" aria-hidden="true">[ ]</span>;
}

// The right-hand stack reflects the sort key: the number they came for, then
// the price. An enabler shows ENABLER rather than "+0", which reads as
// "worth nothing" and makes the row look like the weakest item in the stage.
function Metric({ row }) {
  if (row.installed) {
    return <span className="sp-price-only">{row.price != null ? `$${row.price.toLocaleString()}` : ""}</span>;
  }
  return (
    <span className="sp-metric">
      {row.enabler
        ? <span className="sp-enabler-lbl">ENABLER</span>
        : <span className={`sp-gain${row.gain === null ? " sp-gain-none" : ""}`}>
            {row.gain === null ? "—" : `+${row.gain}`}
          </span>}
      {row.price != null && <span className="sp-price">${row.price.toLocaleString()}</span>}
    </span>
  );
}

function Row({ row, onOpen }) {
  const cls = [
    "sp-row",
    row.isNext   ? "sp-row-next" : "",
    row.installed ? "sp-row-inst" : "",
    row.enabler  ? "sp-row-enabler" : "",
    row.fuelInert ? "sp-row-inert" : "",
  ].filter(Boolean).join(" ");

  return (
    <li>
      <button type="button" className={cls} onClick={() => onOpen(row.slotId)} aria-haspopup="dialog">
        <Marker row={row} />
        <span className="sp-body">
          <span className="sp-name">{row.name}</span>
          <span className="sp-sub">{row.sub}</span>
        </span>
        {/* The shipped app's POPULAR / BEST VALUE / RACE / TURBO MUST badges
            survive the restructure (08 §preserve) — #8a adds no badge, so this
            is additive and never displaces the sort key. */}
        {row.tag && <span className={`sp-tag ${row.tagClass}`}>{row.tag}</span>}
        <Metric row={row} />
        <span className="sr-only">
          {/* The visible metric is a bare number under a group header that
              states the unit; spell it out here, where there is no width
              budget to trade against. */}
          {row.installed ? "In your build." : row.enabler ? "" :
            row.gain === null ? "No measured gain figure." : ` Adds ${row.gain} wheel horsepower.`}
          {row.isNext ? " Your recommended next step." : ""}
          {row.enabler ? ` Enabler — unlocks ${row.enabler.targetName}.` : ""}
          {" "}Opens options.
        </span>
      </button>
    </li>
  );
}

export default function StagedParts({
  groups, sortKey, onSort, onOpenSlot, onToggleGroup,
  categories, activeCat, onCat, sortAnnounce,
}) {
  const uid = useId();

  return (
    <div className="sp-area">
      {/* Sort — performance impact, never price. */}
      <div className="sp-sortbar" role="group" aria-labelledby={`${uid}-sortlbl`}>
        <span className="sp-sortlbl" id={`${uid}-sortlbl`}>Sort</span>
        {SORT_KEYS.map(k => (
          <button key={k.id} type="button" className={`csbtn${sortKey === k.id ? " on" : ""}`}
            aria-pressed={sortKey === k.id} onClick={() => onSort(k.id)}>
            {k.label}
          </button>
        ))}
      </div>

      {/* The shipped app's category tabs survive as a filter over the ladder
          rather than as the primary IA — #8a is stage-first, but losing the
          categories outright would drop a real affordance (08 §preserve). */}
      <div className="cat-strip sp-cats">
        {categories.map(cat => (
          <button key={cat.id} type="button" className={`cbtn${activeCat === cat.id ? " active" : ""}`}
            aria-pressed={activeCat === cat.id} onClick={() => onCat(cat.id)}>
            {cat.label}
            {cat.dot && <span className="cbtn-dot" />}
          </button>
        ))}
      </div>

      <div className="sr-only" aria-live="polite" aria-atomic="true">{sortAnnounce}</div>

      <div className="sp-scroll">
        {groups.map(g => {
          if (!g.total) return null;
          // Orange marks one group: where the build IS, or — for a build with
          // nothing fitted, which has not reached a tier — where to begin.
          const tone = g.isCurrent || g.isStart ? "cur"
            : g.idx < g.currentStage ? "done" : "future";

          if (g.collapsed) {
            return (
              <h2 className="sp-h2 sp-h2-collapsed" key={g.idx}>
                <button type="button" className="sp-collapse" aria-expanded="false"
                  onClick={() => onToggleGroup(g.idx)}>
                  <span className="sp-h2-lbl">{g.label}</span>
                  <span className="sp-h2-spacer" />
                  <span className="sp-h2-count">{g.installedCount} of {g.total}</span>
                  <span className="sp-chev" aria-hidden="true">▾</span>
                </button>
                <span className="sp-h2-inside">{g.inside}</span>
              </h2>
            );
          }

          return (
            <section key={g.idx} className="sp-group">
              <h2 className={`sp-h2 sp-h2-${tone}`}>
                <span className="sp-h2-lbl">{g.label}</span>
                <span className="sp-h2-rule" />
                <span className="sp-h2-count">
                  {g.isCurrent ? "You are here" : g.isStart ? "Start here" : `${g.installedCount} of ${g.total}`}
                </span>
                {g.isCurrent && <span className="sr-only">— the stage your build is at now</span>}
                {g.isStart && <span className="sr-only">— nothing fitted yet, this is the first rung</span>}
              </h2>
              <ul className="sp-list">
                {g.rows.map(r => <Row key={r.slotId} row={r} onOpen={onOpenSlot} />)}
              </ul>
              {g.canCollapse && (
                <button type="button" className="sp-collapse-back" aria-expanded="true"
                  onClick={() => onToggleGroup(g.idx)}>
                  Hide {g.label}
                </button>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
