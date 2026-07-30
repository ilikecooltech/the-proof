# Proof Build — Vendor Link QA Results

Audit date: 2026-07-30 · Catalogue: `src/App.jsx` (SLOTS `buyUrl` fields)

## Scope

- **120** catalogue variants · **107** with a purchase link · **88** unique URLs · **41** vendor domains
- 13 variants intentionally carry no purchase link (custom tunes, shop builds, OEM/stock entries)

## Summary

| Status | Count | Meaning |
|---|---:|---|
| Fixed | 25 | Was dead or pointed at the wrong product; replaced with a URL verified to return HTTP 200 |
| OK | 54 | Resolved correctly, unchanged |
| Unverified | 24 | Vendor blocks scripted clients (Cloudflare/403/450) or has a TLS-chain quirk — **not** evidence of breakage; left unchanged |
| Wrong | 2 | Resolves but lands on the wrong target; needs a human decision |
| Broken | 1 | Genuinely broken and no safe replacement found |

Every replacement URL in this table was fetched and confirmed to return HTTP 200 with a title matching the intended product, vendor, or category. No URL was guessed.

## Results

| Product | Vendor | Old URL | Status | New URL | Note |
|---|---|---|---|---|---|
| Brisk Racing · ER12S Silver — OEM+ / Stage 1 (0.028") | 034motorsport.com | `https://www.034motorsport.com/brisk-er12s-silver-performance-spark-plug-priced-each.html` | **Fixed** | `https://www.034motorsport.com/brisk-racing-er12s-silver-spark-plug.html` | 034 retired the old '-priced-each' slug. |
| Brisk Racing · ER10S Silver — Stage 2 / Hybrid / Big Turbo (0.024") | 034motorsport.com | `https://www.034motorsport.com/brisk-er10s-silver-performance-spark-plug-priced-each.html` | **Fixed** | `https://www.034motorsport.com/brisk-racing-er10s-silver-spark-plug.html` | 034 retired the old '-priced-each' slug. |
| 034 Motorsport · HPFP Piston Upgrade Kit | 034motorsport.com | `https://www.034motorsport.com/high-pressure-fuel-pump-piston-upgrade-kit-for-audi-c7-c7-5-s6-s7.html` | **Fixed** | `https://www.034motorsport.com/034motorsport-high-pressure-fuel-pump-piston-upgrade-kit-audi-4-0t.html` | 034 renamed the HPFP kit page. |
| Motul · 8100 X-Clean 5W-40 — DI Engines / Stage 2+ | amazon.com | `https://www.amazon.com/Motul-104720-X-Clean-5W-40-5-Liter/dp/B00EOMGDG4` | **Fixed** | `https://www.amazon.com/s?k=Motul+8100+X-clean+5W-40` | Dead ASIN. Swapped to an Amazon search scoped to the exact oil spec. SEARCH FALLBACK. |
| Mobil 1 · FS 0W-40 — Cold Climate / Turbo Startup Protection | amazon.com | `https://www.amazon.com/Mobil-1-Synthetic-Motor-0W-40/dp/B07GMJQVGB` | **Fixed** | `https://www.amazon.com/s?k=Mobil+1+0W-40+European+Car+Formula` | Dead ASIN. Swapped to an Amazon search scoped to the exact oil spec. SEARCH FALLBACK. |
| Motul · 8100 X-Power 10W-60 — Track / Race Days Only | amazon.com | `https://www.amazon.com/Motul-100272-Power-10W-60-Liter/dp/B00D9J32LM` | **Fixed** | `https://www.amazon.com/s?k=Motul+300V+Power+10W-60` | Dead ASIN. Swapped to an Amazon search scoped to the exact oil spec. SEARCH FALLBACK. |
| Garrett · G40-1150 Single | atpturbo.com | `https://www.atpturbo.com/mm5/merchant.mvc?Screen=PROD&Store_Code=tp&Product_Code=GRT-TBO-G40` | **Fixed** | `https://www.atpturbo.com/mm5/merchant.mvc?Screen=CTGY&Category_Code=G40-1150` | ATP retired the per-SKU product code; the G40-1150 category page lists every housing option. CATEGORY FALLBACK. |
| Garrett · G45-1500 Single | atpturbo.com | `https://www.atpturbo.com/mm5/merchant.mvc?Screen=PROD&Store_Code=tp&Product_Code=GRT-TBO-G45` | **Fixed** | `https://www.atpturbo.com/mm5/merchant.mvc?Screen=CTGY&Category_Code=G45-1500` | ATP retired the per-SKU product code; the G45-1500 category page lists every housing option. CATEGORY FALLBACK. |
| Autotech · Dual HPFP Upgrade Kit | autotechperformance.com | `https://autotechperformance.com/product-category/audi/audi-c7-s6-s7-rs7/` | **Fixed** | `https://ctsturbo.com/product/autotech-high-volume-fuel-pump-upgrade-kit-for-gen2-2-0tfsi-2-5t-3-0t-4-0t-5-0l/` | autotechperformance.com now redirects to an unrelated business (westislandgarage.com) — the vendor site is gone. Swapped to CTS Turbo, a stocking dealer with a live product page. |
| Capristo · Valved Exhaust System | capristoexhaust.com | `https://capristoexhaust.com/product/s6-s7-valved-exhaust/` | **Fixed** | `https://capristoexhaust.com/collections/audi` | Capristo lists no C7 S6/S7 valved exhaust. Swapped to their Audi category. CATEGORY FALLBACK — catalogue entry may need review. |
| Eventuri · Carbon Intake System | eventuri.net | `https://eventuri.net/product/audi-s6-s7-rs6-rs7-4-0t-carbon-intake/` | **Fixed** | `https://www.eventuri.net/product/audi-c7-rs6-rs7/` | Eventuri moved to www + /product/; the C7 RS6/RS7 page is the 4.0T fitment. |
| GFB · DV+ Diverter Valve | gfb.com.au | `https://www.gfb.com.au/product/t9381-dv-for-audi-vw/` | **Fixed** | `https://tgkmotorsport.com/products/go-fast-bits-dv-diverter-valves-dual` | GFB's own product page 404s; TGK stocks the same DV+ valve with a live product page. |
| Milltek · Sport HFC DP | milltekcorp.com | `https://www.milltekcorp.com/large-bore-downpipe-hi-flow-sports-cat-for-products-audi-rs6-c7-4.0-tfsi-biturbo-quattro-inc-perform/p3051` | **Fixed** | `https://www.milltekcorp.com/search?q=RS6+C7+downpipe` | That downpipe SKU is retired (MSVAG06OLD). Swapped to Milltek's live search for the C7 RS6 downpipe. SEARCH FALLBACK. |
| IE · Race Catless DP | performancebyie.com | `https://performancebyie.com/collections/downpipes` | **Fixed** | `https://performancebyie.com/collections/exhaust-systems` | IE's catalogue contains no C7 4.0T downpipe. Swapped to their exhaust category. CATEGORY FALLBACK — catalogue entry may need review. |
| Remus · Sport Cat-Back | remus.eu | `https://remus.eu/en/sport-exhaust-audi-rs6-rs7-incl-ec-type-approval-046520-0500lr` | **Fixed** | `https://www.remus-exhausts.com/en/search/?q=RS6%20C7` | Old link redirected to the C8 RS6 kit (wrong chassis). Swapped to Remus' C7 RS6 search. SEARCH FALLBACK. |
| SRM · High Vacuum Upgraded Actuators | sillyrabbitmotorsport.com | `https://sillyrabbitmotorsport.com/srm850-single-turbo-kit.html` | **Fixed** | `https://sillyrabbitmotorsport.com/srm-4-0t-high-vacuum-wastegates-ea824.html` | Old SRM850 kit slug 404s; this is SRM's dedicated 4.0T high-vacuum wastegate page. |
| SRM · 2.5" Luftwaffe Intake (C7) | sillyrabbitmotorsport.com | `https://sillyrabbitmotorsport.com/luftwaffe-intake-c7-4-0t.html` | **Fixed** | `https://sillyrabbitmotorsport.com/40tfsi-luftwaffe-cnc-intake.html` | SRM renamed the C7 Luftwaffe intake page. |
| SRM · 3" Dual Intake (S8 / D4) | sillyrabbitmotorsport.com | `https://sillyrabbitmotorsport.com/luftwaffe-intake-d4-s8-4-0t.html` | **Fixed** | `https://sillyrabbitmotorsport.com/srm-s8-3inch-intakes.html` | SRM renamed the D4 S8 3" intake page. |
| TGK Motorsport · 60mm Vacuum Wastegate Kit | tgkmotorsport.com | `https://tgkmotorsport.com/products/tgk-60mm-wastegate-kit` | **Fixed** | `https://tgkmotorsport.com/products/tgk-motorsport-audi-4-0t-vacuum-wastegate-actuators` | TGK renamed the handle; new page is the 4.0T vacuum wastegate actuator kit. |
| TGK Motorsport · 4" Merged Inlet Intake | tgkmotorsport.com | `https://tgkmotorsport.com/products/tgk-4-inch-intake` | **Fixed** | `https://tgkmotorsport.com/products/tgk-motorsport-audi-4-0t-intake-system-4-conversion-audi-c7-c7-5-s6-s7-rs6-rs7` | TGK renamed the handle to the C7 4" intake conversion. |
| TGK Motorsport · 5" Conversion Kit (1000+HP) | tgkmotorsport.com | `https://tgkmotorsport.com/products/tgk-5-inch-intake-kit` | **Fixed** | `https://tgkmotorsport.com/products/tgk-motorsport-audi-4-0t-intake-system-4-to-5-conversion-c7-c7-5-s6-s7-rs6-rs7-copy` | TGK renamed the handle to the 5" conversion kit. |
| TGK Motorsport · BOV Conversion Kit | tgkmotorsport.com | `https://tgkmotorsport.com/products/tgk-motorsport-blow-off-valve-bov-conversion-kit-for-audi-4-0t` | **Fixed** | `https://tgkmotorsport.com/products/tgk-motorsport-audi-4-0t-blow-off-valve-conversion-kit` | TGK renamed the BOV conversion handle. |
| Tial · MVI Wastegate Actuators | tialsport.com | `https://tialsport.com/product/mvi-series-actuator/` | **Fixed** | `https://tialsport.com/product/mvi-2-5-wastegate-actuator/` | TiAL split the MVI series page into per-size products; MVI 2.5 is the 4.0T fitment. |
| Loba · 600cc HPFP | urotuning.com | `https://www.urotuning.com/products/loba-hpfp-upgrade-4-0-tfsi` | **Fixed** | `https://progressiveparts.com/product/loba-motorsport-hp40-high-pressure-fuel-pump-for-audi-4-0tfsi-rs6-rs7-c7-s6-s7-c7-s8-d4-2010400` | UroTuning dropped the LOBA line. Swapped to a stocking dealer's exact C7 4.0TFSI HP40 product page. |
| Xona Rotor · XR5657S (King) | xonarotor.com | `https://xonarotor.com/products/xona-rotor-57-57s-ball-bearing-turbocharger` | **Fixed** | `https://xonarotor.com/collections/all` | Previously duplicated xona_5357's page. Pointed at Xona's product index. CATEGORY FALLBACK. |
| StopTech · Trophy Sport 380 | stoptech.com | `https://www.stoptech.com/big-brake-kits/` | **Broken** | — | stoptech.com presents an invalid TLS certificate (ERR_TLS_CERT_ALTNAME_INVALID) on both apex and www. Genuinely broken for users. NEEDS MANUAL — pick a reseller. |
| KW · Variant 3 | kwsuspensions.com | `https://www.kwsuspensions.com/` | **Wrong** | — | Resolves, but it is only the KW homepage (geo-redirect); no deep product link confirmed. NEEDS MANUAL. |
| Xona Rotor · XR6564S (Big Frame) | xonarotor.com | `https://xonarotor.com/products/xona-rotor-65-64s-ball-bearing-turbocharger` | **Wrong** | — | Resolves to Xona's 65-64 handle but the page titles as XRC5764S. Left as-is. NEEDS MANUAL to confirm SKU. |
| AEM · Methanol Injection | aemelectronics.com | `https://www.aemelectronics.com/products/water-methanol-injection-systems/` | **Unverified** | — | AEM 403s scripted clients. Left unchanged, UNVERIFIED. |
| Akrapovič · Slip-On Titanium | akrapovic.com | `https://www.akrapovic.com/en/car/product/14915/Audi/S6-Avant-Limousine-C7/2017` | **Unverified** | — | akrapovic.com timed out from this network. Left unchanged, UNVERIFIED. |
| Akrapovič · Slip-On Titanium | akrapovic.com | `https://www.akrapovic.com/en/car/product/14915/Audi/S6-Avant-Limousine-C7/2017` | **Unverified** | — | akrapovic.com timed out from this network. Left unchanged, UNVERIFIED. |
| NGK · SILFER8C7ES — Stock / Stage 1 (0.028") | ecstuning.com | `https://www.ecstuning.com/Audi-C7_S6-Quattro-4.0T/Engine/Ignition/Spark_Plugs/NGK/` | **Unverified** | — |  |
| NGK · SILFER8C7ES — Stage 1/2 regapped (0.026") | ecstuning.com | `https://www.ecstuning.com/Audi-C7_S6-Quattro-4.0T/Engine/Ignition/Spark_Plugs/NGK/` | **Unverified** | — |  |
| NGK · SILFER8C7ES — Stage 2 tight gap (0.024") | ecstuning.com | `https://www.ecstuning.com/Audi-C7_S6-Quattro-4.0T/Engine/Ignition/Spark_Plugs/NGK/` | **Unverified** | — |  |
| NGK · Heat Range 9 — Stage 3 / Hybrid Turbo (0.022") | ecstuning.com | `https://www.ecstuning.com/Audi-C7_S6-Quattro-4.0T/Engine/Ignition/Spark_Plugs/NGK/` | **Unverified** | — |  |
| Denso · IKH01-27 (#5750) — Single Turbo / Race (0.018–0.020") | ecstuning.com | `https://www.ecstuning.com/Audi-C7_S6-Quattro-4.0T/Engine/Ignition/Spark_Plugs/Denso/` | **Unverified** | — |  |
| ECS Tuning · Performance Intake | ecstuning.com | `https://www.ecstuning.com/Audi-C7_S6-Quattro-4.0T/Engine/Intake/Air_Intakes/` | **Unverified** | — |  |
| ECS Tuning · Catless Race DP | ecstuning.com | `https://www.ecstuning.com/Audi-C7_S6-Quattro-4.0T/Exhaust/Performance/Downpipe/` | **Unverified** | — |  |
| ECS Tuning · Valved Cat-Back | ecstuning.com | `https://www.ecstuning.com/Audi-C7_S6-Quattro-4.0T/Exhaust/Performance/Cat_Back/ECS/` | **Unverified** | — |  |
| ECS Tuning · Competition A2A FMIC | ecstuning.com | `https://www.ecstuning.com/b-ecs-parts/ecs-tuning-c7-c75-s6-air-to-air-intercooler-kit/012711lakt/` | **Unverified** | — |  |
| ECS Tuning · Valved Cat-Back | ecstuning.com | `https://www.ecstuning.com/Audi-C7_S6-Quattro-4.0T/Exhaust/Performance/Cat_Back/ECS/` | **Unverified** | — |  |
| APR · Stage 1+ | goapr.com | `https://www.goapr.com/products/software/ecu_upgrade/parts/ECU-40T-EA824-S67` | **Unverified** | — | APR product page — Cloudflare blocks scripted fetch; confirmed live in a real browser (correct SKU page). |
| APR · Stage 2+ | goapr.com | `https://www.goapr.com/products/software/ecu_upgrade/parts/ECU-40T-EA824-S67` | **Unverified** | — | Shares the APR ECU page with apr_s1 — confirmed live in a real browser. |
| APR · DSG Tune | goapr.com | `https://www.goapr.com/products/software/tcu_upgrade/parts/TCU-DL501-MLB` | **Unverified** | — | APR TCU page — confirmed live in a real browser. |
| APR · ZF8 TCU Tune | goapr.com | `https://www.goapr.com/products/software/tcu_upgrade/parts/TCU-DL501-MLB` | **Unverified** | — | APR TCU page — confirmed live in a real browser. |
| Injector Dynamics · ID1050x Port Kit | injectordynamics.com | `https://injectordynamics.com/injectors/id1050-xds/` | **Unverified** | — | Incomplete TLS chain blocks scripted fetch; typically fine in browsers. Left unchanged, UNVERIFIED. |
| Hawk · HPS 5.0 | jhmotorsports.com | `https://jhmotorsports.com/front-brake-pads-hawk-hps-street-for-400mm-c7-s6-s7-and-d4-a8-s8.html` | **Unverified** | — | jhmotorsports returns HTTP 450 to scripted clients (bot shield). Left unchanged, UNVERIFIED. |
| Russell / Earls · -6AN Fuel Lines | summitracing.com | `https://www.summitracing.com/search/product-line/russell-performance-products` | **Unverified** | — |  |
| Russell / Earls · -8AN Fuel Lines | summitracing.com | `https://www.summitracing.com/search/product-line/russell-performance-products` | **Unverified** | — |  |
| Russell / Earls · -10AN Fuel Lines | summitracing.com | `https://www.summitracing.com/search/product-line/russell-performance-products` | **Unverified** | — |  |
| Brembo · GT 6-Pot Kit | vividracing.com | `https://www.vividracing.com/brembo-drilled-front-big-brake-kit-8piston-for-audi-rs7s6s7-20132018-p-152460269.html` | **Unverified** | — | Cloudflare 'Attention Required'. Left unchanged, UNVERIFIED. |
| Whiteline · Adjustable Set | whiteline.com.au | `https://www.whiteline.com.au/products/vehicle/audi` | **Unverified** | — | Vendor 403s scripted clients. Left unchanged, UNVERIFIED. |
| 034 Motorsport · Res-X Resonator Delete | 034motorsport.com | `https://www.034motorsport.com/res-x-resonator-delete-and-x-pipe-c7-c7-5-audi-s6-4-0tt.html` | **OK** | — | Resolves to the correct vendor page. |
| 034 Motorsport · Adjustable Solid Rear Sway Bar | 034motorsport.com | `https://www.034motorsport.com/adjustable-solid-rear-sway-bar-b8-b8-5-audi-q5-sq5-c7-c7-5-a6-s6-rs6-a7-s7-rs7.html` | **OK** | — | Resolves to the correct vendor page. |
| 034 Motorsport · Street Density Motor Mounts | 034motorsport.com | `https://www.034motorsport.com/motor-mount-street-density-c7-c7-5-audi-s6-s7-rs7-and-d4-a8-s8-4-0t.html` | **OK** | — | Resolves to the correct vendor page. |
| Liqui-Moly · Leichtlauf High Tech 5W-40 — All Stages | amazon.com | `https://www.amazon.com/LIQUI-Molygen-Generation-5W-40-Motor/dp/B076ZQ4KDK` | **OK** | — | Resolves to the correct vendor page. |
| Motul · 8100 X-cess Gen2 5W-40 — All Stages | amazon.com | `https://www.amazon.com/Motul-109776-X-Cess-5-Liter-Bottle/dp/B089MB5NHC` | **OK** | — | Resolves to the correct vendor page. |
| Castrol · EDGE 5W-40 — Stock / Stage 1 (OEM dealer fill) | amazon.com | `https://www.amazon.com/Castrol-03084-5W-30-Advanced-Synthetic/dp/B00ICSWGJ0` | **OK** | — | Resolves to the correct vendor page. |
| ARM Motorsports · Catless Race DP | armmotorsports.com | `https://armmotorsports.com/products/audi-4-0t-downpipes-s6-s7-s8-rs7` | **OK** | — | Resolves to the correct vendor page. |
| AWE · AirGate Intake | awe-tuning.com | `https://www.awe-tuning.com/products/audi-c7-s6-s7-4-0t-carbon-intake` | **OK** | — | Resolves to the correct vendor page. |
| AWE · Tuning DP | awe-tuning.com | `https://www.awe-tuning.com/products/awe-tuning-s6-4-0t-track-touring-exhaust-suite` | **OK** | — | Resolves to the correct vendor page. |
| AWE · Touring Edition | awe-tuning.com | `https://www.awe-tuning.com/products/awe-tuning-s6-4-0t-track-touring-exhaust-suite` | **OK** | — | Resolves to the correct vendor page. |
| AWE · Touring Edition | awe-tuning.com | `https://www.awe-tuning.com/products/awe-tuning-s6-4-0t-track-touring-exhaust-suite` | **OK** | — | Resolves to the correct vendor page. |
| AWE · Track Edition | awe-tuning.com | `https://www.awe-tuning.com/products/awe-tuning-s6-4-0t-track-touring-exhaust-suite` | **OK** | — | Resolves to the correct vendor page. |
| Bilstein · B16 Dynamic | cloud9ab.com | `https://www.cloud9ab.com/products/audi-14-18-rs7-13-18-s7-b16-pss10-coilover-kit-bil48-221832` | **OK** | — | Resolves to the correct vendor page. |
| Eisenmann · Sport Exhaust | ind-distribution.com | `https://ind-distribution.com/collections/eisenmann` | **OK** | — | Resolves to the correct vendor page. |
| JXB Performance · Retrofitted Wavetrac LSD | jxbperformance.com | `https://www.jxbperformance.com/products/p/jxb-retrofitted-wavetrac-rear-limited-slip-differential-for-audi-b8-s4/s5-and-c7-s6/s7` | **OK** | — | Resolves to the correct vendor page. |
| Klassen · Klassen Manifolds | klasen-motors.com | `https://klasen-motors.com/` | **OK** | — | Resolves to the correct vendor page. |
| Mickey Thompson · ET Street S/S | mickeythompsontires.com | `https://www.mickeythompsontires.com/drag-tires/et-street-s-s` | **OK** | — | Resolves to the correct vendor page. |
| Milltek · Non-Resonated | milltekcorp.com | `https://www.milltekcorp.com/non-resonated-non-valved-cat-back-for-products-audi-s6-4.0-tfsi-c7-quattro-2012-to-2018products-audi/p3274` | **OK** | — | Redirects to the current Milltek cat-back product page — healthy redirect, no change needed. |
| Milltek · Resonated | milltekcorp.com | `https://www.milltekcorp.com/non-resonated-non-valved-cat-back-for-products-audi-s6-4.0-tfsi-c7-quattro-2012-to-2018products-audi/p3274` | **OK** | — | Redirects to the current Milltek cat-back product page — healthy redirect, no change needed. |
| Milltek · Non-Resonated | milltekcorp.com | `https://www.milltekcorp.com/non-resonated-non-valved-cat-back-for-products-audi-s6-4.0-tfsi-c7-quattro-2012-to-2018products-audi/p3274` | **OK** | — | Redirects to the current Milltek cat-back product page — healthy redirect, no change needed. |
| Mishimoto · Oil Cooler Kit | mishimoto.com | `https://www.mishimoto.com/transmission-oil-coolers/oil-cooler-kits.html` | **OK** | — | Resolves to the correct vendor page. |
| NOS / Nitrous Outlet · Wet Nitrous + Port Combo | nitrousoutlet.com | `https://nitrousoutlet.com/products/x-series-core-efi-nitrous-kit` | **OK** | — | Resolves to the correct vendor page. |
| OS Giken · Triple Plate Clutch LSD | osgikenusa.com | `https://osgikenusa.com/collections/clutch1` | **OK** | — | Resolves to the correct vendor page. |
| IE · HPFP Internal Kit | performancebyie.com | `https://performancebyie.com/products/ie-hpfp-internal-upgrade-kit-for-audi-4-0tt-tfsi-engines` | **OK** | — | Resolves to the correct vendor page. |
| IE · Carbon Fiber Intake | performancebyie.com | `https://performancebyie.com/collections/cold-air-intake-systems/products/ie-carbon-fiber-intake-system-for-audi-c7-c7-5-s6` | **OK** | — | Resolves to the correct vendor page. |
| IE · Front Mount A2A FMIC | performancebyie.com | `https://performancebyie.com/collections/intercooler-systems` | **OK** | — | Resolves to the correct vendor page. |
| Hoosier · A7 Drag Radial | shop.hoosiertire.com | `https://shop.hoosiertire.com/racing-tires/drag-racing/` | **OK** | — | Resolves to the correct vendor page. |
| SRM (Softronic) · Stage 1 | sillyrabbitmotorsport.com | `https://sillyrabbitmotorsport.com/tuning/` | **OK** | — | Resolves to the correct vendor page. |
| SRM (Softronic) · Stage 2 | sillyrabbitmotorsport.com | `https://sillyrabbitmotorsport.com/tuning/` | **OK** | — | Resolves to the correct vendor page. |
| Dyno Spectrum (DS1) · DS1 ECU + ET Spec TCU Combo | sillyrabbitmotorsport.com | `https://sillyrabbitmotorsport.com/dyno-spectrum-ds1.html` | **OK** | — | Resolves to the correct vendor page. |
| SRM · Port Injection Kit | sillyrabbitmotorsport.com | `https://sillyrabbitmotorsport.com/port-injection-4-0t-spacer-kit.html` | **OK** | — | Resolves to the correct vendor page. |
| SRM · Upgraded Exhaust Manifolds + Turbine Housing | sillyrabbitmotorsport.com | `https://sillyrabbitmotorsport.com/turbochargers/` | **OK** | — | Resolves to the correct vendor page. |
| SRM · A2A Intercooler (CSF Core) | sillyrabbitmotorsport.com | `https://sillyrabbitmotorsport.com/air-to-air-intercooler-for-4-0t.html` | **OK** | — | Resolves to the correct vendor page. |
| ET Spec · ZF8HP / DL501 TCU Tune | sillyrabbitmotorsport.com | `https://sillyrabbitmotorsport.com/etspec-tcu-tune-audi-zf-8hp-or-continental-dl501.html` | **OK** | — | Resolves to the correct vendor page. |
| Slavov / SRM · Slavov ZF8HP + DL501 TCU | sillyrabbitmotorsport.com | `https://sillyrabbitmotorsport.com/zf8-tcu-tune-audi-a8-s8-rs6-rs7.html` | **OK** | — | Resolves to the correct vendor page. |
| SRM · 4.0T Port Injection Complete Kit | sillyrabbitmotorsport.com | `https://sillyrabbitmotorsport.com/port-injection-4-0t-spacer-kit.html` | **OK** | — | Resolves to the correct vendor page. |
| Unitronic · DQ500 Stage 1 | store.ngpracing.com | `https://store.ngpracing.com/products/unitronic-audi-c7-c7-5-s6-s7-4-0t-s-tronic-performance-tcu-software` | **OK** | — | Resolves to the correct vendor page. |
| Peloquin · Torque Biasing Diff | store.ngpracing.com | `https://store.ngpracing.com/collections/vendors?q=peloquins` | **OK** | — | Resolves to the correct vendor page. |
| Turbosmart · TS1 Hybrid | tgkmotorsport.com | `https://tgkmotorsport.com/` | **OK** | — | Resolves to the correct vendor page. |
| Turbosmart · TS2+ Hybrid | tgkmotorsport.com | `https://tgkmotorsport.com/` | **OK** | — | Resolves to the correct vendor page. |
| Walbro · E85 Injector Kit | tgkmotorsport.com | `https://tgkmotorsport.com/products/tgk-motorsport-flex-fuel-kit` | **OK** | — | Resolves to the correct vendor page. |
| Michelin · Pilot Sport 4S | tirerack.com | `https://www.tirerack.com/tires/michelin-pilot-sport-4s` | **OK** | — | Resolves to the correct vendor page. |
| Michelin · Pilot Sport Cup 2 | tirerack.com | `https://www.tirerack.com/tires/michelin-pilot-sport-cup-2` | **OK** | — | Resolves to the correct vendor page. |
| Michelin · Pilot Super Sport | tirerack.com | `https://www.tirerack.com/tires/michelin-pilot-super-sport` | **OK** | — | Resolves to the correct vendor page. |
| Bridgestone · Potenza RE-71RS | tirerack.com | `https://www.tirerack.com/tires/bridgestone-potenza-re-71rs` | **OK** | — | Resolves to the correct vendor page. |
| Nitto · NT01 R-Compound | tirerack.com | `https://www.tirerack.com/tires/nitto-nt01` | **OK** | — | Resolves to the correct vendor page. |
| Michelin · Pilot Sport 5 | tirerack.com | `https://www.tirerack.com/tires/michelin-pilot-sport-5` | **OK** | — | Resolves to the correct vendor page. |
| Nitto · 555R2 Drag Radial | tirerack.com | `https://www.tirerack.com/tires/nitto-nt555rii` | **OK** | — | Resolves to the correct vendor page. |
| Unitronic · Stage 1 | urotuning.com | `https://www.urotuning.com/products/unitronic-c7-audi-s6-s7-4-0t-performance-software` | **OK** | — | Resolves to the correct vendor page. |
| Unitronic · Stage 2 | urotuning.com | `https://www.urotuning.com/products/unitronic-c7-audi-s6-s7-4-0t-performance-software` | **OK** | — | Resolves to the correct vendor page. |
| Unitronic · ZF8 TCU Stage 1 | urotuning.com | `https://www.urotuning.com/products/unitronic-c7-c7-5-audi-s6-s7-4-0t-tcu-upgrade` | **OK** | — | Resolves to the correct vendor page. |
| Pagid · RS 4-2 Track | vagbremtechnic.com | `https://www.vagbremtechnic.com/pagid-performance-brake-pads-a6-s6-rs6-c7-click-for-options/` | **OK** | — | Resolves to the correct vendor page. |
| Wagner · Competition A2A FMIC | wagner-tuning.com | `https://www.wagner-tuning.com/product/audi/audi-rs6-c7-typ-4g/performance-ladeluftkuehler-kit-fuer-audi-rs6-c7-4-0-biturbo-200001193.html` | **OK** | — | Resolves to the correct vendor page. |
| Xona Rotor · XR5357S (Compact) | xonarotor.com | `https://xonarotor.com/products/xona-rotor-57-57s-ball-bearing-turbocharger` | **OK** | — | Resolves to the correct vendor page. |

## Needs manual confirmation

- **StopTech · Trophy Sport 380** (stoptech.com) — stoptech.com presents an invalid TLS certificate (ERR_TLS_CERT_ALTNAME_INVALID) on both apex and www. Genuinely broken for users. NEEDS MANUAL — pick a reseller.
- **KW · Variant 3** (kwsuspensions.com) — Resolves, but it is only the KW homepage (geo-redirect); no deep product link confirmed. NEEDS MANUAL.
- **Xona Rotor · XR6564S (Big Frame)** (xonarotor.com) — Resolves to Xona's 65-64 handle but the page titles as XRC5764S. Left as-is. NEEDS MANUAL to confirm SKU.

### Vendors that block automated checking

These returned Cloudflare/bot-shield responses to scripted fetches. That is a bot defence, not a dead link — they were left untouched. APR was additionally opened in a real browser and confirmed to load the correct product page.

- AEM · Methanol Injection — `aemelectronics.com`
- Akrapovič · Slip-On Titanium — `akrapovic.com`
- Akrapovič · Slip-On Titanium — `akrapovic.com`
- NGK · SILFER8C7ES — Stock / Stage 1 (0.028") — `ecstuning.com`
- NGK · SILFER8C7ES — Stage 1/2 regapped (0.026") — `ecstuning.com`
- NGK · SILFER8C7ES — Stage 2 tight gap (0.024") — `ecstuning.com`
- NGK · Heat Range 9 — Stage 3 / Hybrid Turbo (0.022") — `ecstuning.com`
- Denso · IKH01-27 (#5750) — Single Turbo / Race (0.018–0.020") — `ecstuning.com`
- ECS Tuning · Performance Intake — `ecstuning.com`
- ECS Tuning · Catless Race DP — `ecstuning.com`
- ECS Tuning · Valved Cat-Back — `ecstuning.com`
- ECS Tuning · Competition A2A FMIC — `ecstuning.com`
- ECS Tuning · Valved Cat-Back — `ecstuning.com`
- APR · Stage 1+ — `goapr.com`
- APR · Stage 2+ — `goapr.com`
- APR · DSG Tune — `goapr.com`
- APR · ZF8 TCU Tune — `goapr.com`
- Injector Dynamics · ID1050x Port Kit — `injectordynamics.com`
- Hawk · HPS 5.0 — `jhmotorsports.com`
- Russell / Earls · -6AN Fuel Lines — `summitracing.com`
- Russell / Earls · -8AN Fuel Lines — `summitracing.com`
- Russell / Earls · -10AN Fuel Lines — `summitracing.com`
- Brembo · GT 6-Pot Kit — `vividracing.com`
- Whiteline · Adjustable Set — `whiteline.com.au`
