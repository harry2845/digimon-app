# Digimon App - Architecture Guide

Pure frontend web app (HTML + CSS + Vanilla JS, no frameworks) for browsing/editing a Digimon encyclopedia from Digimon Story: Cyber Sleuth - Hacker's Memory.

## File Structure

```
digimon-app/
├── index.html        # SPA entry point, all pages defined here
├── style.css         # All styles, responsive, mobile-friendly
├── app.js            # Main application logic (IIFE, ~560 lines)
├── pathfinder.js     # BFS pathfinding algorithms (standalone functions)
├── data.js           # Default digimon database (DEFAULT_DIGIMON_DB)
├── data_backup.js    # Factory backup (BACKUP_DIGIMON_DB), never modified at runtime
├── build_data.py     # One-time script: digimon_guide.txt → data.js
└── README.md         # User-facing docs (Chinese)
```

## Data Model

### Core Database (`data.js`)
```js
const DEFAULT_DIGIMON_DB = {
  digimon: {
    "d001": {
      uid: "d001",           // Immutable unique ID
      dexId: 1,              // Display number, swappable between entries
      nameCN: "月兔獸",       // Chinese name (Traditional)
      nameEN: "Lunamon",     // English name
      stage: "成長期",        // Evolution stage
      evolutions: ["d023"],  // UIDs this can evolve TO
      devolutions: ["d008"]  // UIDs this can devolve TO
    }
  },
  stages: ["幼年期I", "幼年期II", "成長期", "成熟期", "完全體", "究極體", "超究極體"]
};
```

### Collection Status (separate localStorage key `digimonCollection`)
```js
{ "d001": 0, "d002": 1, "d003": 2 }
// 0 = unseen (未见过), 1 = seen (已见过), 2 = owned (已拥有)
```

Not stored in `data.js`. Included in JSON export/import.

## Persistence

- **`localStorage['digimonDB']`** — Modified digimon data. Loaded on startup, takes priority over `data.js`.
- **`localStorage['digimonCollection']`** — Collection status per digimon.
- **`data.js` (DEFAULT_DIGIMON_DB)** — Fallback when no localStorage. User can download updated version via "Save as Default".
- **`data_backup.js` (BACKUP_DIGIMON_DB)** — Factory reset target. Should never be regenerated after user edits `data.js`.

### Reset operations
- "Reset to Default" → loads `DEFAULT_DIGIMON_DB` into localStorage (does NOT touch collection)
- "Reset to Factory" → loads `BACKUP_DIGIMON_DB` into localStorage (does NOT touch collection)
- JSON export includes both digimon data and collection status
- JSON import restores both if collection field is present

## app.js Architecture

Single IIFE containing all application logic:

### Data Layer (top)
- `loadDB()` / `saveDB()` — localStorage ↔ `db` object
- `loadCollection()` / `saveCollection()` — localStorage ↔ `collection` object
- `getStatus(uid)` / `cycleStatus(uid)` — read/toggle collection status (0→1→2→0)

### Router
- Hash-based: `#list`, `#detail/{uid}`, `#pathfinder`
- `navigate()` — reads `location.hash`, shows/hides `.page` divs, calls render function

### Pages
- **List** (`renderList()`) — Card grid, stage filter buttons, collection status icons (clickable)
- **Detail** (`renderDetail(uid)`) — Full info, evo/devo lists (side by side), inline editing, status toggle
- **Pathfinder** (`setupPathfinder()`) — Two search inputs with dropdowns, dual BFS results

### Edit Mode
- Toggled via checkbox in navbar
- Enables: inline name editing, stage select, evo/devo add/delete/reorder, dex swap, add/delete digimon
- All edits save to localStorage immediately

### Data Menu
- Export JSON (includes collection), Import JSON, Save as Default (downloads data.js), Reset to Default, Reset to Factory

## pathfinder.js

Two standalone functions (not inside the IIFE):

- **`findShortestPath(db, fromUid, toUid)`** — Standard BFS, treats evo and devo edges equally (weight 1). Returns array of `{uid, edge}` or null.
- **`findConstrainedPath(db, fromUid, toUid, collectionStatus)`** — Same BFS but devolution edges are only traversable if the target has status >= 1 (seen or owned). Evolution edges are unrestricted.

The UI shows both results: "Ideal Path" and "Currently Feasible Path". If the ideal path is already fully feasible, only one is shown.

## Important Warnings

- **DO NOT run `build_data.py`** — it overwrites `data.js` with regenerated data, destroying user's manual Chinese name edits. Apply fixes in-place instead.
- **341 entries** after deduplication (original source had ~352 with duplicates).
- Three entries were manually split from wrongly-merged duplicates: d340 (鋼鐵巨龍獸/MetalTyrannomon), d341 (鎧甲加魯魯獸/MagnaGarurumon normal form), d014 (多路龍獸/Dorugoramon fixed).
- Evo/devo relationships should be symmetric: if A evolves to B, B should devolve to A.

## UI/UX Notes

- Mobile: responsive grid → single column, touch swipe for detail navigation
- Keyboard: left/right arrows navigate between detail pages
- Stage colors: 7 stages mapped to CSS variables (baby1=pink → super=orange)
- Collection icons on list cards: ○ unseen (gray), ◐ seen (blue), ● owned (green)
