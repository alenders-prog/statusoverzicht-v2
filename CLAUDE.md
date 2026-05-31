# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**Zorgzaam Scheiden V2** is a dossier management system for a Dutch divorce mediation practice. It is a plain static HTML/CSS/JS app (no build step, no framework) backed by Supabase (PostgreSQL + Auth). It is deployed via **GitHub Pages** — pushing to `main` is the only deployment step.

Because there is no localhost server, changes are only visible to the user after a `git push`. Always push when the user wants to verify a UI change.

## Files

| File | Purpose |
|---|---|
| `index.html` + `app.js` + `style.css` | Kanban board (main overview) |
| `statusoverzicht.html` | List/table view of all dossiers (29 columns) |
| `info.html` | Per-dossier detail page (two tabs: Klantgegevens + Klantstatus) |
| `settings.html` | Alarm threshold settings |

## Database

One Supabase project. Two tables:
- **`dossiers`** — one row per client couple. Key columns: `id`, `klant` (name string like `"Jan de Vries - Marie Pietersen"`), `kanban_column`, `flagged`, `info_data` (JSON blob), `opmerkingen`, `opmerkingen_gewijzigd`, and ~25 date/yn/text status fields.
- **`alarmsettings`** — single row `id='main'` with a `settings` JSONB column.

`info_data` is a JSON blob that holds all klantgegevens checklist state (keys like `{ b: 0|1, a: 0|1 }` per document) plus `_dienstverlening`, `_klant`, `_nvt`, and `_opmerkingen_gewijzigd` (deprecated — use the `opmerkingen_gewijzigd` column instead).

## Critical logic: Rechtbank = Nee

When `infoData._dienstverlening.rechtbank === 'Nee'`, the phases **controle, advocaat, rechtbank, gemeente** are skipped entirely.

- **Detection**: always read from `info_data` JSON only — `isRechtbankNee(row)` in app.js, `isRechtbankNeeInfo()` in info.html. Never use flat DB fields as fallbacks (causes false positives).
- **Column placement**: `getColumn(row)` ignores `kanban_column` for Rechtbank=Nee rows and always calls `getInitialColumn(row)`.
- **getInitialColumn**: guards all skipped-phase checks with `!rnee &&`. When `rnee`, `eerste_concept` → `concepten` (not `controle`), `akkoord_klanten` → `afronding` (not `getekend`).
- **n.v.t. propagation**: on save in info.html, `tColsNee` fields are set to `'n.v.t.'` when Rechtbank=Nee; `tColsJa` fields have `'n.v.t.'` cleared when switching back to Ja. Uses `statusData[col]` (in-memory) not a DB fetch to avoid timing issues.

## Data flow in info.html

Two separate data stores, both loaded once on page open:

- **`statusData`** = the raw `dossiers` row (`data` from Supabase). All flat DB columns live here. Saved via `saveStatusField(key, value)` which debounces into `db.from('dossiers').update(patch)`.
- **`infoData`** = `JSON.parse(data.info_data)`. Klantgegevens checklist state. Saved via `save()` which serialises `infoData` back to `info_data`. The `save()` function is triggered by klantgegevens field changes.

`refreshStatusAlarms()` updates alarm highlights and calls `refreshPhaseHighlight()`. It is called from `saveStatusField()` on every status field change — **do not call `renderForm()` from within it**.

## Alarm system

Alarms are thresholds stored in `alarmsettings.settings` (loaded into `alarmSettings` object). Each field has an `is*Overdue` function in app.js and a matching entry in `FIELD_ALARM_CHECKS`. The kanban card shows an SVG warning triangle badge when `countAlarms(row) > 0`. In info.html, `ALARM_CHECKS` (a parallel object) drives row-level `.alarm` CSS class toggling.

## Card layout (app.js)

Cards are built in `renderCard(row, col)`:
1. `.card-top-area` — tinted with `col.color + '18'` (9% opacity), contains the colored top border, name (split on ` - ` into two lines), and alarm badge.
2. `.card-body` — field rows padded to `MAX_FIELDS = 4`, then `.card-opm` (Opmerkingen preview).
3. `.flag-stripe` — absolutely positioned left edge, orange when `row.flagged`.

## Kanban column placement

`getColumn(row)`: for Rechtbank=Nee rows ignores stored `kanban_column`; for others uses stored column or falls back to `getInitialColumn`. Cards can be manually dragged; drag updates `kanban_column` in DB.

## Conventions

- Dates stored as ISO strings or `'n.v.t.'`. `hasValue(v)` returns true only if truthy and not `'n.v.t.'`.
- `klant` field format: `"Partner 1 - Partner 2"`. Split on `' - '` for display.
- Alarm settings keys: `reactie_docs_teurlings`, `reactie_klanten_concepten`, `reactie_teurlings_concepten`, `reactie_beschikking`, `reactie_akkoord_beschikking`, `reactie_inschrijving_gemeente`, `reactie_vergoeding_rvr`.
- `akkoord_klanter` (with typo, no 's') is the DB column for "Akkoord klanten beschikking" — distinct from `akkoord_klanten` (signed concepts).
- Search state is persisted in `sessionStorage` key `'kanbanSearch'` so back-navigation restores it.
- Fonts: **Fraunces** (serif, headings/titles) and **DM Mono** (monospace, data/labels).

## Git / deployment

- Remote: `https://github.com/alenders-prog/statusoverzicht-v2.git`, branch `main`.
- **Never push automatically** — only when the user explicitly asks.
- GitHub Pages serves the repo root. After push, allow ~30 seconds for changes to go live. If the user reports a change "not showing", suspect caching or a missing push before debugging code.
