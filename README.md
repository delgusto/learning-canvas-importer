# Learning Canvas Importer (FigJam plugin — spike)

Imports JSON (from a Co-pilot agent, a file, or the bundled sample) and lays out a
**Learning Canvas**: a grid of FigJam Sections filled with sticky notes. Sub-groups
(Customers / Business, Risks / Assumptions / …) become real nested Sections.

## Run it

1. `npm install`
2. `npm run build` (or `npm run watch` while editing) — compiles `src/code.ts` → `dist/code.js`
3. In **FigJam**: menu → Plugins → Development → **Import plugin from manifest…** → pick `manifest.json`
4. Run the plugin → **Load sample** → **Generate canvas**

## How it works

- **JSON contract** — fixed keys (`problems`, `opportunities`, …) plus an optional
  `extra[]` array for agent-added sections. Each item is a string **or**
  `{ text, source?, owner?, confidence? }`. Metadata renders under the text.
- **Layout** — sections flow-pack into rows in the sketch's order; `extra[]` lands at the end.
- **Colour** — one colour per section; section background is a light tint of it.
- **Empty sections** — always rendered, with a faint "No data yet" placeholder.
- **Long text** — soft-capped at ~280 chars.

See `sample.json` for the full shape. This is the contract to hand your Co-pilot agent.

## Tuning

Layout constants live at the top of `src/code.ts` (`PAD`, `GAP`, `PER_COL`,
`MAX_ROW_W`, `MAX_CHARS`). Colours in `PALETTE`. Structure in `TEMPLATE`.
