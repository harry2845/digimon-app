# Digimon App - Architecture Guide

Pure frontend web app (HTML + CSS + Vanilla JS, no frameworks) for browsing/editing a Digimon encyclopedia from Digimon Story: Cyber Sleuth - Hacker's Memory.

## File Structure

```
digimon-app/
├── index.html        # SPA entry point, all pages defined here
├── style.css         # All styles, responsive, mobile-friendly
├── app.js            # Main application logic (IIFE, ~650 lines)
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
  stages: ["幼年期I", "幼年期II", "成長期", "成熟期", "完全體", "究極體", "超究極體", "裝甲體"]
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
- **`localStorage['digimonPathTabs']`** — Path query tab state: `{ activeTab, tabs: [{ name, fromUid, toUid, waypoints, comments, resultHtml }] }`. `comments` is a `{uid: string}` map of per-node remarks.
- **`localStorage['digimonPathPresets']`** — Named path presets: `[{ name, fromUid, toUid, waypoints, comments }]` (max 10).
- **`localStorage['digimonEvoBlacklist']`** — Evolution blacklist: `[uid, ...]`. Digimon UIDs whose evolution-to edges are blocked in pathfinding (devolution still allowed).
- **`data.js` (DEFAULT_DIGIMON_DB)** — Fallback when no localStorage. User can download updated version via "Save as Default".
- **`data_backup.js` (BACKUP_DIGIMON_DB)** — Factory reset target. Should never be regenerated after user edits `data.js`.

### Reset operations
- "Reset to Default" → loads `DEFAULT_DIGIMON_DB` into localStorage (does NOT touch collection)
- "Reset to Factory" → loads `BACKUP_DIGIMON_DB` into localStorage (does NOT touch collection)
- JSON export includes both digimon data, collection status, path tabs, path presets, and evolution blacklist
- JSON import restores all if respective fields are present

## app.js Architecture

Single IIFE containing all application logic:

### i18n (Traditional/Simplified Chinese)
- `currentLang` — `'tw'` or `'cn'`, persisted in `localStorage['digimonLang']`
- `initConverter()` — initializes OpenCC converters (tw→cn and cn→tw) from opencc-js CDN
- `t(text)` — converts text to Simplified Chinese when `currentLang === 'cn'`, otherwise returns as-is. Used to wrap all displayed strings.
- `fromInput(text)` — converts Simplified input back to Traditional for search matching against `nameCN`
- `updateStaticText()` — updates all static HTML text (nav labels, buttons, placeholders) to current language
- `toggleLang()` — switches language, saves preference, re-renders everything
- **Data layer is never modified** — `t()` only affects rendering output

### Data Layer (top)
- `loadDB()` / `saveDB()` — localStorage ↔ `db` object
- `loadCollection()` / `saveCollection()` — localStorage ↔ `collection` object
- `getStatus(uid)` / `cycleStatus(uid)` — read/toggle collection status (0→1→2→0)

### Router
- Hash-based: `#list`, `#detail/{uid}`, `#pathfinder`
- `navigate()` — reads `location.hash`, shows/hides `.page` divs, calls render function

### Pages
- **List** (`renderList()`) — Card grid, stage filter buttons, collection status filter buttons (unseen/seen-only/owned/seen+owned, combinable with stage filter), collection status icons (clickable)
- **Detail** (`renderDetail(uid)`) — Full info, evo/devo lists (side by side), inline editing, status toggle
- **Pathfinder** (`setupPathfinder()`) — From/to search inputs, waypoint list (add/remove), dual BFS results, collection route planner
  - **Multi-tab**: Up to 20 tabs, each with independent from/to/waypoints/comments/result cache. Tab state in `localStorage['digimonPathTabs']`. Right-click a tab to duplicate it.
  - **Presets**: Save/load named presets (max 10) in `localStorage['digimonPathPresets']`. Load overwrites current tab.
  - **Result caching**: Query results stored as innerHTML string per tab, re-rendered with click handlers on tab switch.
  - **Waypoint highlight**: Waypoint nodes in path results get `.path-node-waypoint` class (orange border + yellow bg).
  - **Node comments**: Each tab stores a `comments: {uid: string}` map. Waypoint form inputs show comment fields. In path results, comments display as orange labels below the node. Right-click any node in results to add/edit comment via prompt dialog. Comments are saved in tab state, presets, and JSON export.
  - **Evolution blacklist**: Global list of UIDs stored in `localStorage['digimonEvoBlacklist']`. BFS skips evolution edges to blacklisted UIDs (devolution still allowed). If blacklist filtering yields no result but unfiltered does, shows a warning and the unfiltered result.
  - `window._refreshPathTabs` — exposed by setupPathfinder for language toggle re-render.

### Edit Mode
- Toggled via checkbox in navbar
- Enables: inline name editing, stage select, evo/devo add/delete/reorder, dex swap, add/delete digimon
- All edits save to localStorage immediately

### Data Menu
- Export JSON (includes collection), Import JSON, Save as Default (downloads data.js), Reset to Default, Reset to Factory

## pathfinder.js

Standalone functions (not inside the IIFE):

- **`findShortestPath(db, fromUid, toUid, blacklist)`** — Standard BFS, treats evo and devo edges equally (weight 1). Skips evolution edges to blacklisted UIDs if provided. Returns array of `{uid, edge}` or null.
- **`findConstrainedPath(db, fromUid, toUid, collectionStatus, blacklist)`** — Same BFS but devolution edges are only traversable if the target has status >= 1 (seen or owned). Evolution edges skip blacklisted UIDs.
- **`findConstrainedPathWithSeen(db, fromUid, toUid, collectionStatus, extraSeen, blacklist)`** — Like `findConstrainedPath` but also allows devolution to nodes in `extraSeen` set. Used for waypoint chains where prior segments' nodes count as seen.
- **`findPathWithWaypoints(db, fromUid, toUid, waypoints, collectionStatus, blacklist)`** — Finds shortest path from→to passing through all waypoint nodes. Enumerates all permutations of waypoints, runs segmented BFS for each, returns the shortest. Returns `{ideal, constrained}` — both the unrestricted and collection-constrained best paths. Constrained version dynamically accumulates seen nodes across segments. Passes blacklist through to all sub-calls.
- **`findCollectionRoute(db, collectionStatus, startUid)`** — Greedy DFS chain builder for collecting all un-owned Digimon. Starts from an owned node, greedily walks to un-owned neighbors (preferring high-connectivity nodes), bridges through owned nodes via BFS when stuck. Returns `{chains, unreachable}`.

The pathfinder UI shows both "Ideal Path" and "Currently Feasible Path". If the ideal path is already fully feasible, only one is shown.

## Important Warnings

- **DO NOT run `build_data.py`** — it overwrites `data.js` with regenerated data, destroying user's manual Chinese name edits. Apply fixes in-place instead.
- **341 entries** after deduplication (original source had ~352 with duplicates).
- **8 stages**: 幼年期I, 幼年期II, 成長期, 成熟期, 完全體, 究極體, 超究極體, 裝甲體 (Armor form, was previously "8" in raw data).
- Three entries were manually split from wrongly-merged duplicates: d340 (鋼鐵巨龍獸/MetalTyrannomon), d341 (鎧甲加魯魯獸/MagnaGarurumon normal form), d014 (多路龍獸/Dorugoramon fixed).
- Evo/devo relationships should be symmetric: if A evolves to B, B should devolve to A.

## UI/UX Notes

- Mobile: responsive grid → single column, touch swipe for detail navigation
- Keyboard: left/right arrows navigate between detail pages
- Stage colors: 8 stages mapped to CSS variables (baby1=pink → super=orange, armor=brown)
- Language toggle button in navbar: 繁/简, switches all display text via opencc-js runtime conversion
- Collection icons on list cards: ○ unseen (gray), ◐ seen (blue), ● owned (green)
- Collection stats bar on list page: total / seen / owned counts
- Waypoint UI: dynamic add/remove waypoint inputs between from/to in pathfinder
