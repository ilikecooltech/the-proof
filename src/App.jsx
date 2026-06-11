import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// ── SUPABASE CLIENT ──────────────────────────────────────────────────────────
const SUPABASE_URL  = "https://bqvdudylkqwpyvhshewj.supabase.co";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

function getUserId() {
  let id = localStorage.getItem("proof-user-id");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("proof-user-id", id); }
  return id;
}


// ── REAL LEADERBOARD DATA (from Audi 4.0T Drag Racing Leaderboard) ────────
const LEADERBOARD = [
  { rank:1,  driver:"Miguel Romero",    car:"B8.5 S5",   tuner:"Load Logic / ET Spec", t60130:4.10, et:"9.26", mph:153.57, turbo:"Xona 5657", fuel:"E75",     trans:"Built",    manifolds:"SRM",     supFuel:"Port+NOS", ic:"SRM W2A",    dp:"Catless", da:"7932ft" },
  { rank:2,  driver:"Chris Clayton",    car:"C7 RS7",    tuner:"C4 / ET Spec",         t60130:4.49, et:null,   mph:null,   turbo:"Xona 6564", fuel:"E65",     trans:"Stock",    manifolds:"SRM",     supFuel:"Port",     ic:"SRM W2A",    dp:"Catless", da:"-65ft" },
  { rank:3,  driver:"Skip Hickey",      car:"D4.5 S8",   tuner:"Load Logic / ET Spec", t60130:4.71, et:"9.66", mph:140.57, turbo:"71mm",       fuel:"E45",     trans:"Stock",    manifolds:"Klassen", supFuel:"Meth",     ic:"Unknown",    dp:"Catless", da:"192ft" },
  { rank:4,  driver:"Adam Emm",         car:"D4 A8L",    tuner:"C4 / ET Spec",         t60130:4.80, et:null,   mph:null,   turbo:"G45-1500",   fuel:"Pump E85",trans:"Stock",    manifolds:"Unknown", supFuel:"Port",     ic:"Unknown",    dp:"Catless", da:"1990ft" },
  { rank:5,  driver:"Neil Otis",        car:"D4.5 A8L",  tuner:"Self Tuned",           t60130:4.96, et:"9.73", mph:145.34, turbo:"Xona 5357",  fuel:"E78",     trans:"Stock",    manifolds:"FRA",     supFuel:"Port",     ic:"Sean East W2A",dp:"Catless",da:"-95ft" },
  { rank:6,  driver:"Matt Jones",       car:"C7.5 RS7",  tuner:"C4",                   t60130:4.97, et:"10.06",mph:145.16, turbo:"Xona 5657",  fuel:"E77",     trans:"Stock",    manifolds:"SRM",     supFuel:"Port",     ic:"SRM W2A",    dp:"Catless", da:"567ft" },
  { rank:7,  driver:"Marcus Maroney",   car:"C7.5 RS7",  tuner:"Kyle / Unknown",       t60130:5.04, et:"9.67", mph:143.90, turbo:"TS1",         fuel:"E38",     trans:"Stock",    manifolds:"SRM",     supFuel:"Meth",     ic:"SRM W2A",    dp:"Catless", da:"-2539ft" },
  { rank:8,  driver:"Reggie MacNelly",  car:"C7 S7",     tuner:"Load Logic / ET Spec", t60130:5.11, et:"9.91", mph:144.75, turbo:"G40-1150",   fuel:"E30",     trans:"ZF8 Swap", manifolds:"Unknown", supFuel:"Meth",     ic:"Unknown",    dp:"Catless", da:"1899ft" },
  { rank:9,  driver:"Saif Sultan",      car:"D4 S8",     tuner:"C4 / ET Spec",         t60130:5.23, et:null,   mph:null,   turbo:"G40-1150",   fuel:"Pump E85",trans:"Stock",    manifolds:"Unknown", supFuel:"Port",     ic:"SRM W2A",    dp:"Catless", da:"-230ft" },
  { rank:10, driver:"Sean Fallon",      car:"C7.5 RS7",  tuner:"Unknown",              t60130:5.24, et:null,   mph:null,   turbo:"TS2+",        fuel:"E60",     trans:"Stock",    manifolds:"Unknown", supFuel:"Port",     ic:"SRM W2A",    dp:"Catless", da:"-1933ft" },
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

const CATEGORIES = ["Engine","Turbos","Fueling","Intake","Exhaust","Intercooler","Cooling","Manifolds","Differential","Drivetrain","Suspension","Brakes","Tires","Maintenance"];

// ── SLOTS ──────────────────────────────────────────────────────────────────
const SLOTS = [

  // ── ENGINE (ECU TUNE) ─────────────────────────────────────────────────
  {
    id:"ecu_s1", cat:"Engine", name:"Stage 1 ECU Tune",
    desc:"Software-only. No hardware needed. Best starting point.",
    tag:"POPULAR", requires:[], recommends:["cai","hpfp"], conflicts:["ecu_s2","ecu_custom"],
    variants:[
      { id:"apr_s1",  brand:"APR",       label:"Stage 1+",        price:799,  rating:4.9,
        hp:{a6_20t:62,a6_30t:58,a7_20t:62,a7_30t:58,s6:82,s7:82,a8:82,s8:84,rs6:85,rs7:85},
        torque:{a6_20t:72,a6_30t:68,a7_20t:72,a7_30t:68,s6:105,s7:105,a8:105,s8:108,rs6:110,rs7:110},
        notes:"Most popular C7 tune. OTS maps, huge community logging base.", difficulty:"Plug & Play",
        pros:["OTS maps","Wide support","Data logging"],cons:["ECU locked","Dealer detectable"] },
      { id:"cobb_s1", brand:"COBB",      label:"Accessport",      price:695,  rating:4.7,
        hp:{a6_20t:58,a6_30t:54,a7_20t:58,a7_30t:54,s6:78,s7:78,a8:78,s8:79,rs6:80,rs7:80},
        torque:{a6_20t:68,a6_30t:64,a7_20t:68,a7_30t:64,s6:98,s7:98,a8:98,s8:99,rs6:100,rs7:100},
        notes:"Handheld flash/revert. Best for dealer visits and resale.", difficulty:"Plug & Play",
        pros:["Revert in minutes","Resale value","Easy logging"],cons:["Slightly lower peak"] },
      { id:"srm_s1",  brand:"SRM (Softronic)", label:"Stage 1",   price:650,  rating:4.7,
        hp:{a6_20t:55,a6_30t:52,a7_20t:55,a7_30t:52,s6:75,s7:75,a8:75,s8:76,rs6:78,rs7:78},
        torque:{a6_20t:65,a6_30t:62,a7_20t:65,a7_30t:62,s6:95,s7:95,a8:95,s8:96,rs6:98,rs7:98},
        notes:"Swedish mail-in ECU service. Known for smooth delivery, strong on 3.0T SC.", difficulty:"Plug & Play",
        pros:["OEM drivability","Budget option","Strong 3.0T maps"],cons:["Mail-in turnaround ~1 wk"] },
      { id:"uni_s1",  brand:"Unitronic", label:"Stage 1",          price:749,  rating:4.8,
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
      { id:"apr_s2",  brand:"APR",            label:"Stage 2+",    price:899,  rating:4.9,
        hp:{a6_20t:100,a6_30t:90,a7_20t:100,a7_30t:90,s6:145,s7:145,a8:145,s8:150,rs6:155,rs7:155},
        torque:{a6_20t:120,a6_30t:110,a7_20t:120,a7_30t:110,s6:175,s7:175,a8:175,s8:190,rs6:205,rs7:205},
        notes:"Benchmark Stage 2. Prefers APR downpipe for full unlock.", difficulty:"Professional",
        pros:["Most dyno data","OTS maps"],cons:["APR DP preferred"] },
      { id:"srm_s2",  brand:"SRM (Softronic)", label:"Stage 2",    price:750,  rating:4.7,
        hp:{a6_20t:93,a6_30t:83,a7_20t:93,a7_30t:83,s6:133,s7:133,a8:133,s8:138,rs6:143,rs7:143},
        torque:{a6_20t:112,a6_30t:102,a7_20t:112,a7_30t:102,s6:163,s7:163,a8:163,s8:178,rs6:193,rs7:193},
        notes:"Most affordable Stage 2. Seen on multiple leaderboard builds at higher stages.", difficulty:"Professional",
        pros:["Best price","Strong 3.0T focus","OEM feel"],cons:["Mail-in downtime"] },
      { id:"uni_s2",  brand:"Unitronic",       label:"Stage 2",    price:849,  rating:4.8,
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
      { id:"ds1_srm",    brand:"Dyno Spectrum (DS1)", label:"DS1 ECU + ET Spec TCU Combo", price:1299, rating:5.0,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"SRM's preferred tuning platform. DS1 ECU + ET Spec TCU combo for ZF8HP or DL501 — $1,299 as a bundle (free overnight shipping). Powers the SRM850 (838whp/744wtq Mustang dyno) and SRM1000 (992whp/919wtq Mustang dyno) kits. The ECU and TCU are tuned together for seamless power delivery across all gears.", difficulty:"Professional",
        pros:["SRM ecosystem native","ECU+TCU bundled","SRM850/1000 proven","Free overnight shipping"],cons:["SRM parts ecosystem recommended","Less aftermarket community than APR"] },
      { id:"loadlogic", brand:"Load Logic",  label:"Custom Race Map", price:1200, rating:5.0,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Leaderboard #1 and #3 60-130 tuner. Works closely with ET Spec. Known for pushing limits safely on big single turbo builds. Often co-tunes with ET Spec on top leaderboard cars.", difficulty:"Professional",
        pros:["Leaderboard proven (#1, #3, #8)","Aggressive safe maps","ET Spec partnership"],cons:["Access limited","Full supporting mods required"] },
      { id:"c4_tuning", brand:"C4 Tuning",  label:"Custom Race Map",  price:1100, rating:4.9,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Appears on #2, #4, #6, #9 leaderboard builds. Specializes in big single turbo maps on E-fuel.", difficulty:"Professional",
        pros:["Multiple leaderboard entries","E-fuel specialist","Big turbo proven"],cons:["Waitlist common"] },
      { id:"etspec",    brand:"ET Spec",    label:"Custom Race Map",   price:1000, rating:4.8,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Partners with Load Logic and C4. Often co-tuner on leaderboard cars. Great for remote tune customers.", difficulty:"Professional",
        pros:["Co-tunes with Load Logic/C4","Remote-friendly","Community reputation"],cons:["Best with complementary tuner"] },
      { id:"selftuned",  brand:"Self Tuned", label:"DIY Map (COBB/HP Tuners)", price:300, rating:4.0,
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
      { id:"ngk_stock",
        brand:"NGK", label:"SILFER8C7ES — Stock / Stage 1 (0.028\")", price:18, rating:4.9,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"OEM plug for all C7/C7.5 4.0T. Part# 06K-905-601-M. Heat range 8. Gap: 0.028\". Audi updated the earlier S6/S7 spec in 2022 to match the RS7 plug — one plug now covers the entire 4.0T range. Fine for stock and Stage 1 builds on 93 octane or E30. Replace every 20–25K miles at stock, 15K at Stage 1. Set of 8 = ~$144.", difficulty:"DIY Friendly",
        pros:["OEM spec","Same plug for all 4.0T models","Iridium tip","Widely available"],
        cons:["Gap too wide for Stage 2+","Replace more frequently when tuned"] },
      { id:"ngk_s1_s2",
        brand:"NGK", label:"SILFER8C7ES — Stage 1/2 regapped (0.026\")", price:18, rating:5.0,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Same NGK SILFER8C7ES OEM plug, regapped to 0.026\" before install. EPL recommends this for Stage 1 performance builds. Tighter gap reduces misfire risk under boost. Community consensus on Audizine and AudiWorld for APR/COBB/Unitronic Stage 1–2. Change every 15–20K miles. Requires a spark plug gap tool — do not install at factory gap.", difficulty:"DIY Friendly",
        pros:["Community gold standard for S1/S2","Same OEM plug — no compatibility risk","Eliminates gap-related misfires"],
        cons:["Must regap before install","0.026\" is minimum for daily street use"] },
      { id:"brisk_er12s",
        brand:"Brisk Racing", label:"ER12S Silver — OEM+ / Stage 1 (0.028\")", price:11, rating:4.8,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"034Motorsport lists the Brisk ER12S as the OEM+ stock replacement for the C7 S6/S7/RS7 4.0T. One step colder than OEM. Silver center electrode — better electrical and thermal conductor than iridium. 14mm × 26.5mm reach, gasket seat. Does NOT come pre-gapped — must verify and set gap before install. Torque: 20–30 Nm. Change every 15–20K miles. Best Stage 1 daily driver upgrade with better heat dissipation than OEM NGK.", difficulty:"DIY Friendly",
        pros:["034Motorsport tested and confirmed","One step colder than OEM","Silver = better conductor than iridium","Better thermal management than NGK OEM"],
        cons:["Must gap before install","Higher cost per plug than NGK OEM"] },
      { id:"brisk_er10s",
        brand:"Brisk Racing", label:"ER10S Silver — Stage 2 / Hybrid / Big Turbo (0.024\")", price:11, rating:5.0,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Community preferred plug for Stage 2 through 700+ crank HP 4.0T builds. 034Motorsport confirmed for Stage 1/2 and hybrid/big turbo applications. A 4.0T tuner on Audizine stated: 'most run Brisk ER10S' at Stage 3 power levels. 1–2 steps colder than OEM. Non-projected tip handles high boost better — tip won't be blast-eroded by high-velocity charge. Silver electrode: far superior electrical and thermal conductor vs iridium. Gap: 0.024\" — comes unset, must gap before install. Change every 7,000–10,000 miles. Set of 8 = ~$88.", difficulty:"DIY Friendly",
        pros:["Community Stage 2–3 standard","Non-projected tip for high boost","Silver electrode — best conductor","034Motorsport tested","Fouling resistant"],
        cons:["Not pre-gapped — must set 0.024\" before install","7–10K change interval","Too cold for stock builds — will foul"] },
      { id:"ngk_s2_tight",
        brand:"NGK", label:"SILFER8C7ES — Stage 2 tight gap (0.024\")", price:18, rating:4.9,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"NGK SILFER8C7ES regapped to 0.024\" for Stage 2 builds on E30–E50. Tighter gap holds spark under higher cylinder pressure. APR previously recommended Denso IKH24 at this gap but moved back to NGK after cylinder 5 misfire reports on Denso. Change every 10–15K miles.", difficulty:"DIY Friendly",
        pros:["Proven Stage 2 setup","No Denso misfire risk","E30–E50 capable"],
        cons:["Too tight for stock — poor idle quality","Must gap precisely"] },
      { id:"ngk_s3_hybrid",
        brand:"NGK", label:"Heat Range 9 — Stage 3 / Hybrid Turbo (0.022\")", price:22, rating:4.8,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Step up to a colder heat range (HR9 equivalent) for Stage 3 hybrid turbo builds running E50–E75. The colder plug dissipates heat faster under sustained boost — prevents pre-ignition at 600–750 whp. Gap: 0.022\". Required when running SRM or TGK hybrid turbo setups on ethanol. Confirm exact NGK part number with your tuner as it varies by build spec. Change every 8–12K miles.", difficulty:"Professional",
        pros:["Colder heat range prevents pre-ignition","Required at 600+ whp on E-fuel","Standard on SRM ecosystem builds"],
        cons:["Confirm part# with tuner","Poor cold-start if heat range too cold for street"] },
      { id:"denso_race",
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
      { id:"liquimoly_5w40",
        brand:"Liqui-Moly", label:"Leichtlauf High Tech 5W-40 — All Stages", price:12, rating:5.0,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Most popular 4.0T oil in the Audizine and AudiWorld communities. Full synthetic, VW 502.00 certified, HTHS 3.5+ mPa·s. Liqui-Moly confirmed this is their recommended oil for the 3.0T and 4.0T. Available in 5L jugs — 2 jugs per change. Price is per liter. Full change kit ~$90–100 with MAHLE filter. Interval: 7,500 miles Stage 1/2; 5,000 miles Stage 3+.", difficulty:"DIY Friendly",
        pros:["Most popular in community","VW 502.00 certified","German engineering","HTHS 3.5+"],
        cons:["Pricier than Castrol","Sold in liters — metric conversion needed"] },
      { id:"motul_xcess_gen2",
        brand:"Motul", label:"8100 X-cess Gen2 5W-40 — All Stages", price:13, rating:4.9,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Preferred oil at VW/Audi specialist tuner shops. Full synthetic, VW 502.00 certified. HTHS 3.8 mPa·s in Gen2 — above the 3.5 minimum, better shear resistance under sustained turbo boost. JH Motorsports sells the full 4.0T kit (2×5L + MAHLE filter). Best choice for builds doing back-to-back pulls or track days. Motul specifically recommends X-cess (not X-Clean) for the 4.0T. Interval: 7,500 miles Stage 1/2; 5,000 miles Stage 3+.", difficulty:"DIY Friendly",
        pros:["HTHS 3.8 — above minimum","Tuner shop preferred","VW 502.00 certified","Better shear under sustained boost"],
        cons:["Slightly pricier than Liqui-Moly","Less widely stocked in retail stores"] },
      { id:"motul_xclean_5w40",
        brand:"Motul", label:"8100 X-Clean 5W-40 — DI Engines / Stage 2+", price:13, rating:4.8,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Motul 8100 X-Clean 5W-40 Gen2. Engineered specifically for direct-injection gasoline engines — targets exactly what the 4.0T DI system demands. HTHS 3.9 in Gen2 (highest in the Motul 8100 lineup). 100% synthetic. Note: carries VW 505.00/505.01 spec (not 502.00) — both are acceptable for the 4.0T, but X-Cess Gen2 (502.00) is the primary community recommendation. X-Clean is the stronger DI deposit-control choice. Confirm with tuner before switching.", difficulty:"DIY Friendly",
        pros:["HTHS 3.9 — highest in Motul 8100 range","100% synthetic","DI-optimized formula","Best deposit control"],
        cons:["VW 505.00 spec, not 502.00 — confirm with tuner","X-Cess is primary 4.0T recommendation"] },
      { id:"castrol_edge_5w40",
        brand:"Castrol", label:"EDGE 5W-40 — Stock / Stage 1 (OEM dealer fill)", price:10, rating:4.7,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"US Audi dealer OEM fill. VW 502.00 certified. Widely available at auto parts stores nationwide. Solid choice for stock or Stage 1 builds on a budget. HTHS at the 3.5 minimum spec. Best for warranty-period oil changes. Not the first choice for Stage 3+ where HTHS headroom matters. Interval: 7,500–10,000 miles stock; 5,000–7,500 Stage 1/2.", difficulty:"DIY Friendly",
        pros:["Cheapest VW 502.00 option","Widely available everywhere","OEM dealer spec","Good for warranty period"],
        cons:["HTHS at minimum spec only","Not ideal for Stage 3+ sustained boost"] },
      { id:"mobil1_0w40",
        brand:"Mobil 1", label:"FS 0W-40 — Cold Climate / Turbo Startup Protection", price:11, rating:4.8,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"0W-40 flows faster than 5W-40 at cold start — better immediate turbo bearing lubrication in the first 10 seconds. VW 502.00 certified. HTHS 3.7. Popular for RS7/S7 builds in cold climates or cars that sit extended periods. Same hot viscosity as 5W-40 — no sacrifice under load. Audizine community frequently recommends for builds that run hard from cold.", difficulty:"DIY Friendly",
        pros:["Fastest cold-start flow","Better turbo startup protection","VW 502.00 certified","HTHS 3.7"],
        cons:["Slight viscosity drop vs 5W-40 at extreme sustained heat","Less community data than Liqui-Moly/Motul"] },
      { id:"motul_xpower_10w60",
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
      { id:"tgk_wg",   brand:"TGK Motorsport", label:"60mm Vacuum Wastegate Kit",  price:700, rating:5.0,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"60mm diaphragm — 150% larger than stock. Billet T6061 aluminum, Nomex diaphragm. Maintains factory vacuum-style gate: no MAC valve needed, simplifies tuning. Requires DS1 tune recalibration before WOT (TGK offers wastegate tuning calibration service). CRITICAL: NOT recommended for stock-sized S6/S7 turbos — 60mm cannot dial down enough, risks overspin.", difficulty:"Professional",
        pros:["60mm vs stock","No MAC valve needed","Holds 30+ PSI","Billet construction"],cons:["DS1 recalibration required before WOT","Not safe with OEM S6/S7 turbos","Tuner coordination needed"] },
      { id:"tial_wg",  brand:"Tial",           label:"MVI Wastegate Actuators",    price:750, rating:4.8,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Tial MVI actuators are included in the SRM1000 kit. Integrated vacuum-style design. Well-proven on 4.0T turbo builds. Preferred by Load Logic and C4 tuners running SRM or Xona builds.", difficulty:"Professional",
        pros:["SRM1000 kit standard","Leaderboard proven","Tial motorsport pedigree"],cons:["More expensive than TGK","Must confirm fitment by chassis"] },
      { id:"srm_wg",   brand:"SRM",            label:"High Vacuum Upgraded Actuators", price:650, rating:4.8,
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
      { id:"xona_5357", brand:"Xona Rotor", label:"XR5357S (Compact)",    price:3200, rating:4.8,
        hp:{a6_20t:180,a6_30t:170,a7_20t:180,a7_30t:170,s6:280,s7:280,a8:280,s8:300,rs6:320,rs7:320},
        torque:{a6_20t:230,a6_30t:220,a7_20t:230,a7_30t:220,s6:350,s7:350,a8:350,s8:370,rs6:390,rs7:390},
        notes:"Leaderboard: Neil Otis ran 4.96s 60-130. Fast spool, strong mid-range. Best street/strip balance.", difficulty:"Professional",
        pros:["Fast spool","Street-friendly","Leaderboard proven"],cons:["Lower ceiling than 5657"] },
      { id:"xona_5657", brand:"Xona Rotor", label:"XR5657S (King)",        price:3600, rating:5.0,
        hp:{a6_20t:210,a6_30t:190,a7_20t:210,a7_30t:190,s6:320,s7:320,a8:320,s8:345,rs6:370,rs7:370},
        torque:{a6_20t:260,a6_30t:240,a7_20t:260,a7_30t:240,s6:395,s7:395,a8:395,s8:418,rs6:440,rs7:440},
        notes:"LEADERBOARD #1 (4.10s) and #6 (4.97s). Most popular performance choice on the list. Billet 7-blade.", difficulty:"Professional",
        pros:["Leaderboard #1 turbo","Billet compressor","Best power/spool balance"],cons:["Needs E60+ for full power"] },
      { id:"xona_6564", brand:"Xona Rotor", label:"XR6564S (Big Frame)",   price:4200, rating:4.9,
        hp:{a6_20t:240,a6_30t:220,a7_20t:240,a7_30t:220,s6:360,s7:360,a8:360,s8:385,rs6:410,rs7:410},
        torque:{a6_20t:290,a6_30t:270,a7_20t:290,a7_30t:270,s6:430,s7:430,a8:430,s8:455,rs6:480,rs7:480},
        notes:"Leaderboard #2 (4.49s, built engine). Highest ceiling on list. Built engine recommended for full power.", difficulty:"Professional",
        pros:["Highest power ceiling","Leaderboard #2","Best top-end"],cons:["Built engine recommended","Slower spool"] },
      { id:"ts1",        brand:"Turbosmart", label:"TS1 Hybrid",            price:2800, rating:4.7,
        hp:{a6_20t:175,a6_30t:165,a7_20t:175,a7_30t:165,s6:270,s7:270,a8:270,s8:290,rs6:310,rs7:310},
        torque:{a6_20t:220,a6_30t:210,a7_20t:220,a7_30t:210,s6:340,s7:340,a8:340,s8:360,rs6:380,rs7:380},
        notes:"Leaderboard #7 (5.04s, Marcus Maroney). Hybrid built on stock frame. OEM turbo housing retained.", difficulty:"Professional",
        pros:["Stock location","Easier install","Good spool"],cons:["Lower ceiling than Xona singles"] },
      { id:"ts2plus",    brand:"Turbosmart", label:"TS2+ Hybrid",           price:3100, rating:4.7,
        hp:{a6_20t:185,a6_30t:175,a7_20t:185,a7_30t:175,s6:285,s7:285,a8:285,s8:305,rs6:325,rs7:325},
        torque:{a6_20t:235,a6_30t:225,a7_20t:235,a7_30t:225,s6:355,s7:355,a8:355,s8:375,rs6:395,rs7:395},
        notes:"Leaderboard #10 (5.24s, Sean Fallon). More aggressive hybrid build than TS1. Better top-end.", difficulty:"Professional",
        pros:["Stock location","Better top-end than TS1","OEM+ fitment"],cons:["More lag than TS1"] },
      { id:"g40_1150",   brand:"Garrett",    label:"G40-1150 Single",       price:3400, rating:4.7,
        hp:{a6_20t:190,a6_30t:180,a7_20t:190,a7_30t:180,s6:295,s7:295,a8:295,s8:315,rs6:335,rs7:335},
        torque:{a6_20t:240,a6_30t:230,a7_20t:240,a7_30t:230,s6:365,s7:365,a8:365,s8:385,rs6:405,rs7:405},
        notes:"Leaderboard #8 (5.11s) and #9 (5.23s). Well-proven Garrett single. Broad powerband.", difficulty:"Professional",
        pros:["Broad powerband","Proven reliability","Garrett support"],cons:["Bigger install than hybrids"] },
      { id:"g45_1500",   brand:"Garrett",    label:"G45-1500 Single",       price:3900, rating:4.8,
        hp:{a6_20t:215,a6_30t:200,a7_20t:215,a7_30t:200,s6:330,s7:330,a8:330,s8:355,rs6:380,rs7:380},
        torque:{a6_20t:265,a6_30t:250,a7_20t:265,a7_30t:250,s6:400,s7:400,a8:400,s8:425,rs6:450,rs7:450},
        notes:"Leaderboard #4 (4.80s, Adam Emm). Larger Garrett option. Bigger top-end than G40.", difficulty:"Professional",
        pros:["Higher ceiling than G40","Leaderboard proven","Good spool for size"],cons:["More lag","More complex install"] },
      { id:"pp_rs_plus",  brand:"Pinnacle Perf.", label:"RS+ 47/60 Billet (Jon)", price:1000, rating:4.7,
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
      { id:"autotech_hpfp", brand:"Autotech", label:"Dual HPFP Upgrade Kit",   price:520, rating:5.0,
        hp:{a6_20t:5,a6_30t:5,a7_20t:5,a7_30t:5,s6:8,s7:8,a8:8,s8:9,rs6:10,rs7:10},
        torque:{a6_20t:8,a6_30t:8,a7_20t:8,a7_30t:8,s6:12,s7:12,a8:12,s8:14,rs6:15,rs7:15},
        notes:"The benchmark HPFP upgrade — the original DLC-coated piston kit. Match-ground and serialized. 5% torque gain, +10 Bar fuel rail pressure per Autotech spec. Lifetime warranty. 4.0T needs 2 kits (price shown for pair). First to use plasma DLC coating. Trusted by SRM, TGK, and most serious 4.0T tuners.", difficulty:"DIY Friendly",
        pros:["Benchmark product","DLC coated","Match-ground precision","Lifetime warranty"],cons:["Requires specialty tool","2 kits needed for 4.0T"] },
      { id:"034_hpfp",      brand:"034 Motorsport", label:"HPFP Piston Upgrade Kit", price:480, rating:4.9,
        hp:{a6_20t:5,a6_30t:5,a7_20t:5,a7_30t:5,s6:8,s7:8,a8:8,s8:9,rs6:10,rs7:10},
        torque:{a6_20t:7,a6_30t:7,a7_20t:7,a7_30t:7,s6:11,s7:11,a8:11,s8:12,rs6:13,rs7:13},
        notes:"034 Motorsport HPFP piston upgrade for C7/C7.5 S6/S7/RS6/RS7. Up to 50% flow increase over stock per 034 spec. DLC coated piston and cylinder, aerospace tolerances. Drop-in replacement into factory pump housings. 034 sells a matching install tool separately.", difficulty:"DIY Friendly",
        pros:["50% flow increase","DLC + aerospace tolerances","034 ecosystem","Matching install tool available"],cons:["Requires specialty install tool","2 kits for 4.0T"] },
      { id:"ie_hpfp",      brand:"IE",           label:"HPFP Internal Kit",        price:449, rating:4.8,
        hp:{a6_20t:5,a6_30t:5,a7_20t:5,a7_30t:5,s6:8,s7:8,a8:8,s8:9,rs6:10,rs7:10},
        torque:{a6_20t:7,a6_30t:7,a7_20t:7,a7_30t:7,s6:10,s7:10,a8:10,s8:12,rs6:13,rs7:13},
        notes:"IE 11.67mm piston upgrade for C7/C7.5 4.0TT. 50% flow increase. Constant-diameter piston (not stepped) for better seal contact. Each pump dyno-tested before shipping. 12-month unlimited miles warranty. 2 complete kits included in price.", difficulty:"DIY Friendly",
        pros:["Constant-diameter piston","Dyno-tested","12-mo warranty","2 kits included"],cons:["Requires IE install tool","Slightly less field data than Autotech"] },
      { id:"loba_hpfp",    brand:"Loba",         label:"600cc HPFP",               price:475, rating:4.7,
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
      { id:"cobb_flex",  brand:"COBB",    label:"Flex Fuel Kit",      price:399, rating:4.6,
        hp:{a6_20t:20,a6_30t:18,a7_20t:20,a7_30t:18,s6:35,s7:35,a8:35,s8:40,rs6:45,rs7:45},
        torque:{a6_20t:25,a6_30t:22,a7_20t:25,a7_30t:22,s6:45,s7:45,a8:45,s8:50,rs6:55,rs7:55},
        notes:"Sensor + Accessport integration. Real-time blend detection.", difficulty:"Professional",
        pros:["AP integration","Real-time blending"],cons:["COBB tune required"] },
      { id:"walbro_flex", brand:"Walbro", label:"E85 Injector Kit",   price:650, rating:4.7,
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
      { id:"srm_port",  brand:"SRM",     label:"Port Injection Kit",  price:1800, rating:4.9,
        hp:{a6_20t:20,a6_30t:18,a7_20t:20,a7_30t:18,s6:40,s7:40,a8:40,s8:45,rs6:50,rs7:50},
        torque:{a6_20t:25,a6_30t:22,a7_20t:25,a7_30t:22,s6:50,s7:50,a8:50,s8:55,rs6:60,rs7:60},
        notes:"SRM port injection appears on 7 of top 10 60-130 leaderboard builds. Pairs directly with SRM manifolds and W2A IC.", difficulty:"Professional",
        pros:["Leaderboard dominant","SRM ecosystem synergy","Full kit"],cons:["SRM manifolds preferred"] },
      { id:"gen_port",  brand:"Generic / Shop", label:"Port Injection (Shop Build)", price:1400, rating:4.5,
        hp:{a6_20t:18,a6_30t:16,a7_20t:18,a7_30t:16,s6:35,s7:35,a8:35,s8:40,rs6:44,rs7:44},
        torque:{a6_20t:22,a6_30t:20,a7_20t:22,a7_30t:20,s6:44,s7:44,a8:44,s8:49,rs6:54,rs7:54},
        notes:"Custom shop-built port injection. Works with any manifold. Lower cost but more integration work.", difficulty:"Professional",
        pros:["Lower cost","Works with any manifold"],cons:["More shop time","Less plug-and-play"] },
      { id:"meth_kit",  brand:"AEM",     label:"Methanol Injection",  price:699, rating:4.6,
        hp:{a6_20t:15,a6_30t:13,a7_20t:15,a7_30t:13,s6:30,s7:30,a8:30,s8:34,rs6:38,rs7:38},
        torque:{a6_20t:18,a6_30t:16,a7_20t:18,a7_30t:16,s6:38,s7:38,a8:38,s8:42,rs6:46,rs7:46},
        notes:"Leaderboard #3, #7, #8 use meth. Cools intake charge. Lower cost alternative to full port injection.", difficulty:"DIY Friendly",
        pros:["Lower cost than port","Charge cooling","Good results"],cons:["Less power than port","Fluid tank to manage"] },
    ]
  },

  // ── INTAKE ────────────────────────────────────────────────────────────
  {
    id:"cai", cat:"Intake", name:"Cold Air / High-Flow Intake",
    desc:"Improves airflow and charge temps. Unlocks tune headroom. High-flow intakes pair best with an upgraded intercooler.",
    tag:"SOUNDS GREAT", requires:[], recommends:["ecu_s1","intercooler"], conflicts:[],
    variants:[
      { id:"ie_cai",    brand:"IE",        label:"Carbon Fiber Intake",   price:649, rating:4.9,
        hp:{a6_20t:12,a6_30t:10,a7_20t:12,a7_30t:10,s6:16,s7:16,a8:16,s8:17,rs6:18,rs7:18},
        torque:{a6_20t:12,a6_30t:10,a7_20t:12,a7_30t:10,s6:14,s7:14,a8:14,s8:16,rs6:18,rs7:18},
        notes:"Full carbon housing. Best IAT reduction available.", difficulty:"DIY Friendly",
        pros:["Best IATs","Carbon aesthetics"],cons:["Most expensive intake"] },
      { id:"awe_cai",   brand:"AWE",       label:"AirGate Intake",        price:449, rating:4.7,
        hp:{a6_20t:10,a6_30t:8,a7_20t:10,a7_30t:8,s6:13,s7:13,a8:13,s8:14,rs6:15,rs7:15},
        torque:{a6_20t:10,a6_30t:8,a7_20t:10,a7_30t:8,s6:12,s7:12,a8:12,s8:13,rs6:14,rs7:14},
        notes:"No-MAF design. Stage 2 favorite. Great sound.", difficulty:"DIY Friendly",
        pros:["No MAF concerns","Easy install","Great sound"],cons:["Slightly lower peak than IE"] },
      { id:"eventuri",  brand:"Eventuri",  label:"Carbon Intake System",  price:899, rating:4.9,
        hp:{a6_20t:14,a6_30t:12,a7_20t:14,a7_30t:12,s6:18,s7:18,a8:18,s8:20,rs6:22,rs7:22},
        torque:{a6_20t:14,a6_30t:12,a7_20t:14,a7_30t:12,s6:17,s7:17,a8:17,s8:18,rs6:20,rs7:20},
        notes:"Full carbon with heat shield. Show-car quality. Best overall flow.", difficulty:"DIY Friendly",
        pros:["Best flow","Heat shielded","Show quality"],cons:["Premium price"] },
      { id:"ecs_cai",   brand:"ECS Tuning",label:"Performance Intake",    price:329, rating:4.5,
        hp:{a6_20t:8,a6_30t:7,a7_20t:8,a7_30t:7,s6:11,s7:11,a8:11,s8:12,rs6:13,rs7:13},
        torque:{a6_20t:8,a6_30t:7,a7_20t:8,a7_30t:7,s6:10,s7:10,a8:10,s8:11,rs6:12,rs7:12},
        notes:"Best-value direct-fit kit. Good for Stage 1 builds on budget.", difficulty:"DIY Friendly",
        pros:["Best price","Direct-fit"],cons:["Lower peak gains"] },
      { id:"tgk_4in",   brand:"TGK Motorsport", label:"4\" Merged Inlet Intake", price:399, rating:4.9,
        hp:{a6_20t:11,a6_30t:9,a7_20t:11,a7_30t:9,s6:15,s7:15,a8:15,s8:16,rs6:17,rs7:17},
        torque:{a6_20t:11,a6_30t:9,a7_20t:11,a7_30t:9,s6:13,s7:13,a8:13,s8:15,rs6:17,rs7:17},
        notes:"4.0T-specific design. Single 4\" merged inlet feeds both turbos from one filter. 3D-scanned for perfect fitment. Extremely loud induction noise — the most aggressive intake sound on the platform. Pairs naturally with TGK BOV. Highly reviewed for sound and performance data. Available with OEM airbox conversion or open air filter.", difficulty:"DIY Friendly",
        pros:["Loudest induction sound","Perfect C7 fitment","Strong community reviews","Pairs with TGK BOV"],cons:["Single-filter design not stealth","Backorder common"] },
      { id:"tgk_5in",   brand:"TGK Motorsport", label:"5\" Conversion Kit (1000+HP)", price:499, rating:4.8,
        hp:{a6_20t:13,a6_30t:11,a7_20t:13,a7_30t:11,s6:18,s7:18,a8:18,s8:20,rs6:22,rs7:22},
        torque:{a6_20t:13,a6_30t:11,a7_20t:13,a7_30t:11,s6:16,s7:16,a8:16,s8:18,rs6:20,rs7:20},
        notes:"Upgrade from TGK 4\" to 5\" filter system. 2,000+ CFM flow capacity. Future-proofs for turbo upgrades. Multi-layer pleated cotton filter. Supports 1000+ HP builds. Requires TGK 4\" intake first.", difficulty:"DIY Friendly",
        pros:["2000+ CFM","1000HP capable","Future-proof","Minimal restriction"],cons:["Requires TGK 4\" base first","Larger filter aesthetics"] },
      { id:"srm_intake", brand:"SRM", label:"2.5\" Luftwaffe Intake (C7)",      price:595, rating:4.8,
        hp:{a6_20t:12,a6_30t:10,a7_20t:12,a7_30t:10,s6:16,s7:16,a8:16,s8:18,rs6:20,rs7:20},
        torque:{a6_20t:11,a6_30t:9,a7_20t:11,a7_30t:9,s6:14,s7:14,a8:14,s8:16,rs6:18,rs7:18},
        notes:"SRM Luftwaffe — the largest intake available for the C7 4.0T platform. Full 2.5\" intake runner all the way to the turbo inlet. 5-axis CNC machined inlets welded to mandrel-bent tubing. Drops inlet depression from 750 mbar (stock) to under 900 mbar, freeing 3-4 PSI at top end. 30-40 HP gains at redline per SRM spec. Core of the SRM850 and SRM1000 kits. Note: S8/D4 chassis uses a separate SRM 3\" dual intake ($895) due to different space constraints.", difficulty:"DIY Friendly",
        pros:["2.5\" full runner to turbo","3-4 PSI top-end gain","SRM ecosystem native","CNC 5-axis machined inlets"],cons:["C7 only — D4 S8 needs separate SKU","Less aggressive sound than TGK single-filter"] },
      { id:"srm_s8_intake", brand:"SRM", label:"3\" Dual Intake (S8 / D4)",     price:895, rating:4.8,
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
      { id:"tgk_bov",   brand:"TGK Motorsport", label:"BOV Conversion Kit",   price:700, rating:5.0,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Converts OEM electronic diverter valves to mechanical BOV. Uses factory vacuum and boost reference port — stays fully closed under boost, eliminates boost leaks. Removes recirculation noise and replaces with full BOV sound. 5.0/5.0 rating across 14 reviews. Easy install. Pairs perfectly with TGK intake for maximum induction theater.", difficulty:"DIY Friendly",
        pros:["Eliminates boost leaks","Full BOV sound","Easy install","Pairs with TGK intake"],cons:["BOV sound — not for sleeper builds","Check MAF tuning compatibility"] },
      { id:"gfb_dv",    brand:"GFB",            label:"DV+ Diverter Valve",   price:89,  rating:4.6,
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
      { id:"awe_dp",     brand:"AWE",      label:"Tuning DP",          price:849, rating:4.8,
        hp:{a6_20t:16,a6_30t:13,a7_20t:16,a7_30t:13,s6:22,s7:22,a8:22,s8:25,rs6:28,rs7:28},
        torque:{a6_20t:19,a6_30t:16,a7_20t:19,a7_30t:16,s6:27,s7:27,a8:27,s8:30,rs6:33,rs7:33},
        notes:"304 SS. Optional resonated version available.", difficulty:"Professional",
        pros:["304 SS","Optional resonated","Great fitment"],cons:["No cat option"] },
      { id:"milltek_dp", brand:"Milltek",  label:"Sport HFC DP",       price:895, rating:4.7,
        hp:{a6_20t:14,a6_30t:11,a7_20t:14,a7_30t:11,s6:19,s7:19,a8:19,s8:22,rs6:24,rs7:24},
        torque:{a6_20t:17,a6_30t:14,a7_20t:17,a7_30t:14,s6:24,s7:24,a8:24,s8:26,rs6:29,rs7:29},
        notes:"HFC option for emissions areas. Polished flanges. UK-made.", difficulty:"Professional",
        pros:["HFC option","Premium finish"],cons:["Slightly less peak vs catless"] },
      { id:"ie_dp",      brand:"IE",       label:"Race Catless DP",    price:749, rating:4.8,
        hp:{a6_20t:16,a6_30t:13,a7_20t:16,a7_30t:13,s6:22,s7:22,a8:22,s8:24,rs6:27,rs7:27},
        torque:{a6_20t:18,a6_30t:15,a7_20t:18,a7_30t:15,s6:26,s7:26,a8:26,s8:28,rs6:31,rs7:31},
        notes:"Best value catless DP. Widely used on APR Stage 2 builds.", difficulty:"Professional",
        pros:["Best price","Race quality"],cons:["Catless — check local laws"] },
      { id:"ecs_dp",     brand:"ECS Tuning",label:"Catless Race DP",   price:649, rating:4.5,
        hp:{a6_20t:14,a6_30t:11,a7_20t:14,a7_30t:11,s6:19,s7:19,a8:19,s8:22,rs6:24,rs7:24},
        torque:{a6_20t:16,a6_30t:13,a7_20t:16,a7_30t:13,s6:23,s7:23,a8:23,s8:26,rs6:28,rs7:28},
        notes:"Lowest price catless option. Good entry point for Stage 2 budget builds.", difficulty:"Professional",
        pros:["Lowest price","304 SS"],cons:["Less refinement than IE/AWE"] },
      { id:"arm_dp",     brand:"ARM Motorsports", label:"Catless Race DP", price:699, rating:4.8,
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
      { id:"034_resx",  brand:"034 Motorsport", label:"Res-X Resonator Delete", price:349, rating:4.7,
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
      { id:"awe_cb",      brand:"AWE",        label:"Touring Edition",    price:1749, rating:4.8,
        hp:{a6_20t:5,a6_30t:5,a7_20t:5,a7_30t:5,s6:8,s7:8,a8:8,s8:9,rs6:10,rs7:10},
        torque:{a6_20t:5,a6_30t:5,a7_20t:5,a7_30t:5,s6:8,s7:8,a8:8,s8:9,rs6:10,rs7:10},
        notes:"Drone-free highway. Great WOT sound. Lifetime warranty.", difficulty:"Professional",
        pros:["No drone","Lifetime warranty"],cons:["Not the most aggressive"] },
      { id:"milltek_cb",  brand:"Milltek",    label:"Non-Resonated",      price:1950, rating:4.7,
        hp:{a6_20t:6,a6_30t:5,a7_20t:6,a7_30t:5,s6:9,s7:9,a8:9,s8:10,rs6:11,rs7:11},
        torque:{a6_20t:6,a6_30t:5,a7_20t:6,a7_30t:5,s6:9,s7:9,a8:9,s8:10,rs6:11,rs7:11},
        notes:"Aggressive tone. Some highway drone. Premium UK finish.", difficulty:"Professional",
        pros:["More aggressive","Premium finish"],cons:["Highway drone possible"] },
      { id:"milltek_res", brand:"Milltek",    label:"Resonated",          price:1799, rating:4.6,
        hp:{a6_20t:5,a6_30t:5,a7_20t:5,a7_30t:5,s6:7,s7:7,a8:7,s8:8,rs6:9,rs7:9},
        torque:{a6_20t:5,a6_30t:5,a7_20t:5,a7_30t:5,s6:7,s7:7,a8:7,s8:8,rs6:9,rs7:9},
        notes:"Quieter daily option. UK tone without drone. Good for street builds.", difficulty:"Professional",
        pros:["No drone","UK quality"],cons:["Less aggressive than non-res"] },
      { id:"akra_cb",     brand:"Akrapovič",  label:"Slip-On Titanium",   price:2800, rating:4.9,
        hp:{a6_20t:7,a6_30t:6,a7_20t:7,a7_30t:6,s6:11,s7:11,a8:11,s8:12,rs6:13,rs7:13},
        torque:{a6_20t:6,a6_30t:5,a7_20t:6,a7_30t:5,s6:10,s7:10,a8:10,s8:11,rs6:12,rs7:12},
        notes:"Titanium. Valve-controlled sound. OEM+ aesthetics.", difficulty:"Professional",
        pros:["Titanium","Sound valve","Prestige brand"],cons:["Highest price"] },
      { id:"ecs_cb",      brand:"ECS Tuning", label:"Valved Cat-Back",    price:1199, rating:4.4,
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
      { id:"mishimoto_oc", brand:"Mishimoto", label:"Oil Cooler Kit", price:349, rating:4.7,
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
      { id:"srm_mani",  brand:"SRM",     label:"Upgraded Exhaust Manifolds + Turbine Housing", price:1395, rating:5.0,
        hp:{a6_20t:25,a6_30t:22,a7_20t:25,a7_30t:22,s6:50,s7:50,a8:50,s8:52,rs6:55,rs7:55},
        torque:{a6_20t:30,a6_30t:27,a7_20t:30,a7_30t:27,s6:60,s7:60,a8:60,s8:62,rs6:65,rs7:65},
        notes:"Drop-in replacement for the highly restrictive OEM manifolds. SRM states 50+ HP gains depending on setup. Fixes the cylinder 5 misfire caused by excessive exhaust backpressure (EMAP). Compatible with factory downpipe. Required for all SRM turbo kits (SRM850 and SRM1000). Appears on 7 of 10 top leaderboard 60-130 builds.", difficulty:"Professional",
        pros:["$1,395 — best value manifold","Fixes cyl 5 misfire","50+ HP gain","Factory DP compatible"],cons:["Requires tuner recalibration for full gains","Professional install required"] },
      { id:"klassen_mani",brand:"Klassen", label:"Klassen Manifolds",      price:2800, rating:4.7,
        hp:{a6_20t:20,a6_30t:18,a7_20t:20,a7_30t:18,s6:38,s7:38,a8:38,s8:43,rs6:48,rs7:48},
        torque:{a6_20t:25,a6_30t:22,a7_20t:25,a7_30t:22,s6:48,s7:48,a8:48,s8:53,rs6:58,rs7:58},
        notes:"Leaderboard #3 (Skip Hickey, 4.71s). Strong alternative to SRM. Used on D4.5 S8 builds.", difficulty:"Professional",
        pros:["Leaderboard proven","Strong D4/S8 fitment"],cons:["Less common than SRM"] },
      { id:"fra_mani",   brand:"FRA",     label:"FRA Manifolds",           price:2600, rating:4.6,
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
      { id:"apr_dsg",  brand:"APR",       label:"DSG Tune",        price:399, rating:4.9,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Launch control, faster shifts. Best with APR engine tune.", difficulty:"Plug & Play",
        pros:["Launch control","Fast shifts"],cons:["APR tune preferred"] },
      { id:"uni_dsg",  brand:"Unitronic", label:"DQ500 Stage 1",   price:429, rating:4.8,
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
      { id:"kw_v3",      brand:"KW",       label:"Variant 3",      price:2249, rating:4.9,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Independent compression + rebound. German. Daily + track.", difficulty:"Professional",
        pros:["Fully adjustable","Lifetime warranty"],cons:["Expensive"] },
      { id:"bilstein_b16",brand:"Bilstein",label:"B16 Dynamic",    price:1899, rating:4.8,
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
      { id:"whiteline_sb",brand:"Whiteline",label:"Adjustable Set", price:599, rating:4.7,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"3-position adjustable. Front and rear set.", difficulty:"DIY Friendly",
        pros:["Adjustable","Front+rear"],cons:["Bushing wear over time"] },
      { id:"034_rsb",   brand:"034 Motorsport", label:"Adjustable Solid Rear Sway Bar", price:395, rating:4.9,
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
      { id:"034_mm",    brand:"034 Motorsport", label:"Street Density Motor Mounts", price:449, rating:4.8,
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
      { id:"align_std", brand:"Shop", label:"4-Wheel + Corner Balance", price:250, rating:5.0,
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
      { id:"hawk_hps",  brand:"Hawk",  label:"HPS 5.0",       price:189, rating:4.7,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Best street/sport balance. Low dust. Good cold bite.", difficulty:"DIY Friendly",
        pros:["Low dust","Cold bite","Easy install"],cons:["Not for track"] },
      { id:"pagid_rs",  brand:"Pagid", label:"RS 4-2 Track",  price:380, rating:4.9,
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
      { id:"stoptech_bbk",brand:"StopTech",  label:"Trophy Sport 380", price:2999, rating:4.8,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"380mm 6-piston front. Best value full BBK.", difficulty:"Professional",
        pros:["380mm rotors","6-piston","Best value"],cons:["Check wheel clearance"] },
      { id:"brembo_bbk",  brand:"Brembo",    label:"GT 6-Pot Kit",     price:3800, rating:4.9,
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
      { id:"srm_a2a",    brand:"SRM",       label:"A2A Intercooler (CSF Core)",  price:2995, rating:5.0,
        hp:{a6_20t:18,a6_30t:15,a7_20t:18,a7_30t:15,s6:25,s7:25,a8:25,s8:28,rs6:30,rs7:30},
        torque:{a6_20t:20,a6_30t:17,a7_20t:20,a7_30t:17,s6:28,s7:28,a8:28,s8:32,rs6:35,rs7:35},
        notes:"Converts OEM air-to-water to full air-to-air. CSF core: 510mm×380mm×90mm (20\"×15\"×3.5\"). Billet end tanks TIG-welded in-house. Lowest IATs over ambient, fastest recovery times. Appears on top leaderboard runs. Note: loses night vision on C7 (not S8).", difficulty:"Professional",
        pros:["Best IAT recovery","Leaderboard standard","Replaces failure-prone OEM unit","Integrates port injection"],cons:["$2,995 price point","Loses C7 night vision","10-day lead time"] },
      { id:"sean_east_ic", brand:"Sean East", label:"A2A + Chiller System",      price:3200, rating:4.9,
        hp:{a6_20t:19,a6_30t:16,a7_20t:19,a7_30t:16,s6:26,s7:26,a8:26,s8:29,rs6:32,rs7:32},
        torque:{a6_20t:21,a6_30t:18,a7_20t:21,a7_30t:18,s6:30,s7:30,a8:30,s8:34,rs6:37,rs7:37},
        notes:"Leaderboard #5 (Neil Otis, 4.96s). Sean East's full A2A system with an active chiller. Best sustained IATs under back-to-back pulls. Preferred for roll racing and track days.", difficulty:"Professional",
        pros:["Best sustained IATs","Active chiller included","Leaderboard proven"],cons:["Highest IC price","Larger footprint"] },
      { id:"ie_fmic",    brand:"IE",        label:"Front Mount A2A FMIC",        price:949,  rating:4.9,
        hp:{a6_20t:16,a6_30t:13,a7_20t:16,a7_30t:13,s6:22,s7:22,a8:22,s8:24,rs6:27,rs7:27},
        torque:{a6_20t:19,a6_30t:16,a7_20t:19,a7_30t:16,s6:26,s7:26,a8:26,s8:29,rs6:32,rs7:32},
        notes:"Best-value front-mount A2A for C7. Largest available A2A core. Solid Stage 2 choice for builds not running full SRM ecosystem.", difficulty:"Professional",
        pros:["Best A2A value","Large core","No night vision loss"],cons:["Less recovery speed than SRM A2A at high RPM"] },
      { id:"ecs_fmic",   brand:"ECS Tuning",label:"Competition A2A FMIC",        price:699,  rating:4.5,
        hp:{a6_20t:14,a6_30t:11,a7_20t:14,a7_30t:11,s6:19,s7:19,a8:19,s8:22,rs6:24,rs7:24},
        torque:{a6_20t:16,a6_30t:13,a7_20t:16,a7_30t:13,s6:22,s7:22,a8:22,s8:25,rs6:28,rs7:28},
        notes:"Budget-friendly A2A option. Direct fit, no cutting. Good for Stage 1–2 daily builds watching budget.", difficulty:"Professional",
        pros:["Best price A2A","Direct fit","Stage 2 capable"],cons:["Smaller core than SRM/IE","Less effective at 600+whp"] },
      { id:"wagner_fmic", brand:"Wagner",   label:"Competition A2A FMIC",        price:1099, rating:4.8,
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
      { id:"jxb_wavetrac", brand:"JXB Performance", label:"Retrofitted Wavetrac LSD", price:2299, rating:5.0,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"The ONLY true rear LSD available for C7 S6/S7 and RS6/RS7. JXB retrofits a Wavetrac helical unit into your OEM diff housing. No clutch packs — pure gear-based. No NVH, no noise. Fits diff codes MNB (C7 S6/S7) and NPR (C7 RS6/RS7, D4 A8/S8). Sport Diff owners must code out Sport Diff via VCDS before removal. From $2,299.99 (send-in) — higher if JXB sources the diff.", difficulty:"Professional",
        pros:["Only C7 rear LSD option","No NVH/noise","Helical — no clutch wear","Street and drag"],cons:["Must send in your diff","Sport Diff needs VCDS coding first","Premium price"] },
      { id:"peloquin",   brand:"Peloquin",  label:"Torque Biasing Diff",        price:1199, rating:4.7,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Helical torque-biasing design. Smoothest street engagement of any LSD. Best for daily drivers who want improved traction without noise or clutch-type harshness.", difficulty:"Professional",
        pros:["Smoothest engagement","No noise","Great daily driver"],cons:["Less aggressive than JXB Wavetrac","Lower locking force"] },
      { id:"os_giken",   brand:"OS Giken",  label:"Triple Plate Clutch LSD",    price:2200, rating:4.9,
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
      { id:"etspec_tcu", brand:"ET Spec",   label:"ZF8HP / DL501 TCU Tune",    price:399, rating:5.0,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"ET Spec is SRM's preferred TCU tuner. Covers both ZF8HP (S6/S7/RS6/RS7) and DL501 (S6/S7). Available as standalone or bundled with DS1 ECU tune at $1,299 combo. Appears on multiple leaderboard builds as the co-tune alongside Load Logic or C4.", difficulty:"Plug & Play",
        pros:["SRM preferred tuner","Leaderboard co-tune","ZF8+DL501 coverage","Bundle available"],cons:["Best value in DS1 combo","Remote tune process"] },
      { id:"apr_tcu",  brand:"APR",       label:"ZF8 TCU Tune",                price:499, rating:4.9,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Most popular ZF8HP TCU tune for street builds. Launch control, faster shifts, raised torque limits. Best paired with APR engine tune.", difficulty:"Plug & Play",
        pros:["Launch control","Fast shifts","APR ECU synergy","Largest community"],cons:["APR engine tune preferred","ZF8 only"] },
      { id:"uni_tcu",  brand:"Unitronic", label:"ZF8 TCU Stage 1",              price:449, rating:4.8,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Aggressive ZF8HP mapping, highest torque limit raise of OTS options. Pairs best with Unitronic engine tune.", difficulty:"Plug & Play",
        pros:["Highest TQ limit OTS","Unitronic synergy","Aggressive shifts"],cons:["Unitronic engine tune preferred"] },
      { id:"gone_tcu",  brand:"Gone Sideways", label:"ZF8 Race TCU",            price:650, rating:4.7,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Race-focused ZF8 tune with full torque lockup and aggressive shift strategy. Designed for drag strip builds running 900+ whp.", difficulty:"Professional",
        pros:["Full lockup","Drag-optimized","Highest holding torque"],cons:["Harsh daily feel","Strip focused only"] },
      { id:"slavov_tcu", brand:"Slavov / SRM", label:"Slavov ZF8HP + DL501 TCU", price:899, rating:4.9,
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
      { id:"srm_port_kit",  brand:"SRM",          label:"4.0T Port Injection Complete Kit", price:1495, rating:5.0,
        hp:{a6_20t:20,a6_30t:18,a7_20t:20,a7_30t:18,s6:40,s7:40,a8:40,s8:45,rs6:50,rs7:50},
        torque:{a6_20t:25,a6_30t:22,a7_20t:25,a7_30t:22,s6:50,s7:50,a8:50,s8:55,rs6:60,rs7:60},
        notes:"$1,495. Includes: 4x 1600cc injectors, SRM port fuel injector controller, wiring harness, and all lines. Integrates with SRM A2A IC kit using spacers (stock IC users need additional spacers). Enables 1000+ whp on ethanol or race gas by uncorking OEM DI fuel system limitations. Per SRM: 'port fuel uncorks power limitations of the OEM fuel system.' Dominant in leaderboard top 10.", difficulty:"Professional",
        pros:["$1,495 complete kit","1600cc injectors","1000+ whp capable","Works with stock IC (spacers)"],cons:["Requires custom ECU tune","SRM manifolds maximize port injection benefit"] },
      { id:"id1050_port",   brand:"Injector Dynamics",label:"ID1050x Port Kit",   price:1400, rating:4.8,
        hp:{a6_20t:18,a6_30t:16,a7_20t:18,a7_30t:16,s6:36,s7:36,a8:36,s8:41,rs6:46,rs7:46},
        torque:{a6_20t:22,a6_30t:20,a7_20t:22,a7_30t:20,s6:45,s7:45,a8:45,s8:50,rs6:55,rs7:55},
        notes:"ID1050x injectors in a custom port setup. High-quality injectors with excellent data. Works with any manifold and tuner.", difficulty:"Professional",
        pros:["High quality injectors","Tuner agnostic","Good data/logging"],cons:["Custom fitting required","More shop time than SRM kit"] },
      { id:"nos_port",      brand:"NOS / Nitrous Outlet", label:"Wet Nitrous + Port Combo", price:900, rating:4.5,
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
      { id:"awe_touring",   brand:"AWE",         label:"Touring Edition",          price:1749, rating:4.8,
        hp:{a6_20t:5,a6_30t:5,a7_20t:5,a7_30t:5,s6:8,s7:8,a8:8,s8:9,rs6:10,rs7:10},
        torque:{a6_20t:5,a6_30t:5,a7_20t:5,a7_30t:5,s6:8,s7:8,a8:8,s8:9,rs6:10,rs7:10},
        notes:"Drone-free highway tone. Loud under WOT. Chrome tips. AWE lifetime warranty.", difficulty:"Professional",
        pros:["No drone","Great WOT","Lifetime warranty"],cons:["Not most aggressive"] },
      { id:"awe_track",     brand:"AWE",         label:"Track Edition",            price:1849, rating:4.9,
        hp:{a6_20t:6,a6_30t:6,a7_20t:6,a7_30t:6,s6:9,s7:9,a8:9,s8:10,rs6:12,rs7:12},
        torque:{a6_20t:6,a6_30t:6,a7_20t:6,a7_30t:6,s6:9,s7:9,a8:9,s8:10,rs6:12,rs7:12},
        notes:"More aggressive than Touring. Straight-through resonators. Loud daily but incredible under load.", difficulty:"Professional",
        pros:["More aggressive than Touring","Better flow","Same warranty"],cons:["Louder daily"] },
      { id:"milltek_nonres", brand:"Milltek",    label:"Non-Resonated",            price:1950, rating:4.7,
        hp:{a6_20t:6,a6_30t:5,a7_20t:6,a7_30t:5,s6:9,s7:9,a8:9,s8:10,rs6:11,rs7:11},
        torque:{a6_20t:6,a6_30t:5,a7_20t:6,a7_30t:5,s6:9,s7:9,a8:9,s8:10,rs6:11,rs7:11},
        notes:"Aggressive British tone. Some highway drone. Polished tips. UK-made quality.", difficulty:"Professional",
        pros:["Aggressive tone","Premium finish"],cons:["Highway drone possible"] },
      { id:"milltek_res",   brand:"Milltek",    label:"Resonated",                price:1799, rating:4.6,
        hp:{a6_20t:5,a6_30t:5,a7_20t:5,a7_30t:5,s6:7,s7:7,a8:7,s8:8,rs6:9,rs7:9},
        torque:{a6_20t:5,a6_30t:5,a7_20t:5,a7_30t:5,s6:7,s7:7,a8:7,s8:8,rs6:9,rs7:9},
        notes:"Quieter daily UK tone. No drone. Best Milltek option for daily drivers.", difficulty:"Professional",
        pros:["No drone","UK quality"],cons:["Less aggressive"] },
      { id:"akra_slip",     brand:"Akrapovič",  label:"Slip-On Titanium",         price:2800, rating:4.9,
        hp:{a6_20t:7,a6_30t:6,a7_20t:7,a7_30t:6,s6:11,s7:11,a8:11,s8:12,rs6:13,rs7:13},
        torque:{a6_20t:6,a6_30t:5,a7_20t:6,a7_30t:5,s6:10,s7:10,a8:10,s8:11,rs6:12,rs7:12},
        notes:"Titanium construction. Valve-controlled sound. OEM+ appearance. Show-car and driver builds.", difficulty:"Professional",
        pros:["Titanium","Sound valve","Prestige"],cons:["Highest price"] },
      { id:"ecs_valved",    brand:"ECS Tuning", label:"Valved Cat-Back",          price:1199, rating:4.4,
        hp:{a6_20t:5,a6_30t:4,a7_20t:5,a7_30t:4,s6:7,s7:7,a8:7,s8:8,rs6:9,rs7:9},
        torque:{a6_20t:5,a6_30t:4,a7_20t:5,a7_30t:4,s6:7,s7:7,a8:7,s8:8,rs6:9,rs7:9},
        notes:"Electronic valve — quiet mode for the neighborhood, open for the highway. Best price for a valved system.", difficulty:"Professional",
        pros:["Valved sound control","Budget valved option"],cons:["Valve longevity questions"] },
      { id:"remus_sport",   brand:"Remus",      label:"Sport Cat-Back",           price:1650, rating:4.6,
        hp:{a6_20t:5,a6_30t:5,a7_20t:5,a7_30t:5,s6:8,s7:8,a8:8,s8:9,rs6:10,rs7:10},
        torque:{a6_20t:5,a6_30t:5,a7_20t:5,a7_30t:5,s6:8,s7:8,a8:8,s8:9,rs6:10,rs7:10},
        notes:"Austrian brand. Deep, bassy tone. Popular in Europe. Good stock-replacing system with slight growl.", difficulty:"Professional",
        pros:["Deep bassy tone","Austrian quality","Good value"],cons:["Less aggressive than Milltek Non-Res"] },
      { id:"capristo",      brand:"Capristo",   label:"Valved Exhaust System",    price:3200, rating:4.8,
        hp:{a6_20t:7,a6_30t:6,a7_20t:7,a7_30t:6,s6:11,s7:11,a8:11,s8:12,rs6:13,rs7:13},
        torque:{a6_20t:6,a6_30t:5,a7_20t:6,a7_30t:5,s6:10,s7:10,a8:10,s8:11,rs6:12,rs7:12},
        notes:"Italian prestige brand. Valve-controlled with remote or OEM integration. Used on RS6/RS7 flagship builds. Unique sound signature.", difficulty:"Professional",
        pros:["Italian prestige","Remote valve control","Unique sound"],cons:["Very expensive","Niche brand"] },
      { id:"eisenmann",     brand:"Eisenmann",  label:"Sport Exhaust",            price:1850, rating:4.7,
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
      { id:"ps4s",          brand:"Michelin",   label:"Pilot Sport 4S",           price:320,  rating:4.9,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"The benchmark ultra-high-performance street tire. Best balance of dry grip, wet safety, and longevity. OEM on RS6/RS7. Per tire price.", difficulty:"DIY Friendly",
        pros:["Best all-round UHP","Excellent wet","Long life"],cons:["Not the most grip in dry","Premium price"] },
      { id:"cup2",          brand:"Michelin",   label:"Pilot Sport Cup 2",        price:420,  rating:5.0,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Street-legal track tire. Best dry grip of any street compound. Needs heat to come on. Marginal wet performance — not for rain.", difficulty:"DIY Friendly",
        pros:["Best dry grip","Incredible feel","Track capable"],cons:["Poor wet grip","Needs warmup","Short life"] },
      { id:"pss",           brand:"Michelin",   label:"Pilot Super Sport",        price:280,  rating:4.7,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Previous gen Michelin flagship. Still excellent. Good value vs PS4S. Better cold weather performance than Cup 2.", difficulty:"DIY Friendly",
        pros:["Great value vs PS4S","Cold grip","Proven"],cons:["Older compound than PS4S"] },
      { id:"re71rs",        brand:"Bridgestone",label:"Potenza RE-71RS",          price:260,  rating:4.8,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Autocross and track day favorite. Massive dry grip. Shorter life than PS4S. Cold tires feel like ice.", difficulty:"DIY Friendly",
        pros:["Incredible dry grip","Autocross proven","Lower price than Cup 2"],cons:["Short tread life","Bad cold grip","Poor wet"] },
      { id:"nt01",          brand:"Nitto",      label:"NT01 R-Compound",          price:220,  rating:4.7,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"DOT R-compound. Grippiest street-legal option. Best for track days and time attacks where wet performance doesn't matter.", difficulty:"DIY Friendly",
        pros:["Maximum grip","Budget R-compound","Track proven"],cons:["Street safety concerns in wet","Loud","Very short life"] },
      { id:"ps5",           brand:"Michelin",   label:"Pilot Sport 5",            price:300,  rating:4.8,
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
      { id:"m_t_et_street",  brand:"Mickey Thompson",label:"ET Street S/S",      price:280,  rating:4.9,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Street/strip radial. DOT legal. Most popular drag tire for C7 street builds. Hooks on street and prepped surface. Per tire price.", difficulty:"DIY Friendly",
        pros:["DOT legal","Street drivable","Hooks hard","Most popular"],cons:["Not for wet roads","Needs heat cycles"] },
      { id:"nitto_555r2",    brand:"Nitto",      label:"555R2 Drag Radial",       price:260,  rating:4.8,
        hp:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        torque:{a6_20t:0,a6_30t:0,a7_20t:0,a7_30t:0,s6:0,s7:0,a8:0,s8:0,rs6:0,rs7:0},
        notes:"Strong competitor to M/T ET Street. Slightly better on cold pavement. Good for street-to-strip builds that see some daily use.", difficulty:"DIY Friendly",
        pros:["Cold street performance","DOT legal","Competitive grip"],cons:["Less prepped surface peak than M/T"] },
      { id:"hoosier_dr2",    brand:"Hoosier",    label:"A7 Drag Radial",          price:340,  rating:5.0,
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
  let hp=0, torque=0, cost=0;
  Object.entries(selectedMap).forEach(([slotId, varId]) => {
    const v = getVariantById(slotId, varId);
    if (!v) return;
    hp += v.hp[modelId]||0;
    torque += v.torque[modelId]||0;
    cost += v.price;
  });
  return { hp, torque, cost };
}

function calcSpeeds(model, hpGain) {
  const newHp = model.hp + hpGain;
  const ratio = model.hp / newHp;
  return {
    t060:   +(model.t060   * Math.pow(ratio, 0.40)).toFixed(2),
    t60130: +(model.t60130 * Math.pow(ratio, 0.65)).toFixed(2),
  };
}

// AWD Quattro drivetrain loss ~15% on Mustang AWD dyno
// Consistent with community data: stock RS7 560 crank = ~476 whp
// SRM1000 kit = 992 whp measured = ~1167 hp crank
function calcWhp(crankHp) { return Math.round(crankHp * 0.85); }

function Stars({ rating }) {
  return (
    <span style={{color:"#ffd000",fontSize:11,letterSpacing:1}}>
      {"★".repeat(Math.floor(rating))}{"☆".repeat(5-Math.floor(rating))}
      <span style={{color:"var(--muted)",marginLeft:4,fontFamily:"'Share Tech Mono',monospace",fontSize:10}}>{rating}</span>
    </span>
  );
}

// ── CSS ─────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400;600;700;900&family=Barlow:wght@300;400;500;600&family=Share+Tech+Mono&display=swap');
:root{
  --bg:#0a0a0c;--surface:#0f0f14;--card:#141420;--card2:#1a1a28;
  --border:#1e1e30;--accent:#e8550a;--accent2:#ff8c00;
  --dim:#8080ac;--text:#d0d0e8;--muted:#8888c0;
  --green:#00e887;--red:#ff3b5c;--yellow:#ffd000;--blue:#4499ff;
  --nav-h:60px;
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overscroll-behavior:none}
body{background:var(--bg);color:var(--text);font-family:'Barlow',sans-serif;-webkit-tap-highlight-color:transparent}

/* ── SHELL ── */
.app{display:flex;flex-direction:column;height:100dvh;overflow:hidden}

/* ── HEADER ── */
.header{background:var(--surface);border-bottom:1px solid var(--border);flex-shrink:0;z-index:50}
.header-row1{display:flex;align-items:center;justify-content:space-between;padding:0 16px;height:50px;gap:12px}
.logo{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:19px;letter-spacing:.08em;text-transform:uppercase;color:#fff;display:flex;align-items:center;gap:8px;flex-shrink:0}
.logo-slash{color:var(--accent)}
.logo-badge{background:var(--accent);color:#fff;font-size:9px;font-weight:700;letter-spacing:.15em;padding:2px 7px;border-radius:3px}
.stats-strip{display:flex;overflow-x:auto;gap:0;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.stats-strip::-webkit-scrollbar{display:none}
.hstat{display:flex;flex-direction:column;align-items:center;padding:4px 8px;border-left:1px solid var(--border);flex-shrink:0;min-width:56px}
.hstat-label{font-family:'Share Tech Mono',monospace;font-size:7px;color:var(--muted);letter-spacing:.07em;text-transform:uppercase;white-space:nowrap}
.hstat-val{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:16px;line-height:1.1;color:var(--accent2);white-space:nowrap}
.hstat-val.green{color:var(--green)}
.hstat-delta{font-family:'Share Tech Mono',monospace;font-size:8px;color:var(--green);line-height:1}
.hstat-cost{font-family:'Share Tech Mono',monospace;font-size:12px;color:var(--text);line-height:1.2}

.model-strip{display:flex;gap:6px;overflow-x:auto;padding:6px 14px;border-top:1px solid var(--border);-webkit-overflow-scrolling:touch;scrollbar-width:none}
.model-strip::-webkit-scrollbar{display:none}
.mbtn{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:.08em;text-transform:uppercase;padding:5px 13px;border:1px solid var(--border);background:transparent;color:var(--muted);border-radius:20px;cursor:pointer;transition:all .15s;white-space:nowrap;flex-shrink:0}
.mbtn.active{background:var(--accent);border-color:var(--accent);color:#fff}

/* ── BODY ── */
.body{flex:1;overflow:hidden;display:flex;flex-direction:column}

/* ── CAT STRIP (mobile) ── */
.cat-strip{display:flex;gap:6px;overflow-x:auto;padding:10px 14px;border-bottom:1px solid var(--border);-webkit-overflow-scrolling:touch;scrollbar-width:none;background:var(--surface);flex-shrink:0}
.cat-strip::-webkit-scrollbar{display:none}
.cbtn{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:.06em;text-transform:uppercase;padding:5px 14px;border:1px solid var(--border);background:transparent;color:var(--muted);border-radius:20px;cursor:pointer;white-space:nowrap;flex-shrink:0;transition:all .15s;position:relative}
.cbtn.active{background:var(--accent);border-color:var(--accent);color:#fff}
.cbtn-dot{position:absolute;top:2px;right:2px;width:7px;height:7px;border-radius:50%;background:var(--green);border:1.5px solid var(--bg)}

/* ── PARTS AREA ── */
.parts-area{flex:1;overflow-y:auto;padding:12px;-webkit-overflow-scrolling:touch}
.area-title{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:22px;text-transform:uppercase;letter-spacing:.04em;color:#fff;margin-bottom:2px}
.area-sub{font-size:11px;color:var(--muted);margin-bottom:12px;font-weight:300}
.slots-list{display:flex;flex-direction:column;gap:8px}

/* ── SLOT CARD ── */
.slot-card{background:var(--card);border:1px solid var(--border);border-radius:10px;overflow:hidden;transition:border-color .18s}
.slot-card.sel{border-color:rgba(232,85,10,.5)}
.slot-card.warn{border-color:rgba(255,208,0,.5)}
.slot-card.conflict{border-color:rgba(255,59,92,.5)}
.slot-hdr{display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer;user-select:none;-webkit-user-select:none;min-height:56px}
.slot-hdr:active{background:rgba(255,255,255,.03)}
.slot-orb{width:28px;height:28px;border-radius:50%;border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;transition:all .2s;color:var(--dim)}
.orb-ok{background:rgba(232,85,10,.12);border-color:var(--accent);color:var(--accent)}
.orb-warn{background:rgba(255,208,0,.1);border-color:var(--yellow);color:var(--yellow)}
.orb-conflict{background:rgba(255,59,92,.1);border-color:var(--red);color:var(--red)}
.slot-info{flex:1;min-width:0}
.slot-name{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;text-transform:uppercase;letter-spacing:.04em;color:#fff;line-height:1.2}
.slot-sel-text{font-size:11px;color:var(--accent);margin-top:1px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.slot-desc-text{font-size:11px;color:var(--muted);margin-top:1px;font-weight:300;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.slot-tag{font-family:'Share Tech Mono',monospace;font-size:8px;font-weight:700;letter-spacing:.08em;padding:2px 6px;border-radius:3px;white-space:nowrap;flex-shrink:0}
.t-maint{background:rgba(100,160,255,.08);color:#88aaff;border:1px solid rgba(100,160,255,.2)}
.t-pop{background:rgba(0,232,135,.1);color:var(--green);border:1px solid rgba(0,232,135,.2)}
.t-best{background:rgba(255,140,0,.1);color:var(--accent2);border:1px solid rgba(255,140,0,.2)}
.t-race{background:rgba(255,59,92,.1);color:var(--red);border:1px solid rgba(255,59,92,.2)}
.t-snd{background:rgba(180,120,255,.1);color:#c080ff;border:1px solid rgba(180,120,255,.2)}
.t-lb{background:rgba(68,153,255,.1);color:var(--blue);border:1px solid rgba(68,153,255,.2)}
.t-uni{background:rgba(255,208,0,.1);color:var(--yellow);border:1px solid rgba(255,208,0,.2)}
.t-oth{background:rgba(100,100,160,.08);color:var(--muted);border:1px solid var(--border)}
.slot-chev{color:var(--dim);font-size:14px;transition:transform .22s;flex-shrink:0}
.slot-chev.open{transform:rotate(180deg)}

/* ── VARIANT PICKER ── */
.var-picker{border-top:1px solid var(--border);background:rgba(0,0,0,.25);padding:10px}
.v-alert{font-size:11px;padding:6px 8px;border-radius:5px;margin-bottom:8px;display:flex;gap:6px;align-items:flex-start;line-height:1.4}
.v-alert.warn{background:rgba(255,208,0,.06);color:var(--yellow);border-left:2px solid var(--yellow)}
.v-alert.conflict{background:rgba(255,59,92,.06);color:var(--red);border-left:2px solid var(--red)}
.v-alert.rec{background:rgba(0,232,135,.05);color:var(--green);border-left:2px solid rgba(0,232,135,.3)}
.var-grid{display:grid;grid-template-columns:1fr;gap:8px}
.vcard{background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:12px;cursor:pointer;transition:border-color .15s;position:relative;overflow:hidden}
.vcard::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:transparent;transition:background .15s}
.vcard.vactive{border-color:var(--accent);background:rgba(232,85,10,.06)}
.vcard.vactive::before{background:var(--accent)}
.vc-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2px}
.vc-brand{font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--dim);letter-spacing:.1em;text-transform:uppercase}
.vc-price{font-family:'Share Tech Mono',monospace;font-size:13px;color:var(--green);font-weight:700}
.vc-name{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;text-transform:uppercase;letter-spacing:.04em;color:#fff;margin-bottom:4px}
.vc-stars{margin-bottom:5px}
.vc-notes{font-size:11px;color:var(--muted);line-height:1.45;margin-bottom:8px;font-weight:300}
.vc-stats{display:flex;gap:4px;margin-bottom:7px}
.vcstat{flex:1;background:rgba(0,0,0,.3);border:1px solid var(--border);border-radius:4px;padding:4px 3px;text-align:center}
.vcstat-label{font-family:'Share Tech Mono',monospace;font-size:7px;color:var(--dim);letter-spacing:.05em;text-transform:uppercase}
.vcstat-val{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;color:var(--accent2);line-height:1.2}
.vcstat-val.zero{color:var(--dim);font-size:12px}
.vc-pc{display:flex;gap:8px;font-size:10px;line-height:1.45;margin-bottom:6px}
.vc-pros{color:var(--green)}.vc-cons{color:var(--red)}
.vc-diff{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px}
.d-plug{color:var(--green)}.d-diy{color:var(--accent2)}.d-pro{color:var(--red)}
.vc-btn{width:100%;padding:10px;border:1px solid var(--accent);background:transparent;color:var(--accent);font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:13px;letter-spacing:.1em;text-transform:uppercase;border-radius:6px;cursor:pointer;transition:all .15s}
.vc-btn:active,.vc-btn:hover{background:var(--accent);color:#fff}
.vc-btn.vsel{background:var(--accent);border-color:var(--accent);color:#fff}
.vc-btn.vsel:active,.vc-btn.vsel:hover{background:var(--red);border-color:var(--red)}

/* ── TIME ESTIMATES ── */
.t-est-row{display:flex;align-items:stretch;margin:6px 0 8px;background:rgba(0,0,0,.3);border:1px solid var(--border);border-radius:6px;overflow:hidden}
.t-est-box{flex:1;padding:7px 9px;display:flex;flex-direction:column;gap:2px}
.t-est-divider{width:1px;background:var(--border);flex-shrink:0}
.t-est-label{font-family:'Share Tech Mono',monospace;font-size:7px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim)}
.t-est-val{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:17px;color:var(--accent2);letter-spacing:.02em;line-height:1}

/* ── PERF BAR ── */
.perf-bar-wrap{margin:6px 0 8px;padding:8px 9px;background:rgba(0,0,0,.3);border:1px solid var(--border);border-radius:6px}
.perf-bar-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:5px}
.perf-tier{font-family:'Share Tech Mono',monospace;font-size:8px;letter-spacing:.08em;text-transform:uppercase;padding:2px 7px;border-radius:3px;font-weight:700}
.perf-range{font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--muted)}
.perf-track{height:4px;background:rgba(255,255,255,.08);border-radius:2px;position:relative;margin-bottom:4px}
.perf-fill{height:4px;border-radius:2px;position:absolute;transition:left .3s,width .3s}
.perf-footer{font-family:'Share Tech Mono',monospace;font-size:8px;color:var(--dim);letter-spacing:.05em}
/* metric toggle */
.perf-metric-toggle{display:flex;gap:4px;align-items:center}
.pmtbtn{font-family:'Share Tech Mono',monospace;font-size:9px;letter-spacing:.08em;padding:4px 10px;border-radius:4px;border:1px solid var(--border);background:transparent;color:var(--dim);cursor:pointer;text-transform:uppercase;transition:all .15s}
.pmtbtn.pma{background:var(--accent);border-color:var(--accent);color:#fff}
.pmtbtn:not(.pma):hover{border-color:var(--muted);color:var(--muted)}

/* ── BUILD PANEL ── */
.build-panel{display:flex;flex-direction:column;overflow:hidden;flex:1}
.build-inner{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px}
.gauges{display:flex;flex-direction:column;gap:10px;margin-bottom:14px}
.g-row{display:flex;justify-content:space-between;margin-bottom:4px}
.g-label{font-family:'Share Tech Mono',monospace;font-size:9px;letter-spacing:.1em;color:var(--muted);text-transform:uppercase}
.g-val{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:13px;color:#fff}
.g-track{height:3px;background:var(--border);border-radius:2px;overflow:hidden}
.g-fill{height:100%;border-radius:2px;transition:width .4s cubic-bezier(.4,0,.2,1)}
.ghp{background:linear-gradient(90deg,var(--accent),var(--accent2))}
.gtq{background:linear-gradient(90deg,#0080ff,#00e4ff)}
.gcost{background:linear-gradient(90deg,var(--green),#00aa66)}
.speed-row{display:flex;border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-top:6px}
.speed-box{flex:1;padding:12px 8px;display:flex;flex-direction:column;align-items:center;gap:2px}
.spd-divider{width:1px;background:var(--border)}
.spd-label{font-family:'Share Tech Mono',monospace;font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.spd-val{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:28px;line-height:1;color:var(--accent2)}
.spd-val.green{color:var(--green)}
.spd-unit{font-size:13px;font-weight:400;color:var(--muted);margin-left:1px}
.spd-delta{font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--green);margin-top:1px}
.build-empty{text-align:center;padding:32px 16px;color:var(--dim);font-size:12px;line-height:1.6}
.build-empty-icon{font-size:32px;margin-bottom:10px;opacity:.4}
.bitem{display:flex;align-items:flex-start;gap:8px;padding:10px;border-radius:7px;margin-bottom:6px;border:1px solid transparent;background:rgba(255,255,255,.02)}
.bwarn{border-color:rgba(255,208,0,.2);background:rgba(255,208,0,.03)}
.bconflict{border-color:rgba(255,59,92,.2);background:rgba(255,59,92,.03)}
.borb{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0;margin-top:1px}
.bok{background:rgba(0,232,135,.1);color:var(--green)}.bwicon{background:rgba(255,208,0,.1);color:var(--yellow)}.bcicon{background:rgba(255,59,92,.1);color:var(--red)}
.bitem-name{font-family:'Barlow Condensed',sans-serif;font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#fff;line-height:1.2}
.bitem-brand{font-size:10px;color:var(--accent);margin-top:1px;font-weight:500}
.bitem-price{font-size:10px;color:var(--muted);margin-top:1px}
.brm{margin-left:auto;background:transparent;border:none;color:var(--dim);cursor:pointer;font-size:20px;padding:2px 6px;line-height:1;flex-shrink:0;transition:color .15s}
.brm:active,.brm:hover{color:var(--red)}
.alerts{padding:10px;border-top:1px solid var(--border);flex-shrink:0}
.alerts-title{font-family:'Share Tech Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
.alert-item{font-size:10px;padding:5px 7px;border-radius:4px;margin-bottom:4px;line-height:1.4;display:flex;gap:5px}
.ai-warn{background:rgba(255,208,0,.05);color:var(--yellow);border-left:2px solid var(--yellow)}
.ai-conflict{background:rgba(255,59,92,.05);color:var(--red);border-left:2px solid var(--red)}

/* ── LEADERBOARD ── */
.lb-area{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px}
.lb-title{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:22px;text-transform:uppercase;letter-spacing:.05em;color:#fff;margin-bottom:2px}
.lb-sub{font-size:11px;color:var(--muted);margin-bottom:12px;font-weight:300}
.lb-card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:8px;position:relative;overflow:hidden}
.lb-card::before{content:'';position:absolute;top:0;left:0;bottom:0;width:3px}
.lb-card.rank1::before{background:linear-gradient(180deg,#ffd000,#ff8c00)}
.lb-card.rank2::before{background:#aaaacc}
.lb-card.rank3::before{background:#cc8844}
.lb-card.rankother::before{background:var(--border)}
.lb-top{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.lb-rank{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:22px;color:var(--dim);min-width:28px;text-align:center;line-height:1}
.lb-rank.r1{color:var(--yellow)}
.lb-rank.r2{color:#aaaacc}
.lb-rank.r3{color:#cc8844}
.lb-driver{flex:1;min-width:0}
.lb-name{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;text-transform:uppercase;letter-spacing:.04em;color:#fff;line-height:1.2}
.lb-car{font-size:11px;color:var(--muted);margin-top:1px}
.lb-time{text-align:right;flex-shrink:0}
.lb-t60130{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:24px;color:var(--green);line-height:1}
.lb-time-label{font-family:'Share Tech Mono',monospace;font-size:8px;color:var(--muted);letter-spacing:.1em;text-transform:uppercase}
.lb-chips{display:flex;flex-wrap:wrap;gap:4px}
.lb-chip{font-family:'Share Tech Mono',monospace;font-size:9px;padding:2px 7px;border-radius:4px;border:1px solid;letter-spacing:.06em}
.lc-tuner{background:rgba(68,153,255,.1);color:var(--blue);border-color:rgba(68,153,255,.25)}
.lc-turbo{background:rgba(232,85,10,.1);color:var(--accent2);border-color:rgba(232,85,10,.25)}
.lc-fuel{background:rgba(0,232,135,.08);color:var(--green);border-color:rgba(0,232,135,.2)}
.lc-mani{background:rgba(180,120,255,.08);color:#c080ff;border-color:rgba(180,120,255,.2)}
.lc-dp{background:rgba(255,59,92,.08);color:var(--red);border-color:rgba(255,59,92,.2)}
.lc-port{background:rgba(255,208,0,.08);color:var(--yellow);border-color:rgba(255,208,0,.2)}
.lb-da{font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--dim);margin-top:6px}

/* ── BOTTOM NAV ── */
.bottom-nav{height:var(--nav-h);background:var(--surface);border-top:1px solid var(--border);display:flex;flex-shrink:0;z-index:50}
.bnav{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;background:transparent;border:none;cursor:pointer;font-family:'Barlow Condensed',sans-serif;font-weight:600;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);transition:color .15s;position:relative;padding:0}
.bnav.active{color:var(--accent)}
.bnav-icon{font-size:20px;line-height:1}
.bnav-badge{position:absolute;top:6px;right:calc(50% - 18px);background:var(--accent);color:#fff;font-size:9px;font-family:'Share Tech Mono',monospace;border-radius:8px;padding:0 5px;min-width:16px;text-align:center;line-height:16px}

::-webkit-scrollbar{width:3px;height:3px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}

/* ── GARAGE / PROFILE ── */
.garage-area{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px}
.garage-hero{background:linear-gradient(135deg,rgba(232,85,10,.12),rgba(0,0,0,0));border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:14px;position:relative;overflow:hidden}
.garage-hero::before{content:'';position:absolute;top:0;right:0;width:80px;height:100%;background:linear-gradient(90deg,transparent,rgba(232,85,10,.06));pointer-events:none}
.gh-name{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:22px;text-transform:uppercase;letter-spacing:.05em;color:#fff;margin-bottom:2px}
.gh-car{font-size:13px;color:var(--accent);font-weight:500;margin-bottom:8px}
.gh-note{font-size:11px;color:var(--muted);font-weight:300;font-style:italic}
.gh-stats{display:flex;gap:0;margin-top:12px;border:1px solid var(--border);border-radius:8px;overflow:hidden}
.gh-stat{flex:1;padding:8px;text-align:center;border-right:1px solid var(--border)}
.gh-stat:last-child{border-right:none}
.gh-stat-val{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:20px;color:var(--accent2);line-height:1}
.gh-stat-val.green{color:var(--green)}
.gh-stat-val.blue{color:var(--blue)}
.gh-stat-lbl{font-family:'Share Tech Mono',monospace;font-size:8px;color:var(--muted);letter-spacing:.1em;text-transform:uppercase;margin-top:2px}
.section-title{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:14px 0 8px;display:flex;justify-content:space-between;align-items:center}
.section-title button{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:11px;letter-spacing:.06em;text-transform:uppercase;background:transparent;border:1px solid var(--border);color:var(--muted);padding:3px 10px;border-radius:4px;cursor:pointer}
.section-title button:active{color:#fff;border-color:var(--accent)}
.mod-row{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:7px;margin-bottom:5px;background:rgba(255,255,255,.02);border:1px solid transparent}
.mod-row.installed{border-color:rgba(0,232,135,.15);background:rgba(0,232,135,.03)}
.mod-row.wishlist{border-color:rgba(68,153,255,.15);background:rgba(68,153,255,.03)}
.mod-orb-sm{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;flex-shrink:0}
.mo-inst{background:rgba(0,232,135,.15);color:var(--green)}
.mo-wish{background:rgba(68,153,255,.15);color:var(--blue)}
.mod-name{flex:1;min-width:0}
.mod-n{font-family:'Barlow Condensed',sans-serif;font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#fff;line-height:1.2}
.mod-b{font-size:10px;color:var(--muted);margin-top:1px}
.mod-action{background:transparent;border:none;color:var(--dim);font-size:11px;font-family:'Barlow Condensed',sans-serif;font-weight:600;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;padding:4px 8px;border-radius:4px;border:1px solid var(--border);transition:all .15s;flex-shrink:0}
.mod-action:active,.mod-action:hover{color:#fff;border-color:var(--accent);background:rgba(232,85,10,.1)}
.mod-action.install{color:var(--green);border-color:rgba(0,232,135,.3)}
.mod-action.install:hover{background:rgba(0,232,135,.1)}

/* ── TIMES LOG ── */
.times-area{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px}
.best-times{display:flex;gap:8px;margin-bottom:14px}
.bt-card{flex:1;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center;position:relative;overflow:hidden}
.bt-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px}
.bt-card.speed-card::before{background:linear-gradient(90deg,var(--accent),var(--accent2))}
.bt-card.strip-card::before{background:linear-gradient(90deg,var(--blue),#00e4ff)}
.bt-label{font-family:'Share Tech Mono',monospace;font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:4px}
.bt-val{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:28px;color:var(--accent2);line-height:1}
.bt-val.blue{color:var(--blue)}
.bt-unit{font-size:13px;font-weight:400;color:var(--muted);margin-left:1px}
.bt-sub{font-size:10px;color:var(--muted);margin-top:3px;font-family:'Share Tech Mono',monospace}
.add-run-btn{width:100%;padding:12px;border:1px dashed var(--border);background:transparent;color:var(--muted);font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px;letter-spacing:.08em;text-transform:uppercase;border-radius:8px;cursor:pointer;transition:all .15s;margin-bottom:10px}
.add-run-btn:active,.add-run-btn:hover{border-color:var(--accent);color:var(--accent)}
.run-form{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px}
.rf-title{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:16px;text-transform:uppercase;letter-spacing:.05em;color:#fff;margin-bottom:12px}
.rf-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
.rf-field{display:flex;flex-direction:column;gap:4px}
.rf-field.full{grid-column:1/-1}
.rf-label{font-family:'Share Tech Mono',monospace;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.rf-input{background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:5px;padding:8px 10px;color:var(--text);font-family:'Barlow',sans-serif;font-size:13px;outline:none;-webkit-appearance:none;width:100%}
.rf-input:focus{border-color:var(--accent);background:rgba(232,85,10,.05)}
.rf-input option{background:var(--card2);color:var(--text)}
.rf-btns{display:flex;gap:8px}
.rf-save{flex:1;padding:10px;background:var(--accent);border:none;color:#fff;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px;letter-spacing:.1em;text-transform:uppercase;border-radius:6px;cursor:pointer}
.rf-cancel{padding:10px 16px;background:transparent;border:1px solid var(--border);color:var(--muted);font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px;letter-spacing:.1em;text-transform:uppercase;border-radius:6px;cursor:pointer}
.run-card{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px;position:relative}
.run-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px}
.run-date{font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--muted)}
.run-type{font-family:'Share Tech Mono',monospace;font-size:9px;letter-spacing:.1em;text-transform:uppercase;padding:2px 7px;border-radius:3px;background:rgba(232,85,10,.12);color:var(--accent);border:1px solid rgba(232,85,10,.2)}
.run-times{display:flex;gap:12px;margin-bottom:8px}
.run-time-big{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:24px;color:var(--green);line-height:1}
.run-time-lbl{font-family:'Share Tech Mono',monospace;font-size:8px;color:var(--muted);letter-spacing:.1em;text-transform:uppercase}
.run-chips{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px}
.run-chip{font-family:'Share Tech Mono',monospace;font-size:9px;padding:2px 6px;border-radius:3px;background:rgba(255,255,255,.05);color:var(--muted);border:1px solid var(--border)}
.run-del{position:absolute;top:10px;right:10px;background:transparent;border:none;color:var(--dim);font-size:16px;cursor:pointer;padding:2px 6px;line-height:1}
.run-del:hover{color:var(--red)}
.run-note{font-size:11px;color:var(--muted);font-weight:300;font-style:italic}
/* ── DRAGGY UPLOAD ── */
.draggy-upload-area{margin-bottom:12px}
.draggy-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:11px;border:1.5px dashed var(--accent);border-radius:8px;background:rgba(232,85,10,.04);color:var(--accent);font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:13px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;transition:all .15s}
.draggy-btn:hover{background:rgba(232,85,10,.1);border-style:solid}
.draggy-spin{display:inline-block;animation:spin .8s linear infinite;font-size:16px}
@keyframes spin{to{transform:rotate(360deg)}}
.draggy-preview{border:1px solid var(--border);border-radius:8px;overflow:hidden}
.draggy-img{width:100%;max-height:160px;object-fit:cover;display:block}
.draggy-preview-actions{display:flex;align-items:center;gap:8px;padding:7px 10px;background:rgba(0,232,135,.06);border-top:1px solid rgba(0,232,135,.15)}
.draggy-ok{flex:1;font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--green);letter-spacing:.08em;text-transform:uppercase}
.draggy-reupload{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);border:1px solid var(--border);background:transparent;border-radius:4px;padding:3px 8px;cursor:pointer}
.draggy-clear{background:transparent;border:none;color:var(--dim);font-size:16px;cursor:pointer;padding:2px 4px;line-height:1}
.draggy-clear:hover{color:var(--red)}
.draggy-error{font-size:11px;color:var(--red);margin-top:7px;padding:6px 8px;background:rgba(255,59,92,.06);border-radius:5px;border-left:2px solid var(--red)}
/* ── SAVE TOAST ── */
.save-toast{background:rgba(0,232,135,.12);border:1px solid rgba(0,232,135,.3);border-radius:6px;padding:9px 14px;margin-bottom:10px;font-family:'Share Tech Mono',monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--green);text-align:center;animation:fadeIn .2s ease}
@keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
/* ── RUN LIST SORT / FILTER BAR ── */
.run-ctrl-bar{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;align-items:center}
.run-ctrl-label{font-family:'Share Tech Mono',monospace;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-right:2px}
.run-ctrl-select{background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:5px;padding:5px 8px;color:var(--text);font-family:'Share Tech Mono',monospace;font-size:9px;letter-spacing:.06em;text-transform:uppercase;outline:none;-webkit-appearance:none;cursor:pointer}
.run-ctrl-select:focus{border-color:var(--accent)}
.run-ctrl-select option{background:var(--card2);color:var(--text)}
.run-ctrl-divider{width:1px;height:16px;background:var(--border);align-self:center}
/* ── RUN CARD EXPANDED DETAIL ── */
.run-card{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px;position:relative;cursor:pointer;transition:border-color .15s}
.run-card:hover{border-color:rgba(232,85,10,.3)}
.run-card.selected{border-color:var(--accent);background:rgba(232,85,10,.04)}
.run-detail{margin-top:10px;border-top:1px solid var(--border);padding-top:10px}
.run-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;margin-bottom:10px}
.rdg-item{display:flex;flex-direction:column;gap:1px}
.rdg-label{font-family:'Share Tech Mono',monospace;font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.rdg-val{font-family:'Share Tech Mono',monospace;font-size:11px;color:#fff}
.splits-title{font-family:'Share Tech Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
.splits-table{width:100%;border-collapse:collapse}
.splits-table th{font-family:'Share Tech Mono',monospace;font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);text-align:left;padding:3px 6px;border-bottom:1px solid var(--border)}
.splits-table td{font-family:'Share Tech Mono',monospace;font-size:11px;color:#fff;padding:4px 6px;border-bottom:1px solid rgba(255,255,255,.04)}
.splits-table tr:last-child td{border-bottom:none}
.splits-table td.split-val{color:var(--green);font-weight:700}
.run-video-link{display:inline-flex;align-items:center;gap:5px;margin-top:8px;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--accent);text-decoration:none;border:1px solid rgba(232,85,10,.3);border-radius:4px;padding:4px 10px}
.run-video-link:hover{background:rgba(232,85,10,.08)}

/* ── PROFILE FORM ── */
.profile-area{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px}
.pf-card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px}
.pf-title{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;text-transform:uppercase;letter-spacing:.06em;color:#fff;margin-bottom:12px}
.pf-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
.pf-field{display:flex;flex-direction:column;gap:4px}
.pf-field.full{grid-column:1/-1}
.pf-label{font-family:'Share Tech Mono',monospace;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.pf-input{background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:5px;padding:8px 10px;color:var(--text);font-family:'Barlow',sans-serif;font-size:13px;outline:none;-webkit-appearance:none;width:100%}
.pf-input:focus{border-color:var(--accent);background:rgba(232,85,10,.05)}
.pf-input option{background:var(--card2);color:var(--text)}
.pf-save{width:100%;padding:12px;background:var(--accent);border:none;color:#fff;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px;letter-spacing:.1em;text-transform:uppercase;border-radius:6px;cursor:pointer;transition:background .15s}
.pf-save:active{background:#c44008}
.pf-saved{background:var(--green) !important}
.share-box{background:rgba(0,232,135,.05);border:1px solid rgba(0,232,135,.2);border-radius:8px;padding:12px;margin-bottom:10px}
.share-title{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:var(--green);margin-bottom:6px}
.share-sub{font-size:11px;color:var(--muted);font-weight:300;margin-bottom:10px;line-height:1.5}
.share-url{font-family:'Share Tech Mono',monospace;font-size:10px;background:rgba(0,0,0,.3);border:1px solid var(--border);border-radius:5px;padding:8px 10px;color:var(--green);word-break:break-all;margin-bottom:8px}
.share-copy{width:100%;padding:9px;background:rgba(0,232,135,.1);border:1px solid rgba(0,232,135,.3);color:var(--green);font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:13px;letter-spacing:.08em;text-transform:uppercase;border-radius:5px;cursor:pointer}

/* ── MODE TOGGLE ── */
.mode-toggle{display:flex;background:rgba(0,0,0,.3);border:1px solid var(--border);border-radius:8px;overflow:hidden;margin:0 0 10px;flex-shrink:0}
.mtbtn{flex:1;padding:8px;background:transparent;border:none;color:var(--muted);font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:6px}
.mtbtn.active.inst{background:rgba(0,232,135,.12);color:var(--green)}
.mtbtn.active.wish{background:rgba(68,153,255,.12);color:var(--blue)}
.mtbtn-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.dot-inst{background:var(--green)}
.dot-wish{background:var(--blue)}
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
function rankClass(r) {
  if (r===1) return "rank1"; if (r===2) return "rank2"; if (r===3) return "rank3"; return "rankother";
}
function rankNumClass(r) {
  if (r===1) return "r1"; if (r===2) return "r2"; if (r===3) return "r3"; return "";
}

// ── PERF BAR COMPONENT ────────────────────────────────────────────────────
const TIER_COLOR = { Moderate:"var(--green)", Significant:"#F5A623", Transformative:"var(--accent)" };
const TIER_BG    = { Moderate:"rgba(60,255,120,.10)", Significant:"rgba(245,166,35,.10)", Transformative:"rgba(232,85,10,.10)" };

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

// ── APP ──────────────────────────────────────────────────────────────────
export default function TheProof() {
  const [activeCat, setActiveCat]   = useState("Engine");
  const [openSlot, setOpenSlot]     = useState(null);
  const [activeTab, setActiveTab]   = useState("garage");
  const [installedMap, setInstalledMap] = useState({});
  const [wishlistMap,  setWishlistMap]  = useState({});
  const [buildMode, setBuildMode]   = useState("installed");
  const [profile, setProfile]       = useState({
    name: "", car: "s7", year: "2016", color: "", nickname: "", tuner: "", note: ""
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
    da:"", surface:"Street", fuel:"", tires:"", note:"", videoUrl:"", splits:{}
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
  const [runsLoading, setRunsLoading] = useState(true);
  const [saveFeedback, setSaveFeedback] = useState(""); // "Saved!" toast

  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = CSS;
    document.head.appendChild(el);
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
        const { note, splits } = (r.note||"").includes("__splits__:") ? (() => {
          const idx = r.note.indexOf("__splits__:");
          try { return { note: r.note.slice(0,idx).trim(), splits: JSON.parse(r.note.slice(idx+11)) }; }
          catch { return { note: r.note, splits: {} }; }
        })() : { note: r.note||"", splits: {} };
        return { id:r.id, date:r.date, type:r.run_type, time:r.time_val, mph:r.mph,
          et8th:r.et8th, et:r.et, trap:r.trap, da:r.da, surface:r.surface,
          fuel:r.fuel, tires:r.tires, note, splits, videoUrl:r.video_url };
      });
      // Sort client-side: most recent date first
      mapped.sort((a,b)=>(b.date||"").localeCompare(a.date||""));
      setRuns(mapped);
    } catch(e) { console.warn("Runs load error:", e); }
    finally { setRunsLoading(false); }
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
    loadRuns();   // separate so it can be called independently
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
  const speeds  = calcSpeeds(currentModel, installedTotals.hp);
  const wspds   = calcSpeeds(currentModel, installedTotals.hp + wishlistTotals.hp);
  const totalHp = currentModel.hp + installedTotals.hp;
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
  }
  function remove(slotId) { setSelectedMap(prev => { const n={...prev}; delete n[slotId]; return n; }); }
  function toggleSlot(id) { setOpenSlot(prev => prev===id ? null : id); }

  useEffect(() => {
    const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setAuthUser(session.user);
        const { data } = await sb.from("profiles").select("*").eq("user_id", session.user.id).single();
        if (data) setProfile(p => ({...p, name:data.name||"", car:data.car||p.car, year:data.year||p.year, color:data.color||"", nickname:data.nickname||"", tuner:data.tuner||"", note:data.note||""}));
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
      email:authUser?.email||"",
      updated_at:new Date().toISOString()
    }, { onConflict:"user_id" });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  }

  // Pack splits into DB note field and unpack on load
  function packNote(note, splits) {
    const s = splits && Object.keys(splits).length ? '__splits__:' + JSON.stringify(splits) : '';
    return [note, s].filter(Boolean).join('\n');
  }
  function unpackNote(raw) {
    if (!raw) return { note:'', splits:{} };
    const idx = raw.indexOf('__splits__:');
    if (idx === -1) return { note: raw, splits: {} };
    try { return { note: raw.slice(0, idx).trim(), splits: JSON.parse(raw.slice(idx + 11)) }; }
    catch { return { note: raw, splits: {} }; }
  }

  async function addRun() {
    const uid = getUserId();
    const toFloat = v => { const n = parseFloat(String(v).replace(/[^\d.-]/g,"")); return isNaN(n) ? null : n; };
    const { data: saved, error: saveErr } = await sb.from("runs").insert({
      user_id:uid, date:runForm.date, run_type:runForm.type,
      time_val: toFloat(runForm.time),
      mph:      toFloat(runForm.mph),
      et8th:    toFloat(runForm.et8th),
      et:       toFloat(runForm.et),
      trap:     toFloat(runForm.trap),
      da:runForm.da, surface:runForm.surface, fuel:runForm.fuel, tires:runForm.tires,
      note: packNote(runForm.note, runForm.splits),
      video_url:runForm.videoUrl
    }).select().single().catch(e=>({ data:null, error:e }));
    if (saveErr) console.warn("Run save error:", saveErr);
    const unp = saved ? unpackNote(saved.note) : { note: runForm.note, splits: runForm.splits||{} };
    const r = saved ? {
      id:saved.id, date:saved.date, type:saved.run_type, time:saved.time_val,
      mph:saved.mph, et8th:saved.et8th, et:saved.et, trap:saved.trap, da:saved.da,
      surface:saved.surface, fuel:saved.fuel, tires:saved.tires,
      note:unp.note, splits:unp.splits, videoUrl:saved.video_url
    } : { ...runForm, id: Date.now(), time: toFloat(runForm.time), et: toFloat(runForm.et) };
    setRuns(prev => {
      // Prepend and re-sort by date desc
      const next = [r, ...prev];
      next.sort((a,b)=>(b.date||"").localeCompare(a.date||""));
      return next;
    });
    setRunForm({date:new Date().toISOString().slice(0,10),type:"60-130",time:"",mph:"",et8th:"",et:"",trap:"",da:"",surface:"Street",fuel:"",tires:"",note:"",videoUrl:"",splits:{}});
    setRunFormOpen(false);
    setDraggyImage(null);
    setSelectedRunId(r.id);
    setActiveTab("times");
    // Show confirmation toast
    const timeLabel = r.time != null ? `${r.time}s` : r.et != null ? `${r.et}s ET` : "Run";
    setSaveFeedback(timeLabel + (saved ? " saved ✓" : " saved locally"));
    setTimeout(() => setSaveFeedback(""), 3500);
  }

  async function deleteRun(id) {
    await sb.from("runs").delete().eq("id", id);
    setRuns(prev => prev.filter(r => r.id !== id));
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
        splits: cleanSplits(parsed.splits),
      }));
    } catch(e) {
      setDraggyError(e.message || "Failed to parse screenshot. Fill in times manually.");
    } finally {
      setDraggyParsing(false);
    }
  }

  // Move wishlist item to installed
  function installFromWishlist(slotId) {
    const varId = wishlistMap[slotId];
    if (!varId) return;
    const newInstalled = {...installedMap, [slotId]: varId};
    const newWishlist  = {...wishlistMap}; delete newWishlist[slotId];
    setInstalledMap(newInstalled);
    setWishlistMap(newWishlist);
    saveBuild(newInstalled, newWishlist);
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

  // ── GARAGE OVERVIEW ───────────────────────────────────────────────
  const garageContent = (
    <div className="garage-area">
      {/* hero */}
      <div className="garage-hero">
        <div className="gh-name">{profile.nickname || profile.name || "My Garage"}</div>
        <div className="gh-car">{currentModel.label} {profile.year && `· ${profile.year}`} {profile.color && `· ${profile.color}`}</div>
        {profile.note && <div className="gh-note">"{profile.note}"</div>}
        <div className="gh-stats">
          <div className="gh-stat">
            <div className="gh-stat-val">{currentModel.hp + installedTotals.hp}</div>
            <div className="gh-stat-lbl">Crank HP</div>
          </div>
          <div className="gh-stat">
            <div className="gh-stat-val" style={{color:"var(--accent2)"}}>~{calcWhp(currentModel.hp + installedTotals.hp)}</div>
            <div className="gh-stat-lbl">Est WHP</div>
          </div>
          <div className="gh-stat">
            <div className="gh-stat-val green">{speeds.t60130}s</div>
            <div className="gh-stat-lbl">60–130 est</div>
          </div>
          <div className="gh-stat">
            <div className="gh-stat-val" style={{color:bestRun60130?"var(--green)":"var(--muted)"}}>{bestRun60130 ? `${bestRun60130.time}s` : "—"}</div>
            <div className="gh-stat-lbl">Best 60–130</div>
          </div>
          <div className="gh-stat">
            <div className="gh-stat-val blue">{bestRun14 ? `${bestRun14.et}s` : "—"}</div>
            <div className="gh-stat-lbl">Best 1/4</div>
          </div>
        </div>
      </div>

      {/* installed mods */}
      <div className="section-title">
        Installed Mods <span style={{color:"var(--green)",fontSize:11}}>{numInst} parts</span>
        <button onClick={()=>{setBuildMode("installed");setActiveTab("parts");}}>+ Add</button>
      </div>
      {numInst === 0
        ? <div style={{color:"var(--dim)",fontSize:12,padding:"8px 0 12px"}}>No installed mods yet. Tap Add to log what's on your car.</div>
        : Object.entries(installedMap).map(([slotId, varId]) => {
            const slot = getSlotById(slotId);
            const v    = getVariantById(slotId, varId);
            if (!slot||!v) return null;
            return (
              <div key={slotId} className="mod-row installed">
                <div className="mod-orb-sm mo-inst">✓</div>
                <div className="mod-name">
                  <div className="mod-n">{slot.name}</div>
                  <div className="mod-b">{v.brand} · {v.label}</div>
                </div>
                <button className="mod-action" onClick={()=>{
                  setInstalledMap(prev=>{const n={...prev};delete n[slotId];saveBuild(n,wishlistMap);return n;});
                }}>×</button>
              </div>
            );
          })
      }

      {/* wishlist */}
      <div className="section-title">
        Wishlist <span style={{color:"var(--blue)",fontSize:11}}>{numWish} parts · ${wishlistTotals.cost.toLocaleString()}</span>
        <button onClick={()=>{setBuildMode("wishlist");setActiveTab("parts");}}>+ Add</button>
      </div>
      {numWish === 0
        ? <div style={{color:"var(--dim)",fontSize:12,padding:"8px 0 12px"}}>Nothing on the wishlist yet. Start planning your next mods.</div>
        : Object.entries(wishlistMap).map(([slotId, varId]) => {
            const slot = getSlotById(slotId);
            const v    = getVariantById(slotId, varId);
            if (!slot||!v) return null;
            return (
              <div key={slotId} className="mod-row wishlist">
                <div className="mod-orb-sm mo-wish">★</div>
                <div className="mod-name">
                  <div className="mod-n">{slot.name}</div>
                  <div className="mod-b">{v.brand} · {v.label} · ${v.price.toLocaleString()}</div>
                </div>
                <button className="mod-action install" onClick={()=>installFromWishlist(slotId)}>Install ✓</button>
              </div>
            );
          })
      }

      {/* Wishlist → Installed gap */}
      {numWish > 0 && (
        <div style={{background:"rgba(68,153,255,.06)",border:"1px solid rgba(68,153,255,.15)",borderRadius:8,padding:"10px 12px",marginTop:8}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,textTransform:"uppercase",letterSpacing:".06em",color:"var(--blue)",marginBottom:4}}>Wishlist Impact</div>
          <div style={{fontSize:11,color:"var(--muted)",fontWeight:300}}>
            Adding wishlist mods: <span style={{color:"var(--accent2)",fontWeight:600}}>+{wishlistTotals.hp} crank hp</span> · <span style={{color:"var(--accent2)",fontWeight:600}}>~{Math.round(wishlistTotals.hp*0.85)} whp gain</span> · est 60–130: <span style={{color:"var(--green)",fontWeight:600}}>{wspds.t60130}s</span> · cost: <span style={{color:"var(--text)",fontWeight:600}}>${wishlistTotals.cost.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );

  // ── TIMES LOG ─────────────────────────────────────────────────────
  const timesContent = (
    <div className="times-area">
      {/* Save feedback toast */}
      {saveFeedback && (
        <div className="save-toast">{saveFeedback}</div>
      )}

      <div className="best-times">
        <div className="bt-card speed-card">
          <div className="bt-label">Best 60–130</div>
          <div className="bt-val">
            {runsLoading ? <span style={{fontSize:14,color:"var(--muted)"}}>…</span>
              : bestRun60130 ? bestRun60130.time : "—"}
            <span className="bt-unit">s</span>
          </div>
          {bestRun60130 && <div className="bt-sub">{bestRun60130.surface} · {bestRun60130.fuel||"fuel n/a"}</div>}
        </div>
        <div className="bt-card strip-card">
          <div className="bt-label">Best 1/4 Mile</div>
          <div className="bt-val blue">
            {runsLoading ? <span style={{fontSize:14,color:"var(--muted)"}}>…</span>
              : bestRun14 ? bestRun14.et : "—"}
            <span className="bt-unit">s</span>
          </div>
          {bestRun14 && <div className="bt-sub">{bestRun14.trap ? `${bestRun14.trap} mph trap` : ""}</div>}
        </div>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:10}}>
        <button className="add-run-btn" style={{flex:1,marginBottom:0}} onClick={()=>setRunFormOpen(v=>!v)}>
          {runFormOpen ? "✕ Cancel" : `+ Log a Run${runs.length>0?` · ${runs.length} run${runs.length===1?"":"s"}`:""}`}
        </button>
        <button className="add-run-btn" style={{marginBottom:0,padding:"0 14px",flex:"none",fontSize:16}}
          title="Refresh runs" onClick={()=>loadRuns()}>
          {runsLoading ? "⟳" : "↺"}
        </button>
      </div>

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
                  <button className="draggy-clear" onClick={()=>{setDraggyImage(null);setDraggyError("");}}>✕</button>
                </div>
              </div>
            )}
            {draggyError && <div className="draggy-error">{draggyError}</div>}
          </div>

          <div className="rf-grid">
            <div className="rf-field">
              <label className="rf-label">Date</label>
              <input className="rf-input" type="date" value={runForm.date}
                onChange={e=>setRunForm(p=>({...p,date:e.target.value}))}/>
            </div>
            <div className="rf-field">
              <label className="rf-label">Run Type</label>
              <select className="rf-input" value={runForm.type}
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
                <label className="rf-label">{runForm.type} Time (s)</label>
                <input className="rf-input" type="number" step="0.01" placeholder="4.96"
                  value={runForm.time} onChange={e=>setRunForm(p=>({...p,time:e.target.value}))}/>
              </div>
            )}
            {(runForm.type==="60-130"||runForm.type==="Roll Race") && (
              <div className="rf-field">
                <label className="rf-label">Exit Speed (mph)</label>
                <input className="rf-input" type="number" step="0.1" placeholder="145"
                  value={runForm.mph} onChange={e=>setRunForm(p=>({...p,mph:e.target.value}))}/>
              </div>
            )}
            {runForm.type==="1/8 Mile" && (
              <>
                <div className="rf-field">
                  <label className="rf-label">1/8 ET (s)</label>
                  <input className="rf-input" type="number" step="0.001" placeholder="6.28"
                    value={runForm.et8th} onChange={e=>setRunForm(p=>({...p,et8th:e.target.value}))}/>
                </div>
                <div className="rf-field">
                  <label className="rf-label">1/8 MPH</label>
                  <input className="rf-input" type="number" step="0.1" placeholder="114"
                    value={runForm.mph} onChange={e=>setRunForm(p=>({...p,mph:e.target.value}))}/>
                </div>
              </>
            )}
            {runForm.type==="1/4 Mile" && (
              <>
                <div className="rf-field">
                  <label className="rf-label">1/4 ET (s)</label>
                  <input className="rf-input" type="number" step="0.001" placeholder="9.67"
                    value={runForm.et} onChange={e=>setRunForm(p=>({...p,et:e.target.value}))}/>
                </div>
                <div className="rf-field">
                  <label className="rf-label">Trap Speed (mph)</label>
                  <input className="rf-input" type="number" step="0.1" placeholder="143"
                    value={runForm.trap} onChange={e=>setRunForm(p=>({...p,trap:e.target.value}))}/>
                </div>
              </>
            )}
            <div className="rf-field">
              <label className="rf-label">Surface</label>
              <select className="rf-input" value={runForm.surface}
                onChange={e=>setRunForm(p=>({...p,surface:e.target.value}))}>
                <option>Street</option>
                <option>Prepped Strip</option>
                <option>Dragway</option>
                <option>Roll Race</option>
              </select>
            </div>
            <div className="rf-field">
              <label className="rf-label">Fuel</label>
              <input className="rf-input" type="text" placeholder="E30, E85, 93 oct…"
                value={runForm.fuel} onChange={e=>setRunForm(p=>({...p,fuel:e.target.value}))}/>
            </div>
            <div className="rf-field">
              <label className="rf-label">DA / Elevation</label>
              <input className="rf-input" type="text" placeholder="-65 ft"
                value={runForm.da} onChange={e=>setRunForm(p=>({...p,da:e.target.value}))}/>
            </div>
            <div className="rf-field">
              <label className="rf-label">Tires</label>
              <input className="rf-input" type="text" placeholder="PS4S, ET Street…"
                value={runForm.tires} onChange={e=>setRunForm(p=>({...p,tires:e.target.value}))}/>
            </div>
            <div className="rf-field full">
              <label className="rf-label">Video / Slip URL</label>
              <input className="rf-input" type="text" placeholder="https://youtube.com/…"
                value={runForm.videoUrl} onChange={e=>setRunForm(p=>({...p,videoUrl:e.target.value}))}/>
            </div>
            <div className="rf-field full">
              <label className="rf-label">Notes</label>
              <input className="rf-input" type="text" placeholder="Launch conditions, boost, notes…"
                value={runForm.note} onChange={e=>setRunForm(p=>({...p,note:e.target.value}))}/>
            </div>
          </div>
          <div className="rf-btns">
            <button className="rf-save" onClick={addRun}>Save Run</button>
            <button className="rf-cancel" onClick={()=>setRunFormOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── SORT / FILTER BAR ── */}
      {runs.length > 0 && (
        <div className="run-ctrl-bar">
          <span className="run-ctrl-label">Sort</span>
          <select className="run-ctrl-select" value={runSortKey} onChange={e=>setRunSortKey(e.target.value)}>
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
          <div className="run-ctrl-divider"/>
          <span className="run-ctrl-label">Surface</span>
          <select className="run-ctrl-select" value={runSurfFilter} onChange={e=>setRunSurfFilter(e.target.value)}>
            <option value="All">All</option>
            {[...new Set(runs.map(r=>r.surface).filter(Boolean))].map(s=><option key={s}>{s}</option>)}
          </select>
          <span className="run-ctrl-label">Fuel</span>
          <select className="run-ctrl-select" value={runFuelFilter} onChange={e=>setRunFuelFilter(e.target.value)}>
            <option value="All">All</option>
            {[...new Set(runs.map(r=>r.fuel).filter(Boolean))].map(f=><option key={f}>{f}</option>)}
          </select>
        </div>
      )}

      {runs.length === 0 && !runFormOpen && (
        <div style={{color:"var(--dim)",fontSize:12,textAlign:"center",padding:"24px 0",lineHeight:1.7}}>
          {runsLoading
            ? <><span style={{display:"inline-block",animation:"spin .8s linear infinite",fontSize:18}}>⟳</span><br/>Loading your runs…</>
            : <>No runs logged yet.<br/>Tap <strong style={{color:"var(--muted)"}}>Log a Run</strong> to record your first Draggy result or strip slip.</>
          }
        </div>
      )}

      {(() => {
        const SPLIT_KEYS = ["60_70","60_80","60_90","60_100","60_110","60_120","60_130"];
        const SPLIT_LABELS = {"60_70":"60–70","60_80":"60–80","60_90":"60–90","60_100":"60–100","60_110":"60–110","60_120":"60–120","60_130":"60–130"};

        // filter
        let filtered = runs.filter(r =>
          (runSurfFilter==="All" || r.surface===runSurfFilter) &&
          (runFuelFilter==="All" || r.fuel===runFuelFilter)
        );

        // sort
        const getVal = (r, key) => {
          if (key==="date") return r.date||"";
          if (key==="time") return r.time!=null ? r.time : 999;
          if (key==="da") { const n=parseFloat(String(r.da||"").replace(/[^\d.-]/g,"")); return isNaN(n)?999:n; }
          if (key==="mph") return r.mph!=null ? -r.mph : 999;
          if (key==="et") return r.et!=null ? r.et : 999;
          if (key==="trap") return r.trap!=null ? -r.trap : 999;
          if (SPLIT_KEYS.includes(key)) { const v=r.splits?.[key]; return v!=null?v:999; }
          return 0;
        };
        filtered = [...filtered].sort((a,b)=> {
          const av=getVal(a,runSortKey), bv=getVal(b,runSortKey);
          if (runSortKey==="date") return bv.localeCompare(av);
          return av-bv;
        });

        return filtered.map(run => {
          const isOpen = selectedRunId===run.id;
          const hasSplits = run.splits && Object.keys(run.splits).length>0;
          return (
            <div key={run.id} className={`run-card${isOpen?" selected":""}`}
              onClick={()=>setSelectedRunId(isOpen?null:run.id)}>
              <button className="run-del" onClick={e=>{e.stopPropagation();deleteRun(run.id);}}>×</button>
              <div className="run-top">
                <span className="run-date">{run.date}</span>
                <span className="run-type">{run.type}</span>
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
                    <div className="run-time-big" style={{color:"var(--accent2)"}}>{run.mph}</div>
                    <div className="run-time-lbl">mph</div>
                  </div>
                )}
                {run.trap!=null && (
                  <div>
                    <div className="run-time-big" style={{color:"var(--accent2)"}}>{run.trap}</div>
                    <div className="run-time-lbl">trap mph</div>
                  </div>
                )}
              </div>
              <div className="run-chips">
                {run.surface && <span className="run-chip">{run.surface}</span>}
                {run.fuel && <span className="run-chip">{run.fuel}</span>}
                {run.tires && <span className="run-chip">{run.tires}</span>}
                {run.da && <span className="run-chip">DA: {run.da}</span>}
                {hasSplits && <span className="run-chip" style={{color:"var(--accent)"}}>splits ▾</span>}
              </div>

              {/* ── EXPANDED DETAIL ── */}
              {isOpen && (
                <div className="run-detail" onClick={e=>e.stopPropagation()}>
                  <div className="run-detail-grid">
                    {run.surface && <div className="rdg-item"><span className="rdg-label">Surface</span><span className="rdg-val">{run.surface}</span></div>}
                    {run.fuel    && <div className="rdg-item"><span className="rdg-label">Fuel</span><span className="rdg-val">{run.fuel}</span></div>}
                    {run.tires   && <div className="rdg-item"><span className="rdg-label">Tires</span><span className="rdg-val">{run.tires}</span></div>}
                    {run.da      && <div className="rdg-item"><span className="rdg-label">Density Alt.</span><span className="rdg-val">{run.da}</span></div>}
                    {run.mph!=null  && <div className="rdg-item"><span className="rdg-label">Exit MPH</span><span className="rdg-val">{run.mph} mph</span></div>}
                    {run.trap!=null && <div className="rdg-item"><span className="rdg-label">Trap MPH</span><span className="rdg-val">{run.trap} mph</span></div>}
                    {run.et!=null   && <div className="rdg-item"><span className="rdg-label">1/4 ET</span><span className="rdg-val">{run.et}s</span></div>}
                    {run.et8th!=null&& <div className="rdg-item"><span className="rdg-label">1/8 ET</span><span className="rdg-val">{run.et8th}s</span></div>}
                    {run.time!=null && <div className="rdg-item"><span className="rdg-label">{run.type}</span><span className="rdg-val">{run.time}s</span></div>}
                  </div>

                  {hasSplits && (
                    <>
                      <div className="splits-title">Speed Splits</div>
                      <table className="splits-table">
                        <thead>
                          <tr>
                            <th>Range</th>
                            <th>Time (s)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {SPLIT_KEYS.filter(k=>run.splits[k]!=null).map(k=>(
                            <tr key={k}>
                              <td>{SPLIT_LABELS[k]}</td>
                              <td className="split-val">{run.splits[k].toFixed(2)}s</td>
                            </tr>
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
                </div>
              )}
            </div>
          );
        });
      })()}
    </div>
  );

  // ── PROFILE SETTINGS ──────────────────────────────────────────────
  const profileContent = (
    <div className="profile-area">
      <div className="share-box">
        <div className="share-title">🏁 Proof.Build is coming</div>
        <div className="share-sub">
          Create an account to save your garage, share your build link, and post your times to the community leaderboard. Your data is already stored locally — sign up to sync it to the cloud and claim your build URL.
        </div>
        <div className="share-url">proof.build/@{profile.name ? profile.name.toLowerCase().replace(/\s/g,"_") : "yourname"}/{currentModel.label.toLowerCase().replace(/\s/,"-")}</div>
        <button className="share-copy" onClick={()=>{
          navigator.clipboard?.writeText(`proof.build/@${(profile.name||"yourname").toLowerCase().replace(/\s/g,"_")}/${currentModel.label.toLowerCase().replace(/\s/,"-")}`);
        }}>Copy Build Link</button>
      </div>

      <div className="pf-card">
        <div className="pf-title">Car Profile</div>
        <div className="pf-grid">
          <div className="pf-field">
            <label className="pf-label">Your Name</label>
            <input className="pf-input" type="text" placeholder="First Last"
              value={profile.name} onChange={e=>setProfile(p=>({...p,name:e.target.value}))}/>
          </div>
          <div className="pf-field">
            <label className="pf-label">Car Nickname</label>
            <input className="pf-input" type="text" placeholder="The Beast"
              value={profile.nickname} onChange={e=>setProfile(p=>({...p,nickname:e.target.value}))}/>
          </div>
          <div className="pf-field">
            <label className="pf-label">Model</label>
            <select className="pf-input" value={profile.car||"s7"}
              onChange={e=>setProfile(p=>({...p,car:e.target.value}))}>
              {MODELS.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div className="pf-field">
            <label className="pf-label">Year</label>
            <select className="pf-input" value={profile.year||"2016"}
              onChange={e=>setProfile(p=>({...p,year:e.target.value}))}>
              {["2013","2014","2015","2016","2017","2018"].map(y=><option key={y}>{y}</option>)}
            </select>
          </div>
          <div className="pf-field">
            <label className="pf-label">Color</label>
            <input className="pf-input" type="text" placeholder="Phantom Black"
              value={profile.color} onChange={e=>setProfile(p=>({...p,color:e.target.value}))}/>
          </div>
          <div className="pf-field">
            <label className="pf-label">Tuner</label>
            <input className="pf-input" type="text" placeholder="APR, Load Logic…"
              value={profile.tuner} onChange={e=>setProfile(p=>({...p,tuner:e.target.value}))}/>
          </div>
          <div className="pf-field full">
            <label className="pf-label">Build Note</label>
            <input className="pf-input" type="text" placeholder="Daily driver | street/strip | track build…"
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
            <div style={{color:"var(--accent)",fontSize:13}}>✓ Signed in as {authUser.email}</div>
            <div style={{fontSize:12,color:"var(--dim)"}}>Profile syncs to your account — reload from any device.</div>
            <button className="pf-save" onClick={()=>sb.auth.signOut()} style={{marginTop:4,maxWidth:140}}>Sign Out</button>
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{fontSize:12,color:"var(--dim)"}}>Save your profile to your account and reload it on any device.</div>
            {authSent ? (
              <div style={{color:"var(--accent)",fontSize:13}}>✓ Magic link sent — check your email!</div>
            ) : (
              <div className="pf-field full">
                <label className="pf-label">Email</label>
                <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                  <input className="pf-input" type="email" placeholder="you@example.com" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMagicLink()} style={{flex:1}} />
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
        <span style={{color:"var(--accent)"}}>proof.build</span> · Coming soon
      </div>
    </div>
  );

  // ── LEADERBOARD CONTENT ───────────────────────────────────────────
  const boardContent = (
    <div className="lb-area">
      <div className="lb-title">60–130 Leaderboard</div>
      <div className="lb-sub">Real runs · Audi 4.0T community · All catless downpipes</div>
      {liveLeaderboard.map(run => (
        <div key={run.rank} className={`lb-card ${rankClass(run.rank)}`}>
          <div className="lb-top">
            <div className={`lb-rank ${rankNumClass(run.rank)}`}>#{run.rank}</div>
            <div className="lb-driver">
              <div className="lb-name">{run.driver}</div>
              <div className="lb-car">{run.car}</div>
            </div>
            <div className="lb-time">
              <div className="lb-t60130">{run.t60130}s</div>
              <div className="lb-time-label">60–130</div>
            </div>
          </div>
          <div className="lb-chips">
            <span className="lb-chip lc-tuner">{run.tuner}</span>
            <span className="lb-chip lc-turbo">{run.turbo}</span>
            <span className="lb-chip lc-fuel">{run.fuel}</span>
            {run.manifolds !== "Unknown" && <span className="lb-chip lc-mani">{run.manifolds} mani</span>}
            <span className="lb-chip lc-port">{run.supFuel}</span>
            <span className="lb-chip lc-dp">{run.dp}</span>
            {run.trans !== "Stock" && <span className="lb-chip lc-mani">{run.trans}</span>}
          </div>
          {run.da && <div className="lb-da">DA: {run.da}{run.et ? `  ·  1/4: ${run.et} @ ${run.mph} mph` : ""}</div>}
        </div>
      ))}
    </div>
  );

  // ── PARTS CONTENT ─────────────────────────────────────────────────
  const activeModelId = currentModel.id;
  const partsContent = (
    <>
      <div className="cat-strip">
        {CATEGORIES.map(cat => (
          <button key={cat} className={`cbtn${activeCat===cat?" active":""}`}
            onClick={()=>{setActiveCat(cat);setOpenSlot(null);}}>
            {cat}
            {catCounts[cat]>0 && <span className="cbtn-dot"/>}
          </button>
        ))}
      </div>
      <div className="parts-area">
        <div className="area-title">{activeCat}</div>
        <div className="area-sub">
          {currentModel.engine} · {currentModel.hp} hp stock ·{" "}
          <span style={{color: buildMode==="installed"?"var(--green)":"var(--blue)"}}>
            {buildMode==="installed" ? "Logging installed mods" : "Adding to wishlist"}
          </span>
        </div>
        <div className="slots-list">
          {catSlots.map(slot => {
            const selVarId   = selectedMap[slot.id];
            // also show if other map has it
            const otherVarId = buildMode==="installed" ? wishlistMap[slot.id] : installedMap[slot.id];
            const selVar     = selVarId ? getVariantById(slot.id, selVarId) : null;
            const { missing, conflicts } = getDeps(slot.id, selectedMap);
            const hasSel    = !!selVarId;
            const hasWarn   = hasSel && missing.length > 0;
            const hasConf   = hasSel && conflicts.length > 0;
            const isOpen    = openSlot === slot.id;
            const missingRecs = hasSel ? slot.recommends.filter(r=>!Object.keys(selectedMap).includes(r)) : [];

            let cardCls = "slot-card";
            if (hasConf) cardCls += " conflict";
            else if (hasWarn) cardCls += " warn";
            else if (hasSel) cardCls += " sel";

            let orbCls = "", orbIcon = "○";
            if (hasSel && hasConf)  { orbCls="orb-conflict"; orbIcon="⚡"; }
            else if (hasSel && hasWarn) { orbCls="orb-warn"; orbIcon="⚠"; }
            else if (hasSel)        { orbCls="orb-ok"; orbIcon= buildMode==="installed"?"✓":"★"; }

            return (
              <div key={slot.id} className={cardCls}>
                <div className="slot-hdr" onClick={()=>toggleSlot(slot.id)}>
                  <div className={`slot-orb ${orbCls}`} style={hasSel && buildMode==="wishlist" && !hasConf && !hasWarn ? {borderColor:"var(--blue)",color:"var(--blue)",background:"rgba(68,153,255,.1)"} : {}}>{orbIcon}</div>
                  <div className="slot-info">
                    <div className="slot-name">{slot.name}</div>
                    {selVar
                      ? <div className="slot-sel-text" style={{color:buildMode==="wishlist"?"var(--blue)":undefined}}>{selVar.brand} · {selVar.label} · ${selVar.price.toLocaleString()}</div>
                      : <div className="slot-desc-text">{slot.desc}{otherVarId ? ` · ${buildMode==="installed"?"★ On wishlist":"✓ Installed"}` : ""}</div>
                    }
                  </div>
                  {slot.tag && <span className={`slot-tag ${tagClass(slot.tag)}`}>{slot.tag}</span>}
                  <span className={`slot-chev${isOpen?" open":""}`}>▾</span>
                </div>

                {isOpen && (
                  <div className="var-picker">
                    {hasConf && <div className="v-alert conflict">⚡ Conflicts with: {conflicts.map(c=>getSlotById(c)?.name||c).join(", ")}</div>}
                    {hasWarn && <div className="v-alert warn">⚠ Also needs: {missing.map(m=>getSlotById(m)?.name||m).join(", ")}</div>}
                    {hasSel && !hasWarn && !hasConf && missingRecs.length>0 && (
                      <div className="v-alert rec">✦ Pairs well with: {missingRecs.map(r=>getSlotById(r)?.name||r).join(", ")}</div>
                    )}
                    <div className="var-grid">
                      {slot.variants.map(v => {
                        const isActive = selVarId===v.id;
                        const hp = v.hp[activeModelId]||0;
                        const tq = v.torque[activeModelId]||0;
                        return (
                          <div key={v.id} className={`vcard${isActive?" vactive":""}`}>
                            <div className="vc-top">
                              <span className="vc-brand">{v.brand}</span>
                              <span className="vc-price">${v.price.toLocaleString()}</span>
                            </div>
                            <div className="vc-name">{v.label}</div>
                            <div className="vc-stars"><Stars rating={v.rating}/></div>
                            <div className="vc-notes">{v.notes}</div>
                            <div className="vc-stats">
                              <div className="vcstat"><div className="vcstat-label">+Crank HP</div><div className={`vcstat-val${hp===0?" zero":""}`}>{hp>0?`+${hp}`:"—"}</div></div>
                              <div className="vcstat"><div className="vcstat-label">+Est WHP</div><div className={`vcstat-val${hp===0?" zero":""}`} style={{color:hp>0?"var(--accent2)":undefined}}>{hp>0?`+${Math.round(hp*0.85)}`:"—"}</div></div>
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
                            <button className={`vc-btn${isActive?" vsel":""}`} onClick={()=>pick(slot.id,v.id)}>
                              {isActive ? "Remove" : buildMode==="installed" ? "Mark Installed" : "Add to Wishlist"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
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
          <button className={`mtbtn${buildMode==="installed"?" active inst":""}`}
            onClick={()=>setBuildMode("installed")}>
            <span className="mtbtn-dot dot-inst"/>
            Installed ({numInst})
          </button>
          <button className={`mtbtn${buildMode==="wishlist"?" active wish":""}`}
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
      <div className="header">
        <div className="header-row1">
          <div className="logo">PROOF<span className="logo-slash">.BUILD</span> <span className="logo-badge">{currentModel.label}</span></div>
          <div className="stats-strip">
            <div className="hstat">
              <span className="hstat-label">Crank HP</span>
              <span className="hstat-val">{totalHp}</span>
            </div>
            <div className="hstat">
              <span className="hstat-label">Est WHP</span>
              <span className="hstat-val" style={{color:"var(--accent2)"}}>~{calcWhp(totalHp)}</span>
            </div>
            <div className="hstat">
              <span className="hstat-label">0–60</span>
              <span className="hstat-val">{speeds.t060}s</span>
              {installedTotals.hp>0&&<span className="hstat-delta">−{(currentModel.t060-speeds.t060).toFixed(2)}s</span>}
            </div>
            <div className="hstat">
              <span className="hstat-label">60–130</span>
              <span className="hstat-val green">{speeds.t60130}s</span>
              {installedTotals.hp>0&&<span className="hstat-delta">−{(currentModel.t60130-speeds.t60130).toFixed(2)}s</span>}
            </div>
            {bestRun60130 && <div className="hstat"><span className="hstat-label">Best 60–130</span><span className="hstat-val" style={{color:"var(--green)"}}>{bestRun60130.time}s</span></div>}
            {bestRun14    && <div className="hstat"><span className="hstat-label">Best 1/4</span><span className="hstat-val" style={{color:"var(--blue)"}}>{bestRun14.et}s</span></div>}
          </div>
        </div>
        <div className="model-strip">
          {MODELS.map(m=>(
            <button key={m.id} className={`mbtn${modelId===m.id?" active":""}`}
              onClick={()=>{ setProfile(p=>({...p,car:m.id})); saveProfile({...profile, car:m.id}); }}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="body">
        {activeTab==="garage" && garageContent}
        {activeTab==="parts"  && partsWithToggle}
        {activeTab==="times"  && timesContent}
        {activeTab==="board"  && boardContent}
        {activeTab==="profile"&& profileContent}
      </div>

      <nav className="bottom-nav">
        <button className={`bnav${activeTab==="garage"?" active":""}`} onClick={()=>setActiveTab("garage")}>
          <span className="bnav-icon">🚗</span>Garage
        </button>
        <button className={`bnav${activeTab==="parts"?" active":""}`} onClick={()=>setActiveTab("parts")}>
          <span className="bnav-icon">⚙</span>Parts
          {(numInst+numWish)>0&&<span className="bnav-badge">{numInst+numWish}</span>}
        </button>
        <button className={`bnav${activeTab==="times"?" active":""}`} onClick={()=>setActiveTab("times")}>
          <span className="bnav-icon">🏁</span>Times
          {runs.length>0&&<span className="bnav-badge">{runs.length}</span>}
        </button>
        <button className={`bnav${activeTab==="board"?" active":""}`} onClick={()=>setActiveTab("board")}>
          <span className="bnav-icon">📊</span>Board
        </button>
        <button className={`bnav${activeTab==="profile"?" active":""}`} onClick={()=>setActiveTab("profile")}>
          <span className="bnav-icon">👤</span>Profile
        </button>
      </nav>
    </div>
  );
}
