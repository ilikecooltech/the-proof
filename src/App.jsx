import { Component, useState, useEffect, useId, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import posthog from "posthog-js";
import { pickTunePair } from "./tuneCompare.js";

// ── ANALYTICS (PostHog) ──────────────────────────────────────────────────────
const PH_KEY = import.meta.env.VITE_POSTHOG_Key;
if (PH_KEY) {
  posthog.init(PH_KEY, {
    api_host: "https://us.i.posthog.com",
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: false,          // manual events only — keeps data clean
    person_profiles: "identified_only",
  });
}
// Safe wrapper — no-ops if key not set (local dev without .env)
const track = (event, props = {}) => { if (PH_KEY) posthog.capture(event, props); };

// ── SUPABASE CLIENT ──────────────────────────────────────────────────────────
const SUPABASE_URL  = "https://bqvdudylkqwpyvhshewj.supabase.co";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── SCREEN ERROR BOUNDARY ────────────────────────────────────────────────────
// Without one of these, a single bad value anywhere in the tree unmounts the
// WHOLE app and leaves a blank page with no way back — which is exactly how a
// string where a number was expected read as "the interactive elements are
// gone". The shell (header, tab bar) lives outside this, so a broken screen
// costs you that screen and nothing else: you can still navigate away.
class ScreenBoundary extends Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error("Screen render failed:", err, info); }
  componentDidUpdate(prev) {
    // A new screen gets a fresh attempt; otherwise the error sticks forever.
    if (prev.resetKey !== this.props.resetKey && this.state.err) this.setState({ err: null });
  }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="screen-error" role="alert">
        <div className="screen-error-hd">This screen didn’t load</div>
        <p className="screen-error-body">
          Something in this view failed to render. The rest of the app still
          works — switch tabs and come back.
        </p>
        <button className="screen-error-btn" onClick={() => this.setState({ err: null })}>
          Try again
        </button>
      </div>
    );
  }
}

function getUserId() {
  let id = localStorage.getItem("proof-user-id");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("proof-user-id", id); }
  return id;
}

// ── DIALOG A11Y HOOK ─────────────────────────────────────────────────────────
// Modal bottom sheets need four things browsers don't give a <div> for free:
// focus moves in on open, Tab is trapped inside, Escape closes, and focus returns
// to whatever opened it. Attach the returned ref to the element carrying
// role="dialog". `onClose` is held in a ref so a parent passing an inline arrow
// can't re-run the effect and yank focus back to the top on every render.
const DIALOG_FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),' +
  'textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';

function useDialog(onClose) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  // Written in an effect, not during render, so the latest handler is available
  // to the keydown listener without re-running the mount effect below.
  useEffect(() => { closeRef.current = onClose; });

  // Captured in a lazy initializer, which runs during the first render — i.e.
  // BEFORE React commits the DOM. The same commit puts `inert` on the app shell,
  // and marking a focused element inert blurs it, so reading activeElement any
  // later than this hands back <body> and focus restore silently does nothing.
  const [restoreTo] = useState(() => document.activeElement);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const visible = () =>
      [...node.querySelectorAll(DIALOG_FOCUSABLE)].filter(el => el.offsetParent !== null);

    // Move focus in. Fall back to the dialog itself (tabIndex={-1}) when it has
    // no focusable children yet.
    (visible()[0] || node).focus();

    function onKeyDown(e) {
      if (e.key === "Escape") { e.preventDefault(); closeRef.current?.(); return; }
      if (e.key !== "Tab") return;
      const list = visible();
      if (!list.length) { e.preventDefault(); node.focus(); return; }
      const first = list[0], last = list[list.length - 1];
      const active = document.activeElement;
      if (!node.contains(active)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); return; }
      if (e.shiftKey && (active === first || active === node)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      // Deferred to the next task: on close React also drops `inert` from the app
      // shell, and focus() on a still-inert element is silently ignored. A timer
      // rather than rAF, because rAF does not fire in a backgrounded tab — which
      // would leave focus stranded on <body>.
      setTimeout(() => {
        if (restoreTo instanceof HTMLElement && document.contains(restoreTo)) restoreTo.focus();
      }, 0);
    };
    // restoreTo comes from a useState initializer, so it is stable for the
    // lifetime of the dialog — this effect still runs exactly once, on mount.
  }, [restoreTo]);

  return ref;
}


// ── REAL LEADERBOARD DATA (from Audi 4.0T Drag Racing Leaderboard) ────────
// Last synced: July 2026 · source: docs.google.com/spreadsheets/d/1TDiEgneJfZaGbl3e6lSyOnUFGZA8ljMi
const LEADERBOARD = [
  { rank:1,  driver:"Level Performance",  car:"C7.5 RS6",   tuner:"Level Performance",    t60130:4.03, et:"9.168",mph:156.60, turbo:"G30-990a",  fuel:"VP Race",   trans:"ZF8HP90",  manifolds:"Billet",  supFuel:"Port/Meth", ic:"W2A",       dp:"Catless", da:"-90ft" },
  { rank:2,  driver:"FE Performance",     car:"D4 S8",      tuner:"C4 / Slavov",          t60130:4.33, et:"9.22", mph:153.33, turbo:"G42",        fuel:"Pump E85",  trans:"Built",    manifolds:"Unknown", supFuel:"Port",      ic:"SRM",       dp:"Catless", da:"-141ft" },
  { rank:3,  driver:"Miguel Romero",      car:"B8.5 S5",    tuner:"Load Logic / ET Spec", t60130:4.10, et:"9.26", mph:153.57, turbo:"XR5756",     fuel:"E75",       trans:"Built",    manifolds:"SRM",     supFuel:"Port/NOS",  ic:"SRM",       dp:"Catless", da:"7932ft" },
  { rank:4,  driver:"Chris Clayton",      car:"C7 RS7",     tuner:"C4 / ET Spec",         t60130:4.49, et:null,   mph:null,   turbo:"Xona 6564",  fuel:"E65",       trans:"Stock",    manifolds:"SRM",     supFuel:"Port",      ic:"SRM",       dp:"Catless", da:"-65ft" },
  { rank:5,  driver:"Skip Hickey",        car:"D4.5 S8",    tuner:"Load Logic / ET Spec", t60130:4.71, et:"9.66", mph:140.57, turbo:"71mm",       fuel:"E45",       trans:"Stock",    manifolds:"Klassen", supFuel:"Meth",      ic:"Unknown",   dp:"Catless", da:"192ft" },
  { rank:6,  driver:"Adam Emm",           car:"D4 A8L",     tuner:"C4 / ET Spec",         t60130:4.80, et:null,   mph:null,   turbo:"G45-1500",   fuel:"Pump E85",  trans:"Stock",    manifolds:"Unknown", supFuel:"Port",      ic:"Unknown",   dp:"Catless", da:"1990ft" },
  { rank:7,  driver:"Daniel Trombley",    car:"C7.5 RS7P",  tuner:"C4 / Slavov",          t60130:4.91, et:null,   mph:null,   turbo:"XR5756",     fuel:"Pump E85",  trans:"Stock",    manifolds:"SRM",     supFuel:"Port",      ic:"SRM",       dp:"Catless", da:"-514ft" },
  { rank:8,  driver:"Neil Otis",          car:"D4.5 A8L",   tuner:"Self Tuned",           t60130:4.96, et:"9.73", mph:145.34, turbo:"XRC5357S",   fuel:"E78",       trans:"Stock",    manifolds:"FRA",     supFuel:"Port",      ic:"Sean East", dp:"Catless", da:"-95ft" },
  { rank:9,  driver:"Matt Jones",         car:"C7.5 RS7",   tuner:"C4",                   t60130:4.97, et:"10.06",mph:145.16, turbo:"XR5756",     fuel:"E77",       trans:"Stock",    manifolds:"SRM",     supFuel:"Port",      ic:"SRM",       dp:"Catless", da:"567ft" },
  { rank:10, driver:"Marcus J. Maroney",  car:"C7.5 RS7",   tuner:"Kyle / Unknown",       t60130:5.04, et:"9.67", mph:143.90, turbo:"TS1",        fuel:"E38",       trans:"Stock",    manifolds:"SRM",     supFuel:"Meth",      ic:"SRM",       dp:"Catless", da:"-2539ft" },
];

// ── MODELS ─────────────────────────────────────────────────────────────────
const MODELS = [
  { id:"a6_20t", label:"A6 2.0T", engine:"2.0T TFSI",    hp:252, torque:273, t060:6.1, t60130:15.2, et:15.1 },
  { id:"a6_30t", label:"A6 3.0T", engine:"3.0T TFSI SC", hp:310, torque:325, t060:5.5, t60130:13.1, et:13.8 },
  { id:"a7_20t", label:"A7 2.0T", engine:"2.0T TFSI",    hp:252, torque:273, t060:6.2, t60130:15.5, et:15.2 },
  { id:"a7_30t", label:"A7 3.0T", engine:"3.0T TFSI SC", hp:310, torque:325, t060:5.6, t60130:13.4, et:13.9 },
  { id:"s6",     label:"S6",      engine:"4.0T TFSI",    hp:450, torque:516, t060:4.4, t60130:9.8,  et:12.6 },
  { id:"s7",     label:"S7",      engine:"4.0T TFSI",    hp:450, torque:516, t060:4.5, t60130:10.1, et:12.7 },
  { id:"rs6",    label:"RS6",     engine:"4.0T TFSI",    hp:560, torque:516, t060:3.9, t60130:8.2,  et:11.8 },
  { id:"rs7",    label:"RS7",     engine:"4.0T TFSI",    hp:560, torque:516, t060:3.9, t60130:8.4,  et:11.9 },
  { id:"a8",     label:"A8 4.0T", engine:"4.0T TFSI",    hp:420, torque:479, t060:4.9, t60130:11.5, et:13.0 },
  { id:"s8",     label:"S8",      engine:"4.0T TFSI",    hp:520, torque:479, t060:3.9, t60130:9.0,  et:12.2 },
];

// ── TRAP SPEED REFERENCE LIBRARY ─────────────────────────────────────────────
// Maps a 60–130 mph roll time (seconds) → expected 1/4-mile trap speed (mph).
// Baseline reference curve sourced from the Dragy Talk 60-130-vs-trap-speed chart.
//
// This is intentionally a standalone, extensible data library — the product's
// reference "spine." As real runs accumulate (LEADERBOARD + user-logged runs), the
// Trap Chart overlays actual data points on top of this curve so the baseline can be
// tuned against reality over time. Extending it:
//   • Widen coverage      → add { t60130, trap } rows (keep it ordered slowest→fastest).
//   • Per-vehicle tables  → add sibling tables in the same shape and select by model.
//   • Blend with data     → weight trapForTime() toward observed points as they grow.
// Ordered slowest → fastest (descending t60130). Steps are non-uniform by design.
const TRAP_TABLE = [
  { t60130:12.0, trap:109   }, { t60130:11.9, trap:109.5 }, { t60130:11.8, trap:110   }, { t60130:11.7, trap:110.5 }, { t60130:11.6, trap:111   },
  { t60130:11.5, trap:111.5 }, { t60130:11.4, trap:112   }, { t60130:11.3, trap:112.5 }, { t60130:11.2, trap:113   }, { t60130:11.1, trap:113.5 },
  { t60130:11.0, trap:114   }, { t60130:10.9, trap:114.5 }, { t60130:10.8, trap:115   }, { t60130:10.7, trap:115.5 }, { t60130:10.6, trap:116   },
  { t60130:10.5, trap:116.5 }, { t60130:10.4, trap:117   }, { t60130:10.3, trap:117.5 }, { t60130:10.2, trap:118   }, { t60130:10.1, trap:118.5 },
  { t60130:10.0, trap:119   }, { t60130:9.9,  trap:119.5 }, { t60130:9.8,  trap:120   }, { t60130:9.7,  trap:120.5 }, { t60130:9.6,  trap:121   },
  { t60130:9.5,  trap:121.5 }, { t60130:9.4,  trap:122   }, { t60130:9.3,  trap:122.5 }, { t60130:9.2,  trap:123   }, { t60130:9.1,  trap:123.5 },
  { t60130:9.0,  trap:124   }, { t60130:8.9,  trap:124.5 }, { t60130:8.8,  trap:125   }, { t60130:8.7,  trap:125.5 }, { t60130:8.6,  trap:126   },
  { t60130:8.5,  trap:126.5 }, { t60130:8.4,  trap:127   }, { t60130:8.3,  trap:127.5 }, { t60130:8.2,  trap:128   }, { t60130:8.1,  trap:128.5 },
  { t60130:8.0,  trap:129   }, { t60130:7.9,  trap:129.5 }, { t60130:7.8,  trap:130   }, { t60130:7.7,  trap:130.5 }, { t60130:7.6,  trap:131   },
  { t60130:7.5,  trap:131.5 }, { t60130:7.4,  trap:132   }, { t60130:7.3,  trap:132.5 }, { t60130:7.2,  trap:133   }, { t60130:7.1,  trap:133.5 },
  { t60130:7.0,  trap:134   }, { t60130:6.9,  trap:134.5 }, { t60130:6.8,  trap:135   }, { t60130:6.7,  trap:135.5 }, { t60130:6.6,  trap:136   },
  { t60130:6.5,  trap:136.5 }, { t60130:6.4,  trap:137   }, { t60130:6.3,  trap:137.5 }, { t60130:6.2,  trap:138   }, { t60130:6.1,  trap:138.5 },
  { t60130:6.0,  trap:139   }, { t60130:5.9,  trap:140   }, { t60130:5.8,  trap:142   }, { t60130:5.7,  trap:143   }, { t60130:5.6,  trap:144   },
  { t60130:5.5,  trap:145   }, { t60130:5.4,  trap:146   }, { t60130:5.3,  trap:147   }, { t60130:5.2,  trap:148   }, { t60130:5.1,  trap:148.5 },
  { t60130:5.0,  trap:149   }, { t60130:4.9,  trap:149.5 }, { t60130:4.8,  trap:150   }, { t60130:4.7,  trap:151   }, { t60130:4.6,  trap:152   },
  { t60130:4.5,  trap:153   }, { t60130:4.4,  trap:154.25}, { t60130:4.3,  trap:155.5 }, { t60130:4.2,  trap:156   }, { t60130:4.1,  trap:157.5 },
  { t60130:4.0,  trap:159   }, { t60130:3.9,  trap:160.5 }, { t60130:3.8,  trap:161.75}, { t60130:3.7,  trap:163   }, { t60130:3.6,  trap:164.25},
  { t60130:3.5,  trap:165.5 }, { t60130:3.4,  trap:166.75}, { t60130:3.3,  trap:168   }, { t60130:3.2,  trap:169.25}, { t60130:3.1,  trap:170.5 },
  { t60130:3.0,  trap:171.75}, { t60130:2.9,  trap:173   }, { t60130:2.8,  trap:174.5 }, { t60130:2.7,  trap:176   }, { t60130:2.6,  trap:177.5 },
  { t60130:2.5,  trap:180   }, { t60130:2.4,  trap:182   }, { t60130:2.3,  trap:184   }, { t60130:2.2,  trap:186   }, { t60130:2.1,  trap:188   },
  { t60130:2.0,  trap:190   },
];

// Estimate 1/4-mile trap speed for ANY 60–130 time — including values that fall
// between table rows — via linear interpolation. Clamps to the table's covered
// range at both ends. Returns null for non-numeric input. This is the seam where
// the reference model can later be blended with observed data.
function trapForTime(t60130) {
  const t = Number(t60130);
  if (!Number.isFinite(t)) return null;
  const rows = TRAP_TABLE;                  // descending t60130: rows[0] slowest, last fastest
  const slowest = rows[0];
  const fastest = rows[rows.length - 1];
  if (t >= slowest.t60130) return slowest.trap;   // clamp slow end
  if (t <= fastest.t60130) return fastest.trap;   // clamp fast end
  for (let i = 0; i < rows.length - 1; i++) {
    const hi = rows[i];        // larger time
    const lo = rows[i + 1];    // smaller time
    if (t <= hi.t60130 && t >= lo.t60130) {
      const span = hi.t60130 - lo.t60130;
      if (span === 0) return hi.trap;
      const frac = (hi.t60130 - t) / span;          // 0 at hi → 1 at lo
      return +(hi.trap + frac * (lo.trap - hi.trap)).toFixed(2);
    }
  }
  return null;
}

// ── OTS vs CUSTOM TUNE — REFERENCE GAINS ─────────────────────────────────────
// Extensible reference library (same style as TRAP_TABLE) for the "OTS vs Custom"
// comparison. These are research-derived ESTIMATES from published dyno results —
// not guarantees. The headline lever is ETHANOL, not the OTS-vs-custom peak gap.
// Extend by adding platform rows / hardware entries as more dyno data is gathered.
const TUNE_GAINS = {
  // Fuel is the biggest single lever: same map, swap 93 oct → E-blend.
  ethanol: [
    { platform:"C8 RS6 / RS7 (4.0T)", from:"93 oct", to:"E85 / E40", hp:[75,110], tq:[80,130],
      evidence:"034 743→817 HP; IE 690→800 HP / 862 ft-lb on E40 (dyno-verified)." },
    { platform:"C7 S6 / S7 (4.0T)",   from:"93 oct", to:"E85 / E40", hp:[50,70],  tq:[114,114],
      evidence:"~+50–70 HP and ~+114 ft-lb from the ethanol swap." },
  ],
  // Peak-power gap between a strong OTS flex map and a custom map on STOCK turbos.
  otsVsCustomPeak: { whp:[0,25],
    note:"Small today — major OTS flex maps are strong. Custom's real value is elsewhere." },
  // Where custom actually pulls ahead: matching hardware an OTS file can't account for.
  customValue: [
    { factor:"Catted downpipes", whp:[23,35], note:"Gains a generic OTS file cannot see or claim." },
    { factor:"Knock margin",     whp:null,    note:"Calibrated to your fuel, IATs, and octane — safer at the edge." },
    { factor:"Fuel-specific cal",whp:null,    note:"Dialed for your exact blend rather than a conservative catch-all." },
  ],
  // Rolling-metric anchor — the number to feature prominently.
  rollingAnchor: { label:"APR S6 / S7 · 60–130 mph", fromS:11.32, toS:9.93, deltaS:-1.4 },
  drivetrainLossPct:[15,18],   // used to reconcile crank vs wheel on the 4.0T
  disclaimer:"Reference figures are estimates from published dyno results, not guarantees. Actual gains vary with hardware, fuel blend, DA, and tuner.",
};

// ── CUSTOM TUNE ADD-ON FEATURES (provider-agnostic) ──────────────────────────
// Selectable add-on features a custom tune can include — independent of tuner.
// NO pricing / bundles / commerce here: pricing and checkout are a FUTURE feature.
// Dyno Scorpion is credited (linked in-module) as the origin of the "Scorpion"
// feature set, but the SELECTION is provider-agnostic — any custom-tune owner can
// record which features they run and who tuned them. Extend the list as needed.
const CUSTOM_FEATURES = [
  { id:"flames",    name:"Flames",             desc:"Exhaust flame effect on lift / overrun." },
  { id:"launch",    name:"Launch Control",     desc:"Set-and-hold RPM target for consistent, repeatable launches." },
  { id:"ral",       name:"Rolling Anti-Lag",   desc:"Keeps boost alive on rolling starts and part-throttle for instant response (RAL)." },
  { id:"antilag",   name:"Anti-Lag",           desc:"Keeps the turbo spooled off-throttle to cut lag between shifts and out of corners." },
  { id:"fuelprot",  name:"Fuel Protection",    desc:"Safety monitoring — watches knock, HPFP/LPFP fuel pressure, overboost, and fuel trims." },
  { id:"nls",       name:"No-Lift Shift",      desc:"Full-throttle upshifts without lifting — holds boost through the gear change." },
  { id:"coldstart", name:"Cold Start Control", desc:"Manages cold-start behavior — smoother warm-up or a controlled cold-start routine." },
  { id:"valet",     name:"Valet / Security",   desc:"Power-limited valet mode and anti-theft immobilizer profile." },
];

// Dyno Scorpion credit — the provider whose Scorpion feature set these map to.
const SCORPION = { name:"Dyno Scorpion", url:"https://dynoscorpion.com/" };

// ── BUILD PATH / MOD POPULARITY (recommendation-engine seed) ─────────────────
// Real usage data: of 63 users who have logged parts, `builds` = how many run each
// mod. Ordered top-to-bottom by the community's proven progression (intake → downpipe
// → flex fuel → tune → fueling support → turbo → supporting hardware), which also
// tracks popularity. `pick` = the popular specific product for that slot, referenced
// by the catalog's existing variant id. Extend / reweight as the lineup grows.
//
// LIVE-DATA SEAM: this is a static seed. To make "What's Next" sharpen over time,
// replace/merge `builds` with live aggregate counts from real builds (see recommendNext).
const MOD_PATH_TOTAL = 63;   // denominator for social-proof %
const MOD_PATH = [
  { slot:"cai",           builds:48, pick:"tgk_4in" },       // Cold Air / High-Flow Intake
  { slot:"downpipe",      builds:36, pick:"arm_dp" },        // High-Flow Downpipe
  { slot:"flex_fuel",     builds:28, pick:"cobb_flex" },     // Flex Fuel / Ethanol Kit
  { slot:"ecu_s2",        builds:24, pick:"apr_s2" },        // Stage 2 OTS Tune
  { slot:"ecu_custom",    builds:27, pick:"ds1_srm" },       // Custom ECU Tune
  { slot:"hpfp",          builds:26, pick:"autotech_hpfp" }, // HPFP internals
  { slot:"port_inj",      builds:14, pick:"srm_port" },      // Port Injection
  { slot:"turbo_upgrade", builds:31, pick:"ts1" },           // Turbo Upgrade
  { slot:"wastegate",     builds:18, pick:"tgk_wg" },        // Wastegate
  { slot:"manifolds",     builds:12, pick:"srm_mani" },      // Upgraded Manifolds
  { slot:"intercooler",   builds:14, pick:"srm_a2a" },       // Intercooler Upgrade
  // supporting / secondary mods, by popularity
  { slot:"catback",       builds:20, pick:"awe_cb" },        // Cat-Back Exhaust
  { slot:"tcu_tune",      builds:17, pick:"etspec_tcu" },    // TCU / ZF8 Tune
  { slot:"spark_plugs",   builds:16, pick:"brisk_er10s" },   // Spark Plugs
  { slot:"bov",           builds:13, pick:"tgk_bov" },       // BOV / Blow-Off Valve
  { slot:"dsg_tune",      builds:10, pick:"apr_dsg" },       // DSG / S-Tronic Tune
  { slot:"resx",          builds:9,  pick:"034_resx" },      // Resonator Delete + X-Pipe
  { slot:"ecu_s1",        builds:6,  pick:"apr_s1" },        // Stage 1 OTS Tune
];

// Community-validated "Recommended" pick per slot, derived HONESTLY from MOD_PATH
// usage data: the most-run product in each slot, with the real social-proof %
// (share of the 63 logged builds running that mod). No invented numbers.
// LIVE-DATA SEAM: when real aggregate data exists, recompute the pick / % here.
const RECOMMENDED_BY_SLOT = Object.fromEntries(
  MOD_PATH.map(m => [m.slot, { variantId: m.pick, pct: Math.round((m.builds / MOD_PATH_TOTAL) * 100) }])
);

// Recommend the next 1–3 mods the user doesn't have, following MOD_PATH order (proven
// path + popularity). Conflict-aware: skips slots that clash with an installed part
// (e.g. won't suggest a second ECU-tune slot). Returns enriched rows with the popular
// pick resolved from the catalog and a social-proof %.
function recommendNext(installedMap, count = 3) {
  // LIVE-DATA SEAM: swap MOD_PATH.builds for live aggregate counts here to make
  // recommendations reflect what real builds are actually running over time.
  const installed = installedMap || {};
  const installedIds = new Set(Object.keys(installed).filter(k => installed[k]));
  const conflictSet = new Set();
  installedIds.forEach(id => (getSlotById(id)?.conflicts || []).forEach(c => conflictSet.add(c)));
  return MOD_PATH
    .filter(m => !installedIds.has(m.slot) && !conflictSet.has(m.slot))
    .slice(0, count)
    .map(m => {
      const slot = getSlotById(m.slot);
      const variant = getVariantById(m.slot, m.pick) || slot?.variants?.[0] || null;
      return {
        slot: m.slot,
        name: slot?.name || m.slot,
        cat: slot?.cat || "",
        builds: m.builds,
        pct: Math.round((m.builds / MOD_PATH_TOTAL) * 100),
        variant,
      };
    });
}

// ── PARTS RECOMMENDATION ENGINE ─────────────────────────────────────────────
// recommendNext (above) answers "which SLOT next?". This answers the other half:
// "which SPECIFIC PRODUCT in this slot is right for MY car, and why?"
//
// Three real signals only — nothing here is invented:
//   (a) COMMUNITY POPULARITY — MOD_PATH usage across the 63 logged builds. The only
//       real percentage we have is SLOT-level share, so that is the only % ever
//       shown, and it is always worded as such.
//   (b) STAGE / COMPATIBILITY — VARIANT_FIT below encodes what each product's own
//       catalog entry already says it is for: spark-plug heat range vs tune stage,
//       hybrid turbo vs big single, fuel-line size vs HP, tune stage vs fueling,
//       ethanol consistency. Hard gates exclude combinations the catalog calls
//       unsafe or non-fitting (e.g. a 60mm wastegate on OEM S6/S7 turbos).
//   (c) END-STATE AWARENESS — where the build is HEADED, taken from the wishlist
//       and an optional user-set power goal. Parts a big single would orphan are
//       flagged ("skip if going big single") instead of quietly recommended.
//
// LIVE-DATA SEAM: popularity is the only piece that needs live data. Point
// popularityFor() at live per-VARIANT install counts (aggregate builds.installed_map,
// or the part_likes table) and every recommendation sharpens automatically — the fit
// rules and gates are product facts and stay exactly as they are.

const REC_STAGE_ORDER = ["stock", "s1", "s2", "s3_hybrid", "big_single"];
const REC_STAGE_LABEL = {
  stock:"Stock", s1:"Stage 1", s2:"Stage 2",
  s3_hybrid:"Stage 3 · hybrid turbo", big_single:"Big single turbo",
};
const rankOfStage = s => Math.max(0, REC_STAGE_ORDER.indexOf(s));

// Turbo classes, taken from each turbo's own catalog entry (stock-frame hybrid vs
// single-turbo conversion). Drives stage inference AND orphan detection.
const REC_HYBRID_TURBOS     = new Set(["ts1", "ts2plus", "pp_rs_plus"]);
const REC_BIG_SINGLE_TURBOS = new Set(["xona_5357", "xona_5657", "xona_6564", "g40_1150", "g45_1500"]);

// Slots you buy ONCE and live with: judge fit against where the build is HEADED,
// so we don't sell someone a hybrid turbo they're about to throw away. Every other
// slot is judged against what the car runs TODAY — a plug two heat ranges too cold
// fouls right now no matter what the plan says. Extend either way as needed.
const REC_BUY_ONCE_SLOTS = new Set([
  "turbo_upgrade", "manifolds", "intercooler", "port_inj", "port_inj_full",
  "fuel_lines", "hpfp", "wastegate", "cai", "downpipe", "diff", "tcu_tune",
]);

// The 4.0T models the community data actually comes from. Recommendations for the
// 2.0T / 3.0T cars still work, but the popularity signal is flagged as directional.
const REC_4OT_MODELS = new Set(["s6", "s7", "a8", "s8", "rs6", "rs7"]);

// Optional user-set power goal (crank HP) → the stage that goal implies.
const REC_GOAL_BANDS = [
  { maxHp:550,      stage:"s1" },
  { maxHp:700,      stage:"s2" },
  { maxHp:900,      stage:"s3_hybrid" },
  { maxHp:Infinity, stage:"big_single" },
];
function stageForGoalHp(hp) {
  const n = Number(hp);
  if (!Number.isFinite(n) || n <= 0) return null;
  return (REC_GOAL_BANDS.find(b => n <= b.maxHp) || {}).stage || null;
}

// ── VARIANT FIT CONFIG ──────────────────────────────────────────────────────
// Per-product fitment, transcribed from that product's own catalog notes/cons.
// Extend by adding a variant id — anything absent is simply neutral on fit and is
// ranked on popularity + this model's power delta. Keys:
//   stages          build stages the product is correct for
//   models          allow-list of model ids (fitment)
//   notModels       deny-list of model ids (fitment)
//   needsVariant    variant ids that must already be in the build (+ needsWhy)
//   needsSlot       slot ids that must be filled first, on safety grounds (+ needsWhy)
//   orphanedBy      end-states that make this product throwaway money
//   leaderboard     number of NUMBERED leaderboard placements the catalog cites
//   caveat          catalog-stated condition that makes it a poor default pick
//   why             the one-line product fact behind the recommendation
const VARIANT_FIT = {
  // ── SPARK PLUGS — heat range must track tune stage. Too cold for the build
  // fouls; too hot risks pre-ignition. Straight out of the catalog notes.
  ngk_stock:     { stages:["stock","s1"], why:"OEM heat range 8 at 0.028\" — the correct plug for stock and Stage 1." },
  brisk_er12s:   { stages:["stock","s1"], why:"One step colder than OEM — 034's OEM+ pick for a Stage 1 daily driver." },
  ngk_s1_s2:     { stages:["s1","s2"],    why:"Same OEM plug regapped to 0.026\" — the community standard for Stage 1–2." },
  ngk_s2_tight:  { stages:["s2"],         why:"0.024\" gap holds spark at Stage 2 cylinder pressure on E30–E50." },
  brisk_er10s:   { stages:["s2","s3_hybrid"], why:"1–2 steps colder with a non-projected tip — the Stage 2–3 standard through 700+ HP." },
  ngk_s3_hybrid: { stages:["s3_hybrid"], orphanedBy:["big_single"],
                   why:"Heat range 9 at 0.022\" — stops pre-ignition at 600–750 whp on E50–E75 hybrid turbos." },
  denso_race:    { stages:["big_single"], why:"Coldest production plug — for 750–1000+ whp singles on E65+. Poor cold start; not a street plug." },

  // ── TURBOS — hybrid (stock frame) vs single-turbo conversion.
  ts1:        { stages:["s2","s3_hybrid"], orphanedBy:["big_single"], leaderboard:1,
                why:"Hybrid on the stock frame — OEM housings retained, the easiest step up from Stage 2." },
  ts2plus:    { stages:["s3_hybrid"], orphanedBy:["big_single"], leaderboard:1,
                why:"More aggressive hybrid than the TS1 — better top end, still stock location." },
  pp_rs_plus: { stages:["s2","s3_hybrid"], orphanedBy:["big_single"],
                caveat:"No published dyno data yet.",
                why:"Drop-in billet pair rated to 750 hp — the value hybrid route, no housing mods." },
  xona_5357:  { stages:["big_single"], leaderboard:1, why:"Compact single — fastest spool of the singles, the street/strip balance." },
  xona_5657:  { stages:["big_single"], leaderboard:2, why:"The leaderboard #1 turbo (4.10s 60–130). Needs E60+ and a custom map." },
  xona_6564:  { stages:["big_single"], leaderboard:1, caveat:"A built engine is recommended for full power.",
                why:"Highest ceiling on the list — leaderboard #2 at 4.49s." },
  g40_1150:   { stages:["big_single"], leaderboard:2, why:"Broad-powerband Garrett single, proven on two leaderboard cars." },
  g45_1500:   { stages:["big_single"], leaderboard:1, why:"Larger Garrett single — more top end than the G40, more lag with it." },

  // ── TUNE — stage has to match the hardware and the fuel it's calibrated for.
  apr_s1:  { stages:["stock","s1"], orphanedBy:["big_single"], why:"Benchmark Stage 1 OTS file with the deepest 4.0T logging base." },
  cobb_s1: { stages:["stock","s1"], orphanedBy:["big_single"], why:"Handheld flash/revert — the choice if you need to go back to stock for dealer visits." },
  srm_s1:  { stages:["stock","s1"], orphanedBy:["big_single"], why:"Mail-in Softronic service — smoothest delivery, lowest Stage 1 price." },
  uni_s1:  { stages:["stock","s1"], orphanedBy:["big_single"], why:"Strong torque curve with E30-capable maps out of the box." },
  apr_s2:  { stages:["s2"], orphanedBy:["big_single"], why:"The benchmark Stage 2 file — most published dyno data on the platform." },
  srm_s2:  { stages:["s2"], orphanedBy:["big_single"], why:"Most affordable Stage 2, and it shows up on higher-stage leaderboard builds." },
  uni_s2:  { stages:["s2"], orphanedBy:["big_single"], why:"Strong mid-range with an E30 map included." },
  ds1_srm: { stages:["s3_hybrid","big_single"], why:"ECU + TCU tuned together — the platform behind the SRM850 / SRM1000 kits." },
  loadlogic:{ stages:["big_single"], leaderboard:2, why:"Tuner on leaderboard #1 and #3 — big-single maps pushed safely at the limit." },
  c4_tuning:{ stages:["big_single"], leaderboard:4, why:"On four leaderboard builds — big single turbo maps on E-fuel are the specialty." },
  etspec:  { stages:["s3_hybrid","big_single"], why:"Remote-friendly and frequently the co-tuner on leaderboard cars." },
  selftuned:{ stages:["s3_hybrid","big_single"], leaderboard:1, caveat:"Highest-risk path — a mistuned map on this engine is expensive.",
             why:"Proven possible — leaderboard #5 runs a self-tune." },

  // ── FUELING — ethanol capability and flow have to line up with the power target.
  autotech_hpfp:{ why:"The benchmark DLC-coated HPFP kit — what most serious 4.0T tuners specify. Both pumps included." },
  "034_hpfp":   { why:"50% flow increase, DLC coated, drop-in to the factory housings." },
  ie_hpfp:      { why:"Constant-diameter piston, dyno-tested per pump, 2 complete kits included." },
  loba_hpfp:    { why:"Highest flow rate of the four — the European flex-fuel favourite." },
  cobb_flex:    { needsVariant:["cobb_s1"], needsWhy:"the COBB flex kit reads through the Accessport, so it needs a COBB tune",
                  stages:["s1","s2"], why:"Sensor + Accessport integration with real-time blend detection." },
  walbro_flex:  { stages:["s2","s3_hybrid","big_single"], why:"Full injector upgrade — the headroom for E75+ and pure E85. Custom tune mandatory." },
  srm_port:     { stages:["s3_hybrid","big_single"], why:"On 7 of the top 10 60–130 builds — port injection is what uncorks the OEM DI limit." },
  gen_port:     { stages:["s3_hybrid","big_single"], why:"Shop-built port injection — works with any manifold, more integration time." },
  meth_kit:     { stages:["s2","s3_hybrid"], orphanedBy:["big_single"],
                  why:"Charge cooling at a fraction of port-injection cost — the Stage 2/hybrid stopgap." },
  stock_lines:  { stages:["stock","s1","s2"], why:"Factory lines are fine to roughly 650 crank HP — no reason to spend here yet." },
  "6an":        { stages:["s2"], orphanedBy:["big_single"], why:"~9.5mm ID — removes the OEM rubber restriction for 650–750 HP builds." },
  "8an":        { stages:["s3_hybrid"], why:"~11mm ID for 750–900 HP — the popular pairing with an HPFP upgrade and port injection." },
  "10an":       { stages:["big_single"], why:"~14mm ID, standard on the SRM850/1000 kits — required past 900 HP." },

  // ── AIRFLOW / SUPPORTING HARDWARE
  tgk_4in:  { why:"4.0T-specific single 4\" merged inlet feeding both turbos — loudest induction on the platform." },
  tgk_5in:  { needsVariant:["tgk_4in"], needsWhy:"the 5\" kit is a conversion of the TGK 4\" intake, not a standalone",
              stages:["s3_hybrid","big_single"], why:"2,000+ CFM — the airflow to feed a 1000+ HP build." },
  srm_intake:{ notModels:["a8","s8"], stages:["s3_hybrid","big_single"],
              why:"Full 2.5\" runner to the turbo inlet — frees 3–4 PSI at the top end. Core of the SRM850/1000 kits." },
  srm_s8_intake:{ models:["a8","s8"], stages:["s3_hybrid","big_single"],
              why:"The D4-specific dual 3\" version — the C7 Luftwaffe does not fit this chassis. Needs an A2A intercooler." },
  ie_cai:   { stages:["stock","s1","s2"], why:"Full carbon housing — the best IAT reduction of the bolt-on intakes." },
  ecs_cai:  { stages:["stock","s1"], why:"Best-value direct-fit kit for a Stage 1 build on a budget." },
  awe_cai:  { stages:["s1","s2"], why:"No-MAF design — the Stage 2 favourite, no MAF scaling to worry about." },
  arm_dp:   { why:"Verified 37whp / 42wtq, same-side routing, and explicitly compatible with every turbo upgrade." },
  ie_dp:    { stages:["s2"], why:"Cast set that deletes the OEM crossover — the common Stage 2 downpipe on this platform." },
  milltek_dp:{ stages:["s1","s2"], why:"The high-flow cat option if you live somewhere catless is not workable." },
  srm_a2a:  { stages:["s3_hybrid","big_single"], why:"Full air-to-air conversion on a CSF core — the leaderboard standard, and it integrates port injection." },
  ie_fmic:  { stages:["s2","s3_hybrid"], why:"Best-value front-mount A2A for a build that is not going full SRM ecosystem." },
  ecs_fmic: { stages:["stock","s1","s2"], orphanedBy:["big_single"],
              why:"Budget direct-fit A2A — the catalog notes it falls off past 600 whp." },
  // Wastegate actuators are gated on an upgraded turbo: the catalog is explicit that
  // a 60mm gate cannot dial down on OEM S6/S7 turbos and risks overspin.
  tgk_wg:   { stages:["s3_hybrid","big_single"], needsSlot:["turbo_upgrade"],
              needsWhy:"a 60mm gate cannot dial down on OEM S6/S7 turbos — overspin risk until the turbos are upgraded",
              why:"60mm diaphragm holding 30+ PSI while keeping the factory vacuum gate — no MAC valve." },
  tial_wg:  { stages:["s3_hybrid","big_single"], needsSlot:["turbo_upgrade"],
              needsWhy:"upgraded actuators are a turbo-build part — stock turbos do not need them",
              why:"Included in the SRM1000 kit — the proven actuator on top builds." },
  srm_wg:   { stages:["s3_hybrid","big_single"], needsSlot:["turbo_upgrade"],
              needsWhy:"upgraded actuators are a turbo-build part — stock turbos do not need them",
              why:"SRM's own high-vacuum actuators — native to a DS1 + SRM manifold build." },
  gfb_dv:   { stages:["stock","s1"], orphanedBy:["big_single","s3_hybrid"],
              why:"Cheap fix for the failure-prone OEM plastic valve — not a high-boost part." },
  tgk_bov:  { stages:["s2","s3_hybrid","big_single"], why:"Converts the OEM electronic diverters to mechanical — kills a real boost-leak path at high power." },
};

// Model-fitment gate: does this variant physically fit / suit this car?
function fitBlocksModel(fit, modelId) {
  if (!fit) return null;
  if (fit.models    && !fit.models.includes(modelId))   return "different chassis — not a fitment for this car";
  if (fit.notModels &&  fit.notModels.includes(modelId)) return "not a fitment for this chassis";
  return null;
}

// Prerequisite gate: some products are explicitly conversions of another product,
// or are unsafe until a supporting slot is filled.
function fitBlocksPrereq(fit, ownedVariantIds, filledSlots) {
  if (fit?.needsVariant?.length && !fit.needsVariant.some(id => ownedVariantIds.has(id))) {
    return fit.needsWhy || "a prerequisite part is missing";
  }
  if (fit?.needsSlot?.length && !fit.needsSlot.every(id => filledSlots.has(id))) {
    return fit.needsWhy || "a supporting mod is missing";
  }
  return null;
}

// Where the build is right now, read off the parts actually in the map.
function inferStage(map) {
  const m = map || {};
  const turbo = m.turbo_upgrade;
  if (turbo && REC_BIG_SINGLE_TURBOS.has(turbo)) return "big_single";
  if (turbo && REC_HYBRID_TURBOS.has(turbo))     return "s3_hybrid";
  if (turbo || m.ecu_custom)                     return "s3_hybrid";
  if (m.ecu_s2 || (m.downpipe && m.cai))         return "s2";
  if (m.ecu_s1 || m.downpipe || m.cai || m.flex_fuel) return "s1";
  return "stock";
}

// LIVE-DATA SEAM: the one signal that wants live data. Today MOD_PATH gives the
// most-run product per slot plus the real share of builds running that slot.
// Swap the body for live aggregates and everything downstream sharpens.
function popularityFor(slotId, variantId) {
  const row = MOD_PATH.find(m => m.slot === slotId);
  if (!row) return { isPick:false, pct:null, builds:null };
  return {
    isPick: row.pick === variantId,
    pct: Math.round((row.builds / MOD_PATH_TOTAL) * 100),
    builds: row.builds,
  };
}

const REC_WEIGHTS = {
  communityPick: 40,   // scaled by the slot's real usage share
  stageExact:    50,
  stageAdjacent: 12,
  stageMismatch:-30,
  goalReady:     14,   // also correct for where the build is headed
  orphanPenalty:-35,
  leaderboard:    6,   // per numbered leaderboard placement the catalog cites (capped)
  leaderboardCap:12,
  caveatPenalty:-12,   // catalog-stated condition that makes it a poor DEFAULT pick
  modelPower:    10,   // tiebreak on this model's own HP delta
};

function pruneMap(map) {
  const out = {};
  Object.entries(map || {}).forEach(([k, v]) => { if (v) out[k] = v; });
  return out;
}

/**
 * Recommend the best specific product in `slotId` for this user.
 *
 * @param slotId   catalog slot id (e.g. "spark_plugs")
 * @param build    { installed, wishlist } — slotId → variantId maps
 * @param vehicle  { modelId, goalHp } — goalHp optional (hook for a user-set goal)
 * @returns { recommended, alternatives, excluded, notes, stage, endStage, ... } | null
 */
function recommendProduct(slotId, build = {}, vehicle = {}) {
  const slot = getSlotById(slotId);
  if (!slot || !slot.variants?.length) return null;

  const installed = pruneMap(build.installed);
  const wishlist  = pruneMap(build.wishlist);
  const modelId   = vehicle.modelId || "s7";
  const goalHp    = vehicle.goalHp ?? null;

  // Current stage from what's actually installed; end state from the furthest of
  // (installed, planned wishlist, explicit power goal).
  const stage     = inferStage(installed);
  const planStage = inferStage({ ...installed, ...wishlist });
  const goalStage = stageForGoalHp(goalHp);
  const endStage  = [stage, planStage, goalStage]
    .filter(Boolean)
    .reduce((a, b) => (rankOfStage(b) > rankOfStage(a) ? b : a), "stock");

  const ownedVariantIds = new Set([...Object.values(installed), ...Object.values(wishlist)]);
  const filledSlots     = new Set([...Object.keys(installed), ...Object.keys(wishlist)]);
  // Buy-once hardware is judged against the end state; everything else against today.
  const targetStage = REC_BUY_ONCE_SLOTS.has(slotId) ? endStage : stage;
  const targetRank  = rankOfStage(targetStage);
  const endRank     = rankOfStage(endStage);

  // Normalizer for the model-specific power tiebreak within this slot.
  const maxHp = Math.max(...slot.variants.map(v => v.hp?.[modelId] || 0), 0);

  const excluded = [];
  const scored = [];

  slot.variants.forEach(v => {
    const fit = VARIANT_FIT[v.id];

    // Hard gates first — a product that does not fit is never "recommended".
    const modelBlock  = fitBlocksModel(fit, modelId);
    const prereqBlock = fitBlocksPrereq(fit, ownedVariantIds, filledSlots);
    if (modelBlock || prereqBlock) {
      excluded.push({ variantId:v.id, variant:v, reason: modelBlock || prereqBlock });
      return;
    }

    let score = 0;
    const reasons = [];

    // (b) stage / compatibility
    if (fit?.stages?.length) {
      const ranks = fit.stages.map(rankOfStage);
      if (fit.stages.includes(targetStage)) {
        score += REC_WEIGHTS.stageExact;
      } else {
        const nearest = ranks.reduce((a, r) => (Math.abs(r - targetRank) < Math.abs(a - targetRank) ? r : a), ranks[0]);
        score += Math.abs(nearest - targetRank) === 1 ? REC_WEIGHTS.stageAdjacent : REC_WEIGHTS.stageMismatch;
      }
      // (c) bonus for a part that ALSO covers where the build is headed.
      if (endRank !== targetRank && fit.stages.includes(endStage)) score += REC_WEIGHTS.goalReady;
    }

    // (c) end-state orphan penalty
    const orphaned = !!fit?.orphanedBy?.includes(endStage);
    if (orphaned) score += REC_WEIGHTS.orphanPenalty;

    // (a) community popularity
    const pop = popularityFor(slotId, v.id);
    if (pop.isPick && pop.pct != null) score += REC_WEIGHTS.communityPick * (pop.pct / 100);

    // (a) leaderboard evidence — numbered placements the catalog entry cites.
    if (fit?.leaderboard) {
      score += Math.min(fit.leaderboard * REC_WEIGHTS.leaderboard, REC_WEIGHTS.leaderboardCap);
    }
    // A product the catalog itself qualifies is not a good DEFAULT pick.
    if (fit?.caveat) score += REC_WEIGHTS.caveatPenalty;

    // model-specific power delta, as a tiebreak only
    const hp = v.hp?.[modelId] || 0;
    if (maxHp > 0) score += REC_WEIGHTS.modelPower * (hp / maxHp);

    if (fit?.why) reasons.push(fit.why);
    if (fit?.caveat) reasons.push(fit.caveat);
    if (pop.isPick && pop.pct != null) {
      reasons.push(`The community's most-run pick here — ${pop.pct}% of the ${MOD_PATH_TOTAL} logged builds run this mod.`);
    }
    if (orphaned) {
      reasons.push(endStage === "big_single"
        ? "Skip if going big single — a single turbo makes this part throwaway money."
        : `Skip if you are heading to ${REC_STAGE_LABEL[endStage]} — it gets replaced.`);
    }

    scored.push({ variantId:v.id, variant:v, score:+score.toFixed(2), orphaned, pop, hp, reasons });
  });

  scored.sort((a, b) => b.score - a.score || (b.hp - a.hp) || a.variant.price - b.variant.price);

  const toOut = c => ({
    variantId: c.variantId,
    variant:   c.variant,
    score:     c.score,
    orphaned:  c.orphaned,
    isCommunityPick: c.pop.isPick,
    pct:       c.pop.isPick ? c.pop.pct : null,
    why:       c.reasons.length
      ? c.reasons.join(" ")
      : `Best remaining option in this slot for a ${REC_STAGE_LABEL[stage].toLowerCase()} ${modelId.toUpperCase()} build.`,
  });

  const notes = [];
  const orphanNames = scored
    .filter(c => c.orphaned)
    .map(c => `${c.variant.brand} ${c.variant.label}`);
  if (orphanNames.length && endStage === "big_single") {
    notes.push(`Skip if going big single: ${orphanNames.join(", ")} — a single turbo replaces them.`);
  }
  if (!REC_4OT_MODELS.has(modelId)) {
    notes.push("Popularity data comes from 4.0T builds — treat it as directional on this engine.");
  }
  excluded.forEach(x => notes.push(`${x.variant.brand} ${x.variant.label} not shown as a pick — ${x.reason}.`));

  return {
    slot: slotId,
    slotName: slot.name,
    modelId,
    goalHp,
    stage,
    stageLabel: REC_STAGE_LABEL[stage],
    endStage,
    endStageLabel: REC_STAGE_LABEL[endStage],
    targetStage,                                  // the stage this slot was judged against
    targetStageLabel: REC_STAGE_LABEL[targetStage],
    // null when every product in the slot is gated out for this build — the caller
    // renders nothing, and `notes` explains why.
    recommended: scored.length ? toOut(scored[0]) : null,
    alternatives: scored.slice(1, 3).map(toOut),
    excluded: excluded.map(x => ({ variantId:x.variantId, variant:x.variant, reason:x.reason })),
    notes,
  };
}

// Reads the optional user-set power goal (crank HP). LIVE-DATA SEAM / HOOK: nothing
// writes this yet — a Profile field or an onboarding question can set
// "proof-power-goal" and every recommendation immediately becomes goal-aware.
// Until then the engine infers the end state from the wishlist.
function readPowerGoal() {
  try {
    const raw = localStorage.getItem("proof-power-goal");
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch { return null; }
}

// 4.0T HP normalization: S6/S7/A8/S8 share the same block; stock HP differences are
// OEM turbo sizing and factory tune — not engine differences. When aftermarket turbos
// or tunes are added, the block normalizes to a common output baseline.
// RS6/RS7 have higher compression pistons (genuine engine difference) so they stay higher.
const TUNING_SLOTS        = new Set(["turbo_upgrade","ecu_s1","ecu_s2","ecu_custom"]);
// Fuel system hardware makes no power on its own — a stock ECU will not command
// the extra fuel, so the gain only exists once a tune can exploit it. The
// catalog's per-variant hp figures all assume that tune is present, so without
// one these slots must contribute zero (05-data-and-math.md: "fuel is inert
// without a tune"). Cost still counts: you paid for the parts either way.
const FUEL_SLOTS = new Set(["hpfp","flex_fuel","port_inj","fuel_lines","port_inj_full"]);
const NON_RS_4OT          = new Set(["s6","s7","a8","s8"]);
const NORMALIZED_4OT_BASE = 450; // S6/S7 stock level — the "true" block baseline

const CATEGORIES = ["Engine","Turbos","Fueling","Intake","Exhaust","Intercooler","Cooling","Manifolds","Differential","Drivetrain","Suspension","Brakes","Tires","Maintenance"];

// ── SLOTS ──────────────────────────────────────────────────────────────────
const SLOTS = [

  // ── ENGINE (ECU TUNE) ─────────────────────────────────────────────────
  {
    id:"ecu_s1", cat:"Engine", name:"Stage 1 ECU Tune",
    desc:"Software-only. No hardware needed. Best starting point.",
    tag:"POPULAR", requires:[], recommends:["cai","hpfp"], conflicts:["ecu_s2","ecu_custom"],
    variants:[
      { id:"apr_s1", buyUrl:"https://www.goapr.com/products/software/ecu_upgrade/parts/ECU-40T-EA824-S67",  brand:"APR",       label:"Stage 1+",        price:799,  rating:4.9,
        hp:{a6_20t:62,a6_30t:58,a7_20t:62,a7_30t:58,s6:82,s7:82,a8:82,s8:84,rs6:85,rs7:85},
        torque:{a6_20t:72,a6_30t:68,a7_20t:72,a7_30t:68,s6:105,s7:105,a8:105,s8:108,rs6:110,rs7:110},
        notes:"Most popular C7 tune. OTS maps, huge community logging base.", difficulty:"Plug & Play",
        pros:["OTS maps","Wide support","Data logging"],cons:["ECU locked","Dealer detectable"] },
      { id:"cobb_s1", buyUrl:"", brand:"COBB",      label:"Accessport",      price:695,  rating:4.7,
        hp:{a6_20t:58,a6_30t:54,a7_20t:58,a7_30t:54,s6:78,s7:78,a8:78,s8:79,rs6:80,rs7:80},
        torque:{a6_20t:68,a6_30t:64,a7_20t:68,a7_30t:64,s6:98,s7:98,a8:98,s8:99,rs6:100,rs7:100},
        notes:"Handheld flash/revert. Best for dealer visits and resale.", difficulty:"Plug & Play",
        pros:["Revert in minutes","Resale value","Easy logging"],cons:["Slightly lower peak"] },
      { id:"srm_s1", buyUrl:"https://sillyrabbitmotorsport.com/tuning/",  brand:"SRM (Softronic)", label:"Stage 1",   price:650,  rating:4.7,
        hp:{a6_20t:55,a6_30t:52,a7_20t:55,a7_30t:52,s6:75,s7:75,a8:75,s8:76,rs6:78,rs7:78},
        torque:{a6_20t:65,a6_30t:62,a7_20t:65,a7_30t:62,s6:95,s7:95,a8:95,s8:96,rs6:98,rs7:98},
        notes:"Swedish mail-in ECU service. Known for smooth delivery, strong on 3.0T SC.", difficulty:"Plug & Play",
        pros:["OEM drivability","Budget option","Strong 3.0T maps"],cons:["Mail-in turnaround ~1 wk"] },
      { id:"uni_s1", buyUrl:"https://www.urotuning.com/products/unitronic-c7-audi-s6-s7-4-0t-performance-software",  brand:"Unitronic", label:"Stage 1",          price:749,  rating:4.8,
        hp:{a6_20t:60,a6_30t:55,a7_20t:60,a7_30t:55,s6:80,s7:80,a8:80,s8:81,rs6:82,rs7:82},
        torque:{a6_20t:70,a6_30t:65,a7_20t:70,a7_30t:65,s6:100,s7:100,a8:100,s8:102,rs6:105,rs7:105},
        notes:"Excellent torque curve. Strong E30-capable maps.", difficulty:"Plug & Play",
        pros:["Smooth torque","E30 capable","Good support"],cons:["Less US presence"] },
    ]
  },
  {
    id:"ecu_s2", cat:"Engine", name:"Stage 2 ECU Tune",
    desc:"Maximizes airflow hardware. Requires downpipe + intake.",
    tag:"BEST VALUE", requires:["downpipe","cai"], recommends:["intercooler","dsg_tune"], conflicts:["ecu_s1","ecu_custom"],
    variants:[
      { id:"apr_s2", buyUrl:"https://www.goapr.com/products/software/ecu_upgrade/parts/ECU-40T-EA824-S67",  brand:"APR",            label:"Stage 2+",    price:899,  rating:4.9,
        hp:{a6_20t:100,a6_30t:90,a7_20t:100,a7_30t:90,s6:145,s7:145,a8:145,s8:150,rs6:155,rs7:155},
        torque:{a6_20t:120,a6_30t:110,a7_20t:120,a7_30t:110,s6:175,s7:175,a8:175,s8:190,rs6:205,rs7:205},
        notes:"Benchmark Stage 2. Prefers APR downpipe for full unlock.", difficulty:"Professional",
        pros:["Most dyno data","OTS maps"],cons:["APR DP preferred"] },
      { id:"srm_s2", buyUrl:"https://sillyrabbitmotorsport.com/tuning/",  brand:"SRM (Softronic)", label:"Stage 2",    price:750,  rating:4.7,
        hp:{a6_20t:93,a6_30t:83,a7_20t:93,a7_30t:83,s6:133,s7:133,a8:133,s8:138,rs6:143,rs7:143},
        torque:{a6_20t:112,a6_30t:102,a7_20t:112,a7_30t:102,s6:163,s7:163,a8:163,s8:178,rs6:193,rs7:193},
        notes:"Most affordable Stage 2. Seen on multiple leaderboard builds at higher stages.", difficulty:"Professional",
        pros:["Best price","Strong 3.0T focus","OEM feel"],cons:["Mail-in downtime"] },
      { id:"uni_s2", buyUrl:"https://www.urotuning.com/products/unitronic-c7-audi-s6-s7-4-0t-performance-software",  brand:"Unitronic",       label:"Stage 2",    price:849,  rating:4.8,
        hp:{a6_20t:98,a6_30t:88,a7_20t:98,a7_30t:88,s6:140,s7:140,a8:140,s8:145,rs6:150,rs7:150},
        torque:{a6_20t:118,a6_30t:108,a7_20t:118,a7_30t:108,s6:172,s7:172,a8:172,s8:186,rs6:200,rs7:200},
        notes:"Strong mid-range torque. Pairs well with Unitronic Stage 1 owners upgrading.", difficulty:"Professional",
        pros:["Mid-range torque","E30 map included"],cons:["Fewer V8 community logs"] },
    ]
  },
  {
    id:"ecu_custom", cat:"Engine", name:"Custom / Race Map",
    desc:"Tuner-written map specific to your exact hardware. Required for turbo builds.",
    tag:"RACE", requires:["turbo_upgrade"], recommends:["port_inj","manifolds","flex_fuel"], conflicts:["ecu_s1","ecu_s2"],
    variants:[
      { id:"ds1_srm", buyUrl:"https://sillyrabbitmotorsport.com/dyno-spectrum-ds1.html",    brand:"Dyno Spectrum (DS1)", label:"DS1 ECU + ET Spec TCU Combo", price:1299, rating:5.0,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"SRM's preferred tuning platform. DS1 ECU + ET Spec TCU combo for ZF8HP or DL501 — $1,299 as a bundle (free overnight shipping). Powers the SRM850 (838whp/744wtq Mustang dyno) and SRM1000 (992whp/919wtq Mustang dyno) kits. The ECU and TCU are tuned together for seamless power delivery across all gears.", difficulty:"Professional",
        pros:["SRM ecosystem native","ECU+TCU bundled","SRM850/1000 proven","Free overnight shipping"],cons:["SRM parts ecosystem recommended","Less aftermarket community than APR"] },
      { id:"loadlogic", buyUrl:"", brand:"Load Logic",  label:"Custom Race Map", price:1200, rating:5.0,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Leaderboard #1 and #3 60-130 tuner. Works closely with ET Spec. Known for pushing limits safely on big single turbo builds. Often co-tunes with ET Spec on top leaderboard cars.", difficulty:"Professional",
        pros:["Leaderboard proven (#1, #3, #8)","Aggressive safe maps","ET Spec partnership"],cons:["Access limited","Full supporting mods required"] },
      { id:"c4_tuning", buyUrl:"", brand:"C4 Tuning",  label:"Custom Race Map",  price:1100, rating:4.9,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Appears on #2, #4, #6, #9 leaderboard builds. Specializes in big single turbo maps on E-fuel.", difficulty:"Professional",
        pros:["Multiple leaderboard entries","E-fuel specialist","Big turbo proven"],cons:["Waitlist common"] },
      { id:"etspec", buyUrl:"",    brand:"ET Spec",    label:"Custom Race Map",   price:1000, rating:4.8,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Partners with Load Logic and C4. Often co-tuner on leaderboard cars. Great for remote tune customers.", difficulty:"Professional",
        pros:["Co-tunes with Load Logic/C4","Remote-friendly","Community reputation"],cons:["Best with complementary tuner"] },
      { id:"selftuned", buyUrl:"",  brand:"Self Tuned", label:"DIY Map (COBB/HP Tuners)", price:300, rating:4.0,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Neil Otis (leaderboard #5, 4.96s) runs a self-tune. High skill ceiling but proven possible.", difficulty:"Professional",
        pros:["Lowest cost","Full control","Instant revisions"],cons:["High learning curve","Risk if inexperienced"] },
    ]
  },

  // ── SPARK PLUGS ───────────────────────────────────────────────────────
  // 4.0TT uses 8 plugs total. Price shown is per-plug. Set of 8 = price × 8.
  // Change interval shortens significantly with tune stage and ethanol content.
  {
    id:"spark_plugs", cat:"Maintenance", name:"Spark Plugs",
    desc:"Gap and heat range matter more than brand on the 4.0T. Wrong gap at high boost causes cylinder misfires. Interval drops to 7–10K on Stage 2+ builds.",
    tag:"MAINTENANCE", requires:[], recommends:["ecu_s1"], conflicts:[],
    variants:[
      { id:"ngk_stock", buyUrl:"https://www.ecstuning.com/Audi-C7_S6-Quattro-4.0T/Engine/Ignition/Spark_Plugs/NGK/",
        brand:"NGK", label:"SILFER8C7ES — Stock / Stage 1 (0.028\")", price:18, rating:4.9,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"OEM plug for all C7/C7.5 4.0T. Part# 06K-905-601-M. Heat range 8. Gap: 0.028\". Audi updated the earlier S6/S7 spec in 2022 to match the RS7 plug — one plug now covers the entire 4.0T range. Fine for stock and Stage 1 builds on 93 octane or E30. Replace every 20–25K miles at stock, 15K at Stage 1. Set of 8 = ~$144.", difficulty:"DIY Friendly",
        pros:["OEM spec","Same plug for all 4.0T models","Iridium tip","Widely available"],
        cons:["Gap too wide for Stage 2+","Replace more frequently when tuned"] },
      { id:"ngk_s1_s2", buyUrl:"https://www.ecstuning.com/Audi-C7_S6-Quattro-4.0T/Engine/Ignition/Spark_Plugs/NGK/",
        brand:"NGK", label:"SILFER8C7ES — Stage 1/2 regapped (0.026\")", price:18, rating:5.0,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Same NGK SILFER8C7ES OEM plug, regapped to 0.026\" before install. EPL recommends this for Stage 1 performance builds. Tighter gap reduces misfire risk under boost. Community consensus on Audizine and AudiWorld for APR/COBB/Unitronic Stage 1–2. Change every 15–20K miles. Requires a spark plug gap tool — do not install at factory gap.", difficulty:"DIY Friendly",
        pros:["Community gold standard for S1/S2","Same OEM plug — no compatibility risk","Eliminates gap-related misfires"],
        cons:["Must regap before install","0.026\" is minimum for daily street use"] },
      { id:"brisk_er12s", buyUrl:"https://www.034motorsport.com/brisk-racing-er12s-silver-spark-plug.html",
        brand:"Brisk Racing", label:"ER12S Silver — OEM+ / Stage 1 (0.028\")", price:11, rating:4.8,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"034Motorsport lists the Brisk ER12S as the OEM+ stock replacement for the C7 S6/S7/RS7 4.0T. One step colder than OEM. Silver center electrode — better electrical and thermal conductor than iridium. 14mm × 26.5mm reach, gasket seat. Does NOT come pre-gapped — must verify and set gap before install. Torque: 20–30 Nm. Change every 15–20K miles. Best Stage 1 daily driver upgrade with better heat dissipation than OEM NGK.", difficulty:"DIY Friendly",
        pros:["034Motorsport tested and confirmed","One step colder than OEM","Silver = better conductor than iridium","Better thermal management than NGK OEM"],
        cons:["Must gap before install","Higher cost per plug than NGK OEM"] },
      { id:"brisk_er10s", buyUrl:"https://www.034motorsport.com/brisk-racing-er10s-silver-spark-plug.html",
        brand:"Brisk Racing", label:"ER10S Silver — Stage 2 / Hybrid / Big Turbo (0.024\")", price:11, rating:5.0,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Community preferred plug for Stage 2 through 700+ crank HP 4.0T builds. 034Motorsport confirmed for Stage 1/2 and hybrid/big turbo applications. A 4.0T tuner on Audizine stated: 'most run Brisk ER10S' at Stage 3 power levels. 1–2 steps colder than OEM. Non-projected tip handles high boost better — tip won't be blast-eroded by high-velocity charge. Silver electrode: far superior electrical and thermal conductor vs iridium. Gap: 0.024\" — comes unset, must gap before install. Change every 7,000–10,000 miles. Set of 8 = ~$88.", difficulty:"DIY Friendly",
        pros:["Community Stage 2–3 standard","Non-projected tip for high boost","Silver electrode — best conductor","034Motorsport tested","Fouling resistant"],
        cons:["Not pre-gapped — must set 0.024\" before install","7–10K change interval","Too cold for stock builds — will foul"] },
      { id:"ngk_s2_tight", buyUrl:"https://www.ecstuning.com/Audi-C7_S6-Quattro-4.0T/Engine/Ignition/Spark_Plugs/NGK/",
        brand:"NGK", label:"SILFER8C7ES — Stage 2 tight gap (0.024\")", price:18, rating:4.9,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"NGK SILFER8C7ES regapped to 0.024\" for Stage 2 builds on E30–E50. Tighter gap holds spark under higher cylinder pressure. APR previously recommended Denso IKH24 at this gap but moved back to NGK after cylinder 5 misfire reports on Denso. Change every 10–15K miles.", difficulty:"DIY Friendly",
        pros:["Proven Stage 2 setup","No Denso misfire risk","E30–E50 capable"],
        cons:["Too tight for stock — poor idle quality","Must gap precisely"] },
      { id:"ngk_s3_hybrid", buyUrl:"https://www.ecstuning.com/Audi-C7_S6-Quattro-4.0T/Engine/Ignition/Spark_Plugs/NGK/",
        brand:"NGK", label:"Heat Range 9 — Stage 3 / Hybrid Turbo (0.022\")", price:22, rating:4.8,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Step up to a colder heat range (HR9 equivalent) for Stage 3 hybrid turbo builds running E50–E75. The colder plug dissipates heat faster under sustained boost — prevents pre-ignition at 600–750 whp. Gap: 0.022\". Required when running SRM or TGK hybrid turbo setups on ethanol. Confirm exact NGK part number with your tuner as it varies by build spec. Change every 8–12K miles.", difficulty:"Professional",
        pros:["Colder heat range prevents pre-ignition","Required at 600+ whp on E-fuel","Standard on SRM ecosystem builds"],
        cons:["Confirm part# with tuner","Poor cold-start if heat range too cold for street"] },
      { id:"denso_race", buyUrl:"https://www.ecstuning.com/Audi-C7_S6-Quattro-4.0T/Engine/Ignition/Spark_Plugs/Denso/",
        brand:"Denso", label:"IKH01-27 (#5750) — Single Turbo / Race (0.018–0.020\")", price:38, rating:4.7,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Denso IKH01-27 (part #5750), heat range 27 — coldest production plug for this application. Listed by ECS Tuning as the Stage 3 race plug for the 4.0T. Gap: 0.018–0.020\". For Xona/Garrett single turbo builds on E65+ running 750–1000+ whp. Not for street use — cold start behavior is poor. Change every 5–8K miles or after every track day. ~$38/plug, set of 8 = ~$304.", difficulty:"Professional",
        pros:["Coldest heat range for max power builds","Race-proven on leaderboard builds","Denso precision manufacturing"],
        cons:["Race only — poor cold start on street","$38/plug — most expensive option","Must be re-gapped precisely"] },
    ]
  },

  // ── ENGINE OIL ────────────────────────────────────────────────────────
  // 4.0TT capacity: 8.7L / 9.2 quarts. Filter: MAHLE (OEM spec).
  // VW 502.00 5W-40 high SAPS is the platform standard.
  // NEVER use oil additives — Audi explicitly warns. Fine oil screen risk on 4.0T.
  {
    id:"engine_oil", cat:"Maintenance", name:"Engine Oil",
    desc:"4.0TT takes 9.2 qts. VW 502.00 5W-40 is the spec. Change interval drops from 10K stock to 3–5K at race boost levels. Always use MAHLE filter.",
    tag:"MAINTENANCE", requires:[], recommends:[], conflicts:[],
    variants:[
      { id:"liquimoly_5w40", buyUrl:"https://www.amazon.com/LIQUI-Molygen-Generation-5W-40-Motor/dp/B076ZQ4KDK",
        brand:"Liqui-Moly", label:"Leichtlauf High Tech 5W-40 — All Stages", price:12, rating:5.0,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Most popular 4.0T oil in the Audizine and AudiWorld communities. Full synthetic, VW 502.00 certified, HTHS 3.5+ mPa·s. Liqui-Moly confirmed this is their recommended oil for the 3.0T and 4.0T. Available in 5L jugs — 2 jugs per change. Price is per liter. Full change kit ~$90–100 with MAHLE filter. Interval: 7,500 miles Stage 1/2; 5,000 miles Stage 3+.", difficulty:"DIY Friendly",
        pros:["Most popular in community","VW 502.00 certified","German engineering","HTHS 3.5+"],
        cons:["Pricier than Castrol","Sold in liters — metric conversion needed"] },
      { id:"motul_xcess_gen2", buyUrl:"https://www.amazon.com/Motul-109776-X-Cess-5-Liter-Bottle/dp/B089MB5NHC",
        brand:"Motul", label:"8100 X-cess Gen2 5W-40 — All Stages", price:13, rating:4.9,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Preferred oil at VW/Audi specialist tuner shops. Full synthetic, VW 502.00 certified. HTHS 3.8 mPa·s in Gen2 — above the 3.5 minimum, better shear resistance under sustained turbo boost. JH Motorsports sells the full 4.0T kit (2×5L + MAHLE filter). Best choice for builds doing back-to-back pulls or track days. Motul specifically recommends X-cess (not X-Clean) for the 4.0T. Interval: 7,500 miles Stage 1/2; 5,000 miles Stage 3+.", difficulty:"DIY Friendly",
        pros:["HTHS 3.8 — above minimum","Tuner shop preferred","VW 502.00 certified","Better shear under sustained boost"],
        cons:["Slightly pricier than Liqui-Moly","Less widely stocked in retail stores"] },
      { id:"motul_xclean_5w40", buyUrl:"https://www.amazon.com/s?k=Motul+8100+X-clean+5W-40",
        brand:"Motul", label:"8100 X-Clean 5W-40 — DI Engines / Stage 2+", price:13, rating:4.8,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Motul 8100 X-Clean 5W-40 Gen2. Engineered specifically for direct-injection gasoline engines — targets exactly what the 4.0T DI system demands. HTHS 3.9 in Gen2 (highest in the Motul 8100 lineup). 100% synthetic. Note: carries VW 505.00/505.01 spec (not 502.00) — both are acceptable for the 4.0T, but X-Cess Gen2 (502.00) is the primary community recommendation. X-Clean is the stronger DI deposit-control choice. Confirm with tuner before switching.", difficulty:"DIY Friendly",
        pros:["HTHS 3.9 — highest in Motul 8100 range","100% synthetic","DI-optimized formula","Best deposit control"],
        cons:["VW 505.00 spec, not 502.00 — confirm with tuner","X-Cess is primary 4.0T recommendation"] },
      { id:"castrol_edge_5w40", buyUrl:"https://www.amazon.com/Castrol-03084-5W-30-Advanced-Synthetic/dp/B00ICSWGJ0",
        brand:"Castrol", label:"EDGE 5W-40 — Stock / Stage 1 (OEM dealer fill)", price:10, rating:4.7,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"US Audi dealer OEM fill. VW 502.00 certified. Widely available at auto parts stores nationwide. Solid choice for stock or Stage 1 builds on a budget. HTHS at the 3.5 minimum spec. Best for warranty-period oil changes. Not the first choice for Stage 3+ where HTHS headroom matters. Interval: 7,500–10,000 miles stock; 5,000–7,500 Stage 1/2.", difficulty:"DIY Friendly",
        pros:["Cheapest VW 502.00 option","Widely available everywhere","OEM dealer spec","Good for warranty period"],
        cons:["HTHS at minimum spec only","Not ideal for Stage 3+ sustained boost"] },
      { id:"mobil1_0w40", buyUrl:"https://www.amazon.com/s?k=Mobil+1+0W-40+European+Car+Formula",
        brand:"Mobil 1", label:"FS 0W-40 — Cold Climate / Turbo Startup Protection", price:11, rating:4.8,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"0W-40 flows faster than 5W-40 at cold start — better immediate turbo bearing lubrication in the first 10 seconds. VW 502.00 certified. HTHS 3.7. Popular for RS7/S7 builds in cold climates or cars that sit extended periods. Same hot viscosity as 5W-40 — no sacrifice under load. Audizine community frequently recommends for builds that run hard from cold.", difficulty:"DIY Friendly",
        pros:["Fastest cold-start flow","Better turbo startup protection","VW 502.00 certified","HTHS 3.7"],
        cons:["Slight viscosity drop vs 5W-40 at extreme sustained heat","Less community data than Liqui-Moly/Motul"] },
      { id:"motul_xpower_10w60", buyUrl:"https://www.amazon.com/s?k=Motul+300V+Power+10W-60",
        brand:"Motul", label:"8100 X-Power 10W-60 — Track / Race Days Only", price:18, rating:4.9,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Motul 8100 X-Power 10W-60. 100% synthetic, full SAPS, ACEA A3/B4. BMW M Series approved. Designed for high power-to-liter ratio turbocharged engines under sustained track load. The 10W base maintains a thicker oil film at extreme sustained temperatures — critical during back-to-back quarter-mile passes or full track sessions at Stage 3+ power. Not suitable for cold-climate daily driving — the 10W base flows sluggishly below 10°C. Change every 3,000–5,000 miles. Use for dedicated track/strip events only — switch back to X-Cess for street.", difficulty:"DIY Friendly",
        pros:["Highest viscosity for sustained track heat","BMW M Series approved","Full SAPS formulation","Maintained oil film at 700+ whp"],
        cons:["Not for daily driving — poor cold start below 10°C","3,000–5,000 mile change interval","Track and strip use only"] },
    ]
  },

  // ── WASTEGATE ACTUATORS ───────────────────────────────────────────────
  {
    id:"wastegate", cat:"Engine", name:"Upgraded Wastegate Actuators",
    desc:"Stock wastegates can't hold boost at high EMAP on turbo builds. Upgraded actuators enable 30+ PSI cleanly without a MAC valve.",
    tag:"TURBO MUST", requires:["turbo_upgrade"], recommends:["ecu_custom"], conflicts:[],
    variants:[
      { id:"tgk_wg", buyUrl:"https://tgkmotorsport.com/products/tgk-motorsport-audi-4-0t-vacuum-wastegate-actuators",   brand:"TGK Motorsport", label:"60mm Vacuum Wastegate Kit",  price:700, rating:5.0,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"60mm diaphragm — 150% larger than stock. Billet T6061 aluminum, Nomex diaphragm. Maintains factory vacuum-style gate: no MAC valve needed, simplifies tuning. Requires DS1 tune recalibration before WOT (TGK offers wastegate tuning calibration service). CRITICAL: NOT recommended for stock-sized S6/S7 turbos — 60mm cannot dial down enough, risks overspin.", difficulty:"Professional",
        pros:["60mm vs stock","No MAC valve needed","Holds 30+ PSI","Billet construction"],cons:["DS1 recalibration required before WOT","Not safe with OEM S6/S7 turbos","Tuner coordination needed"] },
      { id:"tial_wg", buyUrl:"https://tialsport.com/product/mvi-2-5-wastegate-actuator/",  brand:"Tial",           label:"MVI Wastegate Actuators",    price:750, rating:4.8,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Tial MVI actuators are included in the SRM1000 kit. Integrated vacuum-style design. Well-proven on 4.0T turbo builds. Preferred by Load Logic and C4 tuners running SRM or Xona builds.", difficulty:"Professional",
        pros:["SRM1000 kit standard","Leaderboard proven","Tial motorsport pedigree"],cons:["More expensive than TGK","Must confirm fitment by chassis"] },
      { id:"srm_wg", buyUrl:"https://sillyrabbitmotorsport.com/srm-4-0t-high-vacuum-wastegates-ea824.html",   brand:"SRM",            label:"High Vacuum Upgraded Actuators", price:650, rating:4.8,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"SRM's own high-vacuum upgraded wastegate actuators. Included in SRM850 kit. Designed to work within the SRM ecosystem (DS1 + SRM manifolds). Proper boost control on hybrid and single turbo builds.", difficulty:"Professional",
        pros:["SRM ecosystem native","SRM850 standard","DS1 integrated"],cons:["Needs SRM tuner for calibration"] },
    ]
  },
  {
    id:"turbo_upgrade", cat:"Turbos", name:"Turbo Upgrade",
    desc:"The single biggest power lever on the 4.0T. Every leaderboard car runs an upgraded turbo.",
    tag:"#1 MOD", requires:["ecu_custom","downpipe"], recommends:["manifolds","port_inj","flex_fuel"], conflicts:[],
    variants:[
      { id:"xona_5357", buyUrl:"https://xonarotor.com/products/xona-rotor-57-57s-ball-bearing-turbocharger", brand:"Xona Rotor", label:"XR5357S (Compact)",    price:3200, rating:4.8,
        hp:{a6_20t:180,a6_30t:170,a7_20t:180,a7_30t:170,s6:280,s7:280,a8:280,s8:300,rs6:320,rs7:320},
        torque:{a6_20t:230,a6_30t:220,a7_20t:230,a7_30t:220,s6:350,s7:350,a8:350,s8:370,rs6:390,rs7:390},
        notes:"Leaderboard: Neil Otis ran 4.96s 60-130. Fast spool, strong mid-range. Best street/strip balance.", difficulty:"Professional",
        pros:["Fast spool","Street-friendly","Leaderboard proven"],cons:["Lower ceiling than 5657"] },
      { id:"xona_5657", buyUrl:"https://xonarotor.com/collections/all", brand:"Xona Rotor", label:"XR5657S (King)",        price:3600, rating:5.0,
        hp:{a6_20t:210,a6_30t:190,a7_20t:210,a7_30t:190,s6:320,s7:320,a8:320,s8:345,rs6:370,rs7:370},
        torque:{a6_20t:260,a6_30t:240,a7_20t:260,a7_30t:240,s6:395,s7:395,a8:395,s8:418,rs6:440,rs7:440},
        notes:"LEADERBOARD #1 (4.10s) and #6 (4.97s). Most popular performance choice on the list. Billet 7-blade.", difficulty:"Professional",
        pros:["Leaderboard #1 turbo","Billet compressor","Best power/spool balance"],cons:["Needs E60+ for full power"] },
      { id:"xona_6564", buyUrl:"https://xonarotor.com/products/xona-rotor-65-64s-ball-bearing-turbocharger", brand:"Xona Rotor", label:"XRC5764S — formerly XR6564S (Big Frame)",   price:4200, rating:4.9,
        hp:{a6_20t:240,a6_30t:220,a7_20t:240,a7_30t:220,s6:360,s7:360,a8:360,s8:385,rs6:410,rs7:410},
        torque:{a6_20t:290,a6_30t:270,a7_20t:290,a7_30t:270,s6:430,s7:430,a8:430,s8:455,rs6:480,rs7:480},
        notes:"Leaderboard #2 (4.49s, built engine). Highest ceiling on list. Built engine recommended for full power. Xona renamed this turbo: it is listed as XRC5764S and their page states it supersedes what was previously named XR6564S (57mm inducer / 79mm exducer).", difficulty:"Professional",
        pros:["Highest power ceiling","Leaderboard #2","Best top-end"],cons:["Built engine recommended","Slower spool"] },
      { id:"ts1", buyUrl:"https://tgkmotorsport.com/",        brand:"Turbosmart", label:"TS1 Hybrid",            price:2800, rating:4.7,
        hp:{a6_20t:175,a6_30t:165,a7_20t:175,a7_30t:165,s6:270,s7:270,a8:270,s8:290,rs6:310,rs7:310},
        torque:{a6_20t:220,a6_30t:210,a7_20t:220,a7_30t:210,s6:340,s7:340,a8:340,s8:360,rs6:380,rs7:380},
        notes:"Leaderboard #7 (5.04s, Marcus Maroney). Hybrid built on stock frame. OEM turbo housing retained.", difficulty:"Professional",
        pros:["Stock location","Easier install","Good spool"],cons:["Lower ceiling than Xona singles"] },
      { id:"ts2plus", buyUrl:"https://tgkmotorsport.com/",    brand:"Turbosmart", label:"TS2+ Hybrid",           price:3100, rating:4.7,
        hp:{a6_20t:185,a6_30t:175,a7_20t:185,a7_30t:175,s6:285,s7:285,a8:285,s8:305,rs6:325,rs7:325},
        torque:{a6_20t:235,a6_30t:225,a7_20t:235,a7_30t:225,s6:355,s7:355,a8:355,s8:375,rs6:395,rs7:395},
        notes:"Leaderboard #10 (5.24s, Sean Fallon). More aggressive hybrid build than TS1. Better top-end.", difficulty:"Professional",
        pros:["Stock location","Better top-end than TS1","OEM+ fitment"],cons:["More lag than TS1"] },
      { id:"g40_1150", buyUrl:"https://www.atpturbo.com/mm5/merchant.mvc?Screen=CTGY&Category_Code=G40-1150",   brand:"Garrett",    label:"G40-1150 Single",       price:3400, rating:4.7,
        hp:{a6_20t:190,a6_30t:180,a7_20t:190,a7_30t:180,s6:295,s7:295,a8:295,s8:315,rs6:335,rs7:335},
        torque:{a6_20t:240,a6_30t:230,a7_20t:240,a7_30t:230,s6:365,s7:365,a8:365,s8:385,rs6:405,rs7:405},
        notes:"Leaderboard #8 (5.11s) and #9 (5.23s). Well-proven Garrett single. Broad powerband.", difficulty:"Professional",
        pros:["Broad powerband","Proven reliability","Garrett support"],cons:["Bigger install than hybrids"] },
      { id:"g45_1500", buyUrl:"https://www.atpturbo.com/mm5/merchant.mvc?Screen=CTGY&Category_Code=G45-1500",   brand:"Garrett",    label:"G45-1500 Single",       price:3900, rating:4.8,
        hp:{a6_20t:215,a6_30t:200,a7_20t:215,a7_30t:200,s6:330,s7:330,a8:330,s8:355,rs6:380,rs7:380},
        torque:{a6_20t:265,a6_30t:250,a7_20t:265,a7_30t:250,s6:400,s7:400,a8:400,s8:425,rs6:450,rs7:450},
        notes:"Leaderboard #4 (4.80s, Adam Emm). Larger Garrett option. Bigger top-end than G40.", difficulty:"Professional",
        pros:["Higher ceiling than G40","Leaderboard proven","Good spool for size"],cons:["More lag","More complex install"] },
      { id:"pp_rs_plus", buyUrl:"",  brand:"Pinnacle Perf.", label:"RS+ 47/60 Billet (Jon)", price:1000, rating:4.7,
        hp:{a6_20t:155,a6_30t:145,a7_20t:155,a7_30t:145,s6:255,s7:255,a8:255,s8:280,rs6:300,rs7:300},
        torque:{a6_20t:195,a6_30t:185,a7_20t:195,a7_30t:185,s6:320,s7:320,a8:320,s8:340,rs6:365,rs7:365},
        notes:"Jon Gronewald / Pinnacle Performance LLC (Taylor, MO). 47mm inducer / 60mm exducer dual ball-bearing billet compressor. Vendor-rated to 750hp on a pair. Drop-in OEM fit — no housing mod. Best value turbo upgrade at ~$1,000/pair vs. $2,100+ for JHM RS7-R. Active community following. Recommend installing oil screen relocation kit (TSB-2044640) at same time.", difficulty:"Professional",
        pros:["Best value turbo upgrade","Drop-in OEM fit","750hp ceiling","Active community support"],cons:["No published dyno data","Oil screen relocation recommended","C7/D4 only — not C8"] },
    ]
  },

  // ── FUELING ───────────────────────────────────────────────────────────
  {
    id:"hpfp", cat:"Fueling", name:"High-Pressure Fuel Pump Internals",
    desc:"The 4.0T has two HPFPs. Both need upgrading. Prevents fuel starvation at high boost and enables ethanol builds.",
    tag:null, requires:[], recommends:["ecu_s2"], conflicts:[],
    variants:[
      { id:"autotech_hpfp", buyUrl:"https://ctsturbo.com/product/autotech-high-volume-fuel-pump-upgrade-kit-for-gen2-2-0tfsi-2-5t-3-0t-4-0t-5-0l/", brand:"Autotech", label:"Dual HPFP Upgrade Kit",   price:520, rating:5.0,
        hp:{a6_20t:5,a6_30t:5,a7_20t:5,a7_30t:5,s6:8,s7:8,a8:8,s8:9,rs6:10,rs7:10},
        torque:{a6_20t:8,a6_30t:8,a7_20t:8,a7_30t:8,s6:12,s7:12,a8:12,s8:14,rs6:15,rs7:15},
        notes:"The benchmark HPFP upgrade — the original DLC-coated piston kit. Match-ground and serialized. 5% torque gain, +10 Bar fuel rail pressure per Autotech spec. Lifetime warranty. 4.0T needs 2 kits (price shown for pair). First to use plasma DLC coating. Trusted by SRM, TGK, and most serious 4.0T tuners.", difficulty:"DIY Friendly",
        pros:["Benchmark product","DLC coated","Match-ground precision","Lifetime warranty"],cons:["Requires specialty tool","2 kits needed for 4.0T"] },
      { id:"034_hpfp", buyUrl:"https://www.034motorsport.com/034motorsport-high-pressure-fuel-pump-piston-upgrade-kit-audi-4-0t.html",      brand:"034 Motorsport", label:"HPFP Piston Upgrade Kit", price:480, rating:4.9,
        hp:{a6_20t:5,a6_30t:5,a7_20t:5,a7_30t:5,s6:8,s7:8,a8:8,s8:9,rs6:10,rs7:10},
        torque:{a6_20t:7,a6_30t:7,a7_20t:7,a7_30t:7,s6:11,s7:11,a8:11,s8:12,rs6:13,rs7:13},
        notes:"034 Motorsport HPFP piston upgrade for C7/C7.5 S6/S7/RS6/RS7. Up to 50% flow increase over stock per 034 spec. DLC coated piston and cylinder, aerospace tolerances. Drop-in replacement into factory pump housings. 034 sells a matching install tool separately.", difficulty:"DIY Friendly",
        pros:["50% flow increase","DLC + aerospace tolerances","034 ecosystem","Matching install tool available"],cons:["Requires specialty install tool","2 kits for 4.0T"] },
      { id:"ie_hpfp", buyUrl:"https://performancebyie.com/products/ie-hpfp-internal-upgrade-kit-for-audi-4-0tt-tfsi-engines",      brand:"IE",           label:"HPFP Internal Kit",        price:449, rating:4.8,
        hp:{a6_20t:5,a6_30t:5,a7_20t:5,a7_30t:5,s6:8,s7:8,a8:8,s8:9,rs6:10,rs7:10},
        torque:{a6_20t:7,a6_30t:7,a7_20t:7,a7_30t:7,s6:10,s7:10,a8:10,s8:12,rs6:13,rs7:13},
        notes:"IE 11.67mm piston upgrade for C7/C7.5 4.0TT. 50% flow increase. Constant-diameter piston (not stepped) for better seal contact. Each pump dyno-tested before shipping. 12-month unlimited miles warranty. 2 complete kits included in price.", difficulty:"DIY Friendly",
        pros:["Constant-diameter piston","Dyno-tested","12-mo warranty","2 kits included"],cons:["Requires IE install tool","Slightly less field data than Autotech"] },
      { id:"loba_hpfp", buyUrl:"https://progressiveparts.com/product/loba-motorsport-hp40-high-pressure-fuel-pump-for-audi-4-0tfsi-rs6-rs7-c7-s6-s7-c7-s8-d4-2010400",    brand:"Loba",         label:"600cc HPFP",               price:475, rating:4.7,
        hp:{a6_20t:5,a6_30t:5,a7_20t:5,a7_30t:5,s6:8,s7:8,a8:8,s8:9,rs6:10,rs7:10},
        torque:{a6_20t:5,a6_30t:5,a7_20t:5,a7_30t:5,s6:8,s7:8,a8:8,s8:9,rs6:10,rs7:10},
        notes:"German-engineered high-flow option. Higher flow rate than standard upgrades. Preferred on flex fuel builds in European market.", difficulty:"DIY Friendly",
        pros:["Higher flow rate","Flex fuel ready","German quality"],cons:["Less US community data","Per-pump pricing"] },
    ]
  },
  {
    id:"flex_fuel", cat:"Fueling", name:"Flex Fuel / Ethanol Kit",
    desc:"Every top leaderboard car runs E30–E85. Ethanol is not optional at this level.",
    tag:"LEADERBOARD MUST", requires:["hpfp"], recommends:["ecu_custom"], conflicts:[],
    variants:[
      { id:"cobb_flex", buyUrl:"",  brand:"COBB",    label:"Flex Fuel Kit",      price:399, rating:4.6,
        hp:{a6_20t:20,a6_30t:18,a7_20t:20,a7_30t:18,s6:35,s7:35,a8:35,s8:40,rs6:45,rs7:45},
        torque:{a6_20t:25,a6_30t:22,a7_20t:25,a7_30t:22,s6:45,s7:45,a8:45,s8:50,rs6:55,rs7:55},
        notes:"Sensor + Accessport integration. Real-time blend detection.", difficulty:"Professional",
        pros:["AP integration","Real-time blending"],cons:["COBB tune required"] },
      { id:"walbro_flex", buyUrl:"https://tgkmotorsport.com/products/tgk-motorsport-flex-fuel-kit", brand:"Walbro", label:"E85 Injector Kit",   price:650, rating:4.7,
        hp:{a6_20t:25,a6_30t:22,a7_20t:25,a7_30t:22,s6:42,s7:42,a8:42,s8:47,rs6:52,rs7:52},
        torque:{a6_20t:30,a6_30t:27,a7_20t:30,a7_30t:27,s6:52,s7:52,a8:52,s8:57,rs6:62,rs7:62},
        notes:"Full injector upgrade. Higher ceiling for pure E85 or E75+.", difficulty:"Professional",
        pros:["Highest ethanol headroom","Better atomization"],cons:["Custom tune mandatory"] },
    ]
  },
  {
    id:"port_inj", cat:"Fueling", name:"Port Injection",
    desc:"9 of 10 top 60-130 leaderboard builds run port injection. Not optional at 500+ whp.",
    tag:"LEADERBOARD MUST", requires:["ecu_custom"], recommends:["flex_fuel"], conflicts:[],
    variants:[
      { id:"srm_port", buyUrl:"https://sillyrabbitmotorsport.com/port-injection-4-0t-spacer-kit.html",  brand:"SRM",     label:"Port Injection Kit",  price:1800, rating:4.9,
        hp:{a6_20t:20,a6_30t:18,a7_20t:20,a7_30t:18,s6:40,s7:40,a8:40,s8:45,rs6:50,rs7:50},
        torque:{a6_20t:25,a6_30t:22,a7_20t:25,a7_30t:22,s6:50,s7:50,a8:50,s8:55,rs6:60,rs7:60},
        notes:"SRM port injection appears on 7 of top 10 60-130 leaderboard builds. Pairs directly with SRM manifolds and W2A IC.", difficulty:"Professional",
        pros:["Leaderboard dominant","SRM ecosystem synergy","Full kit"],cons:["SRM manifolds preferred"] },
      { id:"gen_port", buyUrl:"",  brand:"Generic / Shop", label:"Port Injection (Shop Build)", price:1400, rating:4.5,
        hp:{a6_20t:18,a6_30t:16,a7_20t:18,a7_30t:16,s6:35,s7:35,a8:35,s8:40,rs6:44,rs7:44},
        torque:{a6_20t:22,a6_30t:20,a7_20t:22,a7_30t:20,s6:44,s7:44,a8:44,s8:49,rs6:54,rs7:54},
        notes:"Custom shop-built port injection. Works with any manifold. Lower cost but more integration work.", difficulty:"Professional",
        pros:["Lower cost","Works with any manifold"],cons:["More shop time","Less plug-and-play"] },
      { id:"meth_kit", buyUrl:"https://www.aemelectronics.com/products/water-methanol-injection-systems/",  brand:"AEM",     label:"Methanol Injection",  price:699, rating:4.6,
        hp:{a6_20t:15,a6_30t:13,a7_20t:15,a7_30t:13,s6:30,s7:30,a8:30,s8:34,rs6:38,rs7:38},
        torque:{a6_20t:18,a6_30t:16,a7_20t:18,a7_30t:16,s6:38,s7:38,a8:38,s8:42,rs6:46,rs7:46},
        notes:"Leaderboard #3, #7, #8 use meth. Cools intake charge. Lower cost alternative to full port injection.", difficulty:"DIY Friendly",
        pros:["Lower cost than port","Charge cooling","Good results"],cons:["Less power than port","Fluid tank to manage"] },
    ]
  },
  {
    id:"fuel_lines", cat:"Fueling", name:"Fuel Feed Lines",
    desc:"Larger AN fuel lines eliminate the stock rubber feed restriction. Required when pushing past 700 HP — the factory lines become the bottleneck.",
    tag:null, requires:[], recommends:["hpfp"], conflicts:[],
    variants:[
      { id:"stock_lines", buyUrl:"", brand:"OEM", label:"Stock Fuel Lines",
        price:0, rating:3.0,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Factory fuel feed lines. Adequate for Stage 1–2 builds up to ~650 crank HP. Inner diameter restricts flow on big turbo or port injection builds.",
        difficulty:"N/A",
        pros:["Already installed","Zero cost"],cons:["Flow-limiting above 650 HP","Rubber ages/cracks"] },
      { id:"6an", buyUrl:"https://www.summitracing.com/search/product-line/russell-performance-products", brand:"Russell / Earls", label:"-6AN Fuel Lines",
        price:285, rating:4.5,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:8,s7:8,a8:8,s8:8,rs6:10,rs7:10},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:10,s7:10,a8:10,s8:10,rs6:12,rs7:12},
        notes:"Entry-level AN upgrade (~9.5mm ID). Removes the rubber feed restriction. Good for 650–750 HP builds. Braided stainless exterior won't degrade like OEM rubber.",
        difficulty:"DIY Friendly",
        pros:["Removes OEM restriction","Cost effective","DIY-friendly"],cons:["Marginal above 750 HP","Step up if running port injection"] },
      { id:"8an", buyUrl:"https://www.summitracing.com/search/product-line/russell-performance-products", brand:"Russell / Earls", label:"-8AN Fuel Lines",
        price:380, rating:4.8,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:15,s7:15,a8:15,s8:15,rs6:18,rs7:18},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:20,s7:20,a8:20,s8:20,rs6:24,rs7:24},
        notes:"The popular choice for turbo and port injection builds (~11mm ID). Recommended for 750–900 HP. Pairs directly with HPFP upgrade and port injection kits. Used on most SRM and leaderboard builds.",
        difficulty:"DIY Friendly",
        pros:["Most popular AN choice","Supports 750–900 HP","Pairs with port injection"],cons:["Needs correct fittings for your pump"] },
      { id:"10an", buyUrl:"https://www.summitracing.com/search/product-line/russell-performance-products", brand:"Russell / Earls", label:"-10AN Fuel Lines",
        price:480, rating:4.9,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:22,s7:22,a8:22,s8:22,rs6:27,rs7:27},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:28,s7:28,a8:28,s8:28,rs6:33,rs7:33},
        notes:"Maximum fuel flow for 900+ HP builds (~14mm ID). Standard on SRM850 and SRM1000 kits. Required if running dual port injection or very high E85 demand. Professional install recommended for proper routing.",
        difficulty:"Professional",
        pros:["Maximum flow capacity","Standard on SRM1000","Required at 900+ HP"],cons:["Overkill below 900 HP","Professional routing recommended"] },
    ]
  },

  // ── INTAKE ────────────────────────────────────────────────────────────
  {
    id:"cai", cat:"Intake", name:"Cold Air / High-Flow Intake",
    desc:"Improves airflow and charge temps. Unlocks tune headroom. High-flow intakes pair best with an upgraded intercooler.",
    tag:"SOUNDS GREAT", requires:[], recommends:["ecu_s1","intercooler"], conflicts:[],
    variants:[
      { id:"ie_cai", buyUrl:"https://performancebyie.com/collections/cold-air-intake-systems/products/ie-carbon-fiber-intake-system-for-audi-c7-c7-5-s6",    brand:"IE",        label:"Carbon Fiber Intake",   price:649, rating:4.9,
        hp:{a6_20t:12,a6_30t:10,a7_20t:12,a7_30t:10,s6:16,s7:16,a8:16,s8:17,rs6:18,rs7:18},
        torque:{a6_20t:12,a6_30t:10,a7_20t:12,a7_30t:10,s6:14,s7:14,a8:14,s8:16,rs6:18,rs7:18},
        notes:"Full carbon housing. Best IAT reduction available.", difficulty:"DIY Friendly",
        pros:["Best IATs","Carbon aesthetics"],cons:["Most expensive intake"] },
      { id:"awe_cai", buyUrl:"https://www.awe-tuning.com/products/audi-c7-s6-s7-4-0t-carbon-intake",   brand:"AWE",       label:"AirGate Intake",        price:449, rating:4.7,
        hp:{a6_20t:10,a6_30t:8,a7_20t:10,a7_30t:8,s6:13,s7:13,a8:13,s8:14,rs6:15,rs7:15},
        torque:{a6_20t:10,a6_30t:8,a7_20t:10,a7_30t:8,s6:12,s7:12,a8:12,s8:13,rs6:14,rs7:14},
        notes:"No-MAF design. Stage 2 favorite. Great sound.", difficulty:"DIY Friendly",
        pros:["No MAF concerns","Easy install","Great sound"],cons:["Slightly lower peak than IE"] },
      { id:"eventuri", buyUrl:"https://www.eventuri.net/product/audi-c7-rs6-rs7/",  brand:"Eventuri",  label:"Carbon Intake System",  price:899, rating:4.9,
        hp:{a6_20t:14,a6_30t:12,a7_20t:14,a7_30t:12,s6:18,s7:18,a8:18,s8:20,rs6:22,rs7:22},
        torque:{a6_20t:14,a6_30t:12,a7_20t:14,a7_30t:12,s6:17,s7:17,a8:17,s8:18,rs6:20,rs7:20},
        notes:"Full carbon with heat shield. Show-car quality. Best overall flow.", difficulty:"DIY Friendly",
        pros:["Best flow","Heat shielded","Show quality"],cons:["Premium price"] },
      { id:"ecs_cai", buyUrl:"https://www.ecstuning.com/Audi-C7_S6-Quattro-4.0T/Engine/Intake/Air_Intakes/",   brand:"ECS Tuning",label:"Performance Intake",    price:329, rating:4.5,
        hp:{a6_20t:8,a6_30t:7,a7_20t:8,a7_30t:7,s6:11,s7:11,a8:11,s8:12,rs6:13,rs7:13},
        torque:{a6_20t:8,a6_30t:7,a7_20t:8,a7_30t:7,s6:10,s7:10,a8:10,s8:11,rs6:12,rs7:12},
        notes:"Best-value direct-fit kit. Good for Stage 1 builds on budget.", difficulty:"DIY Friendly",
        pros:["Best price","Direct-fit"],cons:["Lower peak gains"] },
      { id:"tgk_4in", buyUrl:"https://tgkmotorsport.com/products/tgk-motorsport-audi-4-0t-intake-system-4-conversion-audi-c7-c7-5-s6-s7-rs6-rs7",   brand:"TGK Motorsport", label:"4\" Merged Inlet Intake", price:399, rating:4.9,
        hp:{a6_20t:11,a6_30t:9,a7_20t:11,a7_30t:9,s6:15,s7:15,a8:15,s8:16,rs6:17,rs7:17},
        torque:{a6_20t:11,a6_30t:9,a7_20t:11,a7_30t:9,s6:13,s7:13,a8:13,s8:15,rs6:17,rs7:17},
        notes:"4.0T-specific design. Single 4\" merged inlet feeds both turbos from one filter. 3D-scanned for perfect fitment. Extremely loud induction noise — the most aggressive intake sound on the platform. Pairs naturally with TGK BOV. Highly reviewed for sound and performance data. Available with OEM airbox conversion or open air filter.", difficulty:"DIY Friendly",
        pros:["Loudest induction sound","Perfect C7 fitment","Strong community reviews","Pairs with TGK BOV"],cons:["Single-filter design not stealth","Backorder common"] },
      { id:"tgk_5in", buyUrl:"https://tgkmotorsport.com/products/tgk-motorsport-audi-4-0t-intake-system-4-to-5-conversion-c7-c7-5-s6-s7-rs6-rs7-copy",   brand:"TGK Motorsport", label:"5\" Conversion Kit (1000+HP)", price:499, rating:4.8,
        hp:{a6_20t:13,a6_30t:11,a7_20t:13,a7_30t:11,s6:18,s7:18,a8:18,s8:20,rs6:22,rs7:22},
        torque:{a6_20t:13,a6_30t:11,a7_20t:13,a7_30t:11,s6:16,s7:16,a8:16,s8:18,rs6:20,rs7:20},
        notes:"Upgrade from TGK 4\" to 5\" filter system. 2,000+ CFM flow capacity. Future-proofs for turbo upgrades. Multi-layer pleated cotton filter. Supports 1000+ HP builds. Requires TGK 4\" intake first.", difficulty:"DIY Friendly",
        pros:["2000+ CFM","1000HP capable","Future-proof","Minimal restriction"],cons:["Requires TGK 4\" base first","Larger filter aesthetics"] },
      { id:"srm_intake", buyUrl:"https://sillyrabbitmotorsport.com/40tfsi-luftwaffe-cnc-intake.html", brand:"SRM", label:"2.5\" Luftwaffe Intake (C7)",      price:595, rating:4.8,
        hp:{a6_20t:12,a6_30t:10,a7_20t:12,a7_30t:10,s6:16,s7:16,a8:16,s8:18,rs6:20,rs7:20},
        torque:{a6_20t:11,a6_30t:9,a7_20t:11,a7_30t:9,s6:14,s7:14,a8:14,s8:16,rs6:18,rs7:18},
        notes:"SRM Luftwaffe — the largest intake available for the C7 4.0T platform. Full 2.5\" intake runner all the way to the turbo inlet. 5-axis CNC machined inlets welded to mandrel-bent tubing. Drops inlet depression from 750 mbar (stock) to under 900 mbar, freeing 3-4 PSI at top end. 30-40 HP gains at redline per SRM spec. Core of the SRM850 and SRM1000 kits. Note: S8/D4 chassis uses a separate SRM 3\" dual intake ($895) due to different space constraints.", difficulty:"DIY Friendly",
        pros:["2.5\" full runner to turbo","3-4 PSI top-end gain","SRM ecosystem native","CNC 5-axis machined inlets"],cons:["C7 only — D4 S8 needs separate SKU","Less aggressive sound than TGK single-filter"] },
      { id:"srm_s8_intake", buyUrl:"https://sillyrabbitmotorsport.com/srm-s8-3inch-intakes.html", brand:"SRM", label:"3\" Dual Intake (S8 / D4)",     price:895, rating:4.8,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"SRM's D4 S8/A8 specific 3\" dual intake system. Dual 3\" inlets with 5-axis CNC machined inlets — the additional space in the D4 chassis allows larger individual runners vs the merged C7 design. REQUIRES Air-to-Air intercooler: the increased airflow from 3\" inlets pushes heat load beyond what the OEM air-to-water unit can manage at high power. Pair with SRM A2A IC and port injection for the full SRM ecosystem build.", difficulty:"DIY Friendly",
        pros:["Dual 3\" runners","D4 S8/A8 specific fitment","SRM ecosystem native"],cons:["D4 only — C7 uses 2.5\" Luftwaffe","⚠ Requires SRM A2A intercooler","Not a C7 fitment"] },
    ]
  },

  // ── BOV / DIVERTER VALVE ─────────────────────────────────────────────
  {
    id:"bov", cat:"Intake", name:"BOV / Blow-Off Valve Upgrade",
    desc:"Stock electronic diverter valves are a common boost leak source at high power. A mechanical BOV eliminates this and adds the classic turbo sound.",
    tag:null, requires:[], recommends:["cai"], conflicts:[],
    variants:[
      { id:"tgk_bov", buyUrl:"https://tgkmotorsport.com/products/tgk-motorsport-audi-4-0t-blow-off-valve-conversion-kit",   brand:"TGK Motorsport", label:"BOV Conversion Kit",   price:700, rating:5.0,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Converts OEM electronic diverter valves to mechanical BOV. Uses factory vacuum and boost reference port — stays fully closed under boost, eliminates boost leaks. Removes recirculation noise and replaces with full BOV sound. 5.0/5.0 rating across 14 reviews. Easy install. Pairs perfectly with TGK intake for maximum induction theater.", difficulty:"DIY Friendly",
        pros:["Eliminates boost leaks","Full BOV sound","Easy install","Pairs with TGK intake"],cons:["BOV sound — not for sleeper builds","Check MAF tuning compatibility"] },
      { id:"gfb_dv", buyUrl:"https://tgkmotorsport.com/products/go-fast-bits-dv-diverter-valves-dual",    brand:"GFB",            label:"DV+ Diverter Valve",   price:89,  rating:4.6,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Budget drop-in upgrade. Replaces the OEM plastic diverter valve piston with a stronger unit. Retains OEM recirculation — no BOV sound. Eliminates the common plastic valve failure. Good first valve upgrade for stock-to-Stage 1 builds.", difficulty:"DIY Friendly",
        pros:["Budget option","Drop-in fit","Eliminates OEM failure","OEM sound retained"],cons:["No BOV sound","Not for high-boost applications"] },
    ]
  },

  // ── EXHAUST ───────────────────────────────────────────────────────────
  {
    id:"downpipe", cat:"Exhaust", name:"High-Flow Downpipe",
    desc:"100% of leaderboard builds run catless. Required for Stage 2 and turbo builds.",
    tag:"UNIVERSAL", requires:[], recommends:["ecu_s2","catback"], conflicts:[],
    variants:[
      { id:"awe_dp", buyUrl:"https://www.awe-tuning.com/products/awe-tuning-s6-4-0t-track-touring-exhaust-suite",     brand:"AWE",      label:"Tuning DP",          price:849, rating:4.8,
        hp:{a6_20t:16,a6_30t:13,a7_20t:16,a7_30t:13,s6:22,s7:22,a8:22,s8:25,rs6:28,rs7:28},
        torque:{a6_20t:19,a6_30t:16,a7_20t:19,a7_30t:16,s6:27,s7:27,a8:27,s8:30,rs6:33,rs7:33},
        notes:"304 SS. Optional resonated version available.", difficulty:"Professional",
        pros:["304 SS","Optional resonated","Great fitment"],cons:["No cat option"] },
      { id:"milltek_dp", buyUrl:"https://www.milltekcorp.com/search?q=RS6+C7+downpipe", brand:"Milltek",  label:"Sport HFC DP",       price:895, rating:4.7,
        hp:{a6_20t:14,a6_30t:11,a7_20t:14,a7_30t:11,s6:19,s7:19,a8:19,s8:22,rs6:24,rs7:24},
        torque:{a6_20t:17,a6_30t:14,a7_20t:17,a7_30t:14,s6:24,s7:24,a8:24,s8:26,rs6:29,rs7:29},
        notes:"HFC option for emissions areas. Polished flanges. UK-made.", difficulty:"Professional",
        pros:["HFC option","Premium finish"],cons:["Slightly less peak vs catless"] },
      { id:"ie_dp", buyUrl:"https://ctsturbo.com/product/cts-turbo-audi-c7-c7-5-s6-s7-rs7-4-0t-cast-downpipe-set/",      brand:"CTS Turbo",       label:"4.0T Cast Downpipe Set",    price:1400, rating:4.8,
        hp:{a6_20t:16,a6_30t:13,a7_20t:16,a7_30t:13,s6:22,s7:22,a8:22,s8:24,rs6:27,rs7:27},
        torque:{a6_20t:18,a6_30t:15,a7_20t:18,a7_30t:15,s6:26,s7:26,a8:26,s8:28,rs6:31,rs7:31},
        notes:"Cast stainless set for C7/C7.5 S6/S7/RS7. Deletes the OEM crossover and includes O2 harness extensions. Offered as a high-flow-cat set or a catless race set, 1,399.99 USD at CTS. Replaces a previously listed IE downpipe — Integrated Engineering does not make a C7 4.0T downpipe.", difficulty:"Professional",
        pros:["Cast stainless","Deletes OEM crossover","Catted or catless set","O2 extensions included"],cons:["Race set is off-road only","Pricier than budget options"] },
      { id:"ecs_dp", buyUrl:"https://www.ecstuning.com/Audi-C7_S6-Quattro-4.0T/Exhaust/Performance/Downpipe/",     brand:"ECS Tuning",label:"Catless Race DP",   price:649, rating:4.5,
        hp:{a6_20t:14,a6_30t:11,a7_20t:14,a7_30t:11,s6:19,s7:19,a8:19,s8:22,rs6:24,rs7:24},
        torque:{a6_20t:16,a6_30t:13,a7_20t:16,a7_30t:13,s6:23,s7:23,a8:23,s8:26,rs6:28,rs7:28},
        notes:"Lowest price catless option. Good entry point for Stage 2 budget builds.", difficulty:"Professional",
        pros:["Lowest price","304 SS"],cons:["Less refinement than IE/AWE"] },
      { id:"arm_dp", buyUrl:"https://armmotorsports.com/products/audi-4-0t-downpipes-s6-s7-s8-rs7",     brand:"ARM Motorsports", label:"Catless Race DP", price:699, rating:4.8,
        hp:{a6_20t:16,a6_30t:13,a7_20t:16,a7_30t:13,s6:22,s7:22,a8:22,s8:25,rs6:28,rs7:28},
        torque:{a6_20t:20,a6_30t:17,a7_20t:20,a7_30t:17,s6:30,s7:30,a8:30,s8:33,rs6:36,rs7:36},
        notes:"Verified 37whp / 42wtq on dyno per ARM spec. Same-side design eliminates OEM crossover routing — shorter path, less restriction. 4.4\"×3\" collector on OEM 5-bolt flange. Compatible with all turbo upgrades. Built-in stainless flex sections. Lifetime warranty.", difficulty:"Professional",
        pros:["Verified 37whp/42wtq","Same-side design","Lifetime warranty","Turbo upgrade compatible"],cons:["Catless — check local laws","A8/S8 need extension pieces"] },
    ]
  },
  {
    id:"resx", cat:"Exhaust", name:"Resonator Delete + X-Pipe",
    desc:"Budget exhaust upgrade. Removes factory resonator, adds X-pipe for exhaust pulse balancing. Deep aggressive tone for a fraction of a cat-back cost.",
    tag:"SOUND MOD", requires:[], recommends:[], conflicts:[],
    variants:[
      { id:"034_resx", buyUrl:"https://www.034motorsport.com/res-x-resonator-delete-and-x-pipe-c7-c7-5-audi-s6-4-0tt.html",  brand:"034 Motorsport", label:"Res-X Resonator Delete", price:349, rating:4.7,
        hp:{a6_20t:3,a6_30t:3,a7_20t:3,a7_30t:3,s6:5,s7:5,a8:5,s8:6,rs6:6,rs7:6},
        torque:{a6_20t:3,a6_30t:3,a7_20t:3,a7_30t:3,s6:5,s7:5,a8:5,s8:6,rs6:6,rs7:6},
        notes:"034 Motorsport C7 S6 specific. Bolt-in no-weld installation. Removes heavy factory resonator and adds X-pipe to balance exhaust pulses. Deeper, more aggressive note with no noticeable drone at cruise. Fraction of cat-back price. Good first exhaust mod before committing to a full cat-back.", difficulty:"DIY Friendly",
        pros:["No-weld bolt-in","Budget-friendly","No drone","Noticeably deeper sound"],cons:["C7 S6 fitment — confirm RS7 fitment separately","Less dramatic than full cat-back"] },
    ]
  },
  {
    id:"catback", cat:"Exhaust", name:"Cat-Back Exhaust",
    desc:"Sound and flow improvement after the cats. Pairs with any downpipe.",
    tag:"SOUND MOD", requires:[], recommends:["downpipe"], conflicts:[],
    variants:[
      { id:"awe_cb", buyUrl:"https://www.awe-tuning.com/products/awe-tuning-s6-4-0t-track-touring-exhaust-suite",      brand:"AWE",        label:"Touring Edition",    price:1749, rating:4.8,
        hp:{a6_20t:5,a6_30t:5,a7_20t:5,a7_30t:5,s6:8,s7:8,a8:8,s8:9,rs6:10,rs7:10},
        torque:{a6_20t:5,a6_30t:5,a7_20t:5,a7_30t:5,s6:8,s7:8,a8:8,s8:9,rs6:10,rs7:10},
        notes:"Drone-free highway. Great WOT sound. Lifetime warranty.", difficulty:"Professional",
        pros:["No drone","Lifetime warranty"],cons:["Not the most aggressive"] },
      { id:"milltek_cb", buyUrl:"https://www.milltekcorp.com/non-resonated-non-valved-cat-back-for-products-audi-s6-4.0-tfsi-c7-quattro-2012-to-2018products-audi/p3274",  brand:"Milltek",    label:"Non-Resonated",      price:1950, rating:4.7,
        hp:{a6_20t:6,a6_30t:5,a7_20t:6,a7_30t:5,s6:9,s7:9,a8:9,s8:10,rs6:11,rs7:11},
        torque:{a6_20t:6,a6_30t:5,a7_20t:6,a7_30t:5,s6:9,s7:9,a8:9,s8:10,rs6:11,rs7:11},
        notes:"Aggressive tone. Some highway drone. Premium UK finish.", difficulty:"Professional",
        pros:["More aggressive","Premium finish"],cons:["Highway drone possible"] },
      { id:"milltek_res", buyUrl:"https://www.milltekcorp.com/non-resonated-non-valved-cat-back-for-products-audi-s6-4.0-tfsi-c7-quattro-2012-to-2018products-audi/p3274", brand:"Milltek",    label:"Resonated",          price:1799, rating:4.6,
        hp:{a6_20t:5,a6_30t:5,a7_20t:5,a7_30t:5,s6:7,s7:7,a8:7,s8:8,rs6:9,rs7:9},
        torque:{a6_20t:5,a6_30t:5,a7_20t:5,a7_30t:5,s6:7,s7:7,a8:7,s8:8,rs6:9,rs7:9},
        notes:"Quieter daily option. UK tone without drone. Good for street builds.", difficulty:"Professional",
        pros:["No drone","UK quality"],cons:["Less aggressive than non-res"] },
      { id:"akra_cb", buyUrl:"https://www.akrapovic.com/en/car/product/14915/Audi/S6-Avant-Limousine-C7/2017",     brand:"Akrapovič",  label:"Slip-On Titanium",   price:2800, rating:4.9,
        hp:{a6_20t:7,a6_30t:6,a7_20t:7,a7_30t:6,s6:11,s7:11,a8:11,s8:12,rs6:13,rs7:13},
        torque:{a6_20t:6,a6_30t:5,a7_20t:6,a7_30t:5,s6:10,s7:10,a8:10,s8:11,rs6:12,rs7:12},
        notes:"Titanium. Valve-controlled sound. OEM+ aesthetics.", difficulty:"Professional",
        pros:["Titanium","Sound valve","Prestige brand"],cons:["Highest price"] },
      { id:"ecs_cb", buyUrl:"https://www.ecstuning.com/Audi-C7_S6-Quattro-4.0T/Exhaust/Performance/Cat_Back/ECS/",      brand:"ECS Tuning", label:"Valved Cat-Back",    price:1199, rating:4.4,
        hp:{a6_20t:5,a6_30t:4,a7_20t:5,a7_30t:4,s6:7,s7:7,a8:7,s8:8,rs6:9,rs7:9},
        torque:{a6_20t:5,a6_30t:4,a7_20t:5,a7_30t:4,s6:7,s7:7,a8:7,s8:8,rs6:9,rs7:9},
        notes:"Valved — quiet or loud via OEM button. Best value for sound control.", difficulty:"Professional",
        pros:["Valved control","Best price for valved"],cons:["Valve longevity concerns"] },
    ]
  },

  // ── COOLING (oil only — intercooler moved to its own category) ───────
  {
    id:"oil_cooler", cat:"Cooling", name:"Upgraded Oil Cooler",
    desc:"Reduces oil temps on track. Essential for Stage 3 builds.",
    tag:"TRACK", requires:[], recommends:["turbo_upgrade"], conflicts:[],
    variants:[
      { id:"mishimoto_oc", buyUrl:"https://www.mishimoto.com/transmission-oil-coolers/oil-cooler-kits.html", brand:"Mishimoto", label:"Oil Cooler Kit", price:349, rating:4.7,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Bolt-on. Drops oil temps 20-30°F. Anodized fittings included.", difficulty:"DIY Friendly",
        pros:["Bolt-on","Great temp drop","Affordable"],cons:["No HP gain"] },
    ]
  },

  // ── MANIFOLDS ─────────────────────────────────────────────────────────
  {
    id:"manifolds", cat:"Manifolds", name:"Upgraded Manifolds",
    desc:"SRM manifolds appear on 7 of 10 top 60-130 builds. Critical for port injection and W2A IC integration.",
    tag:"LEADERBOARD MUST", requires:["turbo_upgrade"], recommends:["port_inj","srm_ic"], conflicts:[],
    variants:[
      { id:"srm_mani", buyUrl:"https://sillyrabbitmotorsport.com/turbochargers/",  brand:"SRM",     label:"Upgraded Exhaust Manifolds + Turbine Housing", price:1395, rating:5.0,
        hp:{a6_20t:25,a6_30t:22,a7_20t:25,a7_30t:22,s6:50,s7:50,a8:50,s8:52,rs6:55,rs7:55},
        torque:{a6_20t:30,a6_30t:27,a7_20t:30,a7_30t:27,s6:60,s7:60,a8:60,s8:62,rs6:65,rs7:65},
        notes:"Drop-in replacement for the highly restrictive OEM manifolds. SRM states 50+ HP gains depending on setup. Fixes the cylinder 5 misfire caused by excessive exhaust backpressure (EMAP). Compatible with factory downpipe. Required for all SRM turbo kits (SRM850 and SRM1000). Appears on 7 of 10 top leaderboard 60-130 builds.", difficulty:"Professional",
        pros:["$1,395 — best value manifold","Fixes cyl 5 misfire","50+ HP gain","Factory DP compatible"],cons:["Requires tuner recalibration for full gains","Professional install required"] },
      { id:"klassen_mani", buyUrl:"https://klasen-motors.com/",brand:"Klassen", label:"Klassen Manifolds",      price:2800, rating:4.7,
        hp:{a6_20t:20,a6_30t:18,a7_20t:20,a7_30t:18,s6:38,s7:38,a8:38,s8:43,rs6:48,rs7:48},
        torque:{a6_20t:25,a6_30t:22,a7_20t:25,a7_30t:22,s6:48,s7:48,a8:48,s8:53,rs6:58,rs7:58},
        notes:"Leaderboard #3 (Skip Hickey, 4.71s). Strong alternative to SRM. Used on D4.5 S8 builds.", difficulty:"Professional",
        pros:["Leaderboard proven","Strong D4/S8 fitment"],cons:["Less common than SRM"] },
      { id:"fra_mani", buyUrl:"",   brand:"FRA",     label:"FRA Manifolds",           price:2600, rating:4.6,
        hp:{a6_20t:18,a6_30t:16,a7_20t:18,a7_30t:16,s6:35,s7:35,a8:35,s8:40,rs6:44,rs7:44},
        torque:{a6_20t:22,a6_30t:20,a7_20t:22,a7_30t:20,s6:44,s7:44,a8:44,s8:49,rs6:54,rs7:54},
        notes:"Leaderboard #5 (Neil Otis, 4.96s). FRA manifolds used on self-tuned build.", difficulty:"Professional",
        pros:["Leaderboard proven","Good value vs SRM"],cons:["Smaller ecosystem"] },
    ]
  },

  // ── DRIVETRAIN ────────────────────────────────────────────────────────
  {
    id:"dsg_tune", cat:"Drivetrain", name:"DSG / S-Tronic Tune",
    desc:"Raises torque limits, tightens shifts, enables launch control.",
    tag:"FEEL IT", requires:[], recommends:["ecu_s1"], conflicts:[],
    variants:[
      { id:"apr_dsg", buyUrl:"https://www.goapr.com/products/software/tcu_upgrade/parts/TCU-DL501-MLB",  brand:"APR",       label:"DSG Tune",        price:399, rating:4.9,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Launch control, faster shifts. Best with APR engine tune.", difficulty:"Plug & Play",
        pros:["Launch control","Fast shifts"],cons:["APR tune preferred"] },
      { id:"uni_dsg", buyUrl:"https://store.ngpracing.com/products/unitronic-audi-c7-c7-5-s6-s7-4-0t-s-tronic-performance-tcu-software",  brand:"Unitronic", label:"DQ500 Stage 1",   price:429, rating:4.8,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Highest torque limit raise. Pairs well with Unitronic engine tune.", difficulty:"Plug & Play",
        pros:["Highest TQ limit","Unitronic synergy"],cons:["Unitronic tune preferred"] },
    ]
  },

  // ── SUSPENSION ────────────────────────────────────────────────────────
  {
    id:"coilovers", cat:"Suspension", name:"Coilover Kit",
    desc:"Adjustable height and damping. Transforms handling and stance.",
    tag:"HANDLING", requires:[], recommends:["sway_bars","alignment"], conflicts:[],
    variants:[
      { id:"kw_v3", buyUrl:"https://store.ngpracing.com/products/kw-coilover-kit-v3-audi-a6-c7-4g",      brand:"KW",       label:"Variant 3",      price:2249, rating:4.9,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Independent compression + rebound. German. Daily + track. Linked to the C7/4G kit at New German Performance — KW's own site only resolves to a geo-redirected homepage. Confirm the exact part number for your trim (S6/S7 vs A6/A7) before ordering.", difficulty:"Professional",
        pros:["Fully adjustable","Lifetime warranty"],cons:["Expensive"] },
      { id:"bilstein_b16", buyUrl:"https://www.cloud9ab.com/products/audi-14-18-rs7-13-18-s7-b16-pss10-coilover-kit-bil48-221832",brand:"Bilstein",label:"B16 Dynamic",    price:1899, rating:4.8,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Monotube. Excellent ride quality. Less complex than KW V3.", difficulty:"Professional",
        pros:["Great ride","Value vs KW"],cons:["Less adjustment range"] },
    ]
  },
  {
    id:"sway_bars", cat:"Suspension", name:"Upgraded Sway Bars",
    desc:"Reduces body roll. Best combined with coilovers.", tag:null,
    requires:[], recommends:["coilovers"], conflicts:[],
    variants:[
      { id:"whiteline_sb", buyUrl:"https://www.whiteline.com.au/products/vehicle/audi",brand:"Whiteline",label:"Adjustable Set", price:599, rating:4.7,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"3-position adjustable. Front and rear set.", difficulty:"DIY Friendly",
        pros:["Adjustable","Front+rear"],cons:["Bushing wear over time"] },
      { id:"034_rsb", buyUrl:"https://www.034motorsport.com/adjustable-solid-rear-sway-bar-b8-b8-5-audi-q5-sq5-c7-c7-5-a6-s6-rs6-a7-s7-rs7.html",   brand:"034 Motorsport", label:"Adjustable Solid Rear Sway Bar", price:395, rating:4.9,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"25.4mm single-piece spring steel rear bar for C7/C7.5 S6/RS6/S7/RS7. Designed to work with stock front sway bar — adding a stiffer front bar actually worsens understeer on this platform. Eliminates understeer and body roll, greatly improves turn-in and off-throttle oversteer. Street and track tested on multiple C7 chassis. Adjustable stiffness settings.", difficulty:"DIY Friendly",
        pros:["25.4mm spring steel","Works with stock front bar","Adjustable","C7 track tested"],cons:["Rear only — no front bar needed","May increase rear grip in wet"] },
    ]
  },
  {
    id:"motor_mounts", cat:"Drivetrain", name:"Upgraded Motor Mounts",
    desc:"OEM motor mounts are hydraulic fluid-filled and wear out. Upgraded mounts reduce drivetrain slop and improve throttle response without excessive NVH.",
    tag:null, requires:[], recommends:[], conflicts:[],
    variants:[
      { id:"034_mm", buyUrl:"https://www.034motorsport.com/motor-mount-street-density-c7-c7-5-audi-s6-s7-rs7-and-d4-a8-s8-4-0t.html",    brand:"034 Motorsport", label:"Street Density Motor Mounts", price:449, rating:4.8,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"034 Motorsport C7 4.0T street density motor mounts. 3+ years of testing and multiple revisions per 034. Void-free, fluid-free high-durometer rubber — eliminates leakage and collapse of OEM units. Cast aluminum bodies using OEM production techniques. Plug-and-play electronics (emulators). May produce a soft VCDS code — does not trigger CEL. Not an easy DIY on the 4.0T.", difficulty:"Professional",
        pros:["Eliminates OEM fluid failure","Plug-and-play electronics","No CEL","OEM fit/finish"],cons:["Not a DIY install on 4.0T","Soft VCDS code possible","Slightly firmer feel vs OEM"] },
    ]
  },
  {
    id:"alignment", cat:"Suspension", name:"Performance Alignment",
    desc:"Required after any suspension mod.", tag:"REQUIRED",
    requires:["coilovers"], recommends:[], conflicts:[],
    variants:[
      { id:"align_std", buyUrl:"", brand:"Shop", label:"4-Wheel + Corner Balance", price:250, rating:5.0,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Mandatory after coilover install.", difficulty:"Professional",
        pros:["Tire life","Safety"],cons:["Recurring cost"] },
    ]
  },

  // ── BRAKES ────────────────────────────────────────────────────────────
  {
    id:"brake_pads", cat:"Brakes", name:"Performance Brake Pads",
    desc:"First brake upgrade on any C7.", tag:"START HERE",
    requires:[], recommends:[], conflicts:[],
    variants:[
      { id:"hawk_hps", buyUrl:"https://jhmotorsports.com/front-brake-pads-hawk-hps-street-for-400mm-c7-s6-s7-and-d4-a8-s8.html",  brand:"Hawk",  label:"HPS 5.0",       price:189, rating:4.7,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Best street/sport balance. Low dust. Good cold bite.", difficulty:"DIY Friendly",
        pros:["Low dust","Cold bite","Easy install"],cons:["Not for track"] },
      { id:"pagid_rs", buyUrl:"https://www.vagbremtechnic.com/pagid-performance-brake-pads-a6-s6-rs6-c7-click-for-options/",  brand:"Pagid", label:"RS 4-2 Track",  price:380, rating:4.9,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Motorsport compound. Needs heat. Track only.", difficulty:"DIY Friendly",
        pros:["Best fade resistance","True track compound"],cons:["Cold bite poor","Track only"] },
    ]
  },
  {
    id:"big_brake", cat:"Brakes", name:"Big Brake Kit",
    desc:"Required for consistent stopping at 500+ whp.", tag:"SAFETY",
    requires:[], recommends:["ecu_s2"], conflicts:[],
    variants:[
      { id:"stoptech_bbk", buyUrl:"https://www.achtuning.com/?s=stoptech",brand:"StopTech",  label:"Trophy Sport 380", price:2999, rating:4.8,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"380mm 6-piston front. Best value full BBK. NOTE: stoptech.com serves an invalid TLS certificate, so this links to Achtuning, a StopTech dealer. A C7 S6/S7-specific Trophy Sport application could not be confirmed — verify fitment before ordering.", difficulty:"Professional",
        pros:["380mm rotors","6-piston","Best value"],cons:["Check wheel clearance"] },
      { id:"brembo_bbk", buyUrl:"https://www.vividracing.com/brembo-drilled-front-big-brake-kit-8piston-for-audi-rs7s6s7-20132018-p-152460269.html",  brand:"Brembo",    label:"GT 6-Pot Kit",     price:3800, rating:4.9,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"The benchmark. 6-piston. Excellent modulation.", difficulty:"Professional",
        pros:["Brand benchmark","Excellent modulation"],cons:["Highest price"] },
    ]
  },
  // ── INTERCOOLER (A2A upgrades — OEM 4.0T runs air-to-water stock) ────
  {
    id:"intercooler", cat:"Intercooler", name:"Intercooler Upgrade",
    desc:"The OEM 4.0T runs a stock air-to-water unit. Every serious build replaces it. SRM's A2A conversion dominates the leaderboard.",
    tag:"RELIABILITY", requires:[], recommends:["ecu_s2"], conflicts:[],
    variants:[
      { id:"srm_a2a", buyUrl:"https://sillyrabbitmotorsport.com/air-to-air-intercooler-for-4-0t.html",    brand:"SRM",       label:"A2A Intercooler (CSF Core)",  price:2995, rating:5.0,
        hp:{a6_20t:18,a6_30t:15,a7_20t:18,a7_30t:15,s6:25,s7:25,a8:25,s8:28,rs6:30,rs7:30},
        torque:{a6_20t:20,a6_30t:17,a7_20t:20,a7_30t:17,s6:28,s7:28,a8:28,s8:32,rs6:35,rs7:35},
        notes:"Converts OEM air-to-water to full air-to-air. CSF core: 510mm×380mm×90mm (20\"×15\"×3.5\"). Billet end tanks TIG-welded in-house. Lowest IATs over ambient, fastest recovery times. Appears on top leaderboard runs. Note: loses night vision on C7 (not S8).", difficulty:"Professional",
        pros:["Best IAT recovery","Leaderboard standard","Replaces failure-prone OEM unit","Integrates port injection"],cons:["$2,995 price point","Loses C7 night vision","10-day lead time"] },
      { id:"sean_east_ic", buyUrl:"", brand:"Sean East", label:"A2A + Chiller System",      price:3200, rating:4.9,
        hp:{a6_20t:19,a6_30t:16,a7_20t:19,a7_30t:16,s6:26,s7:26,a8:26,s8:29,rs6:32,rs7:32},
        torque:{a6_20t:21,a6_30t:18,a7_20t:21,a7_30t:18,s6:30,s7:30,a8:30,s8:34,rs6:37,rs7:37},
        notes:"Leaderboard #5 (Neil Otis, 4.96s). Sean East's full A2A system with an active chiller. Best sustained IATs under back-to-back pulls. Preferred for roll racing and track days.", difficulty:"Professional",
        pros:["Best sustained IATs","Active chiller included","Leaderboard proven"],cons:["Highest IC price","Larger footprint"] },
      { id:"ie_fmic", buyUrl:"https://performancebyie.com/collections/intercooler-systems",    brand:"IE",        label:"Front Mount A2A FMIC",        price:949,  rating:4.9,
        hp:{a6_20t:16,a6_30t:13,a7_20t:16,a7_30t:13,s6:22,s7:22,a8:22,s8:24,rs6:27,rs7:27},
        torque:{a6_20t:19,a6_30t:16,a7_20t:19,a7_30t:16,s6:26,s7:26,a8:26,s8:29,rs6:32,rs7:32},
        notes:"Best-value front-mount A2A for C7. Largest available A2A core. Solid Stage 2 choice for builds not running full SRM ecosystem.", difficulty:"Professional",
        pros:["Best A2A value","Large core","No night vision loss"],cons:["Less recovery speed than SRM A2A at high RPM"] },
      { id:"ecs_fmic", buyUrl:"https://www.ecstuning.com/b-ecs-parts/ecs-tuning-c7-c75-s6-air-to-air-intercooler-kit/012711lakt/",   brand:"ECS Tuning",label:"Competition A2A FMIC",        price:699,  rating:4.5,
        hp:{a6_20t:14,a6_30t:11,a7_20t:14,a7_30t:11,s6:19,s7:19,a8:19,s8:22,rs6:24,rs7:24},
        torque:{a6_20t:16,a6_30t:13,a7_20t:16,a7_30t:13,s6:22,s7:22,a8:22,s8:25,rs6:28,rs7:28},
        notes:"Budget-friendly A2A option. Direct fit, no cutting. Good for Stage 1–2 daily builds watching budget.", difficulty:"Professional",
        pros:["Best price A2A","Direct fit","Stage 2 capable"],cons:["Smaller core than SRM/IE","Less effective at 600+whp"] },
      { id:"wagner_fmic", buyUrl:"https://www.wagner-tuning.com/product/audi/audi-rs6-c7-typ-4g/performance-ladeluftkuehler-kit-fuer-audi-rs6-c7-4-0-biturbo-200001193.html", brand:"Wagner",   label:"Competition A2A FMIC",        price:1099, rating:4.8,
        hp:{a6_20t:16,a6_30t:13,a7_20t:16,a7_30t:13,s6:22,s7:22,a8:22,s8:24,rs6:27,rs7:27},
        torque:{a6_20t:18,a6_30t:15,a7_20t:18,a7_30t:15,s6:25,s7:25,a8:25,s8:28,rs6:30,rs7:30},
        notes:"German EVO core A2A. Excellent consistency on track days. Middle-ground between IE and SRM in price and performance.", difficulty:"Professional",
        pros:["EVO core","Track tested","European engineering"],cons:["Pricier than IE","Not SRM level"] },
    ]
  },

  // ── DIFFERENTIAL ──────────────────────────────────────────────────────
  {
    id:"diff", cat:"Differential", name:"Differential Upgrade",
    desc:"Stock open diff loses torque to the spinning wheel. An LSD keeps both rear wheels working — critical for launches and corner exit.",
    tag:"TRACTION", requires:[], recommends:[], conflicts:[],
    variants:[
      { id:"jxb_wavetrac", buyUrl:"https://www.jxbperformance.com/products/p/jxb-retrofitted-wavetrac-rear-limited-slip-differential-for-audi-b8-s4/s5-and-c7-s6/s7", brand:"JXB Performance", label:"Retrofitted Wavetrac LSD", price:2299, rating:5.0,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"The ONLY true rear LSD available for C7 S6/S7 and RS6/RS7. JXB retrofits a Wavetrac helical unit into your OEM diff housing. No clutch packs — pure gear-based. No NVH, no noise. Fits diff codes MNB (C7 S6/S7) and NPR (C7 RS6/RS7, D4 A8/S8). Sport Diff owners must code out Sport Diff via VCDS before removal. From $2,299.99 (send-in) — higher if JXB sources the diff.", difficulty:"Professional",
        pros:["Only C7 rear LSD option","No NVH/noise","Helical — no clutch wear","Street and drag"],cons:["Must send in your diff","Sport Diff needs VCDS coding first","Premium price"] },
      { id:"peloquin", buyUrl:"https://store.ngpracing.com/collections/vendors?q=peloquins",   brand:"Peloquin",  label:"Torque Biasing Diff",        price:1199, rating:4.7,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Helical torque-biasing design. Smoothest street engagement of any LSD. Best for daily drivers who want improved traction without noise or clutch-type harshness.", difficulty:"Professional",
        pros:["Smoothest engagement","No noise","Great daily driver"],cons:["Less aggressive than JXB Wavetrac","Lower locking force"] },
      { id:"os_giken", buyUrl:"https://osgikenusa.com/collections/clutch1",   brand:"OS Giken",  label:"Triple Plate Clutch LSD",    price:2200, rating:4.9,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Japanese motorsport clutch-type LSD. Triple plate design delivers maximum locking force. Track and drag strip only — too aggressive for daily street use. Requires periodic clutch pack service.", difficulty:"Professional",
        pros:["Maximum locking force","Race proven","Motorsport heritage"],cons:["Not street friendly","Clutch packs need service","Requires break-in period"] },
    ]
  },

  // ── TCU TUNE ──────────────────────────────────────────────────────────
  {
    id:"tcu_tune", cat:"Drivetrain", name:"TCU / ZF8 Transmission Tune",
    desc:"The ZF8HP automatic in S6/S7/RS6/RS7 has its own control unit. A TCU tune raises torque limits, sharpens shift speed, and enables launch control.",
    tag:"FEEL IT", requires:[], recommends:["ecu_s1"], conflicts:[],
    variants:[
      { id:"etspec_tcu", buyUrl:"https://sillyrabbitmotorsport.com/etspec-tcu-tune-audi-zf-8hp-or-continental-dl501.html", brand:"ET Spec",   label:"ZF8HP / DL501 TCU Tune",    price:399, rating:5.0,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"ET Spec is SRM's preferred TCU tuner. Covers both ZF8HP (S6/S7/RS6/RS7) and DL501 (S6/S7). Available as standalone or bundled with DS1 ECU tune at $1,299 combo. Appears on multiple leaderboard builds as the co-tune alongside Load Logic or C4.", difficulty:"Plug & Play",
        pros:["SRM preferred tuner","Leaderboard co-tune","ZF8+DL501 coverage","Bundle available"],cons:["Best value in DS1 combo","Remote tune process"] },
      { id:"apr_tcu", buyUrl:"https://www.goapr.com/products/software/tcu_upgrade/parts/TCU-DL501-MLB",  brand:"APR",       label:"ZF8 TCU Tune",                price:499, rating:4.9,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Most popular ZF8HP TCU tune for street builds. Launch control, faster shifts, raised torque limits. Best paired with APR engine tune.", difficulty:"Plug & Play",
        pros:["Launch control","Fast shifts","APR ECU synergy","Largest community"],cons:["APR engine tune preferred","ZF8 only"] },
      { id:"uni_tcu", buyUrl:"https://www.urotuning.com/products/unitronic-c7-c7-5-audi-s6-s7-4-0t-tcu-upgrade",  brand:"Unitronic", label:"ZF8 TCU Stage 1",              price:449, rating:4.8,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Aggressive ZF8HP mapping, highest torque limit raise of OTS options. Pairs best with Unitronic engine tune.", difficulty:"Plug & Play",
        pros:["Highest TQ limit OTS","Unitronic synergy","Aggressive shifts"],cons:["Unitronic engine tune preferred"] },
      { id:"gone_tcu", buyUrl:"",  brand:"Gone Sideways", label:"ZF8 Race TCU",            price:650, rating:4.7,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Race-focused ZF8 tune with full torque lockup and aggressive shift strategy. Designed for drag strip builds running 900+ whp.", difficulty:"Professional",
        pros:["Full lockup","Drag-optimized","Highest holding torque"],cons:["Harsh daily feel","Strip focused only"] },
      { id:"slavov_tcu", buyUrl:"https://sillyrabbitmotorsport.com/zf8-tcu-tune-audi-a8-s8-rs6-rs7.html", brand:"Slavov / SRM", label:"Slavov ZF8HP + DL501 TCU", price:899, rating:4.9,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"The only TCU tune covering both ZF8HP (RS6/RS7/A8/S8) and DL501 (S6/S7) platforms. Tuned by Slavov Performance, sold via Silly Rabbit Motorsport. Programmable WOT shift RPM (6200–7800 rpm in 400 rpm steps), 2nd-gear launch control, optimized clamping pressure, removed torque limits and abuse counters. First ZF8HP solution with programmable shift points per gear. Bundle with DS1 ECU for $1,795.", difficulty:"Plug & Play",
        pros:["Covers ZF8HP + DL501","Programmable shift RPM","2nd-gear launch control","DS1 bundle available"],cons:["ZF8HP launch RPM limited without TC mod","OBD cable required ($200 if not owned)"] },
    ]
  },

  // ── PORT INJECTION (expanded) ─────────────────────────────────────────
  {
    id:"port_inj_full", cat:"Fueling", name:"Port Injection System",
    desc:"9 of 10 leaderboard builds. Adds fuel ports to supplement direct injection at high power. Required above ~600whp on E-fuel.",
    tag:"LEADERBOARD MUST", requires:["ecu_custom"], recommends:["flex_fuel","manifolds"], conflicts:[],
    variants:[
      { id:"srm_port_kit", buyUrl:"https://sillyrabbitmotorsport.com/port-injection-4-0t-spacer-kit.html",  brand:"SRM",          label:"4.0T Port Injection Complete Kit", price:1495, rating:5.0,
        hp:{a6_20t:20,a6_30t:18,a7_20t:20,a7_30t:18,s6:40,s7:40,a8:40,s8:45,rs6:50,rs7:50},
        torque:{a6_20t:25,a6_30t:22,a7_20t:25,a7_30t:22,s6:50,s7:50,a8:50,s8:55,rs6:60,rs7:60},
        notes:"$1,495. Includes: 4x 1600cc injectors, SRM port fuel injector controller, wiring harness, and all lines. Integrates with SRM A2A IC kit using spacers (stock IC users need additional spacers). Enables 1000+ whp on ethanol or race gas by uncorking OEM DI fuel system limitations. Per SRM: 'port fuel uncorks power limitations of the OEM fuel system.' Dominant in leaderboard top 10.", difficulty:"Professional",
        pros:["$1,495 complete kit","1600cc injectors","1000+ whp capable","Works with stock IC (spacers)"],cons:["Requires custom ECU tune","SRM manifolds maximize port injection benefit"] },
      { id:"id1050_port", buyUrl:"https://injectordynamics.com/injectors/id1050-xds/",   brand:"Injector Dynamics",label:"ID1050x Port Kit",   price:1400, rating:4.8,
        hp:{a6_20t:18,a6_30t:16,a7_20t:18,a7_30t:16,s6:36,s7:36,a8:36,s8:41,rs6:46,rs7:46},
        torque:{a6_20t:22,a6_30t:20,a7_20t:22,a7_30t:20,s6:45,s7:45,a8:45,s8:50,rs6:55,rs7:55},
        notes:"ID1050x injectors in a custom port setup. High-quality injectors with excellent data. Works with any manifold and tuner.", difficulty:"Professional",
        pros:["High quality injectors","Tuner agnostic","Good data/logging"],cons:["Custom fitting required","More shop time than SRM kit"] },
      { id:"nos_port", buyUrl:"https://nitrousoutlet.com/products/x-series-core-efi-nitrous-kit",      brand:"NOS / Nitrous Outlet", label:"Wet Nitrous + Port Combo", price:900, rating:4.5,
        hp:{a6_20t:25,a6_30t:22,a7_20t:25,a7_30t:22,s6:50,s7:50,a8:50,s8:55,rs6:60,rs7:60},
        torque:{a6_20t:30,a6_30t:27,a7_20t:30,a7_30t:27,s6:60,s7:60,a8:60,s8:65,rs6:70,rs7:70},
        notes:"Leaderboard #1 (Miguel Romero) runs Port+NOS combo. Wet shot provides both fuel and charge cooling. High peak numbers but requires management.", difficulty:"Professional",
        pros:["Highest peak numbers","Charge cooling","Leaderboard #1 combo"],cons:["Nitrous management required","Not street practical","Bottle refills"] },
    ]
  },

  // ── EXHAUST (expanded brands) ─────────────────────────────────────────
  {
    id:"catback_full", cat:"Exhaust", name:"Cat-Back System",
    desc:"Full cat-back replacement. Choose your tone — quiet daily to full race aggression.",
    tag:"SOUND MOD", requires:[], recommends:["downpipe"], conflicts:[],
    variants:[
      { id:"awe_touring", buyUrl:"https://www.awe-tuning.com/products/awe-tuning-s6-4-0t-track-touring-exhaust-suite",   brand:"AWE",         label:"Touring Edition",          price:1749, rating:4.8,
        hp:{a6_20t:5,a6_30t:5,a7_20t:5,a7_30t:5,s6:8,s7:8,a8:8,s8:9,rs6:10,rs7:10},
        torque:{a6_20t:5,a6_30t:5,a7_20t:5,a7_30t:5,s6:8,s7:8,a8:8,s8:9,rs6:10,rs7:10},
        notes:"Drone-free highway tone. Loud under WOT. Chrome tips. AWE lifetime warranty.", difficulty:"Professional",
        pros:["No drone","Great WOT","Lifetime warranty"],cons:["Not most aggressive"] },
      { id:"awe_track", buyUrl:"https://www.awe-tuning.com/products/awe-tuning-s6-4-0t-track-touring-exhaust-suite",     brand:"AWE",         label:"Track Edition",            price:1849, rating:4.9,
        hp:{a6_20t:6,a6_30t:6,a7_20t:6,a7_30t:6,s6:9,s7:9,a8:9,s8:10,rs6:12,rs7:12},
        torque:{a6_20t:6,a6_30t:6,a7_20t:6,a7_30t:6,s6:9,s7:9,a8:9,s8:10,rs6:12,rs7:12},
        notes:"More aggressive than Touring. Straight-through resonators. Loud daily but incredible under load.", difficulty:"Professional",
        pros:["More aggressive than Touring","Better flow","Same warranty"],cons:["Louder daily"] },
      { id:"milltek_nonres", buyUrl:"https://www.milltekcorp.com/non-resonated-non-valved-cat-back-for-products-audi-s6-4.0-tfsi-c7-quattro-2012-to-2018products-audi/p3274", brand:"Milltek",    label:"Non-Resonated",            price:1950, rating:4.7,
        hp:{a6_20t:6,a6_30t:5,a7_20t:6,a7_30t:5,s6:9,s7:9,a8:9,s8:10,rs6:11,rs7:11},
        torque:{a6_20t:6,a6_30t:5,a7_20t:6,a7_30t:5,s6:9,s7:9,a8:9,s8:10,rs6:11,rs7:11},
        notes:"Aggressive British tone. Some highway drone. Polished tips. UK-made quality.", difficulty:"Professional",
        pros:["Aggressive tone","Premium finish"],cons:["Highway drone possible"] },
      { id:"milltek_res", buyUrl:"https://www.milltekcorp.com/non-resonated-non-valved-cat-back-for-products-audi-s6-4.0-tfsi-c7-quattro-2012-to-2018products-audi/p3274",   brand:"Milltek",    label:"Resonated",                price:1799, rating:4.6,
        hp:{a6_20t:5,a6_30t:5,a7_20t:5,a7_30t:5,s6:7,s7:7,a8:7,s8:8,rs6:9,rs7:9},
        torque:{a6_20t:5,a6_30t:5,a7_20t:5,a7_30t:5,s6:7,s7:7,a8:7,s8:8,rs6:9,rs7:9},
        notes:"Quieter daily UK tone. No drone. Best Milltek option for daily drivers.", difficulty:"Professional",
        pros:["No drone","UK quality"],cons:["Less aggressive"] },
      { id:"akra_slip", buyUrl:"https://www.akrapovic.com/en/car/product/14915/Audi/S6-Avant-Limousine-C7/2017",     brand:"Akrapovič",  label:"Slip-On Titanium",         price:2800, rating:4.9,
        hp:{a6_20t:7,a6_30t:6,a7_20t:7,a7_30t:6,s6:11,s7:11,a8:11,s8:12,rs6:13,rs7:13},
        torque:{a6_20t:6,a6_30t:5,a7_20t:6,a7_30t:5,s6:10,s7:10,a8:10,s8:11,rs6:12,rs7:12},
        notes:"Titanium construction. Valve-controlled sound. OEM+ appearance. Show-car and driver builds.", difficulty:"Professional",
        pros:["Titanium","Sound valve","Prestige"],cons:["Highest price"] },
      { id:"ecs_valved", buyUrl:"https://www.ecstuning.com/Audi-C7_S6-Quattro-4.0T/Exhaust/Performance/Cat_Back/ECS/",    brand:"ECS Tuning", label:"Valved Cat-Back",          price:1199, rating:4.4,
        hp:{a6_20t:5,a6_30t:4,a7_20t:5,a7_30t:4,s6:7,s7:7,a8:7,s8:8,rs6:9,rs7:9},
        torque:{a6_20t:5,a6_30t:4,a7_20t:5,a7_30t:4,s6:7,s7:7,a8:7,s8:8,rs6:9,rs7:9},
        notes:"Electronic valve — quiet mode for the neighborhood, open for the highway. Best price for a valved system.", difficulty:"Professional",
        pros:["Valved sound control","Budget valved option"],cons:["Valve longevity questions"] },
      { id:"remus_sport", buyUrl:"https://www.remus-exhausts.com/en/search/?q=RS6%20C7",   brand:"Remus",      label:"Sport Cat-Back",           price:1650, rating:4.6,
        hp:{a6_20t:5,a6_30t:5,a7_20t:5,a7_30t:5,s6:8,s7:8,a8:8,s8:9,rs6:10,rs7:10},
        torque:{a6_20t:5,a6_30t:5,a7_20t:5,a7_30t:5,s6:8,s7:8,a8:8,s8:9,rs6:10,rs7:10},
        notes:"Austrian brand. Deep, bassy tone. Popular in Europe. Good stock-replacing system with slight growl.", difficulty:"Professional",
        pros:["Deep bassy tone","Austrian quality","Good value"],cons:["Less aggressive than Milltek Non-Res"] },
      { id:"capristo", buyUrl:"https://capristoexhaust.com/products/audi-s6-7-4g-valved-exhaust-with-mid-pipes-ces3",      brand:"Capristo",   label:"Valved Exhaust + MidPipes (CES3)",    price:3200, rating:4.8,
        hp:{a6_20t:7,a6_30t:6,a7_20t:7,a7_30t:6,s6:11,s7:11,a8:11,s8:12,rs6:13,rs7:13},
        torque:{a6_20t:6,a6_30t:5,a7_20t:6,a7_30t:5,s6:10,s7:10,a8:10,s8:11,rs6:12,rs7:12},
        notes:"Italian prestige brand. Valve-controlled with remote or OEM integration. Capristo lists this exact system for the C7 S6/S7 (CES3 valved exhaust with mid-pipes). Unique sound signature.", difficulty:"Professional",
        pros:["Italian prestige","Remote valve control","Unique sound"],cons:["Very expensive","Niche brand"] },
      { id:"eisenmann", buyUrl:"https://ind-distribution.com/collections/eisenmann",     brand:"Eisenmann",  label:"Sport Exhaust",            price:1850, rating:4.7,
        hp:{a6_20t:6,a6_30t:5,a7_20t:6,a7_30t:5,s6:9,s7:9,a8:9,s8:10,rs6:11,rs7:11},
        torque:{a6_20t:5,a6_30t:5,a7_20t:5,a7_30t:5,s6:8,s7:8,a8:8,s8:9,rs6:10,rs7:10},
        notes:"German precision. Aggressive tone with refinement. Popular on C7 S7/RS7 builds that want more note without being antisocial.", difficulty:"Professional",
        pros:["German precision","Aggressive but refined","Popular on C7"],cons:["Less brand recognition in US"] },
    ]
  },

  // ── TIRES ─────────────────────────────────────────────────────────────
  {
    id:"tires_street", cat:"Tires", name:"Street Performance Tires",
    desc:"The only mod that actually contacts the road. Tires determine how power gets to the ground.",
    tag:"CONTACT PATCH", requires:[], recommends:[], conflicts:["tires_drag"],
    variants:[
      { id:"ps4s", buyUrl:"https://www.tirerack.com/tires/michelin-pilot-sport-4s",          brand:"Michelin",   label:"Pilot Sport 4S",           price:320,  rating:4.9,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"The benchmark ultra-high-performance street tire. Best balance of dry grip, wet safety, and longevity. OEM on RS6/RS7. Per tire price.", difficulty:"DIY Friendly",
        pros:["Best all-round UHP","Excellent wet","Long life"],cons:["Not the most grip in dry","Premium price"] },
      { id:"cup2", buyUrl:"https://www.tirerack.com/tires/michelin-pilot-sport-cup-2",          brand:"Michelin",   label:"Pilot Sport Cup 2",        price:420,  rating:5.0,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Street-legal track tire. Best dry grip of any street compound. Needs heat to come on. Marginal wet performance — not for rain.", difficulty:"DIY Friendly",
        pros:["Best dry grip","Incredible feel","Track capable"],cons:["Poor wet grip","Needs warmup","Short life"] },
      { id:"pss", buyUrl:"https://www.tirerack.com/tires/michelin-pilot-super-sport",           brand:"Michelin",   label:"Pilot Super Sport",        price:280,  rating:4.7,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Previous gen Michelin flagship. Still excellent. Good value vs PS4S. Better cold weather performance than Cup 2.", difficulty:"DIY Friendly",
        pros:["Great value vs PS4S","Cold grip","Proven"],cons:["Older compound than PS4S"] },
      { id:"re71rs", buyUrl:"https://www.tirerack.com/tires/bridgestone-potenza-re-71rs",        brand:"Bridgestone",label:"Potenza RE-71RS",          price:260,  rating:4.8,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Autocross and track day favorite. Massive dry grip. Shorter life than PS4S. Cold tires feel like ice.", difficulty:"DIY Friendly",
        pros:["Incredible dry grip","Autocross proven","Lower price than Cup 2"],cons:["Short tread life","Bad cold grip","Poor wet"] },
      { id:"nt01", buyUrl:"https://www.tirerack.com/tires/nitto-nt01",          brand:"Nitto",      label:"NT01 R-Compound",          price:220,  rating:4.7,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"DOT R-compound. Grippiest street-legal option. Best for track days and time attacks where wet performance doesn't matter.", difficulty:"DIY Friendly",
        pros:["Maximum grip","Budget R-compound","Track proven"],cons:["Street safety concerns in wet","Loud","Very short life"] },
      { id:"ps5", buyUrl:"https://www.tirerack.com/tires/michelin-pilot-sport-5",           brand:"Michelin",   label:"Pilot Sport 5",            price:300,  rating:4.8,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Newest Michelin UHP street tire. Better wet performance than PS4S. Improved cold weather. Good for daily drivers in varied climates.", difficulty:"DIY Friendly",
        pros:["Best wet grip","Improved cold perf","New compound"],cons:["Slightly less dry peak than PS4S"] },
    ]
  },
  {
    id:"tires_drag", cat:"Tires", name:"Drag / Roll Race Tires",
    desc:"Street tires lose to drag-specific compounds on a prepped surface. Required for sub-10s passes.",
    tag:"STRIP", requires:[], recommends:["diff"], conflicts:["tires_street"],
    variants:[
      { id:"m_t_et_street", buyUrl:"https://www.mickeythompsontires.com/drag-tires/et-street-s-s",  brand:"Mickey Thompson",label:"ET Street S/S",      price:280,  rating:4.9,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Street/strip radial. DOT legal. Most popular drag tire for C7 street builds. Hooks on street and prepped surface. Per tire price.", difficulty:"DIY Friendly",
        pros:["DOT legal","Street drivable","Hooks hard","Most popular"],cons:["Not for wet roads","Needs heat cycles"] },
      { id:"nitto_555r2", buyUrl:"https://www.tirerack.com/tires/nitto-nt555rii",    brand:"Nitto",      label:"555R2 Drag Radial",       price:260,  rating:4.8,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Strong competitor to M/T ET Street. Slightly better on cold pavement. Good for street-to-strip builds that see some daily use.", difficulty:"DIY Friendly",
        pros:["Cold street performance","DOT legal","Competitive grip"],cons:["Less prepped surface peak than M/T"] },
      { id:"hoosier_dr2", buyUrl:"https://shop.hoosiertire.com/racing-tires/drag-racing/",    brand:"Hoosier",    label:"A7 Drag Radial",          price:340,  rating:5.0,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Best drag radial grip available. What Miguel Romero (leaderboard #1, 4.10s) type builds use. Maximum hook on prepped surface. Not for street driving.", difficulty:"DIY Friendly",
        pros:["Maximum drag grip","Leaderboard-level builds","Best prepped surface"],cons:["Not street safe","Track/strip only","Higher price"] },
    ]
  },
];

// ── PERFORMANCE TIERS ──────────────────────────────────────────────────────
// ET range = seconds off 1/4-mile (negative = faster)
// t60130  = seconds off 60-130 mph roll (negative = faster)
const PERF_TIERS = {
  ecu_s1:       { tier:"Moderate",       et:[-0.10,-0.25], t60130:[-0.25,-0.60],  builds:14 },
  ecu_s2:       { tier:"Moderate",       et:[-0.15,-0.35], t60130:[-0.40,-0.90],  builds:11 },
  ecu_custom:   { tier:"Significant",    et:[-0.20,-0.50], t60130:[-0.50,-1.20],  builds:9  },
  wastegate:    { tier:"Moderate",       et:[-0.05,-0.15], t60130:[-0.10,-0.35],  builds:4  },
  turbo_upgrade:{ tier:"Transformative", et:[-0.40,-0.90], t60130:[-1.50,-3.50],  builds:8  },
  hpfp:         { tier:"Moderate",       et:[-0.05,-0.15], t60130:[-0.10,-0.30],  builds:7  },
  flex_fuel:    { tier:"Significant",    et:[-0.10,-0.30], t60130:[-0.30,-0.80],  builds:12 },
  port_inj:     { tier:"Moderate",       et:[-0.10,-0.25], t60130:[-0.25,-0.60],  builds:7  },
  port_inj_full:{ tier:"Significant",    et:[-0.15,-0.35], t60130:[-0.40,-0.90],  builds:5  },
  cai:          { tier:"Moderate",       et:[-0.05,-0.15], t60130:[-0.10,-0.30],  builds:9  },
  downpipe:     { tier:"Moderate",       et:[-0.10,-0.25], t60130:[-0.25,-0.60],  builds:11 },
  intercooler:  { tier:"Moderate",       et:[-0.05,-0.20], t60130:[-0.10,-0.45],  builds:6  },
  manifolds:    { tier:"Significant",    et:[-0.15,-0.35], t60130:[-0.40,-0.90],  builds:5  },
  dsg_tune:     { tier:"Moderate",       et:[-0.10,-0.20], t60130:[-0.20,-0.50],  builds:8  },
  tcu_tune:     { tier:"Moderate",       et:[-0.10,-0.20], t60130:[-0.20,-0.50],  builds:6  },
  motor_mounts: { tier:"Moderate",       et:[-0.05,-0.15], t60130:[-0.05,-0.10],  builds:3  },
  tires_drag:   { tier:"Significant",    et:[-0.15,-0.40], t60130:[-0.30,-0.70],  builds:6  },
};

// ── HELPERS ────────────────────────────────────────────────────────────────
function getSlotById(id) { return SLOTS.find(s => s.id === id); }
function getVariantById(slotId, variantId) { return getSlotById(slotId)?.variants.find(v => v.id === variantId); }

function getDeps(slotId, selectedMap) {
  const slot = getSlotById(slotId);
  if (!slot) return { missing:[], conflicts:[] };
  const ids = Object.keys(selectedMap);
  return {
    missing: slot.requires.filter(r => !ids.includes(r)),
    conflicts: slot.conflicts.filter(c => ids.includes(c)),
  };
}

function calcTotals(selectedMap, modelId) {
  // Detect if any aftermarket tuning mod is present in this map
  const hasTuningMod = Object.keys(selectedMap).some(k => TUNING_SLOTS.has(k));
  let hp=0, torque=0, cost=0;
  Object.entries(selectedMap).forEach(([slotId, varId]) => {
    const v = getVariantById(slotId, varId);
    if (!v) return;
    // For non-RS 4.0T with a tuning mod: normalize turbo/tune HP to S6 reference
    // (same block — stock HP differences are OEM turbo/tune, not engine)
    const hpDelta = (NON_RS_4OT.has(modelId) && hasTuningMod && TUNING_SLOTS.has(slotId))
      ? (v.hp["s6"] || 0)
      : (v.hp[modelId] || 0);
    // Fuel is inert without a tune: a stock ECU never commands the extra fuel.
    const inertFuel = FUEL_SLOTS.has(slotId) && !hasTuningMod;
    hp     += inertFuel ? 0 : hpDelta;
    torque += inertFuel ? 0 : (v.torque[modelId]||0);
    cost   += v.price;
  });
  return { hp, torque, cost };
}

function calcSpeeds(model, hpGain, baseHpOverride) {
  const base  = baseHpOverride !== undefined ? baseHpOverride : model.hp;
  const newHp = base + hpGain;
  const ratio = base / newHp;
  return {
    t060:   +(model.t060   * Math.pow(ratio, 0.40)).toFixed(2),
    t60130: +(model.t60130 * Math.pow(ratio, 0.65)).toFixed(2),
  };
}

// AWD Quattro drivetrain loss ~15% on Mustang AWD dyno
// Consistent with community data: stock RS7 560 crank = ~476 whp
// SRM1000 kit = 992 whp measured = ~1167 hp crank
function calcWhp(crankHp) { return Math.round(crankHp * 0.85); }

// ── PROGRESSION SCALE (05-data-and-math.md) ─────────────────────────────────
// One scale everywhere: 0 → 1040 hp. Every label sits on a real tick, and every
// percentage below is DERIVED — the mockup's 58% / 72% / 43% are outputs of this
// function, never constants to be copied.
const HP_SCALE_TOP = 1040;

// "1040+ TOP END" is a near-ceiling, not a hard max — the `+` is load-bearing.
// Never relabel it MAX.
const CEILINGS = {
  daily:  { hp: 750,  label: "DAILY"  },  // reliable, stock turbos
  hybrid: { hp: 850,  label: "HYBRID" },  // keeps the fuel system
  single: { hp: 1040, label: "SINGLE" },  // orphans OEM-turbo parts
};

const pctOfScale = v => Math.max(0, Math.min(100, (v / HP_SCALE_TOP) * 100));

// The daily-safe ceiling a build can actually reach, taken from the turbo it is
// running (or planning). This is the bar's emotional anchor — not the top end.
function ceilingForBuild(map) {
  const stage = inferStage(map);
  if (stage === "big_single") return CEILINGS.single;
  if (stage === "s3_hybrid")  return CEILINGS.hybrid;
  return CEILINGS.daily;
}

// The signature graphic. Driven entirely by {hp, wishlistHp, ceiling} — the same
// component on Garage, Parts, Activation and the Planner, so the four screens
// cannot disagree about where a build sits.
function ProgressionBar({
  hp, wishlistHp = 0, ceiling = CEILINGS.daily, goalHp = null,
  nowLabel = "NOW", wishLabel = "PLANNED", ariaLabel,
  // #4b hatches in --verify and labels the delta, not the absolute: the bar is
  // showing what ONE part unlocks, which is a gain, not a plan.
  wishGain = false, ceilingLabel = null, hideTopEnd = false,
}) {
  const projected = Math.max(hp, wishlistHp);
  const fillPct = pctOfScale(hp);
  const wishPct = pctOfScale(projected);
  const ceilPct = pctOfScale(ceiling.hp);
  const goalPct = goalHp != null ? pctOfScale(goalHp) : null;
  const hasWish = projected > hp;
  // The ceiling label is centred on its tick, so keep it off the two ends where
  // it would collide with NOW or the top-end label.
  const ceilNearEdge = ceilPct > 92;

  // ── LABEL COLLISION ──────────────────────────────────────────────────────
  // Every label is absolutely positioned on the same 366px row, so at high hp
  // the NOW label (which ends AT the fill edge) runs straight into
  // "1040+ TOP END", which is pinned right. At 919/1040 the fill sits at 88%
  // and the two overlap outright. Widths below are the labels' share of the
  // track at their authored sizes — NOW is ~8 mono chars at 10px, TOP END is
  // 13 at 9px — with a couple of points of breathing room.
  const NOW_SHARE = 14;
  const TOP_SHARE = 23;
  const rightMost = Math.max(fillPct, hasWish ? wishPct : 0);
  // Drop TOP END onto its own line when anything would reach it.
  const stackTop  = !hideTopEnd && (ceilNearEdge || rightMost > 100 - TOP_SHARE);
  // At very low hp the NOW label, translated fully left of the fill edge,
  // would hang off the start of the track — pin it to the left instead.
  const nowAtLeft = fillPct < NOW_SHARE;

  return (
    <div className="pbar-wrap">
      {/* The ceiling reads ABOVE the bar: it is the number that decides what the
          car can safely make, and it must out-read the platform's top end. */}
      <div className={`pbar-ceiling-row${ceilingLabel ? " pbar-ceiling-lg" : ""}`}>
        <span className={`pbar-ceiling-lbl${ceilNearEdge ? " pbar-ceiling-lbl-end" : ""}`}
          style={ceilNearEdge ? { right: 0 } : { left: `${ceilPct}%` }}>
          {ceiling.hp} {ceilingLabel || ceiling.label} <span aria-hidden="true">✓</span>
        </span>
      </div>

      <div
        className="pbar-track"
        role="img"
        aria-label={ariaLabel || `${hp} hp of a ${HP_SCALE_TOP} hp scale` +
          (hasWish ? `, ${projected} hp with planned parts` : "") +
          `. Safe ceiling for this build ${ceiling.hp} hp.`}
      >
        {hasWish && <div className={`pbar-wish${wishGain ? " pbar-wish-gain" : ""}`} style={{ width: `${wishPct}%` }} />}
        <div className="pbar-fill" style={{ width: `${fillPct}%` }} />
        <div className="pbar-tick" style={{ left: `${ceilPct}%` }} />
        {goalPct != null && <div className="pbar-tick pbar-tick-goal" style={{ left: `${goalPct}%` }} />}
      </div>

      <div className={`pbar-labels${stackTop ? " pbar-labels-stacked" : ""}`}>
        <span className={`pbar-now${nowAtLeft ? " pbar-now-left" : ""}`}
          style={nowAtLeft ? { left: 0 } : { left: `${fillPct}%` }}>{hp} {nowLabel}</span>
        {hasWish && (
          <span className={`pbar-wish-lbl${wishGain ? " pbar-wish-lbl-gain" : ""}`} style={{ left: `${wishPct}%` }}>{wishGain ? wishLabel : `${projected} ${wishLabel}`}</span>
        )}
        {goalPct != null && (
          <span className="pbar-goal-lbl" style={{ left: `${goalPct}%` }}>GOAL</span>
        )}
        {/* Deliberately the quietest thing on the bar: a platform fact, not a to-do. */}
        {!hideTopEnd && (
          <span className={`pbar-top${stackTop ? " pbar-top-clear" : ""}`}>{HP_SCALE_TOP}+ TOP END</span>
        )}
      </div>
    </div>
  );
}

// Rating stars were replaced by a thumbs-up Like control + a data-derived
// "Recommended" badge (see the variant card). Catalog `rating` fields remain in the
// data but are no longer surfaced in the UI.

// ── CSS ─────────────────────────────────────────────────────────────────────
const CSS = `
:root{
  /* ── surfaces (dark, cool-neutral) ── */
  --bg:            #0A0A0C;  /* app background */
  --surface:       #101017;  /* list rows, resting cards */
  --surface-raised:#14141A;  /* selected / primary card */
  --nav:           #0D0D12;  /* tab bar, sheet background */
  --line:          #22222E;  /* hairline dividers, resting borders */
  --line-strong:   #2C2C3C;  /* card borders that need to read */
  --line-dashed:   #34344A;  /* empty-slot borders, secondary buttons */
  --track:         #3A3A54;  /* progress bar unfilled track */

  /* ── text ── */
  --text:          #DEDEEA;  /* body (see --text-hi for pure-white headings) */
  --text-hi:       #FFFFFF;  /* primary values, headings */
  --text-body:     #DEDEEA;
  --text-2:        #B4B4CC;  /* secondary / inactive labels */
  --text-3:        #9494B0;  /* micro-labels, meta — CONTRAST FLOOR, never dimmer */
  --fill-neutral:  #C8C8DC;  /* progress fill, neutral markers */

  /* ── semantic (see 02-color-rules.md) ──
     --action  ONLY things you can act on: buttons, active tab, selected chips, [→]
     --measure hero metrics + caution state          --verify proven / safe / installed / price
     --relevant matched to your car or build         --danger  orphaned spend only            */
  --action:        #FF6A16;
  --measure:       #FFD000;
  --verify:        #00E887;
  --relevant:      #5CC8FF;
  --danger:        #FF3B5C;

  /* on-color foregrounds — near-black on orange is 5.4:1; white would be 2.6:1 */
  --on-action:     #0A0A0C;

  /* tinted fills + borders (rgba over --bg) */
  --action-bg:     rgba(255,106,22,.12);
  --measure-bg:    rgba(255,208,0,.05);   --measure-bd: rgba(255,208,0,.30);
  --verify-bg:     rgba(0,232,135,.08);   --verify-bd:  rgba(0,232,135,.35);
  --relevant-bg:   rgba(92,200,255,.07);  --relevant-bd:rgba(92,200,255,.35);
  --danger-bg:     rgba(255,59,92,.05);   --danger-bd:  rgba(255,59,92,.30);

  /* ── type ── */
  --font-ui:   'Titillium Web', system-ui, sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, Menlo, monospace;

  /* ── radii ── */
  --r-chip: 3px;   /* status pills, badges */
  --r-row:  6px;   /* list rows, buttons */
  --r-card: 8px;   /* cards */
  --r-pill: 22px;  /* filter chips, like buttons */
  --r-sheet:16px;  /* bottom sheet top corners */

  /* ── legacy aliases ──────────────────────────────────────────────────────
     The old palette names still appear across ~600 CSS rules; mapping them onto
     the new values is what made the token swap shippable in one step.
     --accent / --accent2 are gone: every surviving orange usage now names
     --action directly, so the color cannot drift back onto non-actions. */
  --card:      var(--surface);
  --card2:     var(--surface-raised);
  --border:    var(--line);
  --on-accent: var(--on-action);
  --dim:       var(--text-3);
  --muted:     var(--text-2);
  --green:     var(--verify);
  --red:       var(--danger);
  --yellow:    var(--measure);
  --blue:      var(--relevant);
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overscroll-behavior:none}
body{background:var(--bg);color:var(--text-body);font-family:var(--font-ui);-webkit-tap-highlight-color:transparent}

/* ── SHELL ── */
.app{display:flex;flex-direction:column;height:100dvh;overflow:hidden}

/* ── HEADER ── */
/* 402x40: 10px 18px 11px, transparent over --bg, one hairline. */
.header{display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:10px 18px 11px;background:transparent;border-bottom:1px solid var(--line);
  flex:none;z-index:50}
.logo{margin:0;font-family:var(--font-mono);font-weight:600;font-size:14px;letter-spacing:.06em;
  text-transform:none;color:var(--text-hi);flex:none}
.logo-slash{color:var(--action)}
/* Plain slug: Mono 10.5/400 .06em --text-3. The chip variant states build
   state and is the way into setup, so it is a real button — visually identical
   to the mockup's span, which is why its tap target is the chip itself.
   FLAGGED: 19px tall, under the 44px target floor. The header is 40px in the
   mockup, so a 44px target cannot fit without changing its height. */
.hdr-slug{font-family:var(--font-mono);font-size:10.5px;font-weight:400;line-height:normal;letter-spacing:.06em;
  color:var(--text-3);background:transparent;border:0;padding:0;flex:none;white-space:nowrap;
  text-align:right;cursor:default}
button.hdr-slug{cursor:pointer}
.hdr-slug-upper{text-transform:uppercase;letter-spacing:.08em}
.hdr-slug-lg{font-size:11px}
.hdr-slug-verify{color:var(--verify)}
.hdr-slug-chip{font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;
  color:var(--text-body);border:1px solid var(--line-dashed);border-radius:var(--r-chip);
  padding:2px 7px}

.model-strip{display:flex;gap:6px;overflow-x:auto;padding:0 0 4px;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.model-strip::-webkit-scrollbar{display:none}
.mbtn{font-family:var(--font-mono);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;padding:0 13px;border:1px solid var(--line-dashed);background:transparent;color:var(--text-3);border-radius:var(--r-pill);cursor:pointer;transition:all .15s;white-space:nowrap;flex-shrink:0}
.mbtn.active{background:var(--action-bg);border-color:var(--action);color:var(--action);font-weight:600}

/* ── BODY ── */
.body{flex:1;overflow:hidden;display:flex;flex-direction:column}

/* ── CAT STRIP (mobile) ── */
.cat-strip{display:flex;gap:6px;overflow-x:auto;padding:10px 14px;border-bottom:1px solid var(--border);-webkit-overflow-scrolling:touch;scrollbar-width:none;background:var(--surface);flex-shrink:0}
.cat-strip::-webkit-scrollbar{display:none}
.cbtn{font-family:var(--font-mono);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;padding:0 14px;border:1px solid var(--line-dashed);background:transparent;color:var(--text-3);border-radius:var(--r-pill);cursor:pointer;white-space:nowrap;flex-shrink:0;transition:all .15s;position:relative}
.cbtn.active{background:var(--action-bg);border-color:var(--action);color:var(--action);font-weight:600}
.cbtn-dot{position:absolute;top:2px;right:2px;width:7px;height:7px;border-radius:50%;background:var(--green);border:1.5px solid var(--bg)}

/* ── PARTS AREA ── */
.parts-area{flex:1;overflow-y:auto;padding:13px 18px 0;-webkit-overflow-scrolling:touch}
.slots-list{display:flex;flex-direction:column;gap:8px}

/* ── SLOT CARD ── */
.slot-card{background:var(--surface);border:1px solid var(--line);border-radius:7px;overflow:hidden;transition:border-color .18s}
.slot-card.sel{border-color:var(--verify-bd)}
.slot-card.warn{border-color:rgba(255,208,0,.5)}
.slot-card.conflict{border-color:rgba(255,59,92,.5)}
.slot-hdr{display:flex;align-items:center;gap:11px;padding:11px 13px;cursor:pointer;user-select:none;-webkit-user-select:none;min-height:60px;width:100%;box-sizing:border-box;text-align:left;background:transparent;border:0;font-family:inherit;color:inherit}
.slot-hdr:active{background:rgba(255,255,255,.03)}
.slot-info{flex:1;min-width:0}
.slot-name{font-family:var(--font-ui);font-weight:600;font-size:15px;letter-spacing:normal;color:var(--text-hi);line-height:normal}
.slot-sel-text{font-family:var(--font-mono);font-size:10.5px;color:var(--text-3);margin-top:2px;font-weight:400;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.slot-desc-text{font-family:var(--font-mono);font-size:10.5px;color:var(--text-3);margin-top:2px;font-weight:400;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* ── SLOT ROW (#5b) ──
   Bracket marker in mono, not a filled orb; every row ends in a price. */
.slot-mark{font-family:var(--font-mono);font-size:11.5px;font-weight:400;flex:none;color:var(--text-3)}
.slot-mark-inst{color:var(--verify)}
.slot-mark-wish{color:var(--relevant)}
.slot-mark-warn{color:var(--measure)}
.slot-mark-conflict{color:var(--danger)}
.slot-price{font-family:var(--font-mono);font-size:11.5px;color:var(--text-3);flex:none;white-space:nowrap}

/* ── PART SHEET (#5b) ── */
.sheet-scrim{position:fixed;inset:0;z-index:200;display:flex;flex-direction:column;
  justify-content:flex-end;background:rgba(4,4,6,.7)}
.sheet-scrim-btn{flex:1;border:none;background:transparent;cursor:pointer;min-height:44px}
.sheet{background:var(--nav);border-top:1px solid var(--line-strong);
  border-radius:var(--r-sheet) var(--r-sheet) 0 0;padding:12px 18px 24px;
  max-height:82vh;display:flex;flex-direction:column;min-height:0;overflow:hidden}
.sheet:focus{outline:none}
.sheet-hdr{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:11px;flex:none}
/* A long list needs a visible scroll affordance; the mockup never had to show
   one because its sample slot had three options that fit. */
.sheet-body::-webkit-scrollbar{width:3px}
.sheet-body::-webkit-scrollbar-thumb{background:var(--line-dashed);border-radius:2px}
.sheet-title{font-family:var(--font-ui);font-weight:700;font-size:19px;color:var(--text-hi);margin:0;
  text-transform:none;letter-spacing:normal}
.sheet-x{width:44px;height:44px;flex:none;border:1px solid var(--line-dashed);border-radius:22px;
  background:transparent;color:var(--text-2);font-family:var(--font-mono);font-size:15px;cursor:pointer}
.sheet-body{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;
  -webkit-overflow-scrolling:touch;display:flex;flex-direction:column;gap:8px}
/* The cards must not be squeezed by the scroll container either. */
.sheet-body>*{flex:none}
.sheet-more{width:100%;min-height:46px;border:1px solid var(--line-dashed);border-radius:var(--r-row);
  background:transparent;color:var(--text-2);font-family:var(--font-mono);font-size:11.5px;
  letter-spacing:.08em;text-transform:uppercase;cursor:pointer}
.sheet-more:hover{border-color:var(--text-2);color:var(--text-hi)}

.slot-install{display:block;width:calc(100% - 28px);min-height:44px;margin:0 14px 12px;
  border:1px solid var(--verify-bd);border-radius:var(--r-row);background:var(--verify-bg);
  color:var(--verify);font-family:var(--font-mono);font-size:11.5px;letter-spacing:.08em;
  text-transform:uppercase;cursor:pointer}
.slot-tag{font-family:var(--font-mono);font-size:10px;font-weight:700;letter-spacing:.08em;padding:2px 6px;border-radius:3px;white-space:nowrap;flex-shrink:0}
.t-maint{background:rgba(100,160,255,.08);color:#88aaff;border:1px solid rgba(100,160,255,.2)}
.t-pop{background:rgba(0,232,135,.1);color:var(--green);border:1px solid rgba(0,232,135,.2)}
.t-best{background:rgba(200,200,220,.07);color:var(--text-2);border:1px solid var(--line-dashed)}
.t-race{background:rgba(255,59,92,.1);color:var(--red);border:1px solid rgba(255,59,92,.2)}
.t-snd{background:rgba(180,120,255,.1);color:#c080ff;border:1px solid rgba(180,120,255,.2)}
.t-lb{background:rgba(68,153,255,.1);color:var(--blue);border:1px solid rgba(68,153,255,.2)}
.t-uni{background:rgba(255,208,0,.1);color:var(--yellow);border:1px solid rgba(255,208,0,.2)}
.t-oth{background:rgba(100,100,160,.08);color:var(--muted);border:1px solid var(--border)}

/* ── VARIANT PICKER ── */
.v-alert{font-size:11px;padding:6px 8px;border-radius:5px;margin-bottom:8px;display:flex;gap:6px;align-items:flex-start;line-height:1.4}
.v-alert.warn{background:rgba(255,208,0,.06);color:var(--yellow);border-left:2px solid var(--yellow)}
.v-alert.conflict{background:rgba(255,59,92,.06);color:var(--red);border-left:2px solid var(--red)}
.v-alert.rec{background:rgba(0,232,135,.05);color:var(--green);border-left:2px solid rgba(0,232,135,.3)}
.vcard{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-card);padding:12px 13px;transition:border-color .15s,background .15s;position:relative;overflow:hidden}
.vcard::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:transparent;transition:background .15s}
.vcard.vactive{border-color:var(--action);background:var(--surface-raised)}
.vcard.vactive::before{background:var(--verify)}
.vc-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2px}
.vc-brand{font-family:var(--font-mono);font-size:10px;font-weight:600;color:var(--text-3);letter-spacing:.14em;text-transform:uppercase}
.vc-price{font-family:var(--font-mono);font-size:15px;color:var(--verify);font-weight:600;font-variant-numeric:tabular-nums}
.vc-name-row{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-top:3px}
.vc-name{font-family:var(--font-ui);font-weight:600;font-size:16px;color:var(--text-hi)}
/* Blue: a fact about relevance to your car, not an action. Held at the 10px
   floor rather than the mockup's 8.5px (06-accessibility.md). */
.vc-rec-chip{font-family:var(--font-mono);font-size:10px;font-weight:600;letter-spacing:.1em;
  text-transform:uppercase;color:var(--relevant);border:1px solid var(--relevant-bd);
  border-radius:var(--r-chip);padding:2px 5px;flex:none;font-size:8.5px}
.vc-rec-curated{color:var(--text-2);border-color:var(--line-dashed)}
.vc-actions{display:flex;align-items:center;gap:7px;margin-top:11px}
.vc-rating{font-family:var(--font-mono);font-size:11px;color:var(--text-3);white-space:nowrap}
.vc-like{display:inline-flex;align-items:center;gap:5px;font-family:var(--font-mono);font-size:11.5px;font-weight:600;letter-spacing:.04em;padding:0 13px;border:1px solid var(--line-dashed);border-radius:22px;background:transparent;color:var(--muted);cursor:pointer;transition:all .15s}
.vc-like:hover{border-color:var(--muted);color:var(--text)}
.vc-like.on{border-color:var(--action);background:rgba(255,106,22,.12);color:var(--action)}
.vc-like-ic{font-size:11px;filter:grayscale(1);opacity:.7;transition:all .15s}
.vc-like.on .vc-like-ic{filter:none;opacity:1}
.vc-like-n{margin-left:2px;padding-left:6px;border-left:1px solid currentColor;opacity:.85;font-size:10px;letter-spacing:.04em}

/* ── RECOMMENDED FOR YOUR BUILD ── */
.rfy{border:1px solid rgba(68,153,255,.3);background:linear-gradient(180deg,rgba(68,153,255,.09),rgba(68,153,255,.03));border-radius:8px;padding:10px;margin-bottom:8px}
.rfy-hdr{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:6px}
.rfy-badge{font-family:var(--font-mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--blue);font-weight:700}
.rfy-ctx{font-family:var(--font-mono);font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:var(--dim)}
.rfy-pick{font-family:var(--font-ui);font-weight:700;font-size:15px;text-transform:uppercase;letter-spacing:.04em;color:#fff;display:flex;align-items:baseline;gap:8px}
.rfy-price{font-family:var(--font-mono);font-size:12px;color:var(--green);font-weight:700}
.rfy-why{font-size:11px;color:var(--text);line-height:1.5;font-weight:300;margin-top:3px}
.rfy-alts{margin-top:8px;padding-top:7px;border-top:1px solid rgba(68,153,255,.18);display:flex;flex-direction:column;gap:5px}
.rfy-alt{font-size:10px;line-height:1.45}
.rfy-alt-name{font-family:var(--font-mono);font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin-right:6px}
.rfy-alt-why{color:var(--dim);font-weight:300}
.rfy-note{margin-top:7px;font-size:10px;line-height:1.45;color:var(--yellow);opacity:.9}
.vc-why{font-size:13px;line-height:1.45;color:var(--text-2);text-wrap:pretty;margin:7px 0 0}
.vc-stats{display:flex;gap:4px;margin-bottom:7px}
.vcstat{flex:1;background:rgba(0,0,0,.3);border:1px solid var(--border);border-radius:4px;padding:4px 3px;text-align:center}
.vcstat-label{font-family:var(--font-mono);font-size:10px;color:var(--dim);letter-spacing:.05em;text-transform:uppercase}
.vcstat-val{font-family:var(--font-ui);font-weight:700;font-size:15px;color:var(--measure);line-height:1.2}
.vcstat-val.zero{color:var(--dim);font-size:12px}
.vc-pc{display:flex;gap:8px;font-size:10px;line-height:1.45;margin-bottom:6px}
.vc-pros{color:var(--green)}.vc-cons{color:var(--red)}
.vc-diff{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px}
.d-plug{color:var(--verify)}.d-diy{color:var(--measure)}.d-pro{color:var(--danger)}
.vc-btn{flex:1;min-height:44px;height:44px;padding:0 10px;border:1px solid var(--line-dashed);background:transparent;color:var(--text-2);font-family:var(--font-ui);font-weight:700;font-size:12.5px;letter-spacing:.08em;text-transform:uppercase;border-radius:var(--r-row);cursor:pointer;transition:all .15s}
.vc-btn:active,.vc-btn:hover{border-color:var(--text-2);color:var(--text-hi)}
.vc-btn.vsel{background:var(--action);border-color:var(--action);color:var(--on-action)}
.vc-btn.vsel:active,.vc-btn.vsel:hover{filter:brightness(1.08)}
.vc-buy{display:flex;align-items:center;justify-content:center;min-height:44px;color:var(--text-3);text-decoration:none;font-family:var(--font-mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;margin-top:11px}
.vc-buy:hover{color:var(--text-2)}

/* ── TIME ESTIMATES ── */
.t-est-row{display:flex;align-items:stretch;margin:6px 0 8px;background:rgba(0,0,0,.3);border:1px solid var(--border);border-radius:6px;overflow:hidden}
.t-est-box{flex:1;padding:7px 9px;display:flex;flex-direction:column;gap:2px}
.t-est-divider{width:1px;background:var(--border);flex-shrink:0}
.t-est-label{font-family:var(--font-mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim)}
.t-est-val{font-family:var(--font-ui);font-weight:700;font-size:17px;color:var(--measure);letter-spacing:.02em;line-height:1}

/* ── PERF BAR ── */
.perf-bar-wrap{margin:6px 0 8px;padding:8px 9px;background:rgba(0,0,0,.3);border:1px solid var(--border);border-radius:6px}
.perf-bar-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:5px}
.perf-tier{font-family:var(--font-mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;padding:2px 7px;border-radius:3px;font-weight:700}
.perf-range{font-family:var(--font-mono);font-size:10px;color:var(--muted)}
.perf-track{height:4px;background:rgba(255,255,255,.08);border-radius:2px;position:relative;margin-bottom:4px}
.perf-fill{height:4px;border-radius:2px;position:absolute;transition:left .3s,width .3s}
.perf-footer{font-family:var(--font-mono);font-size:10px;color:var(--dim);letter-spacing:.05em}
/* metric toggle */
.perf-metric-toggle{display:flex;gap:4px;align-items:center}
.pmtbtn{font-family:var(--font-mono);font-size:10px;letter-spacing:.08em;padding:4px 10px;border-radius:4px;border:1px solid var(--border);background:transparent;color:var(--dim);cursor:pointer;text-transform:uppercase;transition:all .15s}
.pmtbtn.pma{background:var(--action-bg);border-color:var(--action);color:var(--action);font-weight:600}
.pmtbtn:not(.pma):hover{border-color:var(--muted);color:var(--muted)}

/* ── BUILD PANEL ── */
.build-panel{display:flex;flex-direction:column;overflow:hidden;flex:1}
.build-inner{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px}
.gauges{display:flex;flex-direction:column;gap:10px;margin-bottom:14px}
.g-row{display:flex;justify-content:space-between;margin-bottom:4px}
.g-label{font-family:var(--font-mono);font-size:10px;letter-spacing:.1em;color:var(--muted);text-transform:uppercase}
.g-val{font-family:var(--font-ui);font-weight:700;font-size:13px;color:#fff}
.g-track{height:3px;background:var(--border);border-radius:2px;overflow:hidden}
.g-fill{height:100%;border-radius:2px;transition:width .4s cubic-bezier(.4,0,.2,1)}
.ghp{background:var(--fill-neutral)}
.gtq{background:linear-gradient(90deg,#0080ff,#00e4ff)}
.gcost{background:linear-gradient(90deg,var(--green),#00aa66)}
.speed-row{display:flex;border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-top:6px}
.speed-box{flex:1;padding:12px 8px;display:flex;flex-direction:column;align-items:center;gap:2px}
.spd-divider{width:1px;background:var(--border)}
.spd-label{font-family:var(--font-mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.spd-val{font-family:var(--font-ui);font-weight:700;font-size:28px;line-height:1;color:var(--measure)}
.spd-val.green{color:var(--green)}
.spd-unit{font-size:13px;font-weight:400;color:var(--muted);margin-left:1px}
.spd-delta{font-family:var(--font-mono);font-size:10px;color:var(--green);margin-top:1px}
.build-empty{text-align:center;padding:32px 16px;color:var(--dim);font-size:12px;line-height:1.6}
.build-empty-icon{font-size:32px;margin-bottom:10px;opacity:.4}
.bitem{display:flex;align-items:flex-start;gap:8px;padding:10px;border-radius:7px;margin-bottom:6px;border:1px solid transparent;background:rgba(255,255,255,.02)}
.bwarn{border-color:rgba(255,208,0,.2);background:rgba(255,208,0,.03)}
.bconflict{border-color:rgba(255,59,92,.2);background:rgba(255,59,92,.03)}
.borb{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0;margin-top:1px}
.bok{background:rgba(0,232,135,.1);color:var(--green)}.bwicon{background:rgba(255,208,0,.1);color:var(--yellow)}.bcicon{background:rgba(255,59,92,.1);color:var(--red)}
.bitem-name{font-family:var(--font-ui);font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#fff;line-height:1.2}
.bitem-brand{font-size:10px;color:var(--text-3);margin-top:1px;font-weight:500}
.bitem-price{font-size:10px;color:var(--muted);margin-top:1px}
.brm{margin-left:auto;background:transparent;border:none;color:var(--dim);cursor:pointer;font-size:20px;padding:2px 6px;line-height:1;flex-shrink:0;transition:color .15s}
.brm:active,.brm:hover{color:var(--red)}
.alerts{padding:10px;border-top:1px solid var(--border);flex-shrink:0}
.alerts-title{font-family:var(--font-mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
.alert-item{font-size:10px;padding:5px 7px;border-radius:4px;margin-bottom:4px;line-height:1.4;display:flex;gap:5px}
.ai-warn{background:rgba(255,208,0,.05);color:var(--yellow);border-left:2px solid var(--yellow)}
.ai-conflict{background:rgba(255,59,92,.05);color:var(--red);border-left:2px solid var(--red)}

/* ── LEADERBOARD ── */
.lb-area{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px}
.lb-time{text-align:right;flex-shrink:0}
.lc-tuner{background:rgba(68,153,255,.1);color:var(--blue);border-color:rgba(68,153,255,.25)}
.lc-turbo{background:rgba(200,200,220,.07);color:var(--text-2);border-color:var(--line-dashed)}
.lc-fuel{background:rgba(0,232,135,.08);color:var(--green);border-color:rgba(0,232,135,.2)}
.lc-mani{background:rgba(180,120,255,.08);color:#c080ff;border-color:rgba(180,120,255,.2)}
.lc-dp{background:rgba(255,59,92,.08);color:var(--red);border-color:rgba(255,59,92,.2)}
.lc-port{background:rgba(255,208,0,.08);color:var(--yellow);border-color:rgba(255,208,0,.2)}
.lb-da{font-family:var(--font-mono);font-size:10px;color:var(--dim);margin-top:6px}

/* ── BOTTOM NAV ── */
/* ── TAB BAR (03-components.md; identical across #4a–#4f and #5a/#5b) ──
   One row, one label per item, no icons. The active item is the only orange
   thing here, and it carries the inset top bar as well as the colour so the
   state does not rest on hue alone. Declared once — the old rule set was
   split across two blocks that disagreed on background and height. */
.bottom-nav{display:flex;flex:none;min-height:52px;padding-bottom:22px;
  background:var(--nav);border-top:1px solid var(--line);z-index:50}
.bnav{flex:1;min-height:52px;display:flex;align-items:center;justify-content:center;
  background:transparent;border:none;cursor:pointer;padding:0;
  font-family:var(--font-mono);font-weight:400;font-size:10.5px;letter-spacing:.08em;
  text-transform:uppercase;color:var(--text-3);transition:color .15s}
.bnav.active{color:var(--action);font-weight:600;box-shadow:inset 0 2px 0 var(--action)}

/* Keyboard focus must be visible on every control, including the ones that
   were <div>s until now. --measure clears 3:1 against all four surfaces, and
   keeping the ring off --action leaves orange meaning "you can act on this". */
:focus-visible{outline:2px solid var(--measure);outline-offset:2px}
.slot-hdr:focus-visible,.admin-var:focus-visible{outline-offset:-2px}
::-webkit-scrollbar{width:3px;height:3px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}

/* ── GARAGE / PROFILE ── */
/* The mockup's scroll regions are overflow:hidden, so they reserve nothing for
   a scrollbar and content is a full 366px inside the 18px gutters. Our overlay
   scrollbar was taking 2px off every screen. Hidden here — the same treatment
   the model and category strips already use — so scrolling still works by
   wheel, touch and keyboard but the measurements line up. */
.garage-area,.parts-area,.times-area,.lb-area,.profile-area,.build-inner{
  scrollbar-width:none}
.sheet-body{scrollbar-width:thin;scrollbar-color:var(--line-dashed) transparent}
.garage-area::-webkit-scrollbar,.parts-area::-webkit-scrollbar,.times-area::-webkit-scrollbar,
.lb-area::-webkit-scrollbar,.profile-area::-webkit-scrollbar,.build-inner::-webkit-scrollbar,
.garage-area{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:0}
/* Garage lays out its own full-bleed bands; Activation and Planner still take a
   plain gutter until their own pixel pass. */
.screen-gutter{padding:11px 18px 0}
.garage-hero{padding:10px 18px;border-bottom:1px solid var(--line)}
.garage-body{padding:10px 18px 0}
.garage-hero::before{content:none}
/* ── GARAGE IDENTITY + STAT TILES (04-screens.md #4a) ──
   Identity is a quiet mono kicker over the car name; the three tiles are
   separate bordered cards, not one segmented strip, and every value is
   --measure because all three are hero metrics. */
.gh-id{font-family:var(--font-mono);font-size:10px;font-weight:400;line-height:normal;letter-spacing:.16em;
  text-transform:uppercase;color:var(--text-3)}
.gh-car{font-family:var(--font-ui);font-weight:700;font-size:22px;letter-spacing:-.01em;
  color:var(--text-hi);line-height:1.15;margin-top:1px}
.gh-engine{font-weight:400;font-size:15px;color:var(--text-3)}
.gh-stats{display:flex;gap:8px;margin-top:9px}
.gh-stat{flex:1;min-width:0;border:1px solid var(--line);border-radius:var(--r-row);
  background:var(--surface);padding:9px 11px}
.gh-stat-wide{flex:1.2}
.gh-stat-lbl{font-family:var(--font-mono);font-size:9.5px;line-height:normal;letter-spacing:.14em;
  text-transform:uppercase;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gh-stat-row{display:flex;align-items:baseline;gap:6px;margin-top:2px}
.gh-stat-wide .gh-stat-row{gap:7px}
.gh-stat-val{font-family:var(--font-ui);font-weight:700;font-size:30px;line-height:1;letter-spacing:normal;
  color:var(--measure);font-variant-numeric:tabular-nums}
.gh-stat-sfx{font-family:var(--font-mono);font-size:10px;line-height:normal;letter-spacing:normal;color:var(--text-3);white-space:nowrap}
.gh-stat-wide .gh-stat-sfx{font-size:10.5px}
.gh-gain{color:var(--verify)}

/* One orange action per screen, at the primary-button spec (03-components). */
.g-cta{width:100%;min-height:46px;margin-top:9px;border:none;border-radius:var(--r-row);
  background:var(--action);color:var(--on-action);font-family:var(--font-ui);font-weight:700;
  font-size:13.5px;letter-spacing:.09em;text-transform:uppercase;cursor:pointer}
.g-tertiary{width:100%;min-height:44px;margin-top:4px;border:none;background:transparent;
  color:var(--relevant);font-family:var(--font-mono);font-size:11.5px;letter-spacing:.08em;
  text-transform:uppercase;cursor:pointer;text-decoration:underline;text-underline-offset:3px}

/* Section headings are Mono 10/600 .16em --text-3 with an optional counter on
   the right — the one heading treatment used across every #4/#5 screen. */
.section-title-plain{display:block}
.act-h2-mark{color:var(--action)}
.parts-area .section-title{margin-bottom:9px}
.section-title{font-family:var(--font-mono);font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:.16em;color:var(--text-3);margin:0 0 8px;display:flex;justify-content:space-between;align-items:center;gap:8px}
.section-count{font-family:var(--font-mono);font-weight:600;font-size:10px;letter-spacing:.16em;color:var(--text-body)}
.section-title button{font-family:var(--font-ui);font-weight:700;font-size:11px;letter-spacing:.06em;text-transform:uppercase;background:transparent;border:1px solid var(--border);color:var(--muted);padding:3px 10px;border-radius:4px;cursor:pointer}
.section-title button:active{color:#fff;border-color:var(--action)}
.mod-row{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:7px;margin-bottom:5px;background:rgba(255,255,255,.02);border:1px solid transparent}
.mod-row.installed{border-color:rgba(0,232,135,.15);background:rgba(0,232,135,.03)}
.mod-row.wishlist{border-color:rgba(68,153,255,.15);background:rgba(68,153,255,.03)}
.mo-inst{background:rgba(0,232,135,.15);color:var(--green)}
.mod-name{flex:1;min-width:0}
.mod-n{font-family:var(--font-ui);font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#fff;line-height:1.2}
.mod-b{font-size:10px;color:var(--muted);margin-top:1px}

/* ── TIMES LOG ── */
.times-area{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px}
.best-times{display:flex;gap:8px;margin-bottom:14px}
.bt-card{flex:1;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center;position:relative;overflow:hidden}
.bt-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px}
.bt-card.speed-card::before{background:var(--fill-neutral)}
.bt-card.strip-card::before{background:linear-gradient(90deg,var(--blue),#00e4ff)}
.bt-label{font-family:var(--font-mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:4px}
.bt-val{font-family:var(--font-ui);font-weight:700;font-size:28px;color:var(--measure);line-height:1}
.bt-val.blue{color:var(--blue)}
.bt-unit{font-size:13px;font-weight:400;color:var(--muted);margin-left:1px}
.bt-sub{font-size:10px;color:var(--muted);margin-top:3px;font-family:var(--font-mono)}
.add-run-btn{width:100%;padding:12px;border:1px dashed var(--border);background:transparent;color:var(--muted);font-family:var(--font-ui);font-weight:700;font-size:14px;letter-spacing:.08em;text-transform:uppercase;border-radius:8px;cursor:pointer;transition:all .15s;margin-bottom:10px}
.add-run-btn:active,.add-run-btn:hover{border-color:var(--action);color:var(--action)}
.run-form{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px}
.rf-title{font-family:var(--font-ui);font-weight:700;font-size:16px;text-transform:uppercase;letter-spacing:.05em;color:#fff;margin-bottom:12px}
.rf-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
.rf-field{display:flex;flex-direction:column;gap:4px}
.rf-field.full{grid-column:1/-1}
.rf-label{font-family:var(--font-mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.rf-input{background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:5px;padding:8px 10px;color:var(--text);font-family:var(--font-ui);font-size:13px;outline:none;-webkit-appearance:none;width:100%}
.rf-input:focus{border-color:var(--measure);background:rgba(255,255,255,.06)}
.rf-input option{background:var(--card2);color:var(--text)}
.rf-btns{display:flex;gap:8px}
.rf-save{flex:1;padding:10px;background:var(--action);border:none;color:var(--on-accent);font-family:var(--font-ui);font-weight:700;font-size:14px;letter-spacing:.1em;text-transform:uppercase;border-radius:6px;cursor:pointer}
.rf-cancel{padding:10px 16px;background:transparent;border:1px solid var(--border);color:var(--muted);font-family:var(--font-ui);font-weight:700;font-size:14px;letter-spacing:.1em;text-transform:uppercase;border-radius:6px;cursor:pointer}
.run-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-row);padding:8px 12px;margin-bottom:6px;position:relative}
.run-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px}
.run-date{font-family:var(--font-mono);font-size:10px;color:var(--muted)}
.run-type{font-family:var(--font-mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;padding:2px 7px;border-radius:var(--r-chip);background:rgba(200,200,220,.07);color:var(--text-2);border:1px solid var(--line-dashed)}
.run-times{display:flex;gap:12px;margin-bottom:8px}
.run-time-big{font-family:var(--font-ui);font-weight:700;font-size:24px;color:var(--green);line-height:1}
.run-time-lbl{font-family:var(--font-mono);font-size:10px;color:var(--muted);letter-spacing:.1em;text-transform:uppercase}
.run-chips{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px}
.run-chip{font-family:var(--font-mono);font-size:10px;padding:2px 6px;border-radius:3px;background:rgba(255,255,255,.05);color:var(--muted);border:1px solid var(--border)}
.run-del{position:absolute;top:10px;right:10px;background:transparent;border:none;color:var(--dim);font-size:16px;cursor:pointer;padding:2px 6px;line-height:1}
.run-del:hover{color:var(--red)}
.run-note{font-size:11px;color:var(--muted);font-weight:300;font-style:italic}
/* ── DRAGGY UPLOAD ── */
.draggy-upload-area{margin-bottom:12px}
.draggy-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:11px;border:1.5px dashed var(--action);border-radius:8px;background:rgba(255,106,22,.04);color:var(--action);font-family:var(--font-ui);font-weight:700;font-size:13px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;transition:all .15s}
.draggy-btn:hover{background:rgba(255,106,22,.1);border-style:solid}
.draggy-spin{display:inline-block;animation:spin .8s linear infinite;font-size:16px}
@keyframes spin{to{transform:rotate(360deg)}}
.draggy-preview{border:1px solid var(--border);border-radius:8px;overflow:hidden}
.draggy-img{width:100%;max-height:160px;object-fit:cover;display:block}
.draggy-preview-actions{display:flex;align-items:center;gap:8px;padding:7px 10px;background:rgba(0,232,135,.06);border-top:1px solid rgba(0,232,135,.15)}
.draggy-ok{flex:1;font-family:var(--font-mono);font-size:10px;color:var(--green);letter-spacing:.08em;text-transform:uppercase}
.draggy-reupload{font-family:var(--font-ui);font-weight:700;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);border:1px solid var(--border);background:transparent;border-radius:4px;padding:3px 8px;cursor:pointer}
.draggy-clear{background:transparent;border:none;color:var(--dim);font-size:16px;cursor:pointer;padding:2px 4px;line-height:1}
.draggy-clear:hover{color:var(--red)}
.draggy-error{font-size:11px;color:var(--red);margin-top:7px;padding:6px 8px;background:rgba(255,59,92,.06);border-radius:5px;border-left:2px solid var(--red)}
/* ── SAVE TOAST ── */
.save-toast{background:rgba(0,232,135,.12);border:1px solid rgba(0,232,135,.3);border-radius:6px;padding:9px 14px;margin-bottom:10px;font-family:var(--font-mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--green);text-align:center;animation:fadeIn .2s ease}

/* ── TRAP CHART ── */
.trap-chart-card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px}
.tc-title{font-family:var(--font-ui);font-weight:700;font-size:20px;text-transform:uppercase;letter-spacing:.04em;color:#fff;line-height:1}
.tc-sub{font-size:11px;color:var(--muted);margin:3px 0 12px;font-weight:300}
.tc-svg{width:100%;height:auto;display:block;background:rgba(0,0,0,.25);border:1px solid var(--border);border-radius:8px}
.tc-grid{stroke:rgba(255,255,255,.06);stroke-width:1}
.tc-axis-lbl{fill:var(--dim);font-family:var(--font-mono);font-size:10px}
.tc-ref-line{stroke:var(--measure);stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.tc-real-dot{fill:var(--blue);stroke:#0a0a0c;stroke-width:1}
.tc-you-dot{fill:var(--green);stroke:#0a0a0c;stroke-width:1.5}
.tc-you-line{stroke:var(--green);stroke-width:1;stroke-dasharray:3 3;opacity:.5}
.tc-legend{display:flex;gap:14px;margin-top:8px;flex-wrap:wrap}
.tc-legend-item{display:flex;align-items:center;gap:5px;font-family:var(--font-mono);font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
.tc-legend-item i{width:12px;height:3px;border-radius:2px;display:inline-block;flex-shrink:0}
.tc-sw-ref{background:var(--measure)}
.tc-sw-real{background:var(--blue);width:8px;height:8px;border-radius:50%}
.tc-sw-you{background:var(--green);width:8px;height:8px;border-radius:50%}
.tc-stat{margin-top:10px;padding:8px 10px;background:rgba(0,0,0,.3);border:1px solid var(--border);border-radius:6px;font-size:11px;color:var(--text);line-height:1.5}
.tc-stat strong{color:var(--measure)}
.tc-lookup{margin-top:10px;padding:10px;background:rgba(0,0,0,.3);border:1px solid var(--border);border-radius:6px}
.tc-lookup-lbl{font-family:var(--font-mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);display:block;margin-bottom:6px}
.tc-lookup-row{display:flex;align-items:center;gap:8px}
.tc-lookup-input{flex:1;min-width:0;background:var(--surface);border:1px solid var(--border);border-radius:5px;padding:8px 10px;color:#fff;font-family:var(--font-mono);font-size:13px}
.tc-lookup-input:focus{outline:none;border-color:var(--measure)}
.tc-lookup-arrow{color:var(--dim);font-size:14px;flex-shrink:0}
.tc-lookup-out{min-width:90px;flex-shrink:0;text-align:center;font-family:var(--font-ui);font-weight:700;font-size:18px;color:var(--measure);background:var(--surface);border:1px solid var(--border);border-radius:5px;padding:6px 8px}
.tc-you-note{margin-top:8px;font-size:10px;color:var(--muted);font-family:var(--font-mono)}
.tc-you-note strong{color:var(--green)}
.tc-table-wrap{margin-top:10px}
.tc-table-toggle{font-family:var(--font-mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);cursor:pointer;padding:6px 0;list-style:none}
.tc-table-toggle::-webkit-details-marker{display:none}
.tc-table-toggle::before{content:'▸ ';color:var(--text-3)}
details[open] .tc-table-toggle::before{content:'▾ '}
.tc-table-scroll{max-height:220px;overflow-y:auto;margin-top:6px;border:1px solid var(--border);border-radius:6px}
.tc-table{width:100%;border-collapse:collapse}
.tc-table th{position:sticky;top:0;background:var(--card2);font-family:var(--font-mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding:6px 10px;text-align:left;border-bottom:1px solid var(--border)}
.tc-table td{font-family:var(--font-mono);font-size:11px;color:var(--text);padding:5px 10px;border-bottom:1px solid rgba(255,255,255,.04)}
.tc-table td:last-child{color:var(--measure);font-weight:700}

/* ── OTS vs CUSTOM TUNE COMPARISON ── */
.tcmp-card{background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:14px;margin-top:10px}
.tcmp-grid{display:flex;gap:8px}
.tcmp-col{flex:1;background:rgba(0,0,0,.3);border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center;position:relative;overflow:hidden}
.tcmp-col::before{content:'';position:absolute;top:0;left:0;right:0;height:2px}
.tcmp-col.ots::before{background:var(--dim)}
.tcmp-col.custom::before{background:var(--fill-neutral)}
.tcmp-col-hd{font-family:var(--font-mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:4px}
.tcmp-big{font-family:var(--font-ui);font-weight:700;font-size:30px;line-height:1;color:#fff}
.tcmp-col.custom .tcmp-big{color:var(--measure)}
.tcmp-u{font-size:14px;font-weight:400;color:var(--muted);margin-left:1px}
.tcmp-sub{font-size:10px;color:var(--muted);margin-top:4px;font-family:var(--font-mono);line-height:1.4}
.tcmp-delta{display:flex;gap:8px;margin-top:8px}
.tcmp-delta-item{flex:1;display:flex;justify-content:space-between;align-items:center;background:rgba(0,0,0,.3);border:1px solid var(--border);border-radius:6px;padding:8px 10px}
.tcmp-delta-lbl{font-family:var(--font-mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.tcmp-delta-val{font-family:var(--font-ui);font-weight:700;font-size:17px;color:#fff}
.tcmp-delta-val.good{color:var(--green)}
.tcmp-delta-val.bad{color:var(--red)}
.tcmp-empty{text-align:center;padding:14px 8px;color:var(--text);font-size:12px;line-height:1.55}
.tcmp-empty-icon{font-size:26px;opacity:.5;margin-bottom:6px}
.tcmp-empty strong{color:var(--measure)}
.tcmp-empty-note{font-size:10px;color:var(--muted);margin-top:8px;font-family:var(--font-mono);line-height:1.5}
.tcmp-empty-note strong{color:var(--measure)}
.tcmp-anchor{margin-top:10px;padding:8px 10px;background:var(--surface-raised);border:1px solid var(--line-strong);border-radius:6px;font-size:11px;color:var(--text);text-align:center}
.tcmp-anchor strong{color:var(--measure)}
.tcmp-headline{font-size:12px;color:var(--text);line-height:1.5;margin-bottom:10px;padding:8px 10px;background:rgba(0,232,135,.06);border:1px solid rgba(0,232,135,.18);border-radius:6px}
.tcmp-headline strong{color:var(--green);text-transform:uppercase;letter-spacing:.03em}
.tcmp-ref-row{padding:8px 0;border-top:1px solid rgba(255,255,255,.05)}
.tcmp-ref-hd{font-family:var(--font-ui);font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#fff}
.tcmp-ref-line{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-top:3px;flex-wrap:wrap}
.tcmp-ref-swap{font-family:var(--font-mono);font-size:10px;color:var(--muted)}
.tcmp-ref-gain{font-family:var(--font-ui);font-weight:700;font-size:15px;color:var(--verify)}
.tcmp-ref-note{font-size:10px;color:var(--muted);margin-top:3px;line-height:1.45}
.tcmp-val-line{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;padding:5px 0;font-size:11px;color:var(--text)}
.tcmp-val-factor{font-weight:600;color:#fff;min-width:110px}
.tcmp-val-note{font-size:10px;color:var(--muted);flex:1;min-width:140px}
.tcmp-disclaimer{margin-top:10px;font-size:10px;color:var(--dim);line-height:1.5;font-style:italic}

/* ── CUSTOM FEATURES (selectable, provider-agnostic) ── */
.scp-card{background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:14px;margin-top:10px}
.cf-field{margin-bottom:10px}
.cf-feat-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.cf-feat{text-align:left;background:rgba(0,0,0,.3);border:1px solid var(--border);border-radius:8px;padding:9px;cursor:pointer;transition:border-color .15s,background .15s;font-family:inherit}
.cf-feat:hover{border-color:var(--muted)}
.cf-feat.on{border-color:var(--action);background:rgba(255,106,22,.1)}
.cf-feat-top{display:flex;align-items:center;justify-content:space-between;gap:6px}
.cf-feat-name{font-family:var(--font-ui);font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.03em;color:#fff}
.cf-feat.on .cf-feat-name{color:var(--text-hi)}
.cf-check{width:18px;height:18px;flex-shrink:0;border-radius:50%;border:1px solid var(--border);color:var(--muted);font-size:11px;display:flex;align-items:center;justify-content:center;line-height:1}
.cf-check.on{background:var(--action);border-color:var(--action);color:var(--on-accent)}
.cf-feat-desc{font-size:10px;color:var(--muted);margin-top:4px;line-height:1.45}
.cf-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:12px;padding-top:10px;border-top:1px solid var(--border)}
.cf-count{font-family:var(--font-mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.scp-source{display:inline-block;font-family:var(--font-mono);font-size:10px;letter-spacing:.06em;color:var(--text-2);text-decoration:none;border-bottom:1px dashed var(--line-dashed);padding-bottom:1px}
.scp-source:hover{color:var(--text-hi)}

/* ── ACTIVATION NUDGE ── */
.act-cta{flex:1;width:100%;min-height:46px;padding:0 12px;border:none;border-radius:var(--r-row);background:var(--action);color:var(--on-action);font-family:var(--font-ui);font-weight:700;font-size:13.5px;letter-spacing:.09em;text-transform:uppercase;cursor:pointer;transition:filter .15s}
.act-cta:hover{filter:brightness(1.08)}

/* ── RECOMMENDED NEXT ── */
@keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
/* ── RUN LIST SORT / FILTER BAR ── */
.run-ctrl-bar{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;align-items:center}
.run-ctrl-label{font-family:var(--font-mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-right:2px}
.run-ctrl-select{background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:5px;padding:5px 8px;color:var(--text);font-family:var(--font-mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;outline:none;-webkit-appearance:none;cursor:pointer}
.run-ctrl-select:focus{border-color:var(--measure)}
.run-ctrl-select option{background:var(--card2);color:var(--text)}
.run-ctrl-divider{width:1px;height:16px;background:var(--border);align-self:center}
/* ── RUN CARD EXPANDED DETAIL ── */
.run-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-row);padding:8px 12px;margin-bottom:6px;position:relative;transition:border-color .15s}
.run-toggle{display:block;width:100%;padding:0;border:0;background:transparent;color:inherit;font-family:inherit;text-align:left;cursor:pointer}
.run-card:hover{border-color:var(--line-strong)}
.run-card.selected{border-color:var(--line-strong);background:rgba(255,255,255,.03)}
.run-detail{margin-top:10px;border-top:1px solid var(--border);padding-top:10px}
.run-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;margin-bottom:10px}
.rdg-item{display:flex;flex-direction:column;gap:1px}
.rdg-label{font-family:var(--font-mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.rdg-val{font-family:var(--font-mono);font-size:11px;color:#fff}
.splits-title{font-family:var(--font-mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
.splits-table{width:100%;border-collapse:collapse}
.splits-table th{font-family:var(--font-mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);text-align:left;padding:3px 6px;border-bottom:1px solid var(--border)}
.splits-table td{font-family:var(--font-mono);font-size:11px;color:#fff;padding:4px 6px;border-bottom:1px solid rgba(255,255,255,.04)}
.splits-table tr:last-child td{border-bottom:none}
.splits-table td.split-val{color:var(--green);font-weight:700}
.run-video-link{display:inline-flex;align-items:center;gap:5px;margin-top:8px;font-family:var(--font-ui);font-weight:700;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--action);text-decoration:none;border:1px solid rgba(255,106,22,.3);border-radius:4px;padding:4px 10px}
.run-video-link:hover{background:rgba(255,106,22,.08)}

/* ── PROFILE FORM ── */
.profile-area{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px}
.pf-card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px}
.pf-title{font-family:var(--font-ui);font-weight:700;font-size:15px;text-transform:uppercase;letter-spacing:.06em;color:#fff;margin-bottom:12px}
.pf-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
.pf-field{display:flex;flex-direction:column;gap:4px}
.pf-field.full{grid-column:1/-1}
.pf-label{font-family:var(--font-mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.pf-input{background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:5px;padding:8px 10px;color:var(--text);font-family:var(--font-ui);font-size:13px;outline:none;-webkit-appearance:none;width:100%}
.pf-input:focus{border-color:var(--measure);background:rgba(255,255,255,.06)}
.pf-input option{background:var(--card2);color:var(--text)}
.pf-save{width:100%;padding:12px;background:var(--action);border:none;color:var(--on-accent);font-family:var(--font-ui);font-weight:700;font-size:14px;letter-spacing:.1em;text-transform:uppercase;border-radius:6px;cursor:pointer;transition:background .15s}
.pf-save:active{filter:brightness(1.08)}
.pf-saved{background:var(--green) !important;color:var(--on-accent) !important}
.share-box{background:rgba(0,232,135,.05);border:1px solid rgba(0,232,135,.2);border-radius:8px;padding:12px;margin-bottom:10px}
.share-title{font-family:var(--font-ui);font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:var(--green);margin-bottom:6px}
.share-sub{font-size:11px;color:var(--muted);font-weight:300;margin-bottom:10px;line-height:1.5}
.share-url{font-family:var(--font-mono);font-size:10px;background:rgba(0,0,0,.3);border:1px solid var(--border);border-radius:5px;padding:8px 10px;color:var(--green);word-break:break-all;margin-bottom:8px}
.share-copy{width:100%;padding:9px;background:rgba(0,232,135,.1);border:1px solid rgba(0,232,135,.3);color:var(--green);font-family:var(--font-ui);font-weight:700;font-size:13px;letter-spacing:.08em;text-transform:uppercase;border-radius:5px;cursor:pointer}

/* ── MODE TOGGLE ── */
.mode-toggle{display:flex;background:rgba(0,0,0,.3);border:1px solid var(--border);border-radius:8px;overflow:hidden;margin:0 0 10px;flex-shrink:0}
.mtbtn{flex:1;padding:8px;background:transparent;border:none;color:var(--muted);font-family:var(--font-ui);font-weight:700;font-size:12px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:6px}
.mtbtn.active.inst{background:rgba(0,232,135,.12);color:var(--green)}
.mtbtn.active.wish{background:rgba(68,153,255,.12);color:var(--blue)}
.mtbtn-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.dot-inst{background:var(--green)}
.dot-wish{background:var(--blue)}
/* ── BOARD TOGGLE (Times ↔ Builds) ── */
.board-toggle{display:flex;background:rgba(0,0,0,.3);border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:10px;flex-shrink:0}
/* ── MODEL FILTER BAR ── */
.mfbtn.on{background:rgba(255,106,22,.12);border-color:var(--action);color:var(--action)}
/* ── COMMUNITY BUILD CARDS ── */
/* ── SHARE CARD PREVIEW (Profile tab) ── */
.sc-sect{font-family:var(--font-mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:10px 0 6px}
.sc-wrap{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px}
.sc-head{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.sc-av{width:36px;height:36px;border-radius:50%;background:var(--surface-raised);border:1px solid var(--line-strong);display:flex;align-items:center;justify-content:center;font-family:var(--font-ui);font-weight:700;font-size:14px;color:var(--text-body);flex-shrink:0}
.sc-namewrap{min-width:0}
.sc-name{font-family:var(--font-ui);font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:.04em;color:#fff;line-height:1.1}
.sc-car{font-family:var(--font-mono);font-size:10px;color:var(--text-3);letter-spacing:.05em;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sc-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px}
.sc-stat{background:rgba(0,0,0,.3);border-radius:5px;padding:7px 5px;text-align:center}
.sc-stat-val{font-family:var(--font-ui);font-weight:700;font-size:16px;line-height:1}
.sc-stat-lbl{font-family:var(--font-mono);font-size:10px;color:var(--muted);letter-spacing:.05em;text-transform:uppercase;margin-top:2px}
.sc-chips{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px}
.sc-chip{font-family:var(--font-mono);font-size:10px;letter-spacing:.05em;padding:2px 7px;background:rgba(200,200,220,.07);border:1px solid var(--line-dashed);border-radius:3px;color:var(--text-2)}
.sc-preview{width:100%;padding:8px;border:1px solid rgba(255,106,22,.3);border-radius:5px;background:transparent;color:var(--action);font-family:var(--font-ui);font-weight:700;font-size:11px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;transition:background .15s}
.sc-preview:hover{background:rgba(255,106,22,.07)}
/* ── ADMIN PANEL ── */
.admin-fab{position:fixed;bottom:76px;right:14px;z-index:300;background:var(--action);color:var(--on-accent);border:none;border-radius:20px;padding:7px 14px;font-family:var(--font-ui);font-weight:700;font-size:12px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;box-shadow:0 2px 10px rgba(255,106,22,.5)}
.admin-overlay{position:fixed;inset:0;z-index:500;display:flex;flex-direction:column;background:var(--bg)}
.admin-hdr{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border);flex-shrink:0;background:var(--surface)}
.admin-title{font-family:var(--font-ui);font-weight:700;font-size:19px;text-transform:uppercase;letter-spacing:.06em;color:#fff}
.admin-title span{color:var(--fill-neutral)}
.admin-close{background:transparent;border:none;color:var(--muted);font-size:26px;cursor:pointer;line-height:1;padding:0 4px}
.admin-search{width:100%;padding:10px 16px;background:rgba(0,0,0,.4);border:none;border-bottom:1px solid var(--border);color:var(--text);font-family:var(--font-ui);font-size:13px;flex-shrink:0}
.admin-search:focus{outline:none;background:rgba(255,255,255,.06)}
.admin-search::placeholder{color:var(--muted)}
.admin-body{flex:1;overflow-y:auto}
.admin-slot{border-bottom:1px solid var(--border)}
.admin-slot-hdr{padding:8px 16px 4px;background:rgba(0,0,0,.2);display:flex;align-items:baseline;gap:8px}
.admin-slot-name{font-family:var(--font-ui);font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:var(--text-hi)}
.admin-slot-cat{font-family:var(--font-mono);font-size:10px;color:var(--muted);letter-spacing:.06em}
.admin-var{display:flex;align-items:center;padding:9px 16px;cursor:pointer;border:0;border-top:1px solid rgba(255,255,255,.03);gap:10px;transition:background .1s;width:100%;box-sizing:border-box;text-align:left;background:transparent;color:inherit;font-family:inherit}
.admin-var:active{background:rgba(255,255,255,.04)}
.admin-var.on{background:rgba(0,232,135,.07)}
.admin-var-info{flex:1;min-width:0}
.admin-var-brand{font-family:var(--font-ui);font-weight:700;font-size:13px;color:#fff;text-transform:uppercase;letter-spacing:.03em}
.admin-var-label{font-size:10px;color:var(--muted);display:block;margin-top:1px}
.admin-var-price{font-family:var(--font-mono);font-size:10px;color:var(--dim);display:block;margin-top:2px}
.admin-check{width:26px;height:26px;border-radius:50%;border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;color:var(--muted);transition:all .15s}
.admin-var.on .admin-check{border-color:var(--green);color:var(--green);background:rgba(0,232,135,.12)}
.admin-toast{position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:var(--green);color:#000;font-family:var(--font-ui);font-weight:700;font-size:12px;letter-spacing:.1em;text-transform:uppercase;padding:7px 18px;border-radius:20px;z-index:600;opacity:0;transition:opacity .2s;pointer-events:none}
.admin-toast.show{opacity:1}
/* ── PUBLIC PROFILE TOGGLE ── */
.pub-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;background:rgba(0,0,0,.2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;cursor:pointer;margin:10px 0;text-align:left;font-family:inherit;box-sizing:border-box;transition:border-color .15s}
.pub-toggle:hover{border-color:var(--line-strong)}
.pub-toggle-left{flex:1;min-width:0}
.pub-toggle-label{font-family:var(--font-ui);font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:.04em;color:var(--text)}
.pub-toggle-sub{font-family:var(--font-mono);font-size:10px;letter-spacing:.05em;color:var(--muted);margin-top:3px}
.pub-toggle-pill{width:44px;height:24px;border-radius:12px;background:rgba(255,255,255,.1);border:1px solid var(--border);flex-shrink:0;margin-left:12px;position:relative;transition:background .2s,border-color .2s}
.pub-toggle-pill.on{background:rgba(0,232,135,.2);border-color:var(--green)}
.pub-toggle-thumb{position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:var(--muted);transition:transform .2s,background .2s}
.pub-toggle-pill.on .pub-toggle-thumb{transform:translateX(20px);background:var(--green)}
/* ── COMMUNITY TEASER (Garage shortcut) ── */
/* ── PUBLIC PAGE BOTTOM SHEET ── */
.pub-overlay{position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:200;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn .18s ease}
.pub-sheet{background:var(--bg);border-radius:16px 16px 0 0;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;-webkit-overflow-scrolling:touch;position:relative}
.pub-close{position:absolute;top:10px;right:14px;background:transparent;border:none;color:var(--dim);font-size:22px;cursor:pointer;padding:4px;z-index:10}
.pub-hero{background:var(--surface-raised);padding:20px 16px 12px;position:relative}
.pub-handle{font-family:var(--font-mono);font-size:10px;letter-spacing:.1em;color:var(--text-3)}
.pub-hname{font-family:var(--font-ui);font-weight:700;font-size:24px;text-transform:uppercase;letter-spacing:.04em;color:#fff;line-height:1;margin:3px 0}
.pub-hcar{font-size:11px;color:var(--muted)}
.pub-stats-row{display:grid;grid-template-columns:1fr 1fr 1fr;border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.pub-stat-cell{padding:10px 8px;text-align:center;border-right:1px solid var(--border)}
.pub-stat-cell:last-child{border-right:none}
.pub-stat-val{font-family:var(--font-ui);font-weight:700;font-size:18px;line-height:1}
.pub-stat-lbl{font-family:var(--font-mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-top:2px}
.pub-ptabs{display:flex;background:var(--surface);border-bottom:1px solid var(--border)}
.pub-ptab{flex:1;padding:9px;font-family:var(--font-ui);font-weight:700;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);text-align:center;border:none;background:transparent;cursor:pointer;border-bottom:2px solid transparent;transition:color .15s,border-color .15s}
.pub-ptab.on{color:var(--action);border-bottom-color:var(--action)}
.pub-body{padding:10px 16px}
.pub-mod-row{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)}
.pub-mod-row:last-child{border-bottom:none}
.pub-mod-dot{width:7px;height:7px;border-radius:50%;background:var(--verify);flex-shrink:0}
.pub-mod-name{font-family:var(--font-ui);font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:.02em;color:#fff;flex:1;line-height:1.1}
.pub-mod-brand{font-size:10px;color:var(--text-3);margin-top:2px}
.pub-empty{font-size:12px;color:var(--muted);padding:16px 0;text-align:center}
.pub-footer{padding:10px 16px 20px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.pub-flogo{font-family:var(--font-ui);font-weight:700;font-size:12px;letter-spacing:.12em;color:var(--dim)}
.pub-fcta{font-family:var(--font-ui);font-weight:700;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--action);border:1px solid rgba(255,106,22,.35);border-radius:5px;padding:7px 12px;background:transparent;cursor:pointer}

/* ── PROGRESSION BAR (03-components.md) ─────────────────────────────────────
   Every horizontal position here is set inline from a computed percentage; the
   stylesheet owns appearance only, so the geometry can never drift from data. */
.pbar-wrap{margin:9px 0 0}
.pbar-ceiling-row{position:relative;height:14px}
.pbar-ceiling-lbl{position:absolute;top:0;transform:translateX(-50%);white-space:nowrap;
  font-family:var(--font-mono);font-weight:700;font-size:11px;letter-spacing:.06em;color:var(--verify)}
/* At a 1040 ceiling the tick sits at 100%, so a centred label hangs off the
   right edge. Pin it instead. */
.pbar-ceiling-lbl-end{transform:none}
.pbar-track{position:relative;height:8px;border-radius:2px;background:var(--track);overflow:hidden}
.pbar-fill{position:absolute;top:0;left:0;height:100%;border-radius:2px;background:var(--fill-neutral);
  transition:width .25s ease}
/* The hatch is drawn from 0 to the projected total and sits UNDER the solid
   fill, so the two can never disagree about where "now" ends. */
.pbar-ceiling-lg .pbar-ceiling-lbl{font-size:11.5px}
.pbar-wish{position:absolute;top:0;left:0;height:100%;border-radius:2px;transition:width .25s ease;
  background:repeating-linear-gradient(115deg,rgba(200,200,220,.5) 0 4px,rgba(200,200,220,.14) 4px 8px)}
.pbar-wish-gain{background:repeating-linear-gradient(115deg,rgba(0,232,135,.6) 0 4px,rgba(0,232,135,.18) 4px 8px)}
.pbar-tick{position:absolute;top:0;width:2px;height:100%;background:var(--verify);transition:left .25s ease}
.pbar-tick-goal{background:var(--measure)}
.pbar-labels{position:relative;height:13px;margin-top:3px}
/* TOP END drops to its own line rather than colliding with NOW at high hp. */
.pbar-labels-stacked{height:26px}
.pbar-labels span{position:absolute;top:0;white-space:nowrap;font-family:var(--font-mono);font-size:10px;
  letter-spacing:.04em}
.pbar-now{transform:translateX(-100%);color:var(--text-hi);font-weight:600}
.pbar-now-left{transform:none}
.pbar-wish-lbl{padding-left:5px;color:var(--text-3)}
/* #4b labels the delta in --verify, tight to the hatch. */
.pbar-wish-lbl-gain{padding-left:3px;color:var(--verify)}
.pbar-goal-lbl{transform:translateX(-50%);color:var(--measure);font-weight:600}
/* 9px is the one place below the 10px floor, and only because this label is
   meant to be the quietest thing on the bar. */
.pbar-labels .pbar-top{right:0;left:auto;font-size:9px;color:var(--text-3)}
.pbar-labels .pbar-top-clear{top:14px}

/* ── ACTIVATION (#4b) ───────────────────────────────────────────────────────*/
.act-hero{padding:11px 18px;border-bottom:1px solid var(--line)}
.act-body{padding:11px 18px 0}
.act-hero-lbl{font-family:var(--font-mono);font-size:10px;font-weight:400;line-height:normal;text-transform:uppercase;letter-spacing:.16em;
  color:var(--text-3)}
.act-hero-row{display:flex;align-items:baseline;gap:9px;margin-top:4px}
.act-hero-hp{font-family:var(--font-ui);font-weight:700;font-size:52px;line-height:.9;letter-spacing:normal;color:var(--measure)}
.act-hero-unit{font-family:var(--font-mono);font-size:11px;font-weight:400;letter-spacing:.1em;text-transform:uppercase;color:var(--text-3);white-space:nowrap}
.act-hero-ready{margin-left:auto;font-family:var(--font-mono);font-size:11px;font-weight:400;letter-spacing:normal;color:var(--verify);white-space:nowrap}
.act-card{background:var(--surface-raised);border:1px solid var(--line-strong);
  border-top:3px solid var(--fill-neutral);border-radius:var(--r-card);padding:12px 15px;margin:0 0 10px}
.act-card-top{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.act-card-brand{font-family:var(--font-mono);font-size:10px;font-weight:600;letter-spacing:.14em;
  color:var(--text-3);text-transform:uppercase}
.act-card-price{font-family:var(--font-mono);font-size:16px;font-weight:600;color:var(--verify)}
.act-card-title{font-family:var(--font-ui);font-weight:600;font-size:21px;color:var(--text-hi);
  margin:4px 0 0;line-height:1.2}
.act-card-reason{font-size:13.5px;line-height:1.5;color:var(--text-2);text-wrap:pretty;
  border-left:2px solid var(--line-dashed);padding-left:11px;margin-top:9px}
/* Blue = a fact about relevance to your car, not an action. */
.act-card-proof{color:var(--relevant);font-weight:600}
.act-card-meta{margin:10px 0 0;font-family:var(--font-mono);font-size:11px;letter-spacing:.05em;color:var(--text-3)}
.act-card-actions{display:flex;gap:8px;margin-top:12px}
.act-alt{min-height:46px;padding:0 13px;border:1px solid var(--line-dashed);border-radius:var(--r-row);background:transparent;color:var(--text-2);font-family:var(--font-mono);font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;white-space:nowrap}
.act-alt:hover{border-color:var(--text-2);color:var(--text-hi)}
.act-safe{display:inline-flex;align-items:center;gap:5px;font-family:var(--font-mono);font-size:10px;
  font-weight:600;letter-spacing:.06em;color:var(--verify);background:var(--verify-bg);
  border:1px solid var(--verify-bd);border-radius:var(--r-chip);padding:4px 9px}
.act-safe-note{color:var(--text-2);background:transparent;border-color:var(--line-dashed)}
.act-path{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
.act-path li{display:flex;align-items:center;gap:10px;padding:7px 12px;border:1px dashed var(--line);border-radius:var(--r-row)}
.act-path li.act-step-now{border-color:var(--line-dashed)}
.act-mark{flex:none;font-family:var(--font-mono);font-size:11.5px;color:var(--text-3)}
.act-step-now .act-mark{color:var(--action)}
.act-gain{flex:none;font-family:var(--font-mono);font-size:10.5px;color:var(--text-3)}
.act-step-now .act-gain{color:var(--verify)}
.act-browse{width:100%;min-height:44px;margin-top:10px;background:transparent;border:0;color:var(--relevant);font-family:var(--font-mono);font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.act-when{font-family:var(--font-ui);font-weight:400;font-size:14px;letter-spacing:normal;
  color:var(--text-3)}
.act-what{flex:1;min-width:0;font-family:var(--font-ui);font-weight:600;font-size:14px;color:var(--text-body);line-height:normal}
.act-step-now .act-what{color:var(--text-hi)}
.act-skip{width:100%;min-height:44px;background:transparent;border:0;color:var(--text-3);
  font-family:var(--font-ui);font-size:13px;text-decoration:underline;text-underline-offset:3px;
  cursor:pointer;margin-top:4px}

/* ── END-STATE PLANNER (#4f) ────────────────────────────────────────────────*/
.plan-hero{padding:4px 0 2px}
.plan-hero-lbl{font-family:var(--font-mono);font-size:10px;font-weight:600;letter-spacing:.16em;
  color:var(--text-3)}
.plan-hero-hp{font-family:var(--font-ui);font-weight:700;font-size:46px;line-height:.92;letter-spacing:normal;
  letter-spacing:-.01em;color:var(--measure);margin-top:6px}
.plan-hero-unit{font-size:20px;font-weight:600;color:var(--text-3);margin-left:4px}
.plan-change{margin-top:8px;min-height:44px;padding:0 14px;background:transparent;
  border:1px solid var(--line-dashed);border-radius:var(--r-row);color:var(--text-2);
  font-family:var(--font-mono);font-size:11.5px;cursor:pointer}
.plan-donor{display:flex;align-items:center;gap:7px;margin-top:9px;padding:7px 9px;
  background:var(--relevant-bg);border:1px solid var(--relevant-bd);border-radius:5px}
.plan-donor-tag{font-family:var(--font-mono);font-size:10px;font-weight:600;letter-spacing:.1em;
  color:var(--relevant)}
.plan-donor-txt{font-size:12px;color:var(--text-2);line-height:1.45}
.plan-goals{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
/* Red is ONLY money wasted at the goal — it is not an error color. */
.plan-orph-total{font-family:var(--font-mono);font-size:11px;color:var(--danger)}
.bmap-orph .bmap-body{background:var(--danger-bg);border:1px solid var(--danger-bd)}
.bmap-marker-orph{color:var(--danger)}
.bmap-orph .bmap-name{color:var(--text-2)}

/* ── PROOF STATES (03-components.md / 04-screens.md) ────────────────────────
   ✓ LOG reads as settled fact; ▲ CLAIM is deliberately quieter and dashed, so
   an unbacked time cannot be mistaken for a verified one at a glance. */
.run-proof-row{display:inline-flex;align-items:center;gap:6px}
/* FLAGGED: 9.5px, under the 10px text minimum in 01-tokens.md, which reserves
   sub-10px for the muted "1040+ TOP END" label alone. Matched to the mockup —
   #4c's run chips and #4c/#3a's hero proof badge are both 9.5px/600. */
.proof-chip{display:inline-flex;align-items:center;gap:4px;font-family:var(--font-mono);
  font-size:9.5px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;
  padding:2px 6px;border-radius:var(--r-chip);white-space:nowrap}
/* The hero badge sits on a tinted fill at .1em; the run-list chips are bare. */
.proof-link{letter-spacing:.1em;background:var(--verify-bg);border:1px solid var(--verify-bd)}
.proof-log{color:var(--verify);border:1px solid var(--verify-bd)}
.proof-claim{color:var(--measure);background:transparent;border:1px solid var(--measure-bd)}
/* Tertiary link, still a 44px target. */
.proof-link{margin-top:6px;text-decoration:none;min-height:44px}
.run-card.run-claim{border-style:dashed;border-color:var(--line-dashed);background:transparent;opacity:.75}

/* ── VEHICLE SETUP (#5a) ──
   Chip on-state is SEL from the mockup's own logic class:
     { bg: rgba(255,106,22,.12), bd: #FF6A16, fg: #FF6A16 }
   Off-state is OFF: { transparent, #34344A, #9494B0 }. */
.setup-area{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.setup-area::-webkit-scrollbar{display:none}
.setup-hero{padding:11px 18px;border-bottom:1px solid var(--line)}
.setup-hero-lbl{font-family:var(--font-mono);font-size:10px;font-weight:400;line-height:normal;
  letter-spacing:.16em;text-transform:uppercase;color:var(--text-3)}
.setup-hero-row{display:flex;align-items:baseline;gap:10px;margin-top:2px}
.setup-hero-hp{font-family:var(--font-ui);font-weight:700;font-size:48px;line-height:.9;
  letter-spacing:normal;color:var(--measure);font-variant-numeric:tabular-nums}
.setup-hero-delta{font-family:var(--font-mono);font-size:11.5px;font-weight:400;color:var(--verify);
  white-space:nowrap}
.setup-bar{margin-top:9px}
.setup-track{position:relative;height:8px;border-radius:2px;background:var(--track);overflow:hidden}
.setup-fill{height:100%;background:var(--fill-neutral);transition:width .25s ease}
.setup-tick{position:absolute;top:0;bottom:0;width:2px;background:var(--verify);transition:left .25s ease}
.setup-bar-lbls{position:relative;height:13px;margin-top:3px;font-family:var(--font-mono);
  font-size:10px;letter-spacing:.04em}
.setup-ceil{position:absolute;left:0;font-weight:600;color:var(--verify);white-space:nowrap}
.setup-top{position:absolute;right:0;top:1px;font-size:9px;color:var(--text-3);white-space:nowrap}

.setup-body{display:flex;flex-direction:column;gap:11px;padding:11px 18px 0}
.setup-h2{margin:0 0 7px;font-family:var(--font-mono);font-weight:600;font-size:10px;
  letter-spacing:.16em;text-transform:uppercase;color:var(--text-3)}
.setup-row{display:flex;gap:5px}
.setup-years{overflow-x:auto;scrollbar-width:none;padding-bottom:1px}
.setup-years::-webkit-scrollbar{display:none}
.setup-years .setup-pill{flex:none}
.setup-area .setup-row:has(.setup-pill){gap:7px}

/* Year pills — 44px, fully round. */
.setup-pill{min-height:44px;padding:0 15px;border-radius:22px;border:1px solid var(--line-dashed);
  background:transparent;color:var(--text-3);font-family:var(--font-mono);font-size:12.5px;
  letter-spacing:.06em;cursor:pointer;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:1px;transition:all .15s}
.setup-pill.on{background:var(--action-bg);border-color:var(--action);color:var(--action)}
.setup-pill-lbl{font-weight:600}
/* FLAGGED: 8.5px, below the 10px text floor in 01-tokens.md. Matched to #5a. */
.setup-pill-note{font-size:8.5px;letter-spacing:.08em;text-transform:uppercase}

/* Model cards — 3-up grid, 52px. */
.setup-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}
.setup-card{min-height:52px;border-radius:7px;border:1px solid var(--line-dashed);background:transparent;
  color:var(--text-3);display:flex;flex-direction:column;align-items:flex-start;justify-content:center;
  gap:2px;padding:0 11px;cursor:pointer;transition:all .15s;overflow:hidden}
.setup-card.on{background:var(--action-bg);border-color:var(--action);color:var(--action)}
.setup-card-lbl{font-family:var(--font-ui);font-weight:700;font-size:17px;line-height:1}
/* FLAGGED: 8.5px, below the 10px text floor. Matched to #5a. */
.setup-card-note{font-family:var(--font-mono);font-size:8.5px;letter-spacing:.06em;
  text-transform:uppercase;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  max-width:100%}

/* Tune / fuel segments — the mockup gives tune flex 1.35 against fuel's 1. */
.setup-pair{display:flex;gap:14px}
.setup-tune{flex:1.35;min-width:0}
.setup-fuel{flex:1;min-width:0}
.setup-seg{flex:1;min-height:44px;border-radius:var(--r-row);border:1px solid var(--line-dashed);
  background:transparent;color:var(--text-3);font-family:var(--font-mono);font-size:10.5px;
  font-weight:600;letter-spacing:.04em;text-transform:uppercase;padding:0 4px;cursor:pointer;
  transition:all .15s}
.setup-fuel .setup-seg{padding:0 2px}
.setup-seg.on{background:var(--action-bg);border-color:var(--action);color:var(--action)}
/* Stock dims the fuel row: fuel contributes nothing without a tune. */
.setup-inert{opacity:.4}
.setup-inert .setup-seg{cursor:not-allowed}

/* End-state rows. */
.setup-ends{display:flex;flex-direction:column;gap:5px}
.setup-end{width:100%;min-height:46px;display:flex;align-items:center;gap:10px;text-align:left;
  padding:7px 12px;border:1px solid var(--line);border-radius:var(--r-row);background:transparent;
  cursor:pointer;transition:all .15s}
.setup-end.on{border-color:var(--action);background:var(--surface-raised)}
.setup-end-mark{flex:none;font-family:var(--font-mono);font-size:11px;color:var(--text-3)}
.setup-end.on .setup-end-mark{color:var(--action)}
.setup-end-txt{flex:1;min-width:0}
.setup-end-lbl{display:block;font-family:var(--font-ui);font-weight:600;font-size:14.5px;color:var(--text-2)}
.setup-end.on .setup-end-lbl{color:var(--text-hi)}
.setup-end-note{display:block;font-family:var(--font-mono);font-size:10px;color:var(--text-3);
  margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

.setup-cta{width:100%;min-height:46px;margin-bottom:14px;border:none;border-radius:var(--r-row);
  background:var(--action);color:var(--on-action);font-family:var(--font-ui);font-weight:700;
  font-size:13.5px;letter-spacing:.09em;text-transform:uppercase;cursor:pointer}
.setup-cta.saved{background:transparent;color:var(--verify);border:1px solid rgba(0,232,135,.4)}

/* ── SCREEN ERROR STATE ── */
.screen-error{margin:18px;padding:16px;border:1px solid var(--line-strong);border-radius:var(--r-card);
  background:var(--surface-raised)}
.screen-error-hd{font-family:var(--font-ui);font-weight:700;font-size:16px;color:var(--text-hi)}
.screen-error-body{font-size:13.5px;line-height:1.5;color:var(--text-2);margin:8px 0 0;text-wrap:pretty}
.screen-error-btn{min-height:44px;margin-top:12px;padding:0 15px;border:1px solid var(--line-dashed);
  border-radius:var(--r-row);background:transparent;color:var(--text-2);font-family:var(--font-mono);
  font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}


/* ── BROWSE BUILDS (#4d) ── */
.lb-area{padding:0}
.cmt-filters{display:flex;gap:7px;padding:11px 18px}
/* FLAGGED: 34px, under the 44px target floor in 06-accessibility.md.
   Matched to #4d, which sizes its filter chips at 34px. */
.csbtn{min-height:34px;padding:0 14px;border:1px solid var(--line-dashed);border-radius:17px;
  background:transparent;color:var(--text-3);font-family:var(--font-mono);font-size:10.5px;
  font-weight:400;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;white-space:nowrap;
  transition:all .15s}
.csbtn.on{background:var(--action-bg);border-color:var(--action);color:var(--action);font-weight:600}
.cmt-list{display:flex;flex-direction:column;gap:7px;padding:11px 18px 0}
.cmt-empty{padding:11px 18px;font-size:12px;color:var(--text-3)}

.cmt-card{width:100%;text-align:left;display:block;padding:10px 14px;border:1px solid var(--line);
  border-radius:var(--r-card);background:var(--surface);cursor:pointer;font-family:inherit;
  transition:border-color .15s}
/* The card carrying the relevance row is raised, per #4d. */
.cmt-card.cmt-rel{padding:11px 14px;background:var(--surface-raised);border-color:var(--line-strong)}
.cmt-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.cmt-name{font-family:var(--font-ui);font-weight:700;font-size:17px;color:var(--text-hi)}
.cmt-car{font-weight:400;font-size:12.5px;color:var(--text-3);margin-left:6px}
/* FLAGGED: 9px, under the 10px text minimum. Matched to #4d. */
.cmt-tag{font-family:var(--font-mono);font-size:9px;font-weight:600;letter-spacing:.08em;
  color:var(--text-3);border:1px solid var(--line-dashed);border-radius:var(--r-chip);
  padding:2px 6px;flex:none;white-space:nowrap}
.cmt-tag-rel{color:var(--relevant);border-color:var(--relevant-bd)}
.cmt-stats{display:flex;align-items:baseline;gap:16px;margin-top:9px}
.cmt-stat{font-family:var(--font-ui);font-weight:700;font-size:24px;line-height:1;color:var(--text-hi);
  font-variant-numeric:tabular-nums}
.cmt-stat-hp{color:var(--measure)}
.cmt-unit{font-size:12px;font-weight:700;line-height:1;color:var(--text-3);margin-left:3px}
.cmt-proven{font-family:var(--font-mono);font-size:9.5px;font-weight:600;color:var(--verify);
  border:1px solid var(--verify-bd);border-radius:var(--r-chip);padding:2px 6px;white-space:nowrap}
.cmt-mods{margin-left:auto;font-family:var(--font-mono);font-size:10.5px;color:var(--text-3);white-space:nowrap}
.cmt-summary{margin-top:8px;font-family:var(--font-mono);font-size:10px;letter-spacing:.04em;
  color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cmt-more{width:100%;min-height:44px;margin-top:0;background:transparent;border:0;color:var(--text-3);
  font-family:var(--font-mono);font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;
  cursor:pointer;text-decoration:underline;text-underline-offset:3px}

/* ── TIMES (#4c) ── */
.times-area{padding:0}
.tm-hero{display:flex;align-items:flex-end;justify-content:space-between;
  padding:13px 18px;border-bottom:1px solid var(--line)}
.tm-hero-lbl{font-family:var(--font-mono);font-size:10px;font-weight:400;line-height:normal;
  letter-spacing:.16em;text-transform:uppercase;color:var(--text-3)}
.tm-hero-row{display:flex;align-items:baseline;gap:8px;margin-top:2px}
.tm-hero-val{font-family:var(--font-ui);font-weight:700;font-size:52px;line-height:.9;
  letter-spacing:normal;color:var(--measure);font-variant-numeric:tabular-nums}
.tm-hero-unit{font-size:22px;color:var(--text-3)}
.tm-hero-right{text-align:right;padding-bottom:4px}
.tm-hero-pct{font-family:var(--font-mono);font-size:10.5px;color:var(--text-3);margin-top:5px}
.tm-body{padding:13px 18px 0}
.tm-refresh{margin-left:auto;min-width:44px;min-height:44px;background:transparent;border:0;
  color:var(--text-3);font-size:14px;cursor:pointer}
.tm-cta{width:100%;min-height:46px;margin:11px 0 14px;border:none;border-radius:var(--r-row);
  background:var(--action);color:var(--on-action);font-family:var(--font-ui);font-weight:700;
  font-size:13.5px;letter-spacing:.09em;text-transform:uppercase;cursor:pointer}

/* ── FIELD BANDS (#4c) ──
   Four counts, your band highlighted, your true position a --measure line. */
.tm-h2-field{margin-bottom:9px}
.fb{display:flex;flex-direction:column;gap:7px;margin-bottom:14px}
.fb-row{display:flex;align-items:center;gap:9px}
.fb-lbl{width:74px;flex:none;text-align:right;font-family:var(--font-mono);font-size:10px;color:var(--text-3)}
.fb-lbl-mine{color:var(--measure);font-weight:600}
.fb-track{flex:1;height:14px;border-radius:2px;background:var(--surface-raised);overflow:hidden;position:relative}
.fb-fill{height:100%;background:var(--track)}
.fb-fill-mine{background:var(--fill-neutral)}
.fb-you{position:absolute;top:0;bottom:0;width:2px;background:var(--measure)}
.fb-n{width:24px;flex:none;font-family:var(--font-mono);font-size:10px;color:var(--text-3)}
.fb-n-mine{color:var(--text-body)}
.fb-cap{font-family:var(--font-mono);font-size:9.5px;letter-spacing:.04em;color:var(--text-3);margin-top:1px;line-height:normal}

/* ── HAS YOUR NEXT PART (#4d) ──
   Leads the card, above the numbers. Blue: a fact about relevance. */
.cmt-next{display:flex;align-items:center;gap:7px;margin:9px 0 0;padding:7px 9px;
  border:1px solid var(--relevant-bd);background:var(--relevant-bg);border-radius:5px}
.cmt-next-tag{font-family:var(--font-mono);font-size:9.5px;font-weight:600;letter-spacing:.1em;
  color:var(--relevant);flex:none}
.cmt-next-txt{flex:1;min-width:0;font-family:var(--font-ui);font-weight:600;font-size:13px;line-height:normal;
  color:var(--text-hi);overflow:hidden;text-overflow:ellipsis}



/* ── END-STATE PLANNER (#4f) ── */
.plan-hero{padding:11px 18px;border-bottom:1px solid var(--line)}
.plan-back{background:transparent;border:0;padding:0;margin-bottom:6px;min-height:44px;
  color:var(--text-3);font-family:var(--font-mono);font-size:11.5px;letter-spacing:.08em;
  text-transform:uppercase;cursor:pointer}
.plan-hero-row{display:flex;align-items:baseline;gap:9px;margin-top:2px}
.plan-hero-unit{font-family:var(--font-mono);font-size:11px;font-weight:400;letter-spacing:.08em;
  text-transform:uppercase;color:var(--text-3);white-space:nowrap}
.plan-body{padding:10px 18px 0}
/* FLAGGED: 30px, under the 44px target floor. Matched to #4f. */
.plan-change{margin-left:auto;min-height:30px;padding:0 11px;border:1px solid var(--line-dashed);
  border-radius:15px;background:transparent;color:var(--text-2);font-family:var(--font-mono);
  font-size:10px;font-weight:400;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;
  white-space:nowrap}
.plan-orph-total{font-family:var(--font-mono);font-size:10px;font-weight:600;letter-spacing:.16em;
  text-transform:uppercase;color:var(--danger)}
.bmap-plan .bmap-body{min-height:42px}
.bmap-plan .bmap-marker-wide{font-size:10px}
.bmap-plan .bmap-price{font-size:10.5px}

/* ── LEADERBOARD (#4e) ── */
.lb-filters{display:flex;gap:7px;padding:11px 18px}
.lb-filters .csbtn{padding:0 13px}
.lb-list{display:flex;flex-direction:column;gap:6px;padding:12px 18px 0}
.lb-row{width:100%;display:flex;align-items:center;gap:12px;text-align:left;padding:9px 13px;
  min-height:56px;border:1px solid var(--line);border-radius:var(--r-row);background:var(--surface);
  cursor:pointer;font-family:inherit;transition:border-color .15s}
.lb-row-top{background:var(--surface-raised);border-color:var(--line-strong)}
.lb-rank{flex:none;width:30px;font-family:var(--font-ui);font-weight:700;font-size:20px;color:var(--text-3);
  font-variant-numeric:tabular-nums}
.lb-rank-top{color:var(--measure)}
.lb-mid{flex:1;min-width:0}
.lb-name{display:block;font-family:var(--font-ui);font-weight:600;font-size:15px;color:var(--text-hi);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lb-spec{display:block;margin-top:1px;font-family:var(--font-mono);font-size:10px;color:var(--text-3);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lb-right{flex:none;text-align:right}
.lb-time{display:block;font-family:var(--font-ui);font-weight:700;font-size:22px;line-height:1;
  color:var(--text-hi);font-variant-numeric:tabular-nums}
/* FLAGGED: 9px, under the 10px text minimum. Matched to #4e. */
.lb-da{display:block;margin-top:2px;font-family:var(--font-mono);font-size:9px;color:var(--verify);
  white-space:nowrap}
/* Your row: outlined in --measure, carrying the real gap to the next tier. */
.lb-row-you{background:rgba(255,208,0,.05);border-color:rgba(255,208,0,.4)}
.lb-row-you .lb-rank,.lb-row-you .lb-time{color:var(--measure)}
.lb-cta{width:100%;min-height:46px;margin:2px 0 14px;border:none;border-radius:var(--r-row);
  background:var(--action);color:var(--on-action);font-family:var(--font-ui);font-weight:700;
  font-size:13.5px;letter-spacing:.09em;text-transform:uppercase;cursor:pointer}

/* ── LEADERBOARD DIVIDER + HIDDEN-CLAIM FOOTER (#4e) ── */
.lb-divider{display:flex;align-items:center;gap:8px;padding:2px 0;margin:0}
.lb-divider-line{flex:1;border-top:1px dashed var(--line-dashed)}
/* FLAGGED: 9px, under the 10px text minimum. Matched to #4e. */
.lb-divider-lbl{font-family:var(--font-mono);font-size:9px;letter-spacing:.14em;color:var(--text-3)}
.lb-hidden{margin:0;padding:4px 1px;font-family:var(--font-mono);font-size:10px;letter-spacing:.04em;
  color:var(--text-3)}

/* ── LEADERBOARD GATE ───────────────────────────────────────────────────────*/
.lb-req{display:inline-flex;align-items:center;gap:5px;font-family:var(--font-mono);font-size:10px;
  font-weight:600;letter-spacing:.1em;color:var(--verify);background:var(--verify-bg);
  border:1px solid var(--verify-bd);border-radius:var(--r-chip);padding:3px 8px;margin-bottom:6px}
.lb-you{margin-top:12px;padding:12px;border-radius:var(--r-card);background:var(--surface-raised);
  border:1px solid var(--measure-bd)}
.lb-you-hd{font-family:var(--font-mono);font-size:10px;font-weight:600;letter-spacing:.1em;
  color:var(--measure)}
.lb-you-time{font-family:var(--font-ui);font-weight:700;font-size:30px;line-height:1;
  color:var(--measure);margin-top:4px}
.lb-you-gap{font-family:var(--font-mono);font-size:10px;letter-spacing:.06em;color:var(--text-3);
  margin-top:4px}

/* ── BUILD MAP (03-components.md) ───────────────────────────────────────────
   Marker, border and background carry the state together; the row also states
   it in words for screen readers, so the glyph is never the only signal. */
.bmap{display:flex;flex-direction:column;gap:6px;list-style:none;margin:0;padding:0}
.bmap-dense{gap:5px}
ul.bmap-plan{gap:5px}
.bmap-row{display:flex;align-items:stretch;gap:6px}
/* Every row ends in a price (#4a/#4f). Orphaned money reads red — that is the
   one place --danger is allowed to appear. */
.bmap-price{font-family:var(--font-mono);font-size:11px;color:var(--text-3);flex:none;white-space:nowrap}
.bmap-price-orph{color:var(--danger)}
.bmap-marker-wide{width:56px;flex:none;font-size:10px}
.bmap-body{flex:1;min-width:0;display:flex;align-items:center;gap:10px;padding:6px 12px;
  min-height:44px;border-radius:var(--r-row);text-align:left;font-family:inherit;cursor:pointer;
  background:transparent;border:1px dashed var(--line-dashed);color:inherit}
.bmap-dense .bmap-body{min-height:40px}
.bmap-inst .bmap-body{background:var(--surface);border:1px solid var(--line)}
.bmap-marker{font-family:var(--font-mono);font-size:11.5px;font-weight:400;flex-shrink:0}
.bmap-marker-inst{color:var(--verify)}
.bmap-marker-next{color:var(--action)}
.bmap-marker-open{color:var(--text-3)}
.bmap-text{min-width:0;display:flex;flex-direction:column;gap:1px}
.bmap-name{font-family:var(--font-ui);font-weight:600;font-size:14.5px;line-height:normal;color:var(--text-2);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bmap-inst .bmap-name{color:var(--text-hi)}
.bmap-sub{font-family:var(--font-mono);font-size:10.5px;letter-spacing:normal;color:var(--text-3);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bmap-rm{flex-shrink:0;min-width:44px;min-height:44px;display:inline-flex;align-items:center;
  justify-content:center;background:transparent;border:1px solid var(--line);border-radius:var(--r-row);
  color:var(--text-3);font-size:18px;line-height:1;cursor:pointer}
.bmap-rm:hover,.bmap-rm:active{color:var(--danger);border-color:var(--danger-bd)}

/* ── HEALTH CHIPS (03-components.md) ────────────────────────────────────────
   MAXED = safe but no headroom. Deliberately NOT "AT LIMIT" — testers could not
   distinguish that from "actively damaging". */
.hchips{display:flex;gap:6px;margin-top:8px}
.hchip{flex:1;display:flex;align-items:center;justify-content:space-between;gap:6px;
  font-family:var(--font-mono);font-size:10px;font-weight:600;letter-spacing:.06em;line-height:normal;
  padding:4px 9px;border-radius:var(--r-chip)}
.hchip-ok{color:var(--verify);background:rgba(0,232,135,.05);border:1px solid rgba(0,232,135,.3)}
.hchip-caution{color:var(--measure);background:var(--measure-bg);border:1px solid var(--measure-bd)}

/* Visually hidden, still announced. */
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;
  clip:rect(0 0 0 0);white-space:nowrap;border:0}

/* Fuel hardware on a stock tune contributes zero to the estimate, so the row
   reads as inert rather than as an available gain. Text stays at the --text-3
   floor — dimming is done with the label, not by going below legal contrast. */
.slot-card.fuel-inert .slot-name,.slot-card.fuel-inert .slot-desc-text{color:var(--text-3)}
.t-inert{background:var(--measure-bg);color:var(--measure);border:1px solid var(--measure-bd)}

/* ── DENSITY + HIT TARGETS (06-accessibility.md) ─────────────────────────────
   44px minimum, no exceptions — including like buttons, dismiss ✕ glyphs and
   text-only tertiary buttons. Stated once here so the floor cannot silently
   regress when an individual component's padding is retuned. */
.mbtn,.cbtn,.pmtbtn,.mtbtn,.vc-like,
.run-ctrl-select,.section-title button,.tc-table-toggle,.draggy-reupload,
.sc-preview,.pub-fcta,.share-copy,.admin-fab,.pub-ptab,.rf-cancel{
  min-height:44px}
.vc-buy,.rf-save,.pf-save,.add-run-btn,.draggy-btn,.act-cta{
  min-height:46px}
.run-del,.brm,.draggy-clear,.act-dismiss,.pub-close,.admin-close{
  min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center}
.mod-row,.bitem,.pub-mod-row,.admin-var,.cmt-card,.pub-toggle{
  min-height:44px}
/* Chips sit on one line at 44px, so centre them rather than letting the old
   vertical padding push the label off-axis. */
.mbtn,.cbtn,.pmtbtn,.mtbtn,.csbtn,.vc-like{
  display:inline-flex;align-items:center;justify-content:center}
.mtbtn{flex:1}
/* The tab bar's 52px + 22px safe area now lives with the rest of its rules. */

/* ── REDUCED MOTION (06-accessibility.md) ───────────────────────────────────
   Only the bar fill and ceiling tick are meant to animate at all; honour the
   preference by dropping every transition and the spinner rotation. */
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{
    animation-duration:.01ms !important;animation-iteration-count:1 !important;
    transition-duration:.01ms !important;scroll-behavior:auto !important}
}
`;

// ── TAG CLASS ────────────────────────────────────────────────────────────
function tagClass(tag) {
  if (!tag) return null;
  if (tag==="MAINTENANCE") return "t-maint";
  if (tag==="POPULAR") return "t-pop";
  if (tag==="BEST VALUE") return "t-best";
  if (tag==="RACE") return "t-race";
  if (tag==="#1 MOD") return "t-race";
  if (tag==="LEADERBOARD MUST") return "t-lb";
  if (tag==="TRACTION") return "t-lb";
  if (tag==="CONTACT PATCH") return "t-lb";
  if (tag==="STRIP") return "t-race";
  if (tag.includes("SOUND")) return "t-snd";
  if (tag==="UNIVERSAL") return "t-uni";
  if (tag==="RELIABILITY") return "t-uni";
  if (tag==="SAFETY") return "t-race";
  if (tag==="HANDLING") return "t-pop";
  if (tag==="REQUIRED") return "t-race";
  if (tag==="START HERE") return "t-pop";
  if (tag==="TRACK") return "t-snd";
  if (tag==="FEEL IT") return "t-pop";
  return "t-oth";
}
function diffClass(d) {
  if (d==="Plug & Play") return "d-plug";
  if (d==="DIY Friendly") return "d-diy";
  return "d-pro";
}

// ── PERF BAR COMPONENT ────────────────────────────────────────────────────
// Impact tiers are a MEASUREMENT of how much a part changes the car, so they
// climb the neutral→measure ramp. None of them is an action, so none is orange.
const TIER_COLOR = { Moderate:"var(--text-2)", Significant:"var(--fill-neutral)", Transformative:"var(--measure)" };
const TIER_BG    = { Moderate:"rgba(200,200,220,.07)", Significant:"rgba(200,200,220,.12)", Transformative:"var(--measure-bg)" };

function PerfBar({ slotId, metric }) {
  const d = PERF_TIERS[slotId];
  if (!d) return null;
  const range = d[metric];
  const maxVal = metric === "et" ? 1.0 : 4.0; // absolute scale (seconds)
  const leftPct  = Math.round((Math.abs(range[0]) / maxVal) * 100);
  const widthPct = Math.round((Math.abs(range[1] - range[0]) / maxVal) * 100);
  const color = TIER_COLOR[d.tier];
  const label = metric === "et" ? "1/4-Mile ET" : "60–130 Roll";
  return (
    <div className="perf-bar-wrap">
      <div className="perf-bar-hdr">
        <span className="perf-tier" style={{color, background:TIER_BG[d.tier]}}>{d.tier}</span>
        <span className="perf-range">{label}: {range[0].toFixed(2)}s – {range[1].toFixed(2)}s</span>
      </div>
      <div className="perf-track">
        <div className="perf-fill" style={{left:`${leftPct}%`, width:`${Math.max(widthPct,4)}%`, background:color}}/>
      </div>
      <div className="perf-footer">{d.builds} builds logged</div>
    </div>
  );
}

// ── TRAP CHART ─────────────────────────────────────────────────────────────
// Reference curve (TRAP_TABLE) with real logged runs overlaid. Gets more useful
// as data accumulates: real leaderboard runs are plotted against the baseline and
// their average deviation is surfaced, and any 60–130 time can be interpolated to
// an estimated trap via trapForTime(). Lightweight inline SVG — no chart deps.
function TrapChart({ leaderboard, bestRun60130 }) {
  const [lookup, setLookup] = useState("");
  const uid = useId();

  // Plot geometry (SVG user units)
  const W = 340, H = 240;
  const plotL = 34, plotR = W - 12, plotT = 14, plotB = H - 28;
  const T_MIN = 2, T_MAX = 12;      // 60–130 time domain (s) — slow(left) → fast(right)
  const V_MIN = 105, V_MAX = 195;   // trap range (mph)
  const xOf = t => plotL + ((T_MAX - t) / (T_MAX - T_MIN)) * (plotR - plotL);
  const yOf = v => plotB - ((v - V_MIN) / (V_MAX - V_MIN)) * (plotB - plotT);

  const refPts = TRAP_TABLE.map(r => `${xOf(r.t60130).toFixed(1)},${yOf(r.trap).toFixed(1)}`).join(" ");

  // Real runs overlaid on the baseline (leaderboard entries with both time + trap)
  const real = (leaderboard || [])
    .filter(d => d.t60130 != null && d.mph != null)
    .map(d => ({ ...d, x: xOf(d.t60130), y: yOf(d.mph), ref: trapForTime(d.t60130) }));

  // "Gets smarter with data" stat: how far real runs sit from the reference curve
  const deltas = real.map(d => d.mph - d.ref).filter(Number.isFinite);
  const avgDelta = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null;

  // The user's own best 60–130 projected onto the curve (estimated trap)
  const youT = bestRun60130 && bestRun60130.time != null ? parseFloat(bestRun60130.time) : NaN;
  const you = Number.isFinite(youT) && youT >= T_MIN && youT <= T_MAX
    ? { t: youT, x: xOf(youT), y: yOf(trapForTime(youT)), est: trapForTime(youT) }
    : null;

  const lookupT = parseFloat(lookup);
  const lookupTrap = Number.isFinite(lookupT) ? trapForTime(lookupT) : null;

  const xTicks = [12, 10, 8, 6, 4, 2];
  const yTicks = [110, 130, 150, 170, 190];

  return (
    <div className="trap-chart-card">
      <div className="tc-title">60–130 → Trap Speed</div>
      <div className="tc-sub">Reference curve vs. real logged runs — sharpens as more data lands.</div>

      <svg viewBox={`0 0 ${W} ${H}`} className="tc-svg" preserveAspectRatio="xMidYMid meet">
        {yTicks.map(v => (
          <g key={`y${v}`}>
            <line x1={plotL} y1={yOf(v)} x2={plotR} y2={yOf(v)} className="tc-grid" />
            <text x={plotL - 6} y={yOf(v) + 3} className="tc-axis-lbl" textAnchor="end">{v}</text>
          </g>
        ))}
        {xTicks.map(t => (
          <text key={`x${t}`} x={xOf(t)} y={plotB + 16} className="tc-axis-lbl" textAnchor="middle">{t}s</text>
        ))}
        <polyline points={refPts} className="tc-ref-line" fill="none" />
        {you && (
          <g>
            <line x1={you.x} y1={plotT} x2={you.x} y2={plotB} className="tc-you-line" />
            <circle cx={you.x} cy={you.y} r="4" className="tc-you-dot" />
          </g>
        )}
        {real.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r="3.4" className="tc-real-dot">
            <title>{`#${d.rank} ${d.driver}: ${d.t60130}s → ${d.mph} mph (ref ${d.ref})`}</title>
          </circle>
        ))}
      </svg>

      <div className="tc-legend">
        <span className="tc-legend-item"><i className="tc-sw-ref" />Reference</span>
        <span className="tc-legend-item"><i className="tc-sw-real" />Real runs ({real.length})</span>
        {you && <span className="tc-legend-item"><i className="tc-sw-you" />You (est)</span>}
      </div>

      {avgDelta != null && (
        <div className="tc-stat">
          {real.length} real run{real.length === 1 ? "" : "s"} plotted · actual trap averages{" "}
          <strong>{Math.abs(avgDelta).toFixed(1)} mph {avgDelta < 0 ? "below" : "above"}</strong> the reference at matched 60–130 times.
        </div>
      )}

      <div className="tc-lookup">
        <label className="tc-lookup-lbl" htmlFor={`${uid}-lookup`}>Estimate trap from any 60–130 time</label>
        <div className="tc-lookup-row">
          <input id={`${uid}-lookup`} className="tc-lookup-input" type="number" step="0.1" inputMode="decimal" placeholder="e.g. 4.6"
            value={lookup} onChange={e => setLookup(e.target.value)} />
          <span className="tc-lookup-arrow">→</span>
          <div className="tc-lookup-out">{lookupTrap != null ? `${lookupTrap} mph` : "— mph"}</div>
        </div>
        {you && (
          <div className="tc-you-note">
            Your best 60–130 ({you.t}s) projects to ~<strong>{you.est} mph</strong> trap
          </div>
        )}
      </div>

      <details className="tc-table-wrap">
        <summary className="tc-table-toggle">Full reference table ({TRAP_TABLE.length} rows)</summary>
        <div className="tc-table-scroll">
          <table className="tc-table">
            <thead><tr><th>60–130 (s)</th><th>Trap (mph)</th></tr></thead>
            <tbody>
              {TRAP_TABLE.map(r => (
                <tr key={r.t60130}><td>{r.t60130.toFixed(1)}</td><td>{r.trap}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

// ── OTS vs CUSTOM TUNE COMPARISON (Feature A) ──────────────────────────────
// Two layers: (1) data-driven delta from the user's own OTS-tagged vs Custom-tagged
// runs — same run type only, see pickTunePair in ./tuneCompare.js; (2) research
// reference ranges from TUNE_GAINS when there isn't enough tagged data yet.
function TuneComparison({ runs }) {
  const [view, setView] = useState("data");
  const G = TUNE_GAINS;

  const withTime = (runs || []).filter(r => r.time != null && !isNaN(parseFloat(r.time)));
  const pair = pickTunePair(runs);
  const cmpType = pair?.type ?? null;
  const otsBest = pair?.ots ?? null;
  const customBest = pair?.custom ?? null;
  const hasBoth = !!pair;
  const taggedCount = withTime.filter(r => r.tuneType === "OTS" || r.tuneType === "Custom").length;

  const rng = (a, unit) => !a ? "" : (a[0] === a[1] ? `+${a[0]} ${unit}` : `+${a[0]}–${a[1]} ${unit}`);

  let cmp = null;
  if (hasBoth) {
    const oT = parseFloat(otsBest.time), cT = parseFloat(customBest.time);
    const dTime = +(oT - cT).toFixed(2);              // positive → custom faster
    // TRAP_TABLE maps 60–130 times to trap speed; feeding it a 0–60 or Roll Race
    // time returns a meaningless number, so the trap delta is 60–130 only.
    const trapValid = cmpType === "60-130";
    const oTrap = trapValid ? trapForTime(oT) : null;
    const cTrap = trapValid ? trapForTime(cT) : null;
    const dTrap = trapValid ? +(cTrap - oTrap).toFixed(1) : null;
    cmp = { oT, cT, dTime, oTrap, cTrap, dTrap, type: cmpType, oFuel: otsBest.fuel, cFuel: customBest.fuel };
  }

  return (
    <div className="tcmp-card">
      <div className="tc-title">OTS vs Custom Tune</div>
      <div className="tc-sub">What a custom map buys you — measured from your runs, backed by reference data.</div>

      <div className="times-view-toggle" style={{ marginBottom: 12 }}>
        <button className={`tvbtn${view === "data" ? " tva" : ""}`} aria-pressed={view === "data"} onClick={() => setView("data")}>Your Data</button>
        <button className={`tvbtn${view === "ref" ? " tva" : ""}`} aria-pressed={view === "ref"} onClick={() => setView("ref")}>Reference</button>
      </div>

      {view === "data" ? (
        hasBoth ? (
          <>
            <div className="tcmp-grid">
              <div className="tcmp-col ots">
                <div className="tcmp-col-hd">OTS baseline</div>
                <div className="tcmp-big">{cmp.oT}<span className="tcmp-u">s</span></div>
                <div className="tcmp-sub">{cmp.type}{cmp.oTrap != null ? ` · est ${cmp.oTrap} mph trap` : ""}{cmp.oFuel ? ` · ${cmp.oFuel}` : ""}</div>
              </div>
              <div className="tcmp-col custom">
                <div className="tcmp-col-hd">Custom</div>
                <div className="tcmp-big">{cmp.cT}<span className="tcmp-u">s</span></div>
                <div className="tcmp-sub">{cmp.type}{cmp.cTrap != null ? ` · est ${cmp.cTrap} mph trap` : ""}{cmp.cFuel ? ` · ${cmp.cFuel}` : ""}</div>
              </div>
            </div>
            <div className="tcmp-delta">
              <div className="tcmp-delta-item">
                <span className="tcmp-delta-lbl">{cmp.type}</span>
                <span className={`tcmp-delta-val${cmp.dTime > 0 ? " good" : cmp.dTime < 0 ? " bad" : ""}`}>
                  {cmp.dTime > 0 ? `−${cmp.dTime}s` : cmp.dTime < 0 ? `+${Math.abs(cmp.dTime)}s` : "±0s"}
                </span>
              </div>
              {cmp.dTrap != null && (
                <div className="tcmp-delta-item">
                  <span className="tcmp-delta-lbl">Est. trap</span>
                  <span className={`tcmp-delta-val${cmp.dTrap > 0 ? " good" : cmp.dTrap < 0 ? " bad" : ""}`}>
                    {cmp.dTrap > 0 ? `+${cmp.dTrap}` : cmp.dTrap} mph
                  </span>
                </div>
              )}
            </div>
            <div className="tc-you-note">
              From your best OTS vs best Custom {cmp.type} run — same run type only.
              {cmp.dTrap != null ? " Trap estimated via the reference curve." : ""}
            </div>
          </>
        ) : (
          <div className="tcmp-empty">
            <div className="tcmp-empty-icon">📊</div>
            <div>Tag your runs <strong>OTS</strong> or <strong>Custom</strong> when logging — once you have one of each <em>on the same run type</em>, the real time and trap delta shows here.</div>
            <div className="tcmp-empty-note">
              {taggedCount === 0 ? "No tagged runs yet." : `${taggedCount} tagged run${taggedCount === 1 ? "" : "s"} so far.`} Sharpens as more land. Meanwhile, see <strong>Reference</strong> ↑
            </div>
            <div className="tcmp-anchor">
              {G.rollingAnchor.label}: <strong>{G.rollingAnchor.fromS}s → {G.rollingAnchor.toS}s</strong> ({G.rollingAnchor.deltaS}s)
            </div>
          </div>
        )
      ) : (
        <>
          <div className="tcmp-headline">
            The biggest lever is <strong>ethanol</strong>, not the OTS-vs-custom peak gap.
          </div>

          {G.ethanol.map((e, i) => (
            <div className="tcmp-ref-row" key={i}>
              <div className="tcmp-ref-hd">{e.platform}</div>
              <div className="tcmp-ref-line">
                <span className="tcmp-ref-swap">{e.from} → {e.to}</span>
                <span className="tcmp-ref-gain">{rng(e.hp, "HP")} · {rng(e.tq, "ft-lb")}</span>
              </div>
              <div className="tcmp-ref-note">{e.evidence}</div>
            </div>
          ))}

          <div className="tcmp-anchor" style={{ marginTop: 10 }}>
            🏁 {G.rollingAnchor.label}: <strong>{G.rollingAnchor.fromS}s → {G.rollingAnchor.toS}s</strong> ({G.rollingAnchor.deltaS}s)
          </div>

          <div className="tcmp-ref-row">
            <div className="tcmp-ref-hd">OTS vs Custom — peak (stock turbos)</div>
            <div className="tcmp-ref-line">
              <span className="tcmp-ref-gain">{rng(G.otsVsCustomPeak.whp, "WHP")}</span>
            </div>
            <div className="tcmp-ref-note">{G.otsVsCustomPeak.note}</div>
          </div>

          <div className="tcmp-ref-hd" style={{ marginTop: 8 }}>Where custom actually pulls ahead</div>
          {G.customValue.map((c, i) => (
            <div className="tcmp-val-line" key={i}>
              <span className="tcmp-val-factor">{c.factor}</span>
              {c.whp && <span className="tcmp-ref-gain">{rng(c.whp, "WHP")}</span>}
              <span className="tcmp-val-note">{c.note}</span>
            </div>
          ))}

          <div className="tcmp-disclaimer">
            {G.disclaimer} Crank↔wheel reconciled at ~{G.drivetrainLossPct[0]}–{G.drivetrainLossPct[1]}% drivetrain loss (4.0T).
          </div>
        </>
      )}
    </div>
  );
}

// ── CUSTOM FEATURES MODULE (Feature B, generalized) ────────────────────────
// Provider-agnostic add-on feature selector: pick a tuner/provider, then toggle
// which custom features the tune includes. NO pricing/commerce (future feature).
// Dyno Scorpion is credited/linked as the origin of the Scorpion feature set.
// Provider list reuses the app's existing custom-tuner variants + an "Other tuner"
// catch-all. Selection is lifted to App state and persisted (see customFeatures).
function CustomFeatures({ value, onChange }) {
  const uid = useId();
  const providers = [
    SCORPION.name,
    ...((getSlotById("ecu_custom")?.variants) || []).map(v => v.brand),
    "Other tuner",
  ];
  const selected = value.selected || {};
  const selCount = Object.values(selected).filter(Boolean).length;

  // Functional updates so rapid/batched changes can't clobber each other via a stale prop.
  const toggle = id => onChange(v => ({ ...v, selected: { ...(v.selected || {}), [id]: !(v.selected || {})[id] } }));
  const setProvider = provider => onChange(v => ({ ...v, provider }));

  return (
    <div className="scp-card">
      <div className="tc-title">Custom Features</div>
      <div className="tc-sub">Select the add-on features your custom tune includes — for any tuner.</div>

      <div className="cf-field">
        <label className="rf-label" htmlFor={`${uid}-provider`}>Tuner / Provider</label>
        <select id={`${uid}-provider`} className="rf-input" value={value.provider}
          onChange={e => setProvider(e.target.value)}>
          {providers.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="cf-feat-grid">
        {CUSTOM_FEATURES.map(f => {
          const on = !!selected[f.id];
          return (
            <button key={f.id} type="button" className={`cf-feat${on ? " on" : ""}`}
              aria-pressed={on} onClick={() => toggle(f.id)}>
              <div className="cf-feat-top">
                <span className="cf-feat-name">{f.name}</span>
                <span className={`cf-check${on ? " on" : ""}`}>{on ? "✓" : "+"}</span>
              </div>
              <div className="cf-feat-desc">{f.desc}</div>
            </button>
          );
        })}
      </div>

      <div className="cf-footer">
        <span className="cf-count">{selCount} selected{value.provider ? ` · ${value.provider}` : ""}</span>
        <a className="scp-source" href={SCORPION.url} target="_blank" rel="noopener noreferrer">
          Scorpion feature set by {SCORPION.name} ↗
        </a>
      </div>
    </div>
  );
}

// ── PROOF STATE ─────────────────────────────────────────────────────────────
// Proof is a visible state, not a footnote. A run backed by attached evidence —
// a Draggy datalog (splits) or a slip/video — is a LOG; anything else is a CLAIM.
// The distinction is load-bearing: no datalog, no leaderboard rank.
function runProof(run) {
  const hasDatalog = !!(run.splits && Object.keys(run.splits).length > 0);
  const hasSlip    = !!run.videoUrl;
  const proven     = hasDatalog || hasSlip;
  return {
    proven, hasDatalog, hasSlip,
    label: proven ? "✓ LOG" : "▲ CLAIM",
    // Spelled out because the glyph must never be the only signal.
    words: proven
      ? (hasDatalog ? "Verified by datalog" : "Verified by time slip")
      : "Claimed — no datalog attached",
  };
}

// The badge is an <a>, never a <span> — it opens the logged run with its date,
// DA and fuel. A claim renders in --measure at 75% opacity with a dashed border.
function ProofBadge({ run, onOpen }) {
  if (!run) return null;
  const p = runProof(run);
  return (
    <a className={`proof-chip proof-link${p.proven ? " proof-log" : " proof-claim"}`}
      href={`#run-${run.id}`}
      onClick={() => onOpen(run.id)}>
      <span aria-hidden="true">{p.proven ? "✓ Proven ›" : "▲ CLAIM ›"}</span>
      <span className="sr-only">{p.words}. Open run detail</span>
    </a>
  );
}

// ── BUILD MAP ───────────────────────────────────────────────────────────────
// THE reconciliation point. The map's "next up" row and the recommendation card
// are rendered from the SAME object (`nextRec`, lifted to the screen and passed
// to both). Two different answers to "what do I do next?" on one screen was the
// single biggest usability failure in review — this makes disagreeing impossible.
//
// Sub-lines carry the snake_case part id plus a short reason and must stay under
// ~34 characters: the row is ~274px of usable width and this must not wrap.
// Which caution chip does fitting `slot` actually clear? Derived by running
// healthFor against the build with that slot fitted and diffing, so the
// "clears fuel sys ▲" tie can never drift from the chip it points at.
function clearsChip(installedMap, slot, variantId) {
  if (!slot) return null;
  const before = healthFor(installedMap);
  const after  = healthFor({ ...(installedMap || {}), [slot]: variantId || "x" });
  const fixed  = before.find((c, i) => !c.ok && after[i]?.ok);
  return fixed ? `${fixed.label.toLowerCase()} ▲` : null;
}

function BuildMap({ installedMap, nextRec, onOpenSlot, onRemove, dense = false }) {
  const installed = installedMap || {};
  const rows = MOD_PATH.map(m => {
    const slot      = getSlotById(m.slot);
    if (!slot) return null;
    const varId     = installed[m.slot];
    const isInst    = !!varId;
    const isNext    = !isInst && nextRec && nextRec.slot === m.slot;
    const variant   = isInst ? getVariantById(m.slot, varId) : null;
    const pct       = Math.round((m.builds / MOD_PATH_TOTAL) * 100);

    let state = "open", marker = "[ ]", sub, price, name = slot.name;
    if (isInst) {
      state = "inst"; marker = "[✓]";
      sub = `${varId} · installed`;
      price = variant?.price ?? null;
    } else if (isNext) {
      // #4a/#3a put the PRODUCT name and its price on this row — the same two
      // strings the recommendation shows. Agreeing at the slot level is not
      // enough; the user has to see the same part at the same price.
      state = "next"; marker = "[→]";
      name  = nextRec.variant?.label || slot.name;
      const tie = clearsChip(installed, nextRec.slot, nextRec.variant?.id);
      sub   = tie ? `next up · clears ${tie}` : "next up";
      price = nextRec.variant?.price ?? null;
    } else {
      sub = `${m.pick} · ${pct}% of builds`;
      price = getVariantById(m.slot, m.pick)?.price ?? null;
    }

    return { id: m.slot, name, state, marker, sub, isInst, variant, price };
  }).filter(Boolean);

  // Installed first, then the next step, then the rest of the path in order.
  const order = { inst: 0, next: 1, open: 2 };
  rows.sort((a, b) => order[a.state] - order[b.state]);

  return (
    <ul className={`bmap${dense ? " bmap-dense" : ""}`}>
      {rows.map(r => (
        <li key={r.id} className={`bmap-row bmap-${r.state}`}>
          <button type="button" className="bmap-body" onClick={() => onOpenSlot(r.id)}>
            <span className={`bmap-marker bmap-marker-${r.state}`} aria-hidden="true">{r.marker}</span>
            <span className="bmap-text">
              <span className="bmap-name">{r.name}</span>
              <span className="bmap-sub">{r.sub}</span>
            </span>
            {r.price != null && (
              <span className="bmap-price">${r.price.toLocaleString()}</span>
            )}
            {/* The marker is a glyph, so the state is also stated in words —
                never leave [✓] / [→] as the only signal. */}
            <span className="sr-only">
              {r.state === "inst" ? "installed" : r.state === "next" ? "next up" : "not yet fitted"}
            </span>
          </button>
          {r.isInst && onRemove && (
            <button type="button" className="bmap-rm" onClick={() => onRemove(r.id)}
              aria-label={`Remove ${r.name} from your build`}>
              <span aria-hidden="true">×</span>
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

// ── HEALTH CHIPS ────────────────────────────────────────────────────────────
// Paired states derived from the build, never authored. MAXED means "safe but no
// headroom" — deliberately not "AT LIMIT", which testers could not tell apart
// from "actively damaging". The ▲ glyph is echoed in the recommendation's
// "clears fuel sys ▲" so the cause→effect chain stays legible.
function healthFor(installedMap) {
  const m = installedMap || {};
  const hasTune = Object.keys(m).some(k => TUNING_SLOTS.has(k));
  const hasFuelHardware = ["hpfp", "flex_fuel", "port_inj", "port_inj_full"].some(k => m[k]);
  const hasEthanol = !!m.flex_fuel;

  return [
    {
      label: "FUEL SYS",
      // A tune without fuel hardware is asking the stock system for everything
      // it has: safe, but there is no headroom left for the next step.
      ok: !hasTune || hasFuelHardware,
      state: (!hasTune || hasFuelHardware) ? "✓ OK" : "▲ MAXED",
    },
    {
      label: "KNOCK MARGIN",
      ok: !hasTune || hasEthanol,
      state: (!hasTune || hasEthanol) ? "✓ OK" : "▲ MAXED",
    },
  ];
}

function HealthChips({ installedMap }) {
  return (
    <div className="hchips">
      {healthFor(installedMap).map(c => (
        <div key={c.label} className={`hchip${c.ok ? " hchip-ok" : " hchip-caution"}`}>
          <span>{c.label}</span><span>{c.state}</span>
        </div>
      ))}
    </div>
  );
}

// ── FIELD BANDS (04-screens.md #4c) ─────────────────────────────────────────
// "You vs the field" as four count bands, not a chart. Your position is a
// --measure line inside your band, at its TRUE position within that band —
// the trap chart moves to the run detail view.
//
// The mockup's 8.5 / 9.5 / 11.0 edges belong to its sample field. Hard-coding
// them against a field that actually runs 4-6s would put every car in one band,
// so the edges are derived from the real distribution and rounded to a readable
// step. Four bands, always populated, still the design's shape.
function fieldBands(times, mine) {
  // Supabase hands back Postgres `numeric` columns as STRINGS, so every value
  // here has to be coerced before it touches arithmetic. Left as-is, "4.03" + 0.3
  // concatenates to "4.030.3" and the band edges arrive as strings, where
  // .toFixed() throws and takes the whole render down with it.
  // Drop empties BEFORE coercing: Number(null) and Number("") are both 0, which
  // would quietly enter a missing time into the field as a 0.00s car.
  const all = (times || [])
    .filter(t => t != null && t !== "")
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (all.length < 2) return null;
  const me = Number(mine);
  mine = Number.isFinite(me) ? me : null;
  const lo = all[0], hi = all[all.length - 1];
  const span = hi - lo;
  if (span <= 0) return null;
  const step = Math.max(0.1, Math.round((span / 4) * 10) / 10);
  const edges = [lo, lo + step, lo + step * 2, lo + step * 3, Infinity];

  const bands = [];
  for (let i = 0; i < 4; i++) {
    const bLo = edges[i], bHi = edges[i + 1];
    const count = all.filter(t => t >= bLo && t < bHi).length;
    const label = i === 3 ? `${bLo.toFixed(2)}+`
      : i === 0 ? `UNDER ${bHi.toFixed(2)}`
      : `${bLo.toFixed(2)}–${bHi.toFixed(2)}`;
    const isMine = mine != null && mine >= bLo && mine < bHi;
    // True position within the band, not the middle of it.
    const pos = isMine && isFinite(bHi) && bHi > bLo
      ? Math.min(100, Math.max(0, ((mine - bLo) / (bHi - bLo)) * 100))
      : null;
    bands.push({ label, count, isMine, pos, bLo });
  }
  const max = Math.max(...bands.map(b => b.count), 1);
  return { bands, max, total: all.length };
}

function FieldBands({ times, mine }) {
  const data = fieldBands(times, mine);
  if (!data) return null;
  return (
    <>
      <h2 className="section-title tm-h2-field">
        <span>The field</span>
        <span className="section-count">{data.total} cars</span>
      </h2>
      <div className="fb">
        {data.bands.map(b => (
          <div key={b.label} className="fb-row">
            <span className={`fb-lbl${b.isMine ? " fb-lbl-mine" : ""}`}>{b.label}</span>
            <div className="fb-track">
              <div className={`fb-fill${b.isMine ? " fb-fill-mine" : ""}`}
                style={{ width: `${(b.count / data.max) * 100}%` }} />
              {b.isMine && b.pos != null && (
                <div className="fb-you" style={{ left: `${b.pos}%` }} />
              )}
            </div>
            <span className={`fb-n${b.isMine ? " fb-n-mine" : ""}`}>{b.count}</span>
          </div>
        ))}
        {mine != null && (
          <div className="fb-cap">
            YELLOW LINE = YOUR {mine}
            <span className="sr-only">
              . Your best 60 to 130 is {mine} seconds, shown inside its band.
            </span>
            {" "}· TRAP CHART IN DETAIL VIEW
          </div>
        )}
      </div>
    </>
  );
}

// ── PART SHEET (04-screens.md #5b) ──────────────────────────────────────────
// Recommended-first: the pick for this build leads, and the rest of the
// catalogue sits behind "+N options". That inversion is the whole point — the
// old inline accordion opened with every variant at once and buried the
// recommendation inside them.
//
// Dialog semantics come from useDialog (focus moves in, Tab is trapped, Escape
// closes, focus returns). The scrim is a real button with an accessible name,
// and the caller marks the app shell inert while this is open.
function VariantCard({
  slot, v, isActive, isRecommended, isAdminPick, buildMode, modelId, currentModel,
  liked, likeCount, likesLive, onToggleLike, onChoose, onTrackBuy,
}) {
  const hp = v.hp[modelId] || 0;
  const tq = v.torque[modelId] || 0;
  // #5b swaps the label rather than the button: "what is in my build" has to be
  // readable without comparing borders.
  const chooseLabel = isActive
    ? (buildMode === "installed" ? "✓ In your build" : "✓ On your wishlist")
    : (buildMode === "installed" ? "Add to build" : "Add to wishlist");

  return (
    <article className={`vcard${isActive ? " vactive" : ""}`}>
      <div className="vc-top">
        <span className="vc-brand">{v.brand}</span>
        <span className="vc-price">${v.price.toLocaleString()}</span>
      </div>
      <div className="vc-name-row">
        <span className="vc-name">{v.label}</span>
        {/* Blue: a fact about relevance to this car, not an action. */}
        {isRecommended && <span className="vc-rec-chip">Recommended</span>}
        {isAdminPick && <span className="vc-rec-chip vc-rec-curated">Curator pick</span>}
      </div>
      <p className="vc-why">{v.notes}</p>

      <div className="vc-actions">
        <button
          type="button"
          className={`vc-like${liked ? " on" : ""}`}
          aria-pressed={!!liked}
          aria-label={`${liked ? "Unlike" : "Like"} ${v.brand} ${v.label}${
            likesLive && likeCount > 0 ? ` — ${likeCount.toLocaleString()} likes` : ""}`}
          onClick={() => onToggleLike(v.id)}>
          <span className="vc-like-ic" aria-hidden="true">♥</span>
          {likesLive && likeCount > 0 ? likeCount.toLocaleString() : (liked ? "Liked" : "Like")}
        </button>
        {v.rating != null && (
          <span className="vc-rating"><span aria-hidden="true">★</span> {v.rating.toFixed(1)}</span>
        )}
        <button type="button" className={`vc-btn${isActive ? " vsel" : ""}`}
          onClick={() => onChoose(slot.id, v.id)}
          aria-label={isActive
            ? `Remove ${v.brand} ${v.label} from your ${buildMode === "installed" ? "build" : "wishlist"}`
            : `Add ${v.brand} ${v.label} to your ${buildMode === "installed" ? "build" : "wishlist"}`}>
          {chooseLabel}
        </button>
      </div>

      <div className="vc-stats">
        <div className="vcstat"><div className="vcstat-label">+Crank HP</div><div className={`vcstat-val${hp===0?" zero":""}`}>{hp>0?`+${hp}`:"—"}</div></div>
        <div className="vcstat"><div className="vcstat-label">+Est WHP</div><div className={`vcstat-val${hp===0?" zero":""}`}>{hp>0?`+${Math.round(hp*0.85)}`:"—"}</div></div>
        <div className="vcstat"><div className="vcstat-label">+TQ</div><div className={`vcstat-val${tq===0?" zero":""}`}>{tq>0?`+${tq}`:"—"}</div></div>
      </div>
      {hp > 0 && (
        <div className="t-est-row">
          <div className="t-est-box">
            <div className="t-est-label">1/4 Mile Est.</div>
            <div className="t-est-val">−{(currentModel.et * hp / (currentModel.hp + hp)).toFixed(2)}s</div>
          </div>
          <div className="t-est-divider"/>
          <div className="t-est-box">
            <div className="t-est-label">60–130 Est.</div>
            <div className="t-est-val">−{(currentModel.t60130 * hp / (currentModel.hp + hp)).toFixed(2)}s</div>
          </div>
        </div>
      )}
      <div className="vc-pc">
        <div className="vc-pros">{v.pros.map((p,i)=><div key={i}>+ {p}</div>)}</div>
        <div className="vc-cons">{v.cons.map((c,i)=><div key={i}>− {c}</div>)}</div>
      </div>
      <div className={`vc-diff ${diffClass(v.difficulty)}`}>{v.difficulty}</div>
      {/* Outbound link to the vendor's own page — Proof.Build does not sell
          parts, so this is deliberately NOT labelled "Buy". */}
      {v.buyUrl && (
        <a className="vc-buy" href={v.buyUrl} target="_blank" rel="noopener noreferrer"
          onClick={() => onTrackBuy(v)}>
          View at vendor ↗
        </a>
      )}
    </article>
  );
}

function PartSheet({
  slot, rec, selVarId, otherVarId, buildMode, modelId, currentModel,
  likedParts, likeCounts, likesLive, adminPicks, onToggleLike, onChoose,
  onInstallFromWishlist, onTrackBuy, onClose, missing, conflicts, missingRecs,
  fuelInert, extras,
}) {
  const dialogRef = useDialog(onClose);
  const uid = useId();
  const [showAll, setShowAll] = useState(false);

  const recId  = rec?.recommended?.variantId || null;
  const leadId = recId && slot.variants.some(v => v.id === recId) ? recId : slot.variants[0]?.id;
  const lead   = slot.variants.filter(v => v.id === leadId);
  const rest   = slot.variants.filter(v => v.id !== leadId);
  const shown  = showAll ? [...lead, ...rest] : lead;

  const hasSel = !!selVarId;

  return (
    <div className="sheet-scrim">
      {/* A real button, not a dimmed div — it has to be reachable and named. */}
      <button type="button" className="sheet-scrim-btn" aria-label="Close options"
        onClick={onClose} />
      <section className="sheet" role="dialog" aria-modal="true" tabIndex={-1}
        ref={dialogRef} aria-labelledby={`${uid}-title`}>
        <div className="sheet-hdr">
          <h2 className="sheet-title" id={`${uid}-title`}>
            {slot.name} · {slot.variants.length} option{slot.variants.length === 1 ? "" : "s"}
          </h2>
          <button type="button" className="sheet-x" aria-label="Close options" onClick={onClose}>
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <div className="sheet-body">
          {fuelInert && (
            <div className="v-alert warn">
              ⚠ Fuel hardware does nothing without a tune — this adds no power on its own.
            </div>
          )}
          {conflicts.length > 0 && (
            <div className="v-alert conflict">⚡ Conflicts with: {conflicts.map(c=>getSlotById(c)?.name||c).join(", ")}</div>
          )}
          {missing.length > 0 && (
            <div className="v-alert warn">⚠ Also needs: {missing.map(m=>getSlotById(m)?.name||m).join(", ")}</div>
          )}
          {hasSel && !missing.length && !conflicts.length && missingRecs.length > 0 && (
            <div className="v-alert rec">✦ Pairs well with: {missingRecs.map(r=>getSlotById(r)?.name||r).join(", ")}</div>
          )}
          {rec?.notes?.map((n, i) => <div key={i} className="v-alert warn">⚠ {n}</div>)}

          {buildMode === "installed" && otherVarId && !hasSel && (
            <button type="button" className="slot-install" style={{margin:"0 0 8px",width:"100%"}}
              onClick={() => { onInstallFromWishlist(slot.id); onClose(); }}>
              <span aria-hidden="true">✓</span> Install from wishlist
            </button>
          )}

          {shown.map(v => (
            <VariantCard
              key={v.id}
              slot={slot} v={v}
              isActive={selVarId === v.id}
              isRecommended={recId === v.id}
              isAdminPick={adminPicks[slot.id] === v.id}
              buildMode={buildMode} modelId={modelId} currentModel={currentModel}
              liked={!!likedParts[v.id]} likeCount={likeCounts[v.id] || 0} likesLive={likesLive}
              onToggleLike={onToggleLike} onChoose={onChoose} onTrackBuy={onTrackBuy}
            />
          ))}

          {/* Depth, behind one button — never labelled with a bare count. */}
          {!showAll && rest.length > 0 && (
            <button type="button" className="sheet-more" onClick={() => setShowAll(true)}>
              +{rest.length} option{rest.length === 1 ? "" : "s"}
            </button>
          )}

          {showAll && extras}
        </div>
      </section>
    </div>
  );
}

// ── VEHICLE SETUP (04-screens.md #5a) ───────────────────────────────────────
// Year → model → tune → fuel → end state. Every tap recomputes the hp readout,
// the bar fill and the ceiling tick, and announces the new estimate through a
// visually-hidden aria-live region. Selecting Stock dims the fuel row, because
// fuel does nothing without a tune — the power model says so, and the UI has to
// agree with the arithmetic.
//
// The power model is 05-data-and-math.md's, not invented here:
//   hp = base + stage.hp + (stage === 'stock' ? 0 : fuel.hp)
// Full C7/D4 4.0T production span — deliberately NOT narrowed to the mockup's
// three chips, which would strip valid years off existing profiles. The row
// scrolls horizontally; each pill keeps #5a's exact geometry.
const SETUP_YEARS  = [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019];
const SETUP_STAGES = [
  { id: "stock",  label: "Stock",  hp: 0,   slot: null },
  { id: "s1",     label: "STG 1",  hp: 100, slot: "ecu_s1" },
  { id: "s2",     label: "STG 2",  hp: 118, slot: "ecu_s2" },
  { id: "custom", label: "Custom", hp: 170, slot: "ecu_custom" },
];
const SETUP_FUELS = [
  { id: "p91", label: "91/93", hp: 0 },
  { id: "e30", label: "E30",   hp: 36 },
  { id: "e85", label: "E85",   hp: 70 },
];
const SETUP_ENDS = [
  { id: "daily",  label: "Reliable daily", note: "Stay under 750 hp · stock turbos",    ceiling: CEILINGS.daily.hp },
  { id: "hybrid", label: "Hybrid turbos",  note: "To ~850 hp · keeps fuel system",      ceiling: CEILINGS.hybrid.hp },
  { id: "single", label: "Big single",     note: "1,000+ hp · orphans OEM-turbo parts", ceiling: CEILINGS.single.hp },
];

function readSetupFuel() {
  try { return localStorage.getItem("proof-fuel") || "p91"; } catch { return "p91"; }
}

function VehicleSetup({ profile, modelId, installedMap, powerGoal, onSave }) {
  const [year,  setYear]  = useState(() => Number(profile.year) || 2016);
  const [model, setModel] = useState(modelId);
  const [stage, setStage] = useState(() => {
    const s = inferStage(installedMap);
    return s === "s3_hybrid" || s === "big_single" ? "custom" : (s || "stock");
  });
  const [fuel,  setFuel]  = useState(readSetupFuel);
  const [end,   setEnd]   = useState(() => {
    const g = powerGoal || 0;
    if (g > CEILINGS.hybrid.hp) return "single";
    if (g > CEILINGS.daily.hp)  return "hybrid";
    return "daily";
  });
  const [saved, setSaved] = useState(false);

  const st   = SETUP_STAGES.find(s => s.id === stage) || SETUP_STAGES[0];
  const fu   = SETUP_FUELS.find(f => f.id === fuel)   || SETUP_FUELS[0];
  const en   = SETUP_ENDS.find(e => e.id === end)     || SETUP_ENDS[0];
  // Fuel is inert without a tune — the same rule the parts list enforces.
  const fuelInert = stage === "stock";

  // 05-data-and-math.md: "Replace with the repo's real estimator if one exists
  // — but keep the property that fuel is inert without a tune." So the preview
  // runs the SAME calcTotals the Garage runs, over the build this screen would
  // commit. The doc's flat stage table would read 604 here against the Garage's
  // 595 for one car, and two hp figures for the same build is exactly what this
  // app cannot afford.
  const prospective = (() => {
    const next = { ...(installedMap || {}) };
    SETUP_STAGES.forEach(x => { if (x.slot) delete next[x.slot]; });
    if (st.slot) {
      const v = getSlotById(st.slot)?.variants?.[0];
      if (v) next[st.slot] = v.id;
    }
    return next;
  })();
  const modelHp = (MODELS.find(m => m.id === model) || MODELS[0]).hp;
  const hasTune = Object.keys(prospective).some(k => TUNING_SLOTS.has(k));
  const base    = (NON_RS_4OT.has(model) && hasTune) ? NORMALIZED_4OT_BASE : modelHp;
  // Fuel blend is the one thing the build estimate does not model, so it comes
  // from the doc's table rather than being invented per part.
  const hp      = base + calcTotals(prospective, model).hp + (fuelInert ? 0 : fu.hp);
  const delta   = hp - modelHp;

  const on = v => (v ? " on" : "");
  // Any change re-arms the CTA: what is on screen is no longer what was saved.
  const touch = fn => v => { setSaved(false); fn(v); };

  return (
    <div className="setup-area">
      <div className="setup-hero">
        <div className="setup-hero-lbl">Estimated crank hp</div>
        <div className="setup-hero-row">
          <span className="setup-hero-hp">{hp.toLocaleString()}</span>
          <span className="setup-hero-delta">+{delta} hp vs stock</span>
        </div>
        <div className="setup-bar">
          <div className="setup-track">
            <div className="setup-fill" style={{ width: `${(hp / HP_SCALE_TOP) * 100}%` }} />
            <div className="setup-tick" style={{ left: `${(en.ceiling / HP_SCALE_TOP) * 100}%` }} />
          </div>
          <div className="setup-bar-lbls">
            <span className="setup-ceil">{en.ceiling} CEILING</span>
            <span className="setup-top">{HP_SCALE_TOP}+ TOP END</span>
          </div>
        </div>
        {/* Announced on every tap, per #5a. */}
        <p className="sr-only" aria-live="polite">
          Estimated {hp} horsepower, {en.label.toLowerCase()} end state.
        </p>
      </div>

      <div className="setup-body">
        <div>
          <h2 className="setup-h2">Year</h2>
          <div className="setup-row setup-years">
            {SETUP_YEARS.map(y => (
              <button key={y} type="button" className={`setup-pill${on(year === y)}`}
                aria-pressed={year === y} onClick={() => touch(setYear)(y)}>
                <span className="setup-pill-lbl">{y}</span>
                {y === 2016 && <span className="setup-pill-note">86% of members</span>}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="setup-h2">Model</h2>
          <div className="setup-grid">
            {MODELS.map(m => (
              <button key={m.id} type="button" className={`setup-card${on(model === m.id)}`}
                aria-pressed={model === m.id} onClick={() => touch(setModel)(m.id)}>
                <span className="setup-card-lbl">{m.label}</span>
                <span className="setup-card-note">{m.engine}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="setup-pair">
          <div className="setup-tune">
            <h2 className="setup-h2">Tune</h2>
            <div className="setup-row">
              {SETUP_STAGES.map(s => (
                <button key={s.id} type="button" className={`setup-seg${on(stage === s.id)}`}
                  aria-pressed={stage === s.id} onClick={() => touch(setStage)(s.id)}>{s.label}</button>
              ))}
            </div>
          </div>
          <div className="setup-fuel">
            <h2 className="setup-h2">Fuel</h2>
            {/* Dimmed AND disabled on Stock: it contributes nothing to the
                estimate, so it must not look or behave as though it does. */}
            <div className={`setup-row${fuelInert ? " setup-inert" : ""}`}>
              {SETUP_FUELS.map(f => (
                <button key={f.id} type="button" className={`setup-seg${on(fuel === f.id)}`}
                  aria-pressed={fuel === f.id} disabled={fuelInert}
                  title={fuelInert ? "Fuel does nothing without a tune" : undefined}
                  onClick={() => touch(setFuel)(f.id)}>{f.label}</button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <h2 className="setup-h2">Where it ends up</h2>
          <div className="setup-ends">
            {SETUP_ENDS.map(e => (
              <button key={e.id} type="button" className={`setup-end${on(end === e.id)}`}
                aria-pressed={end === e.id} onClick={() => touch(setEnd)(e.id)}>
                <span className="setup-end-mark" aria-hidden="true">{end === e.id ? "[✓]" : "[ ]"}</span>
                <span className="setup-end-txt">
                  <span className="setup-end-lbl">{e.label}</span>
                  <span className="setup-end-note">{e.note}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <button type="button" className={`setup-cta${saved ? " saved" : ""}`}
          onClick={() => { onSave({ year: String(year), model, stage: st, fuel, goal: en.ceiling }); setSaved(true); }}>
          {saved ? "✓ Saved" : "Build my parts list"}
        </button>
      </div>
    </div>
  );
}

// ── ACTIVATION (04-screens.md #4b) ──────────────────────────────────────────
// A new owner must NOT land on the populated Garage — that screen reads as
// "you're 3 of 32 done" before they have done anything. This is the zero-mods
// screen: one solved problem, paced, with the anxiety answered inline.
//
// It renders from the SAME recommendation object as every other screen (step 5),
// so the app never proposes two different first moves.
function ActivationScreen({ model, baseHp, nextRec, recs, profileName, onStart, onOptions, onBrowse, onSkip }) {
  const variant = nextRec?.variant || null;
  // "+N hp ready today" is the catalog's gain for THIS model and THIS part.
  const readyHp = variant ? (variant.hp?.[model.id] || 0) : 0;
  const unlocked = baseHp + readyHp;

  // The share of logged builds running THIS slot, straight off the recommendation
  // (pct = builds/MOD_PATH_TOTAL). Summing several slots would double-count the
  // builds that run more than one, which is how you end up claiming "14 out of
  // 10". Change MOD_PATH and this sentence changes with it.
  const inTen = Math.min(10, Math.round((nextRec?.pct || 0) / 10));

  // The anxiety line is taken from the part's own difficulty, never assumed.
  const reversible = variant?.difficulty === "Plug & Play";

  // "+N options" counts the rest of THIS slot's catalogue — the depth the sheet
  // opens onto. Never a bare "All 3".
  const altCount = Math.max(0, (getSlotById(nextRec?.slot)?.variants.length || 1) - 1);

  // The three-step path is the top three recommendations, each carrying the hp
  // it actually unlocks for this model.
  const pathSteps = (recs || []).slice(0, 3).map((r, i) => ({
    key: r.slot,
    label: r.variant?.label || r.name,
    when: ["today", "when ready", "someday"][i],
    gain: r.variant?.hp?.[model.id] || 0,
  }));

  return (
    <div className="garage-area">
      {/* #4b: full-bleed band, 11px 18px, hairline under it. */}
      <div className="act-hero">
        <div className="act-hero-lbl">{profileName || "Your build"} · {model.label}</div>
        <div className="act-hero-row">
          <span className="act-hero-hp">{baseHp}</span>
          <span className="act-hero-unit">hp · factory</span>
          {readyHp > 0 && (
            <span className="act-hero-ready">+{readyHp} hp ready today</span>
          )}
        </div>

      <ProgressionBar
        hp={baseHp} wishlistHp={unlocked} ceiling={CEILINGS.daily}
        wishLabel={`+${readyHp}`} wishGain
        ceilingLabel="DAILY SAFE"
        ariaLabel={`Stock ${baseHp} hp. One part takes this to ${unlocked} hp.`}
      />
      </div>

      {/* #4b's scroll region: 11px 18px 0. */}
      <div className="act-body">
      {/* #4b puts the orange [→] inside the heading itself. */}
      <h2 className="section-title section-title-plain">
        <span className="act-h2-mark" aria-hidden="true">[→]</span> Your first mod is a solved problem
      </h2>
      {variant && (
        <div className="act-card">
          <div className="act-card-top">
            <span className="act-card-brand">{variant.brand}</span>
            <span className="act-card-price">${variant.price.toLocaleString()}</span>
          </div>
          <div className="act-card-title">{nextRec.name}</div>
          <p className="act-card-reason">
            <strong className="act-card-proof">{inTen} out of 10 builds like yours start here.</strong>{" "}
            {nextRec.name} — {variant.label}. The path is settled; you are not
            experimenting.
          </p>
          {/* #4b's meta row is a plain mono line, not a chip: rating, likes,
              then the anxiety answered inline. */}
          <div className="act-card-meta">
            {variant.rating != null && <><span aria-hidden="true">★</span> {variant.rating.toFixed(1)} · </>}
            {reversible ? "PLUG-IN · REVERSIBLE ✓" : `${variant.difficulty.toUpperCase()} INSTALL`}
          </div>
          <div className="act-card-actions">
            <button className="act-cta" onClick={onStart}>Start my build</button>
            {altCount > 0 && (
              <button className="act-alt" onClick={onOptions}>
                +{altCount} option{altCount === 1 ? "" : "s"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Paced, not a checklist: nothing here is overdue. Each step carries the
          gain it actually unlocks, straight off the catalog. */}
      <h2 className="section-title">The path {MOD_PATH_TOTAL} builds took</h2>
      <ol className="act-path">
        {pathSteps.map((s, i) => (
          <li key={s.key} className={`act-step${i === 0 ? " act-step-now" : ""}`}>
            <span className="act-mark" aria-hidden="true">{i === 0 ? "[→]" : "[ ]"}</span>
            <span className="act-what">
              {s.label} <span className="act-when">· {s.when}</span>
            </span>
            {s.gain > 0 && <span className="act-gain">+{s.gain} hp</span>}
          </li>
        ))}
      </ol>

      <button className="act-browse" onClick={onBrowse}>
        See builds like yours ›
      </button>
      <button className="act-skip" onClick={onSkip}>Skip — I already have mods</button>
      </div>
    </div>
  );
}

// ── END-STATE PLANNER (04-screens.md #4f) ───────────────────────────────────
// Goal-first, for the builder who plans backward from a target rather than
// forward from today. Every part is [✓] KEEPS or [✗] ORPH against the end state,
// and the orphaned-$ total is a SUM of the orphaned rows — never typed.
function plannerRows(goalHp, installedMap, wishlistMap) {
  const endStage = stageForGoalHp(goalHp);
  const build = { ...(installedMap || {}), ...(wishlistMap || {}) };
  const rows = Object.entries(build).map(([slotId, varId]) => {
    const slot = getSlotById(slotId);
    const v    = getVariantById(slotId, varId);
    if (!slot || !v) return null;
    // orphanedBy is the catalog's own statement of which end states make this
    // product throwaway money.
    const orphanedBy = VARIANT_FIT[varId]?.orphanedBy || [];
    const orphaned   = !!endStage && orphanedBy.includes(endStage);
    return {
      slotId, varId, name: slot.name, brand: v.brand, label: v.label,
      price: v.price, orphaned,
      reason: orphaned ? "replaced at the goal" : "survives end-state",
      installed: !!(installedMap || {})[slotId],
    };
  }).filter(Boolean);

  const orphanedRows = rows.filter(r => r.orphaned);
  return {
    endStage,
    rows: [...rows.filter(r => !r.orphaned), ...orphanedRows],
    orphanedTotal: orphanedRows.reduce((t, r) => t + r.price, 0),
    orphanedCount: orphanedRows.length,
  };
}

// Representative goal for each band in REC_GOAL_BANDS — the number a builder
// actually names, mapped onto the stage that goal implies.
const GOAL_CHOICES = [550, 700, 900, 1040];

function PlannerScreen({
  goalHp, onSetGoal, model, currentHp, installedMap, wishlistMap, leaderboard,
  nextRec, onOpenSlot, onSkipOrphans, onBack,
}) {
  const [pickingGoal, setPickingGoal] = useState(false);
  const { endStage, rows, orphanedTotal, orphanedCount } =
    plannerRows(goalHp, installedMap, wishlistMap);

  const ceiling = endStage === "big_single" ? CEILINGS.single
    : endStage === "s3_hybrid" ? CEILINGS.hybrid : CEILINGS.daily;

  // A leaderboard car that actually ran a spec at or past the goal — evidence
  // the target is reachable, not a projection.
  const donor = [...leaderboard].sort((a, b) => a.t60130 - b.t60130)[0] || null;

  // Only worth a [→] NEXT row if the recommendation is not already planned.
  const showNext = !!nextRec && !rows.some(r => r.slotId === nextRec.slot);

  return (
    <div className="garage-area">
      <div className="plan-hero">
        <button className="plan-back" onClick={onBack}>‹ Back to garage</button>
        <div className="plan-hero-lbl">{model.label} · GOAL</div>
        <div className="plan-hero-row">
          <span className="plan-hero-hp">{goalHp.toLocaleString()}</span>
          <span className="plan-hero-unit">hp · {endStage === "big_single" ? "big single" : endStage === "s3_hybrid" ? "hybrid turbos" : "reliable daily"}</span>
          <button className="plan-change" aria-expanded={pickingGoal}
            onClick={()=>setPickingGoal(v=>!v)}>Change goal</button>
        </div>
        {pickingGoal && (
          <div className="plan-goals" role="group" aria-label="Choose a power goal">
            {GOAL_CHOICES.map(g => (
              <button key={g} className={`mfbtn${g===goalHp?" on":""}`} aria-pressed={g===goalHp}
                onClick={()=>{ onSetGoal(g); setPickingGoal(false); }}>
                {g.toLocaleString()} hp
              </button>
            ))}
          </div>
        )}

      <ProgressionBar
        hp={currentHp} goalHp={goalHp} ceiling={ceiling} hideTopEnd
        ariaLabel={`Today ${currentHp} hp. Goal ${goalHp} hp.`}
      />

      {donor && (
        <div className="plan-donor">
          <span className="plan-donor-tag">PROVEN DONOR</span>
          <span className="plan-donor-txt">
            {donor.driver} · {donor.car} ran {donor.t60130}s on {donor.turbo} / {donor.fuel}
          </span>
        </div>
      )}
      </div>

      <div className="plan-body">
      <h2 className="section-title">
        <span>Path from the goal back</span>
        {orphanedCount > 0 && (
          <span className="plan-orph-total">
            ${orphanedTotal.toLocaleString()} orphaned
          </span>
        )}
      </h2>

      {rows.length === 0 && !showNext ? (
        <div style={{ color: "var(--text-3)", fontSize: 12, padding: "8px 0 12px" }}>
          Nothing in the build yet. Add parts and this map will show which of them
          survive to {goalHp.toLocaleString()} hp.
        </div>
      ) : (
        <ul className="bmap bmap-plan">
          {rows.map(r => (
            <li key={r.slotId} className={`bmap-row ${r.orphaned ? "bmap-orph" : "bmap-inst"}`}>
              <button type="button" className="bmap-body" onClick={() => onOpenSlot(r.slotId)}>
                <span className={`bmap-marker bmap-marker-wide ${r.orphaned ? "bmap-marker-orph" : "bmap-marker-inst"}`}
                  aria-hidden="true">{r.orphaned ? "[✗] ORPH" : "[✓] KEEPS"}</span>
                <span className="bmap-text">
                  <span className="bmap-name">{r.name}</span>
                  <span className="bmap-sub">{r.varId} · {r.reason}</span>
                </span>
                {/* Orphaned money reads red; kept money is just money. */}
                <span className={`bmap-price${r.orphaned ? " bmap-price-orph" : ""}`}>
                  ${r.price.toLocaleString()}
                </span>
                <span className="sr-only">
                  {r.orphaned
                    ? `orphaned at ${goalHp} horsepower, ${r.price} dollars`
                    : "kept at the goal"}
                </span>
              </button>
            </li>
          ))}

          {/* The third instance of the single next-up contract (#4f): same
              nextRec object as the Garage map, same product name and price. */}
          {showNext && (
            <li className="bmap-row bmap-next">
              <button type="button" className="bmap-body" onClick={() => onOpenSlot(nextRec.slot)}>
                <span className="bmap-marker bmap-marker-wide bmap-marker-next" aria-hidden="true">[→] NEXT</span>
                <span className="bmap-text">
                  <span className="bmap-name">{nextRec.variant?.label || nextRec.name}</span>
                  <span className="bmap-sub">
                    {nextRec.variant?.id || nextRec.slot} · buy once, at the goal
                  </span>
                </span>
                {nextRec.variant?.price != null && (
                  <span className="bmap-price">${nextRec.variant.price.toLocaleString()}</span>
                )}
                <span className="sr-only">next up toward the goal</span>
              </button>
            </li>
          )}
        </ul>
      )}

      {orphanedCount > 0 && (
        <button className="act-cta" style={{ marginTop: 12 }} onClick={onSkipOrphans}>
          Lock this plan — skip the orphans
        </button>
      )}
      </div>
    </div>
  );
}

// ── HELPERS ──────────────────────────────────────────────────────────────────
function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── PUBLIC PAGE SHEET ──────────────────────────────────────────────────────
// Bottom-sheet preview of a build's public profile page.
// Opened by the owner (Profile → "Preview public page →") or community browsers
// (Board → Builds → tap a card).
function PublicPageSheet({ profile, installedMap, bestRun60130, runs, onClose }) {
  const [pubTab, setPubTab] = useState("build");
  const dialogRef = useDialog(onClose);
  const uid = useId();
  const model = MODELS.find(m => m.id === (profile.car || "s7")) || MODELS.find(m=>m.id==="s7");
  const handle = profile.name
    ? `@${profile.name.toLowerCase().replace(/\s+/g, "_")}`
    : "@yourname";
  const installedSlots = Object.entries(installedMap || {})
    .filter(([, vid]) => !!vid)
    .map(([slotId, vid]) => {
      const slot = getSlotById(slotId);
      if (!slot) return null;
      const variant = getVariantById(slotId, vid);
      return { name: slot.name, brand: variant?.brand || "" };
    })
    .filter(Boolean);
  const modCount = installedSlots.length;
  const best60130 = runs.filter(r => r.type === "60-130" && r.time != null).sort((a,b) => a.time - b.time)[0];
  const bestTime  = best60130 ? `${best60130.time}s` : (bestRun60130 ? `${bestRun60130.time}s` : "—");
  const fuelGuess = (runs.find(r => r.fuel) || {}).fuel || "—";
  const slug = `proof.build/${handle}/${model.label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="pub-overlay" onClick={onClose}>
      <div className="pub-sheet" role="dialog" aria-modal="true" aria-labelledby={`${uid}-title`}
        tabIndex={-1} ref={dialogRef} onClick={e => e.stopPropagation()}>
        <button className="pub-close" onClick={onClose} aria-label="Close build preview">
          <span aria-hidden="true">×</span>
        </button>
        <div className="pub-hero">
          <div className="pub-handle">{handle}</div>
          <div className="pub-hname" id={`${uid}-title`}>{profile.name || "Your Name"}</div>
          <div className="pub-hcar">
            {profile.year} {model.label}
            {profile.tuner ? ` · ${profile.tuner}` : ""}
            {profile.color ? ` · ${profile.color}` : ""}
          </div>
        </div>
        <div className="pub-stats-row">
          <div className="pub-stat-cell">
            <div className="pub-stat-val" style={{color:"var(--green)"}}>{bestTime}</div>
            <div className="pub-stat-lbl">Best 60–130</div>
          </div>
          <div className="pub-stat-cell">
            <div className="pub-stat-val" style={{color:"var(--measure)"}}>{modCount || "—"}</div>
            <div className="pub-stat-lbl">Mods</div>
          </div>
          <div className="pub-stat-cell">
            <div className="pub-stat-val" style={{color:"var(--blue)"}}>{fuelGuess}</div>
            <div className="pub-stat-lbl">Fuel</div>
          </div>
        </div>
        <div className="pub-ptabs">
          <button className={`pub-ptab${pubTab==="build"?" on":""}`} aria-pressed={pubTab==="build"} onClick={()=>setPubTab("build")}>Build</button>
          <button className={`pub-ptab${pubTab==="runs"?" on":""}`} aria-pressed={pubTab==="runs"} onClick={()=>setPubTab("runs")}>Runs ({runs.length})</button>
        </div>
        <div className="pub-body">
          {pubTab === "build" && (installedSlots.length === 0
            ? <div className="pub-empty">No mods logged yet.</div>
            : installedSlots.map((s, i) => (
              <div key={i} className="pub-mod-row">
                <div className="pub-mod-dot"/>
                <div>
                  <div className="pub-mod-name">{s.name}</div>
                  {s.brand && <div className="pub-mod-brand">{s.brand}</div>}
                </div>
              </div>
            ))
          )}
          {pubTab === "runs" && (runs.length === 0
            ? <div className="pub-empty">No runs logged yet.</div>
            : runs.slice(0, 10).map((r, i) => (
              <div key={i} className="pub-mod-row">
                <div className="pub-mod-dot"/>
                <div>
                  <div className="pub-mod-name">
                    {r.time != null ? `${r.time}s` : r.et != null ? `${r.et}s ET` : "—"}
                    {" "}<span style={{fontSize:10,color:"var(--muted)",fontFamily:"var(--font-ui)",fontWeight:300}}>{r.type}</span>
                  </div>
                  <div className="pub-mod-brand">
                    {r.date}{r.fuel ? ` · ${r.fuel}` : ""}{r.da ? ` · DA: ${r.da}` : ""}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="pub-footer">
          <div className="pub-flogo">PROOF<span style={{color:"var(--fill-neutral)"}}>.</span>BUILD</div>
          <button className="pub-fcta" onClick={()=>{ try{navigator.clipboard?.writeText(slug);}catch{} }}>Copy link</button>
        </div>
      </div>
    </div>
  );
}

// ── LEADERBOARD CLASSES (04-screens.md #4e) ─────────────────────────────────
// A car lands in a class because of the turbo it actually runs, not a label
// somebody typed. "Full weight" is the whole field — the default view.
const LB_CLASSES = [
  { id: "all",    label: "Full weight" },
  { id: "oem",    label: "OEM turbo"   },
  { id: "single", label: "Big single"  },
];

// Single-turbo upgrades name a frame (G30, G42, XR/Xona, G45, EFR…) or a bare
// inducer size ("71mm"). A hybrid is still an OEM-location turbo, which is what
// the "OEM turbo" class is actually asking, so stock-frame rebuilds stay there.
function lbClassOf(run) {
  const t = String(run.turbo || "").toLowerCase().trim();
  if (!t) return "oem";
  if (/stock|oem|hybrid|^ts\d|k04|is38/.test(t)) return "oem";
  if (/^g\d|garrett|xona|^xrc?\d|efr|precision|borg|^\d{2,3}\s?mm|single/.test(t)) return "single";
  return "oem";
}

// ── COMMUNITY BUILD CARD ────────────────────────────────────────────────────
function CommunityBuildCard({ build, onView, userCar, nextRec }) {
  const model = MODELS.find(m => m.id === build.car) || MODELS.find(m=>m.id==="s7");
  const slotNames = Object.entries(build.installed_map || {})
    .filter(([, vid]) => !!vid)
    .map(([sid]) => getSlotById(sid)?.name || sid)
    .filter(Boolean);
  const likeYours = userCar && build.car === userCar;
  const proven = build.bestT60130 != null;

  // #4d: "that row is the reason to tap; it must out-read the hp/time figures."
  // Only true when this build actually runs the part we are recommending.
  const theirVarId = nextRec ? (build.installed_map || {})[nextRec.slot] : null;
  const theirPart  = theirVarId ? getVariantById(nextRec.slot, theirVarId) : null;
  const relevance  = theirPart
    ? `${theirPart.brand} ${theirPart.label}${proven ? ` → ran ${build.bestT60130} after` : ""}`
    : null;

  // The mod summary is the caps mono line #4d puts under the numbers.
  const summary = slotNames.slice(0, 3).map(n => n.toUpperCase()).join(" · ");

  return (
    <button type="button" className={`cmt-card${relevance ? " cmt-rel" : ""}`} onClick={onView}
      aria-label={`View ${build.name || "Anonymous"}'s build — ${build.year || ""} ${model.label}, ${build.modCount} mods${relevance ? `. Has your next part: ${relevance}` : ""}`}>
      <div className="cmt-top">
        <span className="cmt-name">
          {build.name || "Anonymous"}
          <span className="cmt-car">{build.year ? `${build.year} ` : ""}{model.label}{build.tuner ? ` · ${build.tuner}` : ""}</span>
        </span>
        {likeYours
          ? <span className="cmt-tag cmt-tag-rel">LIKE YOURS</span>
          : !proven && <span className="cmt-tag">IN PROGRESS</span>}
      </div>

      <div className="cmt-stats">
        <span className="cmt-stat cmt-stat-hp">
          {build.estHp != null ? build.estHp.toLocaleString() : "—"}<span className="cmt-unit">hp</span>
        </span>
        <span className="cmt-stat">
          {proven ? build.bestT60130 : "—"}<span className="cmt-unit">s</span>
        </span>
        {proven && <span className="cmt-proven">✓ PROVEN</span>}
        <span className="cmt-mods">{build.modCount} mods</span>
      </div>

      {relevance && (
        <div className="cmt-next">
          <span className="cmt-next-tag">HAS YOUR NEXT PART</span>
          <span className="cmt-next-txt">{relevance}</span>
          <span className="cmt-next-arr" aria-hidden="true">▸</span>
        </div>
      )}
      {!relevance && summary && <div className="cmt-summary">{summary}</div>}
    </button>
  );
}

// ── APP ──────────────────────────────────────────────────────────────────
// ── ADMIN PANEL ─────────────────────────────────────────────────────────────
function AdminPanel({ adminPicks, onSetPick, onClose }) {
  const [searchQ, setSearchQ] = useState("");
  const [toast, setToast] = useState(false);
  const dialogRef = useDialog(onClose);
  const uid = useId();

  const filtered = searchQ
    ? SLOTS.filter(s =>
        s.name.toLowerCase().includes(searchQ.toLowerCase()) ||
        s.cat.toLowerCase().includes(searchQ.toLowerCase()))
    : SLOTS;

  async function handlePick(slotId, varId, currently) {
    await onSetPick(slotId, currently ? null : varId);
    setToast(true);
    setTimeout(() => setToast(false), 1400);
  }

  return (
    <div className="admin-overlay" role="dialog" aria-modal="true"
      aria-labelledby={`${uid}-title`} tabIndex={-1} ref={dialogRef}>
      <div className="admin-hdr">
        <div className="admin-title" id={`${uid}-title`}>Recommended <span>Picks</span></div>
        <button className="admin-close" onClick={onClose} aria-label="Close admin panel">
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <input className="admin-search" id={`${uid}-search`} aria-label="Search slots or categories"
        placeholder="Search slots or categories…"
        value={searchQ} onChange={e=>setSearchQ(e.target.value)} />
      <div className="admin-body">
        {filtered.map(slot => (
          <div key={slot.id} className="admin-slot">
            <div className="admin-slot-hdr">
              <span className="admin-slot-name">{slot.name}</span>
              <span className="admin-slot-cat">{slot.cat}</span>
            </div>
            {(slot.variants||[]).map(v => {
              const on = adminPicks[slot.id] === v.id;
              return (
                <button type="button" key={v.id} className={`admin-var${on?" on":""}`}
                  aria-pressed={on}
                  aria-label={`${on ? "Remove" : "Set"} ${v.brand} ${v.label} as the recommended pick for ${slot.name}`}
                  onClick={()=>handlePick(slot.id, v.id, on)}>
                  <div className="admin-var-info">
                    <div className="admin-var-brand">{v.brand}</div>
                    <span className="admin-var-label">{v.label}</span>
                    <span className="admin-var-price">${v.price?.toLocaleString()}</span>
                  </div>
                  <div className="admin-check" aria-hidden="true">{on ? "★" : "○"}</div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className={`admin-toast${toast?" show":""}`}>Saved ✓</div>
    </div>
  );
}

export default function TheProof() {
  // Stable id prefix for label/control association across the run-log and
  // profile forms (both live in this component).
  const formUid = useId();
  const [activeCat, setActiveCat]   = useState("Engine");
  const [openSlot, setOpenSlot]     = useState(null);
  const [activeTab, setActiveTab]   = useState("garage");
  const [installedMap, setInstalledMap] = useState({});
  const [wishlistMap,  setWishlistMap]  = useState({});
  const [buildMode, setBuildMode]   = useState("installed");
  const [profile, setProfile]       = useState({
    name: "", car: "s7", year: "2016", color: "", nickname: "", tuner: "", note: "", public: false
  });
  const [profileSaved, setProfileSaved] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authSent, setAuthSent] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [runs, setRuns]             = useState([]);
  const [runForm, setRunForm]       = useState({
    date: new Date().toISOString().slice(0,10),
    type:"60-130", time:"", mph:"", et8th:"", et:"", trap:"",
    da:"", surface:"Street", fuel:"", tires:"", note:"", videoUrl:"", splits:{}, tuneType:""
  });
  const [runFormOpen, setRunFormOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [runSortKey,    setRunSortKey]    = useState("date");
  const [runSurfFilter, setRunSurfFilter] = useState("All");
  const [runFuelFilter, setRunFuelFilter] = useState("All");
  const [liveLeaderboard, setLiveLeaderboard] = useState(LEADERBOARD);
  const [draggyImage, setDraggyImage] = useState(null);   // base64 data URL
  const [draggyParsing, setDraggyParsing] = useState(false);
  const [draggyError, setDraggyError] = useState("");
  const [perfMetric, setPerfMetric]   = useState("et");   // "et" | "t60130"
  const [boardView, setBoardView]       = useState("builds"); // "builds" | "times"
  const [adminPicks, setAdminPicks]     = useState({});
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const isAdminMode = typeof window !== "undefined" && window.location.search.includes("admin");
  const [buildSort, setBuildSort]       = useState("like");   // "like" | "fast" | "mods"
  const [lbClass, setLbClass]           = useState("all");    // see LB_CLASSES
  const [communityBuilds, setCommunityBuilds]   = useState([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [viewedBuild, setViewedBuild]   = useState(null);  // {profile, installedMap} for community sheet
  const [showPublicPage, setShowPublicPage]     = useState(false); // own public page preview
  // True while any modal sheet is up — drives `inert` on the three app-shell
  // siblings so background controls can't be tabbed into or reached by AT.
  const dialogOpen = showPublicPage || !!viewedBuild || showAdminPanel || !!openSlot;
  // Custom-tune add-on features (provider + selected feature ids). Persisted to
  // localStorage — no DB migration, doesn't touch existing run/profile data.
  // Lazy initializer (runs once) so we don't add a set-state-in-effect.
  const [customFeatures, setCustomFeaturesState] = useState(() => {
    try {
      const raw = localStorage.getItem("proof-custom-features");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore malformed / unavailable storage */ }
    return { provider: SCORPION.name, selected: {} };
  });
  function setCustomFeatures(next) {
    setCustomFeaturesState(prev => {
      const val = typeof next === "function" ? next(prev) : next;
      try { localStorage.setItem("proof-custom-features", JSON.stringify(val)); } catch { /* ignore */ }
      return val;
    });
  }
  // Activation-nudge dismissal, persisted (lazy init, no effect). It's auto-cleared
  // when the user installs a part (see pick / installFromWishlist), so it can reappear
  // if they ever return to an empty build — tasteful, not a permanent one-time dismissal.
  const [activationDismissed, setActivationDismissed] = useState(() => {
    try { return localStorage.getItem("proof-activation-nudge") === "dismissed"; }
    catch { return false; }
  });
  function dismissActivation() {
    setActivationDismissed(true);
    try { localStorage.setItem("proof-activation-nudge", "dismissed"); } catch { /* ignore */ }
    track("activation_nudge_dismissed");
  }
  function clearActivationDismissal() {
    setActivationDismissed(false);
    try { localStorage.removeItem("proof-activation-nudge"); } catch { /* ignore */ }
  }
  // Part "likes" (thumbs up), keyed by variant id.
  //   likedParts — THIS user's like state. Seeded from localStorage so the UI is
  //                correct on first paint, then reconciled against the DB.
  //   likeCounts — the COMMUNITY aggregate per variant, tallied from `part_likes`
  //                (variant_id, user_id, unique(variant_id,user_id); public read,
  //                anon insert/delete). Updated optimistically on toggle.
  // Degrades gracefully: if part_likes is unreachable we keep showing the user's own
  // like state from localStorage, hide the aggregate, and never throw.
  const [likedParts, setLikedPartsState] = useState(() => {
    try {
      const raw = localStorage.getItem("proof-liked-parts");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore malformed / unavailable storage */ }
    return {};
  });
  const [likeCounts, setLikeCounts] = useState({});
  // Announced through the polite live region when a like count moves.
  const [likeAnnounce, setLikeAnnounce] = useState("");
  const [likesLive, setLikesLive]   = useState(false);

  function persistMyLikes(next) {
    try { localStorage.setItem("proof-liked-parts", JSON.stringify(next)); } catch { /* ignore */ }
  }

  // Pull every like row and tally client-side — one round trip gives both the
  // aggregate per variant AND this user's own likes. The catalog is a few hundred
  // variants; if this table ever gets large, switch to a per-visible-variant
  // count query (.select("variant_id", { count:"exact", head:true })).
  async function loadLikes() {
    try {
      const { data, error } = await sb.from("part_likes").select("variant_id,user_id");
      if (error) throw error;
      const uid = getUserId();
      const counts = {}, mine = {};
      (data || []).forEach(r => {
        counts[r.variant_id] = (counts[r.variant_id] || 0) + 1;
        if (r.user_id === uid) mine[r.variant_id] = true;
      });
      // Carry up any likes made before this table was wired in (localStorage-only),
      // so nobody loses their existing likes on the transition.
      let local = {};
      try { local = JSON.parse(localStorage.getItem("proof-liked-parts") || "{}") || {}; } catch { /* ignore */ }
      const orphans = Object.keys(local).filter(id => local[id] && !mine[id]);
      if (orphans.length) {
        const { error: mErr } = await sb.from("part_likes")
          .upsert(orphans.map(id => ({ variant_id:id, user_id:uid })),
                  { onConflict:"variant_id,user_id", ignoreDuplicates:true });
        if (!mErr) orphans.forEach(id => { mine[id] = true; counts[id] = (counts[id] || 0) + 1; });
      }
      setLikeCounts(counts);
      setLikedPartsState(mine);
      persistMyLikes(mine);
      setLikesLive(true);
    } catch (e) {
      // Table unreachable / RLS change / offline — show the user's own likes only.
      console.warn("part_likes load failed — showing local like state only:", e);
      setLikesLive(false);
    }
  }

  function toggleLike(variantId) {
    const uid      = getUserId();
    const wasLiked = !!likedParts[variantId];
    const delta    = wasLiked ? -1 : 1;

    // Optimistic: own state + aggregate move immediately.
    setLikedPartsState(prev => {
      const next = { ...prev };
      if (wasLiked) delete next[variantId]; else next[variantId] = true;
      persistMyLikes(next);
      return next;
    });
    setLikeCounts(prev => {
      const next = { ...prev, [variantId]: Math.max(0, (prev[variantId] || 0) + delta) };
      // Like-count changes announce the same way the hp estimate does.
      const slotId = SLOTS.find(s => s.variants.some(x => x.id === variantId))?.id;
      const v = slotId ? getVariantById(slotId, variantId) : null;
      const name = v ? `${v.brand} ${v.label}` : "part";
      setLikeAnnounce(`${wasLiked ? "Removed like from" : "Liked"} ${name}. ${next[variantId]} like${next[variantId]===1?"":"s"}.`);
      return next;
    });
    track("part_like_toggled", { variant: variantId, liked: !wasLiked });

    (async () => {
      try {
        const { error } = wasLiked
          ? await sb.from("part_likes").delete().eq("variant_id", variantId).eq("user_id", uid)
          : await sb.from("part_likes").insert({ variant_id: variantId, user_id: uid });
        if (error) throw error;
        setLikesLive(true);
      } catch (e) {
        // Roll the aggregate back — the user's own like stays (localStorage).
        console.warn("part_likes write failed — like kept locally only:", e);
        setLikeCounts(prev => ({ ...prev, [variantId]: Math.max(0, (prev[variantId] || 0) - delta) }));
        setLikesLive(false);
      }
    })();
  }
  // Optional user-set power goal (crank HP) feeding the recommendation engine.
  // See readPowerGoal() — hook only for now; the engine infers from the wishlist.
  const [powerGoal, setPowerGoalState] = useState(readPowerGoal);
  function setPowerGoal(n) {
    setPowerGoalState(n);
    try { localStorage.setItem("proof-power-goal", String(n)); } catch { /* private mode */ }
    track("power_goal_set", { goal: n });
  }
  // Garage tab sub-view: the end-state planner lives here rather than claiming a
  // sixth tab slot, which would break the five-item tab bar in 03-components.md.
  const [garageView, setGarageView] = useState("garage");
  const [runsLoading, setRunsLoading] = useState(true);
  const [saveFeedback, setSaveFeedback] = useState(""); // "Saved!" toast

  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = CSS;
    document.head.appendChild(el);
    // Identify user in PostHog so sessions are tied to the same person
    if (PH_KEY) posthog.identify(getUserId());
    track("app_loaded");
    return () => document.head.removeChild(el);
  }, []);

  // ── LOAD RUNS (also callable for manual refresh) ─────────────────
  async function loadRuns() {
    const uid = getUserId();
    setRunsLoading(true);
    try {
      // Fetch without .order() — order() on non-existent column silently returns null data
      const { data: runRows, error: runErr } = await sb.from("runs").select("*").eq("user_id", uid);
      if (runErr) { console.warn("Runs fetch error:", runErr); }
      const mapped = (runRows || []).map(r => {
        const { note, splits, tuneType } = unpackNote(r.note || "");
        // Handle both possible column names: time_val (new) and time (original schema)
        const timeVal = r.time_val != null ? r.time_val : (r.time != null ? r.time : null);
        return { id:r.id, date:r.date, type:r.run_type, time:timeVal, mph:r.mph,
          et8th:r.et8th, et:r.et, trap:r.trap, da:r.da, surface:r.surface,
          fuel:r.fuel, tires:r.tires, note, splits, tuneType, videoUrl:r.video_url };
      });
      // Sort client-side: most recent date first
      mapped.sort((a,b)=>(b.date||"").localeCompare(a.date||""));
      // Merge: preserve local time values if DB has null (schema mismatch protection)
      // Also keep any temp runs (optimistic saves in flight) not yet in DB
      setRuns(prev => {
        const dbIds = new Set(mapped.map(r => r.id));
        const tempRuns = prev.filter(p => String(p.id).startsWith("temp_"));
        const merged = mapped.map(dbRun => {
          const local = prev.find(p => p.id === dbRun.id);
          if (local && dbRun.time == null && local.time != null) {
            return { ...dbRun, time: local.time }; // keep local time if DB lost it
          }
          return dbRun;
        });
        return [...tempRuns, ...merged].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
      });
    } catch(e) { console.warn("Runs load error:", e); }
    finally { setRunsLoading(false); }
  }

  async function loadAdminPicks() {
    const { data } = await sb.from("admin_picks").select("slot_id,variant_id");
    if (data?.length) setAdminPicks(Object.fromEntries(data.map(r=>[r.slot_id,r.variant_id])));
  }

  async function saveAdminPick(slotId, variantId) {
    if (variantId) {
      await sb.from("admin_picks").upsert({ slot_id:slotId, variant_id:variantId, updated_at:new Date().toISOString() }, { onConflict:"slot_id" });
      setAdminPicks(p=>({...p,[slotId]:variantId}));
    } else {
      await sb.from("admin_picks").delete().eq("slot_id",slotId);
      setAdminPicks(p=>{ const n={...p}; delete n[slotId]; return n; });
    }
  }

  async function loadCommunityBuilds() {
    if (communityLoading) return;
    setCommunityLoading(true);
    try {
      // profiles + builds are USING(true) RLS — all rows readable. runs adds each
      // owner's performance (best 60-130 + best trap); degrades gracefully to none
      // if the runs table isn't readable to this client.
      const [{ data: profs }, { data: blds }, { data: runRows }] = await Promise.all([
        sb.from("profiles").select("user_id,name,car,year,color,tuner,note,public").not("name","is",null).neq("name","").eq("public",true),
        sb.from("builds").select("user_id,installed_map,updated_at"),
        sb.from("runs").select("user_id,run_type,time_val,time,et,trap,mph,fuel,da,date"),
      ]);
      const buildMap = Object.fromEntries((blds || []).map(b => [b.user_id, b]));
      // group each user's runs, mapped to the app's run shape (same as loadRuns)
      const runsByUser = {};
      (runRows || []).forEach(r => {
        const t = r.time_val != null ? r.time_val : (r.time != null ? r.time : null);
        const mapped = { type: r.run_type, time: t, et: r.et, trap: r.trap, mph: r.mph, fuel: r.fuel, da: r.da, date: r.date };
        (runsByUser[r.user_id] || (runsByUser[r.user_id] = [])).push(mapped);
      });
      const joined = (profs || [])
        .map(p => {
          const b = buildMap[p.user_id] || {};
          const installed = b.installed_map || {};
          const modCount = Object.keys(installed).filter(k => installed[k]).length;
          const userRuns = (runsByUser[p.user_id] || []).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
          const best60 = userRuns.filter(r => r.type === "60-130" && r.time != null).sort((a, b) => a.time - b.time)[0];
          const bestTrapRun = userRuns.filter(r => r.trap != null).sort((a, b) => b.trap - a.trap)[0];
          // #4d leads each card with an hp figure. Computed with the same
          // estimator the Garage uses, so a build never shows one number here
          // and another on its own page.
          const car = MODELS.find(m => m.id === p.car) || MODELS.find(m => m.id === "s7");
          const hasTune = Object.keys(installed).some(k => TUNING_SLOTS.has(k));
          const carBase = (NON_RS_4OT.has(p.car) && hasTune) ? NORMALIZED_4OT_BASE : car.hp;
          return {
            ...p, installed_map: installed, modCount, runs: userRuns,
            estHp: modCount ? carBase + calcTotals(installed, p.car).hp : car.hp,
            bestT60130: best60?.time ?? null,
            bestTrap: bestTrapRun?.trap ?? null,
          };
        })
        .filter(p => p.name && p.modCount > 0)
        .sort((a, b) => b.modCount - a.modCount);
      setCommunityBuilds(joined);
    } catch(e) { console.warn("Community builds load error:", e); }
    finally { setCommunityLoading(false); }
  }

  useEffect(() => {
    async function load() {
      const uid = getUserId();
      try {
        // Profile
        const { data: prof } = await sb.from("profiles").select("*").eq("user_id", uid).single();
        if (prof) setProfile({ name:prof.name||"", car:prof.car||"s7", year:prof.year||"2016",
          color:prof.color||"", nickname:prof.nickname||"", tuner:prof.tuner||"", note:prof.note||"" });

        // Build (installed + wishlist)
        const { data: build } = await sb.from("builds").select("*").eq("user_id", uid).single();
        if (build?.installed_map) setInstalledMap(build.installed_map);
        if (build?.wishlist_map)  setWishlistMap(build.wishlist_map);

        // Community leaderboard (falls back to hardcoded LEADERBOARD if empty)
        const { data: lb } = await sb.from("leaderboard").select("*").order("rank");
        if (lb?.length) setLiveLeaderboard(lb.map(r => ({
          rank:r.rank, driver:r.driver, car:r.car, tuner:r.tuner,
          t60130:r.t60130, et:r.et, mph:r.mph, turbo:r.turbo, fuel:r.fuel,
          trans:r.trans, manifolds:r.manifolds, supFuel:r.sup_fuel,
          ic:r.ic, dp:r.dp, da:r.da
        })));
      } catch(e) { console.warn("Supabase load error:", e); }
    }
    load();
    loadRuns();         // separate so it can be called independently
    loadAdminPicks();   // load curator picks for Recommended badge
    loadLikes();        // community like counts + this user's own likes
  }, []);

  const currentModel = MODELS.find(m => m.id === profile.car) || MODELS.find(m=>m.id==="s7");
  const modelId = currentModel.id;

  // Stats for installed
  // The active map being edited depends on buildMode
  const selectedMap = buildMode === "installed" ? installedMap : wishlistMap;
  async function saveBuild(installed, wishlist) {
    const uid = getUserId();
    await sb.from("builds").upsert(
      { user_id:uid, installed_map:installed, wishlist_map:wishlist, updated_at:new Date().toISOString() },
      { onConflict:"user_id" }
    );
  }

  function setSelectedMap(fn) {
    if (buildMode === "installed") {
      setInstalledMap(prev => {
        const next = typeof fn === "function" ? fn(prev) : fn;
        saveBuild(next, wishlistMap);
        return next;
      });
    } else {
      setWishlistMap(prev => {
        const next = typeof fn === "function" ? fn(prev) : fn;
        saveBuild(installedMap, next);
        return next;
      });
    }
  }

  const installedTotals = calcTotals(installedMap, modelId);
  const wishlistTotals  = calcTotals(wishlistMap,  modelId);
  const totals  = buildMode === "installed" ? installedTotals : wishlistTotals;

  // Normalize base HP for non-RS 4.0T when aftermarket tuning mods are present
  // (S6/S7/A8/S8 are the same block — stock differences are OEM turbo/tune only)
  const hasTuningInst = Object.keys(installedMap).some(k => TUNING_SLOTS.has(k));
  const hasTuningAny  = hasTuningInst || Object.keys(wishlistMap).some(k => TUNING_SLOTS.has(k));
  const baseHp        = (NON_RS_4OT.has(modelId) && hasTuningInst) ? NORMALIZED_4OT_BASE : currentModel.hp;
  const baseHpCombined= (NON_RS_4OT.has(modelId) && hasTuningAny)  ? NORMALIZED_4OT_BASE : currentModel.hp;

  const speeds  = calcSpeeds(currentModel, installedTotals.hp, baseHp);
  const totalHp = baseHp + installedTotals.hp;
  // Where the build lands once the wishlist is fitted, and the safe ceiling that
  // the turbo it is running (or planning) actually allows. Both feed the single
  // ProgressionBar used on Garage, Parts, Activation and the Planner.
  const projectedHp  = baseHpCombined + installedTotals.hp + wishlistTotals.hp;
  const buildCeiling = ceilingForBuild({ ...installedMap, ...wishlistMap });

  // ── SINGLE SOURCE OF TRUTH FOR "NEXT STEP" ──────────────────────────────
  // Computed once here and handed to BOTH the recommendation card and the build
  // map. Neither recomputes it, so the screen cannot show two different answers.
  const recs    = recommendNext(installedMap, 3);
  const nextRec = recs[0] || null;

  // Leaderboard placement is gated on evidence: only datalog/slip-backed runs
  // can place, and the number of runs that could NOT place is counted so the
  // consequence can be stated rather than the runs quietly disappearing.
  const myBoardRuns = (() => {
    const sixty = runs.filter(r => r.type === "60-130" && r.time != null);
    const proven = sixty.filter(r => runProof(r).proven)
      .sort((a, b) => parseFloat(a.time) - parseFloat(b.time))[0] || null;
    return { proven, claimCount: sixty.filter(r => !runProof(r).proven).length };
  })();
  const totalTq = currentModel.torque + installedTotals.torque;
  const numInst = Object.keys(installedMap).length;
  const numWish = Object.keys(wishlistMap).length;

  const catSlots = SLOTS.filter(s => s.cat === activeCat);
  const catCounts = {};
  CATEGORIES.forEach(c => {
    catCounts[c] = SLOTS.filter(s => s.cat===c && (installedMap[s.id] || wishlistMap[s.id])).length;
  });

  const hpPct   = Math.min((installedTotals.hp / Math.max(currentModel.hp * 0.8, 1)) * 100, 100);
  const tqPct   = Math.min((installedTotals.torque / Math.max(currentModel.torque * 0.8, 1)) * 100, 100);
  const costPct = Math.min((installedTotals.cost / 20000) * 100, 100);

  function pick(slotId, varId) {
    setSelectedMap(prev => {
      if (prev[slotId] === varId) { const n={...prev}; delete n[slotId]; return n; }
      return { ...prev, [slotId]: varId };
    });
    if (buildMode === "installed" && selectedMap[slotId] !== varId) clearActivationDismissal();
  }
  function remove(slotId) { setSelectedMap(prev => { const n={...prev}; delete n[slotId]; return n; }); }
  // #5b: the row opens a sheet rather than expanding in place.
  function openSheet(id) { setOpenSlot(id); track("part_sheet_opened", { slot: id }); }
  function closeSheet()  { setOpenSlot(null); }
  // Jump straight into the build flow at a specific slot (used by "What's Next").
  function goToSlot(slotId) {
    const slot = getSlotById(slotId);
    if (!slot) return;
    setBuildMode("installed");
    setActiveCat(slot.cat);
    setActiveTab("parts");
    setOpenSlot(slotId);
    track("reco_slot_clicked", { slot: slotId });
  }

  useEffect(() => {
    const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setAuthUser(session.user);
        const { data } = await sb.from("profiles").select("*").eq("user_id", session.user.id).single();
        if (data) setProfile(p => ({...p, name:data.name||"", car:data.car||p.car, year:data.year||p.year, color:data.color||"", nickname:data.nickname||"", tuner:data.tuner||"", note:data.note||"", public:data.public||false}));
      } else { setAuthUser(null); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function sendMagicLink() {
    if (!authEmail) return;
    setAuthLoading(true);
    const { error } = await sb.auth.signInWithOtp({ email: authEmail, options: { emailRedirectTo: window.location.origin } });
    setAuthLoading(false);
    if (!error) setAuthSent(true);
  }

  async function saveProfile(updates) {
    const next = {...profile, ...updates};
    setProfile(next);
    const uid = authUser?.id || getUserId();
    await sb.from("profiles").upsert({
      user_id:uid, name:next.name, car:next.car, year:next.year,
      color:next.color, nickname:next.nickname, tuner:next.tuner, note:next.note,
      public:next.public||false, email:authUser?.email||"",
      updated_at:new Date().toISOString()
    }, { onConflict:"user_id" });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  }

  // Pack splits into DB note field and unpack on load
  // Extra fields (splits, tuneType) are packed into the note text column since the
  // DB schema is fixed. Each marker lives on its own line so parsing one can't corrupt
  // another (splits JSON is single-line via JSON.stringify).
  function packNote(note, splits, tuneType) {
    const parts = [];
    if (note) parts.push(note);
    if (tuneType) parts.push('__tune__:' + tuneType);
    if (splits && Object.keys(splits).length) parts.push('__splits__:' + JSON.stringify(splits));
    return parts.join('\n');
  }
  function unpackNote(raw) {
    if (!raw) return { note:'', splits:{}, tuneType:'' };
    let splits = {}, tuneType = '';
    const noteLines = [];
    for (const line of String(raw).split('\n')) {
      if (line.startsWith('__splits__:')) {
        try { splits = JSON.parse(line.slice(11)); } catch { /* ignore malformed */ }
      } else if (line.startsWith('__tune__:')) {
        tuneType = line.slice(9);
      } else {
        noteLines.push(line);
      }
    }
    return { note: noteLines.join('\n').trim(), splits, tuneType };
  }

  function addRun() {
    const toFloat = v => { const n = parseFloat(String(v).replace(/[^\d.-]/g,"")); return isNaN(n) ? null : n; };

    // ── 0. VALIDATE: must have at least one timing value ────────────
    const timeVal = toFloat(runForm.time);
    const etVal   = toFloat(runForm.et);
    const et8Val  = toFloat(runForm.et8th);
    if (timeVal == null && etVal == null && et8Val == null) {
      setSaveFeedback("⚠ Enter a time before saving — or import a Draggy screenshot");
      setTimeout(() => setSaveFeedback(""), 4000);
      return;
    }

    // ── 1. BUILD RUN OBJECT IMMEDIATELY ─────────────────────────────
    const tempId = `temp_${Date.now()}`;
    const r = {
      id:       tempId,
      date:     runForm.date,
      type:     runForm.type,
      time:     timeVal,
      mph:      toFloat(runForm.mph),
      et8th:    et8Val,
      et:       etVal,
      trap:     toFloat(runForm.trap),
      da:       runForm.da,
      surface:  runForm.surface,
      fuel:     runForm.fuel,
      tires:    runForm.tires,
      note:     runForm.note,
      splits:   runForm.splits || {},
      videoUrl: runForm.videoUrl,
      tuneType: runForm.tuneType || "",
    };

    // ── 2. UPDATE UI RIGHT NOW (no await) ────────────────────────────
    setRuns(prev => {
      const next = [r, ...prev];
      next.sort((a,b)=>(b.date||"").localeCompare(a.date||""));
      return next;
    });
    setRunForm({date:new Date().toISOString().slice(0,10),type:"60-130",time:"",mph:"",et8th:"",et:"",trap:"",da:"",surface:"Street",fuel:"",tires:"",note:"",videoUrl:"",splits:{},tuneType:""});
    setRunFormOpen(false);
    setDraggyImage(null);
    setSelectedRunId(tempId);
    setActiveTab("times");
    const timeLabel = r.time != null ? `${r.time}s` : r.et != null ? `${r.et}s ET` : "Run";
    setSaveFeedback(`${timeLabel} logged ✓`);
    setTimeout(() => setSaveFeedback(""), 3500);
    track("run_logged", {
      run_type:    r.type,
      time:        r.time,
      mph:         r.mph,
      et:          r.et,
      et8th:       r.et8th,
      trap:        r.trap,
      surface:     r.surface,
      fuel:        r.fuel,
      da:          r.da,
      has_splits:  Object.keys(r.splits||{}).length > 0,
      has_video:   !!r.videoUrl,
      car_model:   currentModel.id,
    });

    // ── 3. SAVE TO DB IN BACKGROUND ──────────────────────────────────
    // Try time_val first; if schema uses "time" column it will error and we retry
    const uid = getUserId();
    const insertPayload = {
      user_id:uid, date:r.date, run_type:r.type,
      time_val:r.time, mph:r.mph, et8th:r.et8th, et:r.et, trap:r.trap,
      da:r.da, surface:r.surface, fuel:r.fuel, tires:r.tires,
      note: packNote(r.note, r.splits, r.tuneType),
      video_url:r.videoUrl
    };

    const mapSaved = (saved) => {
      const unp = unpackNote(saved.note);
      // Handle both column names time_val and time
      const savedTime = saved.time_val != null ? saved.time_val : (saved.time != null ? saved.time : r.time);
      return {
        id:saved.id, date:saved.date, type:saved.run_type, time:savedTime,
        mph:saved.mph, et8th:saved.et8th, et:saved.et, trap:saved.trap, da:saved.da,
        surface:saved.surface, fuel:saved.fuel, tires:saved.tires,
        note:unp.note, splits:unp.splits, tuneType:unp.tuneType, videoUrl:saved.video_url
      };
    };

    sb.from("runs").insert(insertPayload).select().single()
    .then(({ data: saved, error: saveErr }) => {
      if (saveErr) {
        console.warn("Run DB save error (time_val):", saveErr.message);
        // Retry with "time" column name instead of "time_val"
        const { time_val, ...rest } = insertPayload;
        return sb.from("runs").insert({ ...rest, time: r.time }).select().single();
      }
      return { data: saved, error: null };
    })
    .then(({ data: saved, error: saveErr2 }) => {
      if (saveErr2) { console.warn("Run DB save error (time):", saveErr2.message); return; }
      if (saved) {
        // Swap temp ID → real DB ID so run persists on reload
        const dbRun = mapSaved(saved);
        setRuns(prev => prev.map(x => x.id === tempId ? dbRun : x));
        setSelectedRunId(dbRun.id);
      }
    })
    .catch(e => console.warn("Run save error:", e));
  }

  function deleteRun(id) {
    setRuns(prev => prev.filter(r => r.id !== id));  // immediate
    if (!String(id).startsWith("temp_")) {
      sb.from("runs").delete().eq("id", id).catch(e => console.warn("Delete error:", e));
    }
  }

  async function compressDraggyImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const MAX = 1200;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else       { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  async function parseDraggyScreenshot(file) {
    setDraggyError("");
    setDraggyParsing(true);
    try {
      // Compress first so we don't blow Vercel's 4.5MB body limit
      const base64 = await compressDraggyImage(file);
      setDraggyImage(base64);

      const b64data = base64.split(",")[1];
      const mediaType = "image/jpeg";

      const response = await fetch("/api/parse-draggy", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-5",
          max_tokens:1000,
          messages:[{
            role:"user",
            content:[
              {
                type:"image",
                source:{ type:"base64", media_type:mediaType, data:b64data }
              },
              {
                type:"text",
                text:`You are reading a Draggy GPS performance timer screenshot or a drag strip timing slip. Extract all available performance data and return ONLY a JSON object with no markdown, no explanation, no backticks. Use null for any field not visible.

Fields to extract:
{
  "type": "run type — one of: 60-130, 0-60, 1/8 Mile, 1/4 Mile, Roll Race",
  "time": "primary elapsed time in seconds as a plain decimal number string with no units, e.g. '5.03'",
  "mph": "exit speed in mph as a plain decimal number string with no units, e.g. '130.0'",
  "et8th": "eighth mile elapsed time in seconds if shown, e.g. '6.28'",
  "et": "quarter mile elapsed time in seconds if shown, e.g. '9.67'",
  "trap": "trap speed in mph if this is a strip slip, e.g. '143.0'",
  "da": "density altitude in feet if shown, include unit, e.g. '-261ft'",
  "date": "date in YYYY-MM-DD format if shown",
  "fuel": "fuel type if shown or visible on the screen",
  "surface": "surface type if visible — Street, Prepped Strip, Dragway, or Roll Race",
  "note": "any other relevant data — reaction time, 60ft, slope, conditions",
  "splits": {
    "60_70": "elapsed time for 60-70 mph split in seconds as a number, e.g. 0.51",
    "60_80": "elapsed time for 60-80 mph split in seconds as a number, e.g. 1.04",
    "60_90": "elapsed time for 60-90 mph split in seconds as a number, e.g. 1.66",
    "60_100": "elapsed time for 60-100 mph split in seconds as a number, e.g. 2.38",
    "60_110": "elapsed time for 60-110 mph split in seconds as a number, e.g. 3.15",
    "60_120": "elapsed time for 60-120 mph split in seconds as a number, e.g. 4.07",
    "60_130": "elapsed time for 60-130 mph split in seconds as a number, e.g. 5.03"
  }
}`
              }
            ]
          }]
        })
      });

      const data = await response.json();

      // Propagate API-level errors with detail
      if (!response.ok || data?.error) {
        const msg = data?.error?.message || data?.error || `API error ${response.status}`;
        throw new Error(msg);
      }

      const raw = data?.content?.[0]?.text || "";
      let parsed;
      try {
        parsed = JSON.parse(raw.trim());
      } catch {
        const match = raw.match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) : null;
      }

      if (!parsed) throw new Error("Could not read timing data from image.");

      // Strip units from numeric fields (AI sometimes returns "5.03s", "130 mph")
      const cleanNum = v => v != null ? String(v).replace(/[^\d.-]/g, "") : "";
      // Sanitize splits object — keep only numeric values
      const cleanSplits = raw => {
        if (!raw || typeof raw !== "object") return {};
        const out = {};
        Object.entries(raw).forEach(([k,v]) => {
          const n = parseFloat(String(v).replace(/[^\d.-]/g,""));
          if (!isNaN(n)) out[k] = n;
        });
        return out;
      };

      const splitsOut = cleanSplits(parsed.splits);
      setRunForm(prev => ({
        ...prev,
        ...(parsed.type    && { type:    parsed.type }),
        ...(parsed.time    && { time:    cleanNum(parsed.time) }),
        ...(parsed.mph     && { mph:     cleanNum(parsed.mph) }),
        ...(parsed.et8th   && { et8th:   cleanNum(parsed.et8th) }),
        ...(parsed.et      && { et:      cleanNum(parsed.et) }),
        ...(parsed.trap    && { trap:    cleanNum(parsed.trap) }),
        ...(parsed.da      && { da:      String(parsed.da) }),
        ...(parsed.date    && { date:    parsed.date }),
        ...(parsed.fuel    && { fuel:    parsed.fuel }),
        ...(parsed.surface && { surface: parsed.surface }),
        ...(parsed.note    && { note:    parsed.note }),
        splits: splitsOut,
      }));
      track("draggy_parsed", {
        success: true,
        run_type: parsed.type,
        has_time: !!parsed.time,
        has_splits: Object.keys(splitsOut).length > 0,
        has_da: !!parsed.da,
      });
    } catch(e) {
      track("draggy_parsed", { success: false, error: e.message });
      setDraggyError(e.message || "Failed to parse screenshot. Fill in times manually.");
    } finally {
      setDraggyParsing(false);
    }
  }

  // Move wishlist item to installed
  function installFromWishlist(slotId) {
    const varId = wishlistMap[slotId];
    if (!varId) return;
    const slot = getSlotById(slotId);
    const v    = getVariantById(slotId, varId);
    track("mod_installed", { slot: slotId, slot_name: slot?.name, brand: v?.brand, variant: v?.label, from_wishlist: true });
    const newInstalled = {...installedMap, [slotId]: varId};
    const newWishlist  = {...wishlistMap}; delete newWishlist[slotId];
    setInstalledMap(newInstalled);
    setWishlistMap(newWishlist);
    saveBuild(newInstalled, newWishlist);
    clearActivationDismissal();
  }

  const allIssues = [];
  Object.keys(selectedMap).forEach(slotId => {
    const { missing, conflicts } = getDeps(slotId, selectedMap);
    const slot = getSlotById(slotId);
    if (!slot) return;
    missing.forEach(m => allIssues.push({type:"warn", msg:`${slot.name} needs: ${getSlotById(m)?.name||m}`}));
    conflicts.forEach(c => allIssues.push({type:"conflict", msg:`${slot.name} conflicts with ${getSlotById(c)?.name||c}`}));
  });

  const bestRun60130 = runs.filter(r=>r.type==="60-130" && r.time != null).sort((a,b)=>parseFloat(a.time)-parseFloat(b.time))[0];
  const bestRun14    = runs.filter(r=>r.et != null).sort((a,b)=>parseFloat(a.et)-parseFloat(b.et))[0];

  // ── SHARED RUN LIST (used in both Garage and Times tabs) ──────────
  const SPLIT_KEYS_G   = ["60_70","60_80","60_90","60_100","60_110","60_120","60_130"];
  const SPLIT_LABELS_G = {"60_70":"60–70","60_80":"60–80","60_90":"60–90","60_100":"60–100","60_110":"60–110","60_120":"60–120","60_130":"60–130"};
  const getRunVal = (r, key) => {
    if (key==="date") return r.date||"";
    if (key==="time") return r.time!=null ? r.time : 999;
    if (key==="da")   { const n=parseFloat(String(r.da||"").replace(/[^\d.-]/g,"")); return isNaN(n)?999:n; }
    if (key==="mph")  return r.mph!=null ? -r.mph : 999;
    if (key==="et")   return r.et!=null ? r.et : 999;
    if (key==="trap") return r.trap!=null ? -r.trap : 999;
    if (SPLIT_KEYS_G.includes(key)) { const v=r.splits?.[key]; return v!=null?v:999; }
    return 0;
  };
  let filteredRuns = [...runs];
  filteredRuns = [...filteredRuns].sort((a,b)=>{
    const av=getRunVal(a,runSortKey), bv=getRunVal(b,runSortKey);
    return runSortKey==="date" ? bv.localeCompare(av) : av-bv;
  });

  const runFilterBarJSX = runs.length > 0 ? (
    <div className="run-ctrl-bar">
      <span className="run-ctrl-label">Sort</span>
      <select className="run-ctrl-select" aria-label="Sort runs by" value={runSortKey} onChange={e=>setRunSortKey(e.target.value)}>
        <option value="date">Date</option>
        <option value="time">Time</option>
        <option value="da">DA</option>
        <option value="60_70">60–70</option>
        <option value="60_80">60–80</option>
        <option value="60_90">60–90</option>
        <option value="60_100">60–100</option>
        <option value="60_110">60–110</option>
        <option value="60_120">60–120</option>
        <option value="60_130">60–130 (split)</option>
        <option value="mph">Exit MPH</option>
        <option value="et">1/4 ET</option>
        <option value="trap">Trap MPH</option>
      </select>
    </div>
  ) : null;

  const runCardsJSX = filteredRuns.map(run => {
    const isOpen   = selectedRunId===run.id;
    const hasSplits = run.splits && Object.keys(run.splits).length>0;
    const proof     = runProof(run);
    return (
      <div key={run.id} id={`run-${run.id}`}
        className={`run-card${isOpen?" selected":""}${proof.proven?"":" run-claim"}`}>
        <button className="run-del" aria-label={`Delete the ${run.type} run logged ${run.date}`}
          onClick={e=>{e.stopPropagation();deleteRun(run.id);}}>
          <span aria-hidden="true">×</span>
        </button>
        <button type="button" className="run-toggle"
          aria-expanded={isOpen} aria-controls={`run-detail-${run.id}`}
          onClick={()=>setSelectedRunId(isOpen?null:run.id)}>
        <div className="run-top">
          <span className="run-date">{run.date}</span>
          <span className="run-proof-row">
            <span className="run-type">{run.type}</span>
            <span className={`proof-chip${proof.proven?" proof-log":" proof-claim"}`}>
              <span aria-hidden="true">{proof.label}</span>
              <span className="sr-only">{proof.words}</span>
            </span>
          </span>
        </div>
        <div className="run-times">
          {run.time!=null && (
            <div>
              <div className="run-time-big">{run.time}s</div>
              <div className="run-time-lbl">{run.type}</div>
            </div>
          )}
          {run.et!=null && (
            <div>
              <div className="run-time-big" style={{color:"var(--blue)"}}>{run.et}s</div>
              <div className="run-time-lbl">1/4 ET</div>
            </div>
          )}
          {run.et8th!=null && (
            <div>
              <div className="run-time-big" style={{color:"var(--blue)"}}>{run.et8th}s</div>
              <div className="run-time-lbl">1/8 ET</div>
            </div>
          )}
          {run.mph!=null && !run.et && !run.et8th && (
            <div>
              <div className="run-time-big" style={{color:"var(--measure)"}}>{run.mph}</div>
              <div className="run-time-lbl">mph</div>
            </div>
          )}
          {run.trap!=null && (
            <div>
              <div className="run-time-big" style={{color:"var(--measure)"}}>{run.trap}</div>
              <div className="run-time-lbl">trap mph</div>
            </div>
          )}
        </div>
        <div className="run-chips">
          {run.surface && <span className="run-chip">{run.surface}</span>}
          {run.fuel    && <span className="run-chip">{run.fuel}</span>}
          {run.tires   && <span className="run-chip">{run.tires}</span>}
          {run.da      && <span className="run-chip">DA: {run.da}</span>}
          {hasSplits   && <span className="run-chip" style={{color:"var(--text-2)"}}>splits ▾</span>}
        </div>
        </button>
        {/* Detail sits OUTSIDE the toggle button — it holds its own links, and
            nesting interactive content inside a button is invalid. */}
        {isOpen && (
          <div className="run-detail" id={`run-detail-${run.id}`}>
            {/* #4c: "TRAP CHART IN DETAIL VIEW" — it is no longer a top-level
                toggle on Times, it lives here, against the run you opened. */}
            <TrapChart leaderboard={liveLeaderboard} bestRun60130={run} />
            <div className="run-detail-grid">
              {run.surface && <div className="rdg-item"><span className="rdg-label">Surface</span><span className="rdg-val">{run.surface}</span></div>}
              {run.fuel    && <div className="rdg-item"><span className="rdg-label">Fuel</span><span className="rdg-val">{run.fuel}</span></div>}
              {run.tuneType && <div className="rdg-item"><span className="rdg-label">Tune</span><span className="rdg-val">{run.tuneType}</span></div>}
              {run.tires   && <div className="rdg-item"><span className="rdg-label">Tires</span><span className="rdg-val">{run.tires}</span></div>}
              {run.da      && <div className="rdg-item"><span className="rdg-label">Density Alt.</span><span className="rdg-val">{run.da}</span></div>}
              {run.mph!=null   && <div className="rdg-item"><span className="rdg-label">Exit MPH</span><span className="rdg-val">{run.mph} mph</span></div>}
              {run.trap!=null  && <div className="rdg-item"><span className="rdg-label">Trap MPH</span><span className="rdg-val">{run.trap} mph</span></div>}
              {run.et!=null    && <div className="rdg-item"><span className="rdg-label">1/4 ET</span><span className="rdg-val">{run.et}s</span></div>}
              {run.et8th!=null && <div className="rdg-item"><span className="rdg-label">1/8 ET</span><span className="rdg-val">{run.et8th}s</span></div>}
              {run.time!=null  && <div className="rdg-item"><span className="rdg-label">{run.type}</span><span className="rdg-val">{run.time}s</span></div>}
            </div>
            {hasSplits && (
              <>
                <div className="splits-title">Speed Splits</div>
                <table className="splits-table">
                  <thead><tr><th>Range</th><th>Time (s)</th></tr></thead>
                  <tbody>
                    {SPLIT_KEYS_G.filter(k=>run.splits[k]!=null).map(k=>(
                      <tr key={k}><td>{SPLIT_LABELS_G[k]}</td><td className="split-val">{run.splits[k].toFixed(2)}s</td></tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            {run.note && <div className="run-note" style={{marginTop:8}}>"{run.note}"</div>}
            {run.videoUrl && (
              <a href={run.videoUrl} target="_blank" rel="noreferrer" className="run-video-link">
                📹 View Slip / Video
              </a>
            )}
            <button className="run-del-full" onClick={()=>deleteRun(run.id)}>Delete Run</button>
          </div>
        )}
      </div>
    );
  });

  // ── GARAGE OVERVIEW ───────────────────────────────────────────────
  // ── GARAGE (04-screens.md #4a) ────────────────────────────────────
  // Identity → three stat tiles → progression bar → health chips →
  // build map → one orange action. Nothing else belongs on this screen:
  // run logging lives on Times (#4c), browsing on Builds (#4d), and the
  // build map's [→] row is the only "what's next" answer the design has.
  const garageContent = (
    <div className="garage-area">
      <div className="garage-hero">
        <div className="gh-id">
          {profile.nickname || profile.name || "Your garage"}
          {profile.note ? ` · ${profile.note}` : ""}
        </div>
        <div className="gh-car">
          {profile.year ? `${profile.year} ` : ""}Audi {currentModel.label}{" "}
          <span className="gh-engine">{currentModel.engine}</span>
        </div>

        {/* Three tiles: hp / 60–130 / quarter mile. All three are the numbers
            you came here for, so all three are --measure — not a mix of
            yellow, green and blue (02-color-rules.md). */}
        <div className="gh-stats">
          <div className="gh-stat gh-stat-wide">
            <div className="gh-stat-lbl">Est. crank hp</div>
            <div className="gh-stat-row">
              <span className="gh-stat-val">{totalHp}</span>
              {installedTotals.hp > 0 && (
                <span className="gh-stat-sfx gh-gain">+{installedTotals.hp}</span>
              )}
            </div>
          </div>
          <div className="gh-stat">
            <div className="gh-stat-lbl">60–130</div>
            <div className="gh-stat-row">
              <span className="gh-stat-val">{bestRun60130 ? bestRun60130.time : speeds.t60130}</span>
              {bestRun60130
                ? <span className="gh-stat-sfx gh-gain"><span aria-hidden="true">✓</span><span className="sr-only">proven</span></span>
                : <span className="gh-stat-sfx">est</span>}
            </div>
          </div>
          <div className="gh-stat">
            <div className="gh-stat-lbl">1/4 mile</div>
            <div className="gh-stat-row">
              <span className="gh-stat-val">{bestRun14 ? bestRun14.et : "—"}</span>
              {bestRun14?.trap ? <span className="gh-stat-sfx">@{bestRun14.trap}</span> : null}
            </div>
          </div>
        </div>

        <ProgressionBar hp={totalHp} wishlistHp={projectedHp} ceiling={buildCeiling} />
        <HealthChips installedMap={installedMap} />
      </div>

      {/* #4a's scroll region: its own 18px gutter, 10px above the heading. */}
      <div className="garage-body">
      <h2 className="section-title">
        <span>Build map</span>
        {/* "3/32 slots" in #4a counts every build slot, not just the proven
            path — SLOTS.length, which is 32. */}
        <span className="section-count">{numInst}/{SLOTS.length} slots</span>
      </h2>
      <BuildMap
        installedMap={installedMap}
        nextRec={nextRec}
        dense
        onOpenSlot={goToSlot}
        onRemove={slotId=>{
          setInstalledMap(prev=>{const n={...prev};delete n[slotId];saveBuild(n,wishlistMap);return n;});
        }}
      />

      {/* The one orange action on the screen. */}
      <button className="g-cta" onClick={()=>{setActiveTab("times");track("tab_viewed",{tab:"times"});}}>
        Log a run
      </button>

      {/* Tertiary, in the #4b/#4d link language. The planner has no tab of its
          own, so this is its only route in — see the gap report. */}
      <button className="g-tertiary" onClick={()=>{
        setGarageView("planner");
        track("planner_opened", { from:"garage" });
      }}>Plan back from an end state ›</button>
      </div>
    </div>
  );

  // ── GARAGE TAB ROUTING ────────────────────────────────────────────
  // A new owner with nothing logged must not land on the populated Garage —
  // "3 of 32 fitted" is a discouraging first impression when the answer is 0.
  const showActivation = numInst === 0 && !activationDismissed;
  const plannerGoal = powerGoal || (buildCeiling.hp === CEILINGS.daily.hp ? 700 : buildCeiling.hp);

  const garageScreen = showActivation ? (
    <ActivationScreen
      model={currentModel}
      baseHp={totalHp}
      nextRec={nextRec}
      recs={recs}
      profileName={profile.nickname || profile.name}
      onStart={()=>{ setBuildMode("installed"); setActiveTab("parts");
        if (nextRec) goToSlot(nextRec.slot); track("activation_start"); }}
      // "+N options" opens the same sheet the Parts rows open (#5b).
      onOptions={()=>{ if (nextRec) { setBuildMode("installed"); openSheet(nextRec.slot); } }}
      onBrowse={()=>{
        setBoardView("builds");
        setActiveTab("board");
        if (communityBuilds.length === 0) loadCommunityBuilds();
        track("community_builds_opened", { from:"activation" });
      }}
      onSkip={dismissActivation}
    />
  ) : garageView === "planner" ? (
    <PlannerScreen
      goalHp={plannerGoal}
      onSetGoal={setPowerGoal}
      model={currentModel}
      currentHp={totalHp}
      installedMap={installedMap}
      wishlistMap={wishlistMap}
      leaderboard={liveLeaderboard}
      nextRec={nextRec}
      onOpenSlot={goToSlot}
      onBack={()=>setGarageView("garage")}
      onSkipOrphans={()=>{
        // "Skip the orphans" actually skips them: drop every orphaned part from
        // the wishlist. Installed parts are left alone — those are already bought.
        const { rows } = plannerRows(plannerGoal, installedMap, wishlistMap);
        const drop = new Set(rows.filter(r => r.orphaned && !r.installed).map(r => r.slotId));
        setWishlistMap(prev => {
          const next = { ...prev };
          drop.forEach(id => delete next[id]);
          saveBuild(installedMap, next);
          return next;
        });
        track("planner_orphans_skipped", { dropped: drop.size });
      }}
    />
  ) : garageContent;

  // ── TIMES LOG ─────────────────────────────────────────────────────
  // "faster than N% of field" (#4c) — computed from the same leaderboard the
  // bands use, so the two can never disagree.
  const fieldPercentile = (() => {
    if (!bestRun60130) return null;
    const mine = parseFloat(bestRun60130.time);
    const field = liveLeaderboard.map(r => Number(r.t60130)).filter(Number.isFinite);
    if (!Number.isFinite(mine) || field.length === 0) return null;
    return Math.round((field.filter(t => t > mine).length / field.length) * 100);
  })();

  const timesContent = (
    <div className="times-area">
      {/* Save feedback toast */}
      {saveFeedback && (
        <div className="save-toast">{saveFeedback}</div>
      )}

      {/* #4c hero: one number, the proof state, and where it puts you. The
          Trap Chart is no longer a top-level toggle — the mockup's own caption
          says it lives in the run detail, which is where it renders now. */}
      <div className="tm-hero">
        <div className="tm-hero-left">
          <div className="tm-hero-lbl">Your best</div>
          <div className="tm-hero-row">
            <span className="tm-hero-val">
              {runsLoading ? "…" : bestRun60130 ? bestRun60130.time : "—"}
              <span className="tm-hero-unit">s</span>
            </span>
          </div>
        </div>
        <div className="tm-hero-right">
          <ProofBadge run={bestRun60130}
            onOpen={id=>{ setActiveTab("times"); setSelectedRunId(id); }} />
          {fieldPercentile != null && (
            <div className="tm-hero-pct">faster than {fieldPercentile}% of field</div>
          )}
        </div>
      </div>

      <div className="tm-body">

      {/* You vs the field, as bands (#4c). */}
      <FieldBands
        times={liveLeaderboard.map(r => r.t60130)}
        mine={bestRun60130 ? parseFloat(bestRun60130.time) : null}
      />

      <h2 className="section-title">
        <span>Your runs</span>
        <button className="tm-refresh" title="Refresh runs" aria-label="Refresh runs"
          onClick={()=>loadRuns()}>{runsLoading ? "⟳" : "↺"}</button>
      </h2>

      {runFormOpen && (
        <div className="run-form">
          <div className="rf-title">Log a Run</div>

          {/* Draggy screenshot upload */}
          <div className="draggy-upload-area">
            <input
              type="file" id="draggy-file" accept="image/*"
              style={{display:"none"}}
              onChange={e => { if(e.target.files[0]) parseDraggyScreenshot(e.target.files[0]); e.target.value=""; }}
            />
            {!draggyImage ? (
              <label htmlFor="draggy-file" className="draggy-btn">
                {draggyParsing
                  ? <><span className="draggy-spin">⟳</span> Reading screenshot…</>
                  : <><span>📷</span> Import Draggy Screenshot</>
                }
              </label>
            ) : (
              <div className="draggy-preview">
                <img src={draggyImage} alt="Draggy screenshot" className="draggy-img"/>
                <div className="draggy-preview-actions">
                  <span className="draggy-ok">✓ Times imported — review below</span>
                  <label htmlFor="draggy-file" className="draggy-reupload">Change</label>
                  <button className="draggy-clear" aria-label="Remove imported screenshot" onClick={()=>{setDraggyImage(null);setDraggyError("");}}><span aria-hidden="true">✕</span></button>
                </div>
              </div>
            )}
            {draggyError && <div className="draggy-error">{draggyError}</div>}
          </div>

          <div className="rf-grid">
            <div className="rf-field">
              <label className="rf-label" htmlFor={`${formUid}-date`}>Date</label>
              <input id={`${formUid}-date`} className="rf-input" type="date" value={runForm.date}
                onChange={e=>setRunForm(p=>({...p,date:e.target.value}))}/>
            </div>
            <div className="rf-field">
              <label className="rf-label" htmlFor={`${formUid}-type`}>Run Type</label>
              <select id={`${formUid}-type`} className="rf-input" value={runForm.type}
                onChange={e=>setRunForm(p=>({...p,type:e.target.value}))}>
                <option>60-130</option>
                <option>0-60</option>
                <option>1/8 Mile</option>
                <option>1/4 Mile</option>
                <option>Roll Race</option>
              </select>
            </div>
            {(runForm.type==="60-130"||runForm.type==="Roll Race"||runForm.type==="0-60") && (
              <div className="rf-field">
                <label className="rf-label" htmlFor={`${formUid}-time`}>{runForm.type} Time (s)</label>
                <input id={`${formUid}-time`} className="rf-input" type="number" step="0.01" placeholder="4.96"
                  value={runForm.time} onChange={e=>setRunForm(p=>({...p,time:e.target.value}))}/>
              </div>
            )}
            {(runForm.type==="60-130"||runForm.type==="Roll Race") && (
              <div className="rf-field">
                <label className="rf-label" htmlFor={`${formUid}-mph`}>Exit Speed (mph)</label>
                <input id={`${formUid}-mph`} className="rf-input" type="number" step="0.1" placeholder="145"
                  value={runForm.mph} onChange={e=>setRunForm(p=>({...p,mph:e.target.value}))}/>
              </div>
            )}
            {runForm.type==="1/8 Mile" && (
              <>
                <div className="rf-field">
                  <label className="rf-label" htmlFor={`${formUid}-et8`}>1/8 ET (s)</label>
                  <input id={`${formUid}-et8`} className="rf-input" type="number" step="0.001" placeholder="6.28"
                    value={runForm.et8th} onChange={e=>setRunForm(p=>({...p,et8th:e.target.value}))}/>
                </div>
                <div className="rf-field">
                  <label className="rf-label" htmlFor={`${formUid}-mph8`}>1/8 MPH</label>
                  <input id={`${formUid}-mph8`} className="rf-input" type="number" step="0.1" placeholder="114"
                    value={runForm.mph} onChange={e=>setRunForm(p=>({...p,mph:e.target.value}))}/>
                </div>
              </>
            )}
            {runForm.type==="1/4 Mile" && (
              <>
                <div className="rf-field">
                  <label className="rf-label" htmlFor={`${formUid}-et`}>1/4 ET (s)</label>
                  <input id={`${formUid}-et`} className="rf-input" type="number" step="0.001" placeholder="9.67"
                    value={runForm.et} onChange={e=>setRunForm(p=>({...p,et:e.target.value}))}/>
                </div>
                <div className="rf-field">
                  <label className="rf-label" htmlFor={`${formUid}-trap`}>Trap Speed (mph)</label>
                  <input id={`${formUid}-trap`} className="rf-input" type="number" step="0.1" placeholder="143"
                    value={runForm.trap} onChange={e=>setRunForm(p=>({...p,trap:e.target.value}))}/>
                </div>
              </>
            )}
            <div className="rf-field">
              <label className="rf-label" htmlFor={`${formUid}-surface`}>Surface</label>
              <select id={`${formUid}-surface`} className="rf-input" value={runForm.surface}
                onChange={e=>setRunForm(p=>({...p,surface:e.target.value}))}>
                <option>Street</option>
                <option>Prepped Strip</option>
                <option>Dragway</option>
                <option>Roll Race</option>
              </select>
            </div>
            <div className="rf-field">
              <label className="rf-label" htmlFor={`${formUid}-fuel`}>Fuel</label>
              <input id={`${formUid}-fuel`} className="rf-input" type="text" placeholder="E30, E85, 93 oct…"
                value={runForm.fuel} onChange={e=>setRunForm(p=>({...p,fuel:e.target.value}))}/>
            </div>
            <div className="rf-field">
              <label className="rf-label" htmlFor={`${formUid}-tunetype`}>Tune Type</label>
              <select id={`${formUid}-tunetype`} className="rf-input" value={runForm.tuneType}
                onChange={e=>setRunForm(p=>({...p,tuneType:e.target.value}))}>
                <option value="">— not set —</option>
                <option value="OTS">OTS (off-the-shelf)</option>
                <option value="Custom">Custom</option>
              </select>
            </div>
            <div className="rf-field">
              <label className="rf-label" htmlFor={`${formUid}-da`}>DA / Elevation</label>
              <input id={`${formUid}-da`} className="rf-input" type="text" placeholder="-65 ft"
                value={runForm.da} onChange={e=>setRunForm(p=>({...p,da:e.target.value}))}/>
            </div>
            <div className="rf-field">
              <label className="rf-label" htmlFor={`${formUid}-tires`}>Tires</label>
              <input id={`${formUid}-tires`} className="rf-input" type="text" placeholder="PS4S, ET Street…"
                value={runForm.tires} onChange={e=>setRunForm(p=>({...p,tires:e.target.value}))}/>
            </div>
            <div className="rf-field full">
              <label className="rf-label" htmlFor={`${formUid}-video`}>Video / Slip URL</label>
              <input id={`${formUid}-video`} className="rf-input" type="text" placeholder="https://youtube.com/…"
                value={runForm.videoUrl} onChange={e=>setRunForm(p=>({...p,videoUrl:e.target.value}))}/>
            </div>
            <div className="rf-field full">
              <label className="rf-label" htmlFor={`${formUid}-notes`}>Notes</label>
              <input id={`${formUid}-notes`} className="rf-input" type="text" placeholder="Launch conditions, boost, notes…"
                value={runForm.note} onChange={e=>setRunForm(p=>({...p,note:e.target.value}))}/>
            </div>
          </div>
          <div className="rf-btns">
            <button className="rf-save" onClick={addRun}>Save Run</button>
            <button className="rf-cancel" onClick={()=>setRunFormOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── SORT / FILTER BAR (shared) ── */}
      {runFilterBarJSX}

      {runs.length === 0 && !runFormOpen && (
        <div style={{color:"var(--dim)",fontSize:12,textAlign:"center",padding:"24px 0",lineHeight:1.7}}>
          {runsLoading
            ? <><span style={{display:"inline-block",animation:"spin .8s linear infinite",fontSize:18}}>⟳</span><br/>Loading your runs…</>
            : <>No runs logged yet.<br/>Tap <strong style={{color:"var(--muted)"}}>Log a Run</strong> to record your first Draggy result or strip slip.</>
          }
        </div>
      )}

      {/* ── RUN CARDS (shared) ── */}
      {runCardsJSX}

      {/* #4c puts the CTA at the foot of the list, not above it. */}
      <button className="tm-cta" onClick={()=>setRunFormOpen(v=>!v)}>
        {runFormOpen ? "✕ Cancel" : "Log a run — attach datalog"}
      </button>
      </div>
    </div>
  );

  // ── PROFILE SETTINGS ──────────────────────────────────────────────
  const profileContent = (
    <div className="profile-area">
      {/* ── SHARE SECTION ── */}
      <div className="share-box">
        <div className="share-title">Your build link</div>
        <div className="share-sub">
          Share your setup with the community. Anyone with this link sees your full mod list and best time.
        </div>

        {/* Public toggle */}
        <button className="pub-toggle" onClick={()=>{
          const next = {...profile, public: !profile.public};
          saveProfile(next);
          track("profile_public_toggled", {public: next.public});
        }}>
          <div className="pub-toggle-left">
            <div className="pub-toggle-label">Show in Community builds</div>
            <div className="pub-toggle-sub">{profile.public ? "Your build is visible to other members" : "Only you can see your build"}</div>
          </div>
          <div className={`pub-toggle-pill${profile.public ? " on" : ""}`}>
            <div className="pub-toggle-thumb"/>
          </div>
        </button>

        {profile.public && <>
          <div className="share-url">proof.build/@{profile.name ? profile.name.toLowerCase().replace(/\s+/g,"_") : "yourname"}/{currentModel.label.toLowerCase().replace(/\s+/g,"-")}</div>
          <button className="share-copy" onClick={()=>{
            try { navigator.clipboard?.writeText(`proof.build/@${(profile.name||"yourname").toLowerCase().replace(/\s+/g,"_")}/${currentModel.label.toLowerCase().replace(/\s+/g,"-")}`); } catch {}
          }}>Copy Link</button>
        </>}
      </div>

      {/* ── SHARE CARD PREVIEW ── */}
      {(() => {
        const instSlots = Object.entries(installedMap)
          .filter(([,vid])=>!!vid)
          .map(([sid,vid])=>{ const s=getSlotById(sid); return s ? {name:s.name, brand:getVariantById(sid,vid)?.brand||""} : null; })
          .filter(Boolean);
        const best = runs.filter(r=>r.type==="60-130"&&r.time!=null).sort((a,b)=>a.time-b.time)[0];
        const fuel = (runs.find(r=>r.fuel)||{}).fuel||"—";
        const initials = getInitials(profile.name);
        return (
          <>
            <div className="sc-sect">Your share card</div>
            <div className="sc-wrap">
              <div className="sc-head">
                <div className="sc-av">{initials}</div>
                <div className="sc-namewrap">
                  <div className="sc-name">{profile.name || "Your Name"}</div>
                  <div className="sc-car">{profile.year} {currentModel.label}{profile.tuner ? ` · ${profile.tuner}` : ""}</div>
                </div>
              </div>
              <div className="sc-stats">
                <div className="sc-stat">
                  <div className="sc-stat-val" style={{color:"var(--green)"}}>{best ? `${best.time}s` : "—"}</div>
                  <div className="sc-stat-lbl">Best run</div>
                </div>
                <div className="sc-stat">
                  <div className="sc-stat-val" style={{color:"var(--measure)"}}>{instSlots.length || "—"}</div>
                  <div className="sc-stat-lbl">Mods</div>
                </div>
                <div className="sc-stat">
                  <div className="sc-stat-val" style={{color:"var(--blue)"}}>{fuel}</div>
                  <div className="sc-stat-lbl">Fuel</div>
                </div>
              </div>
              {instSlots.length > 0 && (
                <div className="sc-chips">
                  {instSlots.map((s,i)=><span key={i} className="sc-chip">{s.name}</span>)}
                </div>
              )}
              <button className="sc-preview" onClick={()=>setShowPublicPage(true)}>Preview public page →</button>
            </div>
          </>
        );
      })()}

      <div className="pf-card">
        <div className="pf-title">Car Profile</div>
        <div className="pf-grid">
          <div className="pf-field">
            <label className="pf-label" htmlFor={`${formUid}-pname`}>Your Name</label>
            <input id={`${formUid}-pname`} className="pf-input" type="text" placeholder="First Last"
              value={profile.name} onChange={e=>setProfile(p=>({...p,name:e.target.value}))}/>
          </div>
          <div className="pf-field">
            <label className="pf-label" htmlFor={`${formUid}-pnick`}>Car Nickname</label>
            <input id={`${formUid}-pnick`} className="pf-input" type="text" placeholder="The Beast"
              value={profile.nickname} onChange={e=>setProfile(p=>({...p,nickname:e.target.value}))}/>
          </div>
          <div className="pf-field">
            <label className="pf-label" htmlFor={`${formUid}-pmodel`}>Model</label>
            <select id={`${formUid}-pmodel`} className="pf-input" value={profile.car||"s7"}
              onChange={e=>setProfile(p=>({...p,car:e.target.value}))}>
              {MODELS.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div className="pf-field">
            <label className="pf-label" htmlFor={`${formUid}-pyear`}>Year</label>
            <select id={`${formUid}-pyear`} className="pf-input" value={profile.year||"2016"}
              onChange={e=>setProfile(p=>({...p,year:e.target.value}))}>
              {["2013","2014","2015","2016","2017","2018"].map(y=><option key={y}>{y}</option>)}
            </select>
          </div>
          <div className="pf-field">
            <label className="pf-label" htmlFor={`${formUid}-pcolor`}>Color</label>
            <input id={`${formUid}-pcolor`} className="pf-input" type="text" placeholder="Phantom Black"
              value={profile.color} onChange={e=>setProfile(p=>({...p,color:e.target.value}))}/>
          </div>
          <div className="pf-field">
            <label className="pf-label" htmlFor={`${formUid}-ptuner`}>Tuner</label>
            <input id={`${formUid}-ptuner`} className="pf-input" type="text" placeholder="APR, Load Logic…"
              value={profile.tuner} onChange={e=>setProfile(p=>({...p,tuner:e.target.value}))}/>
          </div>
          <div className="pf-field full">
            <label className="pf-label" htmlFor={`${formUid}-pnote`}>Build Note</label>
            <input id={`${formUid}-pnote`} className="pf-input" type="text" placeholder="Daily driver | street/strip | track build…"
              value={profile.note} onChange={e=>setProfile(p=>({...p,note:e.target.value}))}/>
          </div>
        </div>
        <button className={`pf-save${profileSaved?" pf-saved":""}`} onClick={()=>saveProfile(profile)}>
          {profileSaved ? "✓ Saved" : "Save Profile"}
        </button>
      </div>

            <div className="pf-card">
        <div className="pf-title">{authUser ? "Profile Linked" : "Link Your Profile"}</div>
        {authUser ? (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <div style={{color:"var(--verify)",fontSize:13}}>✓ Signed in as {authUser.email}</div>
            <div style={{fontSize:12,color:"var(--dim)"}}>Profile syncs to your account — reload from any device.</div>
            <button className="pf-save" onClick={()=>sb.auth.signOut()} style={{marginTop:4,maxWidth:140}}>Sign Out</button>
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{fontSize:12,color:"var(--dim)"}}>Save your profile to your account and reload it on any device.</div>
            {authSent ? (
              <div style={{color:"var(--verify)",fontSize:13}}>✓ Magic link sent — check your email!</div>
            ) : (
              <div className="pf-field full">
                <label className="pf-label" htmlFor={`${formUid}-pemail`}>Email</label>
                <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                  <input id={`${formUid}-pemail`} className="pf-input" type="email" placeholder="you@example.com" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMagicLink()} style={{flex:1}} />
                  <button className="pf-save" onClick={sendMagicLink} disabled={authLoading||!authEmail} style={{whiteSpace:"nowrap",width:"auto",minWidth:110,opacity:(authLoading||!authEmail)?0.5:1}}>
                    {authLoading ? "Sending…" : "Send Magic Link"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

<div className="pf-card" style={{fontSize:11,color:"var(--muted)",lineHeight:1.7,fontWeight:300}}>
        <div className="pf-title">About Proof.Build</div>
        Proof.Build is a performance build platform for the Audi 4.0T community. Configure your current setup, plan your next mods, log your times, and discover what upgrades fit your goals — backed by real community data, real vendor specs, and a verified leaderboard.<br/><br/>
        Platform: C7 / C7.5 (2013–2018) · S6 · S7 · RS6 · RS7<br/>
        Leaderboard data: Real community runs from the Audi 4.0T Drag Racing Leaderboard.<br/>
        Parts data: Verified against SRM, TGK Motorsport, 034 Motorsport, Autotech, IE, ECS, ARM, JXB Performance.<br/><br/>
        <span style={{color:"var(--fill-neutral)"}}>proof.build</span> · Coming soon
      </div>
    </div>
  );

  // ── LEADERBOARD CONTENT ───────────────────────────────────────────
  // #4d has no per-model filter row; "Like yours" is its relevance control.
  const filteredCommunity = communityBuilds.slice().sort((a, b) => {
    if (buildSort === "like") {
      // #4d: builds running your next part first, then same-model builds.
      // Relevance is the reason to browse, so it outranks the numbers.
      const rel = x => (nextRec && (x.installed_map || {})[nextRec.slot] ? 2 : 0)
        + (profile.car && x.car === profile.car ? 1 : 0);
      const ar = rel(a), br = rel(b);
      if (ar !== br) return br - ar;
    }
    if (buildSort === "fast") {
      // fastest 60-130 first; builds without a time sink to the bottom
      const av = a.bestT60130 ?? Infinity, bv = b.bestT60130 ?? Infinity;
      if (av !== bv) return av - bv;
    }
    return b.modCount - a.modCount;
  });

  // #4e: class filter, then a top slice with the rest folded behind "N MORE"
  // so your own row can be pinned directly beneath it.
  // ── VEHICLE SETUP (#5a) ────────────────────────────────────────────
  // Replaces the old header model strip. Writes go through the existing paths:
  // profile via saveProfile, the tune slot via saveBuild, the goal via
  // setPowerGoal. Fuel is the only new value and follows powerGoal's pattern —
  // a local key, not a schema change.
  const setupScreen = (
    <VehicleSetup
      profile={profile}
      modelId={modelId}
      installedMap={installedMap}
      powerGoal={powerGoal}
      onSave={({ year, model, stage, fuel, goal }) => {
        saveProfile({ ...profile, car: model, year });
        setPowerGoal(goal);
        try { localStorage.setItem("proof-fuel", fuel); } catch { /* private mode */ }
        // The tune is a real part: selecting a stage fits that ECU slot and
        // clears the others, so inferStage and the build map stay honest.
        setInstalledMap(prev => {
          const next = { ...prev };
          SETUP_STAGES.forEach(s => { if (s.slot) delete next[s.slot]; });
          if (stage.slot) {
            const v = getSlotById(stage.slot)?.variants?.[0];
            if (v) next[stage.slot] = v.id;
          }
          saveBuild(next, wishlistMap);
          return next;
        });
        clearActivationDismissal();
        track("vehicle_setup_saved", { model, year, stage: stage.id, fuel, goal });
      }}
    />
  );

  // ── HEADER CONTEXT SLUG ────────────────────────────────────────────
  // The mockup gives every screen the same header and varies only this: a
  // bordered chip where it states build state, plain mono text elsewhere.
  // Verbatim per screen — #4a "Stage 2", #4b "Stock", #4c "60–130 MPH",
  // #4d "103 BUILDS", #4e "✓ DATALOG REQUIRED", #4f "End-state plan",
  // #5b "2016 S6 · STAGE 2".
  const stageLabel = REC_STAGE_LABEL[inferStage(installedMap)] || "Stock";
  const openSetup = () => { setActiveTab("setup"); track("tab_viewed", { tab: "setup" }); };
  const hdrSlug = (() => {
    if (activeTab === "garage" && garageView === "planner")
      return { text: "End-state plan", upper: true };
    if (activeTab === "garage")
      return { text: stageLabel, chip: true, action: openSetup };
    if (activeTab === "parts")
      return { text: `${profile.year || ""} ${currentModel.label} · ${stageLabel.toUpperCase()}`.trim(), action: openSetup };
    if (activeTab === "times")   return { text: "60–130 MPH", lg: true };
    if (activeTab === "board" && boardView === "times")
      return { text: "✓ DATALOG REQUIRED", tone: "verify" };
    if (activeTab === "board")
      return { text: `${communityBuilds.length} BUILDS`, lg: true };
    if (activeTab === "setup") return { text: "Set up your car", upper: true };
    return { text: "Your profile", upper: true };
  })();

  // ── TAB BAR ITEMS ──────────────────────────────────────────────────
  // The spec's five, in order. Labels are lowercase here and uppercased in CSS,
  // exactly as the mockup does it. Counts feed the accessible name only — the
  // mockup carries no visual badges.
  const openBoard = view => () => {
    setActiveTab("board");
    setBoardView(view);
    if (view === "builds" && communityBuilds.length === 0) loadCommunityBuilds();
    track("tab_viewed", { tab: view === "builds" ? "builds" : "board" });
  };
  const goTab = id => () => { setActiveTab(id); track("tab_viewed", { tab: id }); };
  const NAV_TABS = [
    { id: "garage", label: "garage", count: 0,                 onSelect: goTab("garage") },
    { id: "parts",  label: "parts",  count: numInst + numWish, onSelect: goTab("parts")  },
    { id: "times",  label: "times",  count: runs.length,       onSelect: goTab("times")  },
    { id: "builds", label: "builds", count: 0,                 onSelect: openBoard("builds") },
    { id: "board",  label: "board",  count: 0,                 onSelect: openBoard("times")  },
  ];

  const lbFiltered = lbClass === "all"
    ? liveLeaderboard
    : liveLeaderboard.filter(r => lbClassOf(r) === lbClass);
  const LB_TOP = 3;
  const lbShown  = lbFiltered.slice(0, LB_TOP);
  const lbHidden = Math.max(0, lbFiltered.length - lbShown.length);

  const boardContent = (
    <div className="lb-area">
      {/* The Builds / Leaderboard toggle that used to sit here is gone: the tab
          bar now addresses #4d and #4e directly, and two controls for the same
          switch is worse than one. */}

      {/* ── TIMES VIEW (existing leaderboard) ── */}
      {boardView === "times" && (
        <>
          <h2 className="lb-title">60–130 Leaderboard</h2>
          <div className="lb-req"><span aria-hidden="true">✓</span> DATALOG REQUIRED</div>
          <div className="lb-sub">Real runs · Audi 4.0T community · All catless downpipes</div>

          {/* Class filters (#4e). Derived from each run's own turbo string, so
              a car lands in a class because of what it runs, not a label. */}
          <div className="lb-filters">
            {LB_CLASSES.map(c => (
              <button key={c.id} className={`csbtn${lbClass===c.id?" on":""}`} aria-pressed={lbClass===c.id}
                onClick={()=>setLbClass(c.id)}>{c.label}</button>
            ))}
          </div>

          <div className="lb-list">

          {lbShown.map(run => (
            <button type="button" key={run.rank}
              className={`lb-row${run.rank === 1 ? " lb-row-top" : ""}`}>
              <span className={`lb-rank${run.rank === 1 ? " lb-rank-top" : ""}`}>
                {String(run.rank).padStart(2, "0")}
              </span>
              <span className="lb-mid">
                <span className="lb-name">{run.driver}</span>
                {/* #4e compresses the whole spec into one mono line. */}
                <span className="lb-spec">
                  {[run.car, run.tuner, run.fuel, run.supFuel]
                    .filter(v => v && v !== "Unknown" && v !== "None")
                    .join(" · ").toUpperCase()}
                </span>
              </span>
              <span className="lb-right">
                <span className="lb-time">{run.t60130}</span>
                {run.da && <span className="lb-da">✓ DA {run.da}</span>}
              </span>
            </button>
          ))}

          {/* #4e pins your row below a "N MORE" divider so the gap to the next
              tier is readable without scrolling the whole field. */}
          {lbHidden > 0 && (
            <div className="lb-divider">
              <span className="lb-divider-line" />
              <span className="lb-divider-lbl">{lbHidden} MORE</span>
              <span className="lb-divider-line" />
            </div>
          )}

          {/* Your own placement, gated on evidence — same row shape as the
              field, outlined in --measure, carrying the real gap to the next
              tier up rather than to the bottom of the board. */}
          {myBoardRuns.proven ? (() => {
            const mine  = parseFloat(myBoardRuns.proven.time);
            const ahead = [...lbFiltered].filter(r => Number(r.t60130) < mine)
              .sort((a, b) => Number(b.t60130) - Number(a.t60130))[0];
            const gap   = ahead ? +(mine - Number(ahead.t60130)).toFixed(2) : null;
            const place = lbFiltered.filter(r => Number(r.t60130) < mine).length + 1;
            return (
              <button type="button" className="lb-row lb-row-you">
                <span className="lb-rank">{String(place).padStart(2, "0")}</span>
                <span className="lb-mid">
                  <span className="lb-name">YOU · {(profile.nickname || profile.name || "your build").toUpperCase()}</span>
                  <span className="lb-spec">
                    {currentModel.label.toUpperCase()} · {stageLabel.toUpperCase()}
                    {gap != null ? ` · ${gap}s TO #${ahead.rank}` : " · FASTEST ON THE BOARD"}
                  </span>
                </span>
                <span className="lb-right">
                  <span className="lb-time">{myBoardRuns.proven.time}</span>
                  {myBoardRuns.proven.da && <span className="lb-da">✓ DA {myBoardRuns.proven.da}</span>}
                </span>
              </button>
            );
          })() : null}

          {/* The consequence, stated plainly (#4e). */}
          {myBoardRuns.claimCount > 0 && (
            <div className="lb-hidden">
              <span aria-hidden="true">▲</span> {myBoardRuns.claimCount} CLAIMED TIME{myBoardRuns.claimCount!==1?"S":""} HIDDEN — NO DATALOG, NO RANK
            </div>
          )}

          <button className="lb-cta" onClick={()=>{setActiveTab("times");track("tab_viewed",{tab:"times"});}}>
            Beat it — log a run
          </button>
          </div>
        </>
      )}

      {/* ── BUILDS VIEW (community browser) ── */}
      {boardView === "builds" && (
        <>
          {/* #4d carries one filter row of three chips. The per-model filter
              that used to sit above it has no counterpart in the mockup and is
              largely subsumed by "Like yours" — flagged in the report. */}
          {communityLoading
            ? <div className="cmt-empty">Loading builds…</div>
            : <>
                <div className="cmt-filters">
                  <div className="cmt-sort">
                    {/* #4d pins "Like yours" first — it is the default reason
                        to browse at all. */}
                    <button className={`csbtn${buildSort==="like"?" on":""}`} aria-pressed={buildSort==="like"} onClick={()=>setBuildSort("like")}>Like yours</button>
                    <button className={`csbtn${buildSort==="fast"?" on":""}`} aria-pressed={buildSort==="fast"} onClick={()=>setBuildSort("fast")}>Fastest</button>
                    <button className={`csbtn${buildSort==="mods"?" on":""}`} aria-pressed={buildSort==="mods"} onClick={()=>setBuildSort("mods")}>Most mods</button>
                  </div>
                </div>
                {filteredCommunity.length === 0
                  ? <div className="cmt-empty">No builds logged yet.</div>
                  : <div className="cmt-list">
                      {filteredCommunity.map((b, i) => (
                        <CommunityBuildCard key={b.user_id || i} build={b}
                          userCar={profile.car}
                          nextRec={nextRec}
                          onView={()=>setViewedBuild(b)} />
                      ))}
                      <button className="cmt-more" onClick={()=>loadCommunityBuilds()}>
                        More builds
                      </button>
                    </div>
                }
              </>
          }
        </>
      )}
    </div>
  );

  // ── PARTS CONTENT ─────────────────────────────────────────────────
  const activeModelId = currentModel.id;
  const partsContent = (
    <>
      <div className="cat-strip">
        {CATEGORIES.map(cat => (
          <button key={cat} className={`cbtn${activeCat===cat?" active":""}`} aria-pressed={activeCat===cat}
            onClick={()=>{setActiveCat(cat);setOpenSlot(null);}}>
            {cat}
            {catCounts[cat]>0 && <span className="cbtn-dot"/>}
          </button>
        ))}
      </div>
      <div className="parts-area">
        {/* #5b heads the screen with one mono line: category on the left, the
            option count on the right. No 22px title, no subtitle, and no
            progression bar — that was #3a, which this supersedes. */}
        <h2 className="section-title">
          <span>{activeCat}</span>
          <span className="section-count">
            {catSlots.length} slot{catSlots.length === 1 ? "" : "s"}
          </span>
        </h2>
        <div className="slots-list">
          {catSlots.map(slot => {
            const selVarId   = selectedMap[slot.id];
            const otherVarId = buildMode==="installed" ? wishlistMap[slot.id] : installedMap[slot.id];
            const selVar     = selVarId ? getVariantById(slot.id, selVarId) : null;
            const { missing, conflicts } = getDeps(slot.id, selectedMap);
            const hasSel    = !!selVarId;
            const hasWarn   = hasSel && missing.length > 0;
            const hasConf   = hasSel && conflicts.length > 0;

            // Fuel hardware makes nothing on a stock tune, and calcTotals credits
            // it with nothing — so dim the row to match, rather than showing a
            // confident hp figure the estimate does not actually contain.
            const fuelInert = FUEL_SLOTS.has(slot.id) &&
              !Object.keys(selectedMap).some(k => TUNING_SLOTS.has(k));

            let cardCls = "slot-card";
            if (fuelInert) cardCls += " fuel-inert";
            if (hasConf) cardCls += " conflict";
            else if (hasWarn) cardCls += " warn";
            else if (hasSel) cardCls += " sel";

            // #5b uses a bracket marker in mono, not a filled orb.
            let markCls = "slot-mark-open", mark = "[ ]";
            if (hasSel && hasConf)      { markCls="slot-mark-conflict"; mark="[⚡]"; }
            else if (hasSel && hasWarn) { markCls="slot-mark-warn";     mark="[⚠]"; }
            else if (hasSel)            { markCls = buildMode==="installed" ? "slot-mark-inst" : "slot-mark-wish";
                                          mark    = buildMode==="installed" ? "[✓]" : "[★]"; }

            return (
              <div key={slot.id} className={cardCls}>
                {/* The row's whole job is to open the sheet (#5b). */}
                <button type="button" className="slot-hdr" onClick={()=>openSheet(slot.id)}
                  aria-haspopup="dialog">
                  <span className={`slot-mark ${markCls}`} aria-hidden="true">{mark}</span>
                  <div className="slot-info">
                    <div className="slot-name">{slot.name}</div>
                    {selVar
                      ? <div className="slot-sel-text" style={{color:buildMode==="wishlist"?"var(--relevant)":undefined}}>{selVar.brand} · {selVar.label}</div>
                      : <div className="slot-desc-text">{otherVarId ? (buildMode==="installed"?"on your wishlist · tap to compare":"installed · tap to compare") : "tap to compare options"}</div>
                    }
                  </div>
                  {fuelInert
                    ? <span className="slot-tag t-inert">NEEDS TUNE</span>
                    : slot.tag && <span className={`slot-tag ${tagClass(slot.tag)}`}>{slot.tag}</span>}
                  {/* #5b ends every row in a price. */}
                  <span className="slot-price">
                    {selVar ? `$${selVar.price.toLocaleString()}` : `$${Math.min(...slot.variants.map(v=>v.price)).toLocaleString()}+`}
                  </span>
                  <span className="sr-only">
                    {hasSel ? "in your build" : "not yet chosen"}. Opens options.
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );

  // ── PARTS + BUILD MODE TOGGLE ──────────────────────────────────────
  const partsWithToggle = (
    <>
      <div style={{padding:"8px 14px 0",background:"var(--surface)",flexShrink:0}}>
        <div className="mode-toggle">
          <button className={`mtbtn${buildMode==="installed"?" active inst":""}`} aria-pressed={buildMode==="installed"}
            onClick={()=>setBuildMode("installed")}>
            <span className="mtbtn-dot dot-inst"/>
            Installed ({numInst})
          </button>
          <button className={`mtbtn${buildMode==="wishlist"?" active wish":""}`} aria-pressed={buildMode==="wishlist"}
            onClick={()=>setBuildMode("wishlist")}>
            <span className="mtbtn-dot dot-wish"/>
            Wishlist ({numWish})
          </button>
        </div>
      </div>
      {partsContent}
    </>
  );

  return (
    <div className="app">
      {/* Header (identical on every #4/#5 screen): the wordmark on the left and
          a single per-screen context slug on the right. 402x40, 10px 18px 11px,
          transparent over --bg, one hairline under it. No stat strip, no model
          strip, no profile avatar — the mockup carries none of them. */}
      <header className="header" inert={dialogOpen}>
        {/* The mockup's logo is a TEXT wordmark, not artwork — there is no SVG,
            <img> or background-image in any of the eight #4/#5 headers. It is
            authored as:
              <div style="font-family:'IBM Plex Mono',monospace;font-weight:600;
                          font-size:14px;letter-spacing:.06em;color:#fff">
                the<span style="color:#FF6A16">/</span>proof</div>
            Reproduced verbatim: lowercase "the/proof", plain ASCII solidus
            (U+002F), Mono 600 14px .06em on #FFFFFF with the slash in --action.
            aria-label names the heading outright rather than leaving it to
            name-from-content, which would otherwise be read as "the slash
            proof". A visually-hidden span was tried first and Chrome folded the
            aria-hidden glyphs into the name anyway ("the/proofthe-proof"), so
            the label is set on the heading itself. */}
        <h1 className="logo" aria-label="the-proof">
          the<span className="logo-slash">/</span>proof
        </h1>
        {hdrSlug.action ? (
          // Where the slug states build state it doubles as the way into setup;
          // elsewhere it is plain text, exactly as the mockup has it.
          <button
            type="button"
            className={`hdr-slug${hdrSlug.chip ? " hdr-slug-chip" : ""}${hdrSlug.tone ? " hdr-slug-" + hdrSlug.tone : ""}${hdrSlug.upper ? " hdr-slug-upper" : ""}${hdrSlug.lg ? " hdr-slug-lg" : ""}`}
            onClick={hdrSlug.action}
            aria-label={`${hdrSlug.text} — open your car and profile`}
          >{hdrSlug.text}</button>
        ) : (
          <span className={`hdr-slug${hdrSlug.chip ? " hdr-slug-chip" : ""}${hdrSlug.tone ? " hdr-slug-" + hdrSlug.tone : ""}${hdrSlug.upper ? " hdr-slug-upper" : ""}${hdrSlug.lg ? " hdr-slug-lg" : ""}`}>
            {hdrSlug.text}
          </span>
        )}
      </header>

      {/* The hp estimate recomputes on every part change; announce it rather
          than letting the number change silently for screen-reader users. */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {`Estimated ${totalHp} crank horsepower, ${calcWhp(totalHp)} at the wheels. `}
        {`Estimated 60 to 130 in ${speeds.t60130} seconds.`}
      </div>
      <div className="sr-only" aria-live="polite" aria-atomic="true">{likeAnnounce}</div>

      <main className="body" inert={dialogOpen}>
        <ScreenBoundary resetKey={activeTab}>
          {activeTab==="garage" && garageScreen}
          {activeTab==="parts"  && partsWithToggle}
          {activeTab==="times"  && timesContent}
          {activeTab==="board"  && boardContent}
          {activeTab==="setup"  && setupScreen}
          {activeTab==="profile"&& profileContent}
        </ScreenBoundary>
      </main>

      {/* Part sheet (#5b) — options for one slot, recommended pick first. */}
      {openSlot && (() => {
        const slot = getSlotById(openSlot);
        if (!slot) return null;
        const { missing, conflicts } = getDeps(slot.id, selectedMap);
        const selVarId = selectedMap[slot.id];
        return (
          <PartSheet
            slot={slot}
            rec={recommendProduct(slot.id,
              { installed: installedMap, wishlist: wishlistMap },
              { modelId: activeModelId, goalHp: powerGoal })}
            selVarId={selVarId}
            otherVarId={buildMode==="installed" ? wishlistMap[slot.id] : installedMap[slot.id]}
            buildMode={buildMode}
            modelId={activeModelId}
            currentModel={currentModel}
            likedParts={likedParts}
            likeCounts={likeCounts}
            likesLive={likesLive}
            adminPicks={adminPicks}
            onToggleLike={toggleLike}
            onChoose={pick}
            onInstallFromWishlist={installFromWishlist}
            onTrackBuy={v => track('affiliate_click', {
              slot: slot.id, variant: v.id, brand: v.brand, price: v.price, url: v.buyUrl,
            })}
            onClose={closeSheet}
            missing={selVarId ? missing : []}
            conflicts={selVarId ? conflicts : []}
            missingRecs={selVarId ? slot.recommends.filter(r=>!Object.keys(selectedMap).includes(r)) : []}
            fuelInert={FUEL_SLOTS.has(slot.id) &&
              !Object.keys(selectedMap).some(k => TUNING_SLOTS.has(k))}
            extras={slot.id === "ecu_custom" ? (
              <>
                <TuneComparison runs={runs} />
                <CustomFeatures value={customFeatures} onChange={setCustomFeatures} />
              </>
            ) : null}
          />
        );
      })()}

      {/* Public page sheet — own profile preview */}
      {showPublicPage && (
        <PublicPageSheet
          profile={profile}
          installedMap={installedMap}
          bestRun60130={bestRun60130}
          runs={runs}
          onClose={()=>setShowPublicPage(false)}
        />
      )}

      {/* Community build sheet — tapped from Builds view */}
      {viewedBuild && (
        <PublicPageSheet
          profile={viewedBuild}
          installedMap={viewedBuild.installed_map || {}}
          bestRun60130={viewedBuild.bestT60130 != null ? { time: viewedBuild.bestT60130 } : null}
          runs={viewedBuild.runs || []}
          onClose={()=>setViewedBuild(null)}
        />
      )}

      {isAdminMode && !showAdminPanel && (
        <button className="admin-fab" onClick={()=>setShowAdminPanel(true)}><span aria-hidden="true">⚙</span> Admin</button>
      )}
      {showAdminPanel && (
        <AdminPanel adminPicks={adminPicks} onSetPick={saveAdminPick} onClose={()=>{
          setShowAdminPanel(false);
          // The FAB unmounts while the panel is open, so useDialog has no node to
          // restore to. Re-focus it once it comes back rather than dropping the
          // keyboard user on <body>.
          setTimeout(()=>document.querySelector(".admin-fab")?.focus(), 0);
        }} />
      )}

      {/* Tab bar (03-components.md). Five lowercase mono labels, no icons —
          uppercased in CSS so the rendered text matches the mockup while the
          source stays the spec's `garage · parts · times · builds · board`.
          `builds` and `board` are the two halves of #4d and #4e, which the app
          already models as boardView "builds" | "times". */}
      <nav className="bottom-nav" aria-label="Primary" inert={dialogOpen}>
        {NAV_TABS.map(t => {
          const current = t.id === "builds" ? (activeTab === "board" && boardView === "builds")
            : t.id === "board"              ? (activeTab === "board" && boardView === "times")
            : activeTab === t.id;
          return (
            <button
              key={t.id}
              className={`bnav${current ? " active" : ""}`}
              aria-current={current ? "page" : undefined}
              aria-label={t.count > 0 ? `${t.label}, ${t.count} items` : undefined}
              onClick={t.onSelect}
            >
              {t.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
