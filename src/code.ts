// Learning Canvas Importer — FigJam plugin (spike)
//
// Reads JSON (from a Co-pilot agent or the bundled sample) and lays out a
// "Learning Canvas": a fixed grid of FigJam Sections, each holding sticky notes.
// Nested sub-groups (e.g. Customers / Business) become real nested Sections.

// ----------------------------------------------------------------------------
// Types — the JSON contract between the agent and this plugin.
// ----------------------------------------------------------------------------

// A single sticky. The agent may send a bare string (auto-wrapped) or an object.
// Only `text` is required; the rest are optional metadata shown under the text.
// `url` makes the sticky a clickable link (used by Sources).
type Item = string | { text: string; source?: string; owner?: string; confidence?: string; url?: string };

// A flexible extra section the agent can append beyond the fixed canvas.
interface ExtraSection {
  title?: string;
  items?: Item[];
  children?: { title?: string; items?: Item[] }[];
}

// One source/reference: a named (optionally dated, optionally linked) origin,
// with the data points pulled from it listed underneath.
interface SourceEntry {
  name: string;
  date?: string;
  url?: string;
  items?: Item[];
}

// The whole payload. Fixed keys below are all optional — missing = empty section.
interface CanvasData {
  projectSnapshot?: Item[];
  problems?: { customers?: Item[]; business?: Item[] };
  opportunities?: { customers?: Item[]; business?: Item[] };
  successMetrics?: Item[];
  requirements?: Item[];
  users?: Item[];
  hypotheses?: Item[];
  solutions?: { currentState?: Item[]; competitorAnalysis?: Item[] };
  insights?: { dataFeedback?: Item[]; research?: Item[] };
  constraints?: { risks?: Item[]; assumptions?: Item[]; issues?: Item[]; dependencies?: Item[] };
  collaborations?: { overlaps?: Item[]; partnerships?: Item[]; forums?: Item[] };
  useCases?: Item[];
  okrs?: Item[];
  sources?: SourceEntry[];
  extra?: ExtraSection[];
  [key: string]: unknown; // tolerate unknown keys without crashing
}

// ----------------------------------------------------------------------------
// Template — fixed canvas structure, in the deliberate order of the sketch.
// `colorKey` drives the section colour. `children` makes it a nested section.
// ----------------------------------------------------------------------------

interface ChildDef { key: string; title: string; _items?: Item[] }
interface SectionDef { key: string; title: string; colorKey: string; children?: ChildDef[]; _items?: Item[] }

const TEMPLATE: SectionDef[] = [
  { key: "projectSnapshot", title: "Project Snapshot", colorKey: "slate" },
  { key: "problems", title: "Problems / Challenges", colorKey: "red", children: [
    { key: "customers", title: "Customers" },
    { key: "business", title: "Business" },
  ] },
  { key: "opportunities", title: "Opportunities & Value", colorKey: "green", children: [
    { key: "customers", title: "Customers" },
    { key: "business", title: "Business" },
  ] },
  { key: "successMetrics", title: "Success Metrics / Outcomes", colorKey: "teal" },
  { key: "requirements", title: "High-Level Requirements", colorKey: "violet" },
  { key: "users", title: "Users / Customers", colorKey: "orange" },
  { key: "hypotheses", title: "Hypotheses", colorKey: "amber" },
  { key: "solutions", title: "Solutions Today", colorKey: "blue", children: [
    { key: "currentState", title: "Current State" },
    { key: "competitorAnalysis", title: "Competitor & Comparator Analysis" },
  ] },
  { key: "insights", title: "Insights", colorKey: "cyan", children: [
    { key: "dataFeedback", title: "Data, Analytics, Complaints, Feedback" },
    { key: "research", title: "Research (UX etc.)" },
  ] },
  { key: "constraints", title: "Project Constraints", colorKey: "rose", children: [
    { key: "risks", title: "Risks" },
    { key: "assumptions", title: "Assumptions" },
    { key: "issues", title: "Issues" },
    { key: "dependencies", title: "Dependencies" },
  ] },
  { key: "collaborations", title: "Collaborations", colorKey: "emerald", children: [
    { key: "overlaps", title: "Overlaps" },
    { key: "partnerships", title: "Partnerships" },
    { key: "forums", title: "Forums" },
  ] },
  { key: "useCases", title: "Potential Use Cases", colorKey: "indigo" },
  { key: "okrs", title: "Crew OKRs", colorKey: "fuchsia" },
];

// ----------------------------------------------------------------------------
// Colour palette. Sticky fill = the colour; section background = a light tint.
// ----------------------------------------------------------------------------

type Color = { r: number; g: number; b: number };

function hex(h: string): Color {
  const n = parseInt(h.slice(1), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}
// Mix a colour toward white. amt=0 → original, amt=1 → white. Used for section bg.
function lighten(c: Color, amt: number): Color {
  return { r: c.r + (1 - c.r) * amt, g: c.g + (1 - c.g) * amt, b: c.b + (1 - c.b) * amt };
}

const PALETTE: Record<string, Color> = {
  slate: hex("#64748b"), red: hex("#ef4444"), green: hex("#22c55e"), teal: hex("#14b8a6"),
  violet: hex("#8b5cf6"), orange: hex("#f97316"), amber: hex("#f59e0b"), blue: hex("#3b82f6"),
  cyan: hex("#06b6d4"), rose: hex("#f43f5e"), emerald: hex("#10b981"), indigo: hex("#6366f1"),
  fuchsia: hex("#d946ef"), extra: hex("#94a3b8"),
};
const EMPTY_FILL = hex("#e2e8f0"); // faint grey for "No data yet" placeholders
const LINK_FILL = hex("#bfdbfe"); // light blue for clickable source-link stickies

// ----------------------------------------------------------------------------
// Layout constants (px). Tune here.
// ----------------------------------------------------------------------------

const PAD = 24;          // inner padding inside a section
const GAP = 28;          // gap between sub-sections inside a parent
const GAP_TOP = 56;      // gap between top-level sections
const GAP_S = 16;        // gap between stickies
const HEADER = 72;       // top band in a PARENT section, below its label, before sub-sections
const SUBHEADER = 52;    // top band in a leaf/sub section, below its label, before stickies
const MIN_SECTION_W = 380; // floor on top-section width so titles don't truncate
const PER_COL = 5;       // stickies per column before wrapping to a new column
const MAX_ROW_W = 5400;  // board wraps top sections to a new row past this width
const FONT: FontName = { family: "Inter", style: "Medium" };
const MAX_CHARS = 280;   // soft cap on sticky text length

let STICKY_W = 240;      // measured from the first real sticky at runtime

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

type NormItem = { text: string; source?: string; owner?: string; confidence?: string; url?: string };

function normItems(val: unknown): NormItem[] {
  if (!Array.isArray(val)) return [];
  return val
    .map((it): NormItem => {
      if (typeof it === "string") return { text: it };
      if (it && typeof it === "object") {
        const o = it as Record<string, unknown>;
        return { text: String(o.text ?? ""), source: o.source as string, owner: o.owner as string, confidence: o.confidence as string, url: o.url as string };
      }
      return { text: "" };
    })
    .filter((x) => x.text.trim().length > 0);
}

function cap(t: string): string {
  return t.length > MAX_CHARS ? t.slice(0, MAX_CHARS - 1) + "…" : t;
}

function stickyText(item: { text: string; source?: string; owner?: string; confidence?: string }): string {
  let t = cap(item.text);
  const meta: string[] = [];
  if (item.owner) meta.push("@" + item.owner);
  if (item.source) meta.push(item.source);
  if (item.confidence) meta.push(item.confidence);
  if (meta.length) t += "\n— " + meta.join(" · ");
  return t;
}

function makeSticky(item: NormItem | null, fill: Color): StickyNode {
  const s = figma.createSticky();
  const empty = item === null;
  const isLink = !empty && !!item!.url;
  s.fills = [{ type: "SOLID", color: empty ? EMPTY_FILL : isLink ? LINK_FILL : fill }];
  s.text.fontName = FONT;
  s.text.characters = empty ? "No data yet" : isLink ? "🔗 " + item!.url : stickyText(item!);
  if (isLink) {
    // Make the whole sticky a clickable link. Sticky text sublayers support
    // hyperlinks; wrap in try/catch so an API change degrades to plain URL text.
    try {
      s.text.setRangeHyperlink(0, s.text.characters.length, { type: "URL", value: item!.url! });
    } catch (e) { /* leave the URL as visible, copyable text */ }
  }
  STICKY_W = s.width; // stickies are a fixed width; capture it once for layout math
  return s;
}

// Place a list of stickies into `container`, top-left at (ox, oy) — coordinates
// RELATIVE to the container, because a Section is a parent (child x/y are
// measured from the section's own origin, not the page).
// Stickies stack vertically, wrapping into a new column every PER_COL items.
// Returns the bounding box so the caller can size the section.
function placeItems(container: SectionNode, raw: unknown, fill: Color, ox: number, oy: number): { width: number; height: number } {
  const items = normItems(raw);
  const list: ({ text: string } | null)[] = items.length ? items : [null]; // null → placeholder
  const cols = Math.ceil(list.length / PER_COL);
  const colY: number[] = [];
  for (let c = 0; c < cols; c++) colY.push(oy);
  let maxBottom = oy;

  for (let i = 0; i < list.length; i++) {
    const c = Math.floor(i / PER_COL);
    const s = makeSticky(list[i], fill);
    container.appendChild(s);            // append first; x/y below are relative to container
    s.x = ox + c * (STICKY_W + GAP_S);
    s.y = colY[c];
    colY[c] += s.height + GAP_S;
    if (colY[c] > maxBottom) maxBottom = colY[c];
  }

  const width = cols * STICKY_W + (cols - 1) * GAP_S;
  const height = maxBottom - oy - GAP_S;
  return { width, height };
}

// Build one top-level section (with its stickies / sub-sections) directly at its
// FINAL position (ox, oy). We build in place and never move sections afterwards:
// setting section.x via the API does NOT carry child stickies along (unlike
// dragging in the UI), so a build-then-move approach strands the stickies.
function buildTopSection(def: SectionDef, data: CanvasData, ox: number, oy: number): SectionNode {
  const fill = PALETTE[def.colorKey] ?? PALETTE.extra;
  const sec = figma.createSection();
  sec.name = def.title;
  sec.fills = [{ type: "SOLID", color: lighten(fill, 0.86) }];
  sec.x = ox; // top section's parent is the page, so ox/oy are absolute here
  sec.y = oy;

  if (def.children) {
    let cx = PAD; // cursor relative to `sec`, not the page
    const top = HEADER; // push sub-sections below the parent's own label band
    let maxH = 0;
    for (const ch of def.children) {
      const sub = figma.createSection();
      sub.name = ch.title;
      sub.fills = [{ type: "SOLID", color: lighten(fill, 0.94) }];
      sec.appendChild(sub);
      sub.x = cx; // relative to `sec`
      sub.y = top;
      const bb = placeItems(sub, childItems(def, ch, data), fill, PAD, SUBHEADER); // relative to `sub`, below its label
      sub.resizeWithoutConstraints(bb.width + 2 * PAD, SUBHEADER + bb.height + PAD);
      cx += sub.width + GAP;
      if (sub.height > maxH) maxH = sub.height;
    }
    sec.resizeWithoutConstraints(Math.max(cx - GAP + PAD, MIN_SECTION_W), HEADER + maxH + PAD);
  } else {
    const bb = placeItems(sec, topItems(def, data), fill, PAD, SUBHEADER); // relative to `sec`, below its label
    sec.resizeWithoutConstraints(Math.max(bb.width + 2 * PAD, MIN_SECTION_W), SUBHEADER + bb.height + PAD);
  }
  return sec;
}

// Analytic width of a section, computed WITHOUT creating nodes. Sticky width is
// fixed, so we can decide row-packing up front, then build each section in place.
function leafInnerWidth(n: number): number {
  const cols = Math.ceil(Math.max(1, n) / PER_COL); // >=1: empty leaves still show a placeholder
  return cols * STICKY_W + (cols - 1) * GAP_S;
}
function sectionWidth(def: SectionDef, data: CanvasData): number {
  if (def.children) {
    let w = PAD;
    for (const ch of def.children) {
      const n = normItems(childItems(def, ch, data)).length;
      w += leafInnerWidth(n) + 2 * PAD + GAP; // each sub-section + its padding + gap
    }
    return Math.max(w - GAP + PAD, MIN_SECTION_W); // drop trailing gap, add right padding
  }
  return Math.max(leafInnerWidth(normItems(topItems(def, data)).length) + 2 * PAD, MIN_SECTION_W);
}

// Item getters — `_items` (from extra sections) wins over the fixed data keys.
function topItems(def: SectionDef, data: CanvasData): unknown {
  return def._items !== undefined ? def._items : data[def.key];
}
function childItems(def: SectionDef, ch: ChildDef, data: CanvasData): unknown {
  if (ch._items !== undefined) return ch._items;
  const parent = data[def.key] as Record<string, unknown> | undefined;
  return parent ? parent[ch.key] : undefined;
}

// Turn agent-supplied extra[] sections into SectionDefs appended after the fixed canvas.
function extraDefs(data: CanvasData): SectionDef[] {
  const extras = Array.isArray(data.extra) ? data.extra : [];
  return extras.map((e, i) => ({
    key: "__extra" + i,
    title: e.title || "Extra " + (i + 1),
    colorKey: "extra",
    _items: e.children ? undefined : e.items,
    children: e.children
      ? e.children.map((c, j) => ({ key: "c" + j, title: c.title || "Group " + (j + 1), _items: c.items || [] }))
      : undefined,
  }));
}

// Turn data.sources[] into a single "Sources" section whose sub-sections are the
// sources — titled "Name · Date", with a clickable link sticky (if a url is given)
// followed by the data points pulled from that source.
function sourcesDefs(data: CanvasData): SectionDef[] {
  const src = Array.isArray(data.sources) ? data.sources : [];
  if (!src.length) return [];
  const children: ChildDef[] = src.map((s, i) => {
    const title = (s.name || "Source " + (i + 1)) + (s.date ? " · " + s.date : "");
    const items: Item[] = [];
    if (s.url) items.push({ text: s.url, url: s.url }); // first sticky = the link
    if (Array.isArray(s.items)) items.push(...s.items);
    return { key: "src" + i, title, _items: items };
  });
  return [{ key: "__sources", title: "Sources", colorKey: "slate", children }];
}

// ----------------------------------------------------------------------------
// Orchestration
// ----------------------------------------------------------------------------

async function buildLearningCanvas(data: CanvasData): Promise<void> {
  await figma.loadFontAsync(FONT); // required before setting any sticky text

  const defs = TEMPLATE.concat(extraDefs(data)).concat(sourcesDefs(data));

  // Pass 1: assign each section to a row by analytic width (sticky width is fixed),
  // wrapping when a row would exceed MAX_ROW_W. Order follows the sketch.
  const rows: SectionDef[][] = [];
  let cur: SectionDef[] = [];
  let curW = 0;
  for (const def of defs) {
    const w = sectionWidth(def, data);
    if (cur.length && curW + w > MAX_ROW_W) { rows.push(cur); cur = []; curW = 0; }
    cur.push(def);
    curW += w + GAP_TOP;
  }
  if (cur.length) rows.push(cur);

  // Pass 2: build each section in place, row by row. Heights are only known after
  // building, so we measure each row's tallest section before stepping y down.
  const sections: SectionNode[] = [];
  let y = 0;
  for (const row of rows) {
    let x = 0;
    let rowH = 0;
    for (const def of row) {
      const sec = buildTopSection(def, data, x, y);
      sections.push(sec);
      x += sec.width + GAP_TOP;
      if (sec.height > rowH) rowH = sec.height;
    }
    y += rowH + GAP_TOP;
  }

  figma.currentPage.selection = sections;
  figma.viewport.scrollAndZoomIntoView(sections);
}

// ----------------------------------------------------------------------------
// Plugin entry
// ----------------------------------------------------------------------------

if (figma.editorType !== "figjam") {
  figma.notify("Learning Canvas Importer runs in FigJam only.");
  figma.closePlugin();
} else {
  figma.showUI(__html__, { width: 400, height: 560, title: "Learning Canvas Importer" });

  figma.ui.onmessage = async (msg: { type: string; json?: string }) => {
    if (msg.type === "generate") {
      let data: CanvasData;
      try {
        data = JSON.parse(msg.json || "");
      } catch (e) {
        figma.notify("Invalid JSON: " + (e as Error).message);
        figma.ui.postMessage({ type: "error", message: (e as Error).message });
        return;
      }
      try {
        await buildLearningCanvas(data);
        figma.notify("Learning Canvas created ✓");
        figma.ui.postMessage({ type: "done" });
      } catch (e) {
        figma.notify("Build failed: " + (e as Error).message);
        figma.ui.postMessage({ type: "error", message: (e as Error).message });
      }
    } else if (msg.type === "cancel") {
      figma.closePlugin();
    }
  };
}
