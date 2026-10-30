# Collisions and identity issues (Stage 2 draft, 30 Oct 2026)

Built by `tools/build_ids.py` from Moonshot `main` @ 4e08b27 (PR 23) and EMMA `scripts/universe.py`, cross-checked with the research owner's inventory.

## Counts

| | |
|---|---|
| Moonshot Screen codes | 187 (no duplicates within the Screen) |
| Moonshot pilot register names | 11 (3 already on the Screen under another code: IPCO, LUC, SNM/ShaMaran) |
| Moonshot Norway shelf records | 24 (none is a Screen row; Kistos Norway is a subsidiary of Screen row KIST) |
| **Distinct entities across the three Moonshot lists** | **219** (187 + 8 + 24). The plan's "about 218" is close but was not reproducible; use 219. |
| + listed parents added from Norway parent links | 11 |
| + names only in country files | 4 (Africa Energy, Argos Resources, JHI Associates, Pancontinental) |
| Moonshot-touching companies in `companies.csv` | 234 |
| EMMA equities | 84 |
| **All companies** | **281**, with **266 listings** |
| **Overlap EMMA ∩ Moonshot** | **37** = 30 research companies (Screen or pilot) + 7 Norway-shelf parents/licensees (Aker BP, ConocoPhillips, Equinor, Harbour, Shell, TotalEnergies, Vår Energi) |

The earlier "21" overlap was counted before the London E&Ps, rest-of-Europe names (PR 23) and Norway parent links were in the data.

Research overlap (30): Afentra; Arrow Exploration; Capricorn Energy; Chariot; Diversified Energy; Eco (Atlantic) Oil and Gas; Energean; EnQuest; Europa Oil and Gas; Genel Energy; Gulf Keystone; International Petroleum Corp; Jadestone; Kistos; Lucara Diamond; Lundin Gold; Lundin Mining; LunR Royalties; Montage Gold; NGEx Minerals; Orrön Energy; PetroTal; Pharos; Prospex; Rockhopper; Serica; ShaMaran; Star Energy Group; Tullow; Zephyr.

## 1. Ticker collisions (same ticker, different companies) — 3

| Ticker | Company A | Company B | Where it bites |
|---|---|---|---|
| **SNM** | Sentinel Metals (ASX:SNM, Screen code `SNM`) | ShaMaran Petroleum (Oslo/Stockholm SNM; pilot ticker `SNM`, Screen code `SNM.OL`) | **Live clash inside Moonshot**: the bare key `SNM` means Sentinel on the Screen and ShaMaran in the pilot register |
| **PEN** | Panoro Energy (XOSL:PEN, Screen `PEN.OL`) | Peninsula Energy (ASX:PEN, Screen `PEN`) | Only the suffix separates them |
| **MAU** | Maurel et Prom (XPAR:MAU, Screen `MAU.PA`) | Montage Gold (TSX:MAU, pilot `MAU`) | Two different companies. **Correction to the research inventory**, which lists MAU as one company under two codes |

General risk: Moonshot keys mix bare tickers (ASX, London; 163 codes) with Yahoo-suffixed ones (Nordic/EU; 24). Bare tickers repeat across exchanges worldwide, so any new name can collide. New key = `listing_id` (`MIC:ticker`), never a bare ticker.

## 2. Same company under two codes (double records) — fix through `id_map.csv`

| Company | Codes in use |
|---|---|
| International Petroleum Corp | pilot `IPCO`, Screen `IPCO.ST`, EMMA `IPCO.TO` |
| Lucara Diamond | pilot `LUC`, Screen `LUC.ST`, EMMA `LUC.TO` |
| ShaMaran Petroleum | pilot `SNM`, Screen `SNM.OL`, EMMA `SNM.OL` |
| Kistos | Screen `KIST` (plc) and Norway record `Kistos` (Kistos Energy (Norway) AS, kept as a subsidiary with its own company_id) |

## 3. Multi-listed companies — 8 (one company, several listings)

International Petroleum (XTSE, XSTO), ShaMaran (MERK, XSTO), Lucara (XTSE, SSME, XBOT), Lundin Gold (XTSE, XSTO), Lundin Mining (XTSE, XSTO `LUMI`), Equinor (XOSL, XNYS), TotalEnergies (XPAR, XNYS), Shell (XLON, XNYS). Secondary tickers marked "ticker to verify" in `listings.csv`: XSTO:LUG, XSTO:LUMI, XBOT:LUC.

## 4. Name changes (keep company_id, change name; old names as aliases)

No rename or delisting is recorded in either site's data. Known from public announcements (verify before relying on them):
- Barrick: Barrick Gold → Barrick Mining; NYSE ticker GOLD → B (EMMA already uses `B`).
- Meren Energy: formerly Africa Oil Corp.
- Star Energy Group: formerly IGas Energy.
- Capricorn Energy: formerly Cairn Energy.
- Rockhopper appears in country files "via Falkland Oil and Gas" (a former subsidiary name) — mapped to Rockhopper.

## 5. Delisted, private, state, unverified — no listing row

Private (8): Concedo, Lime Petroleum, M Vest Energy, Pandion Energy, Petrolia NOCO, Source Energy, Sval Energi, Wellesley Petroleum. State: Petoro. Unverified: Argos Resources, JHI Associates (country files only). Lime's parent link is unverified. INPEX Idemitsu Norge has a JV parent (INPEX + Idemitsu) kept as one parent record for now.
No delisted company found in the current data.

## 6. Name-matching errors

Moonshot's Events chart matches rows by approximate name (`namesClose`) and files RCM (Rapid Critical Metals) events under CRI (Critica) and CRI under BCM (Brazilian Critical Minerals). The ID tables use code-first matching only; names are a fallback that a person confirms.

## 7. Event ids (Stage 3)

Event ids are built from headline + date (past) and list position (upcoming) and are also the calendar UIDs, so they are not stable. Freeze all current ids (742 past, 171 upcoming, 246 Norway, 46 pilot) in an `event_id_map.csv` before any change.
