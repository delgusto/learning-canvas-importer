"use strict";
(() => {
  // src/code.ts
  var TEMPLATE = [
    { key: "projectSnapshot", title: "Project Snapshot", colorKey: "slate" },
    { key: "problems", title: "Problems / Challenges", colorKey: "red", children: [
      { key: "customers", title: "Customers" },
      { key: "business", title: "Business" }
    ] },
    { key: "opportunities", title: "Opportunities & Value", colorKey: "green", children: [
      { key: "customers", title: "Customers" },
      { key: "business", title: "Business" }
    ] },
    { key: "successMetrics", title: "Success Metrics / Outcomes", colorKey: "teal" },
    { key: "requirements", title: "High-Level Requirements", colorKey: "violet" },
    { key: "users", title: "Users / Customers", colorKey: "orange" },
    { key: "hypotheses", title: "Hypotheses", colorKey: "amber" },
    { key: "solutions", title: "Solutions Today", colorKey: "blue", children: [
      { key: "currentState", title: "Current State" },
      { key: "competitorAnalysis", title: "Competitor & Comparator Analysis" }
    ] },
    { key: "insights", title: "Insights", colorKey: "cyan", children: [
      { key: "dataFeedback", title: "Data, Analytics, Complaints, Feedback" },
      { key: "research", title: "Research (UX etc.)" }
    ] },
    { key: "constraints", title: "Project Constraints", colorKey: "rose", children: [
      { key: "risks", title: "Risks" },
      { key: "assumptions", title: "Assumptions" },
      { key: "issues", title: "Issues" },
      { key: "dependencies", title: "Dependencies" }
    ] },
    { key: "collaborations", title: "Collaborations", colorKey: "emerald", children: [
      { key: "overlaps", title: "Overlaps" },
      { key: "partnerships", title: "Partnerships" },
      { key: "forums", title: "Forums" }
    ] },
    { key: "useCases", title: "Potential Use Cases", colorKey: "indigo" },
    { key: "okrs", title: "Crew OKRs", colorKey: "fuchsia" }
  ];
  function hex(h) {
    const n = parseInt(h.slice(1), 16);
    return { r: (n >> 16 & 255) / 255, g: (n >> 8 & 255) / 255, b: (n & 255) / 255 };
  }
  function lighten(c, amt) {
    return { r: c.r + (1 - c.r) * amt, g: c.g + (1 - c.g) * amt, b: c.b + (1 - c.b) * amt };
  }
  var PALETTE = {
    slate: hex("#64748b"),
    red: hex("#ef4444"),
    green: hex("#22c55e"),
    teal: hex("#14b8a6"),
    violet: hex("#8b5cf6"),
    orange: hex("#f97316"),
    amber: hex("#f59e0b"),
    blue: hex("#3b82f6"),
    cyan: hex("#06b6d4"),
    rose: hex("#f43f5e"),
    emerald: hex("#10b981"),
    indigo: hex("#6366f1"),
    fuchsia: hex("#d946ef"),
    extra: hex("#94a3b8")
  };
  var EMPTY_FILL = hex("#e2e8f0");
  var LINK_FILL = hex("#bfdbfe");
  var PAD = 24;
  var GAP = 28;
  var GAP_TOP = 56;
  var GAP_S = 16;
  var HEADER = 72;
  var SUBHEADER = 52;
  var MIN_SECTION_W = 380;
  var PER_COL = 5;
  var MAX_ROW_W = 5400;
  var SOURCES_W = 520;
  var FONT = { family: "Inter", style: "Medium" };
  var BOLD_FONT = { family: "Inter", style: "Bold" };
  var MAX_CHARS = 280;
  var STICKY_W = 240;
  function normItems(val) {
    if (!Array.isArray(val)) return [];
    return val.map((it) => {
      var _a;
      if (typeof it === "string") return { text: it };
      if (it && typeof it === "object") {
        const o = it;
        return { text: String((_a = o.text) != null ? _a : ""), source: o.source, owner: o.owner, confidence: o.confidence, url: o.url };
      }
      return { text: "" };
    }).filter((x) => x.text.trim().length > 0);
  }
  function cap(t) {
    return t.length > MAX_CHARS ? t.slice(0, MAX_CHARS - 1) + "\u2026" : t;
  }
  function stickyText(item) {
    let t = cap(item.text);
    const meta = [];
    if (item.owner) meta.push("@" + item.owner);
    if (item.source) meta.push(item.source);
    if (item.confidence) meta.push(item.confidence);
    if (meta.length) t += "\n\u2014 " + meta.join(" \xB7 ");
    return t;
  }
  function makeSticky(item, fill) {
    const s = figma.createSticky();
    const empty = item === null;
    const isLink = !empty && !!item.url;
    s.fills = [{ type: "SOLID", color: empty ? EMPTY_FILL : isLink ? LINK_FILL : fill }];
    s.text.fontName = FONT;
    s.text.characters = empty ? "No data yet" : isLink ? "\u{1F517} " + item.url : stickyText(item);
    if (isLink) {
      try {
        s.text.setRangeHyperlink(0, s.text.characters.length, { type: "URL", value: item.url });
      } catch (e) {
      }
    }
    STICKY_W = s.width;
    return s;
  }
  function placeItems(container, raw, fill, ox, oy) {
    const items = normItems(raw);
    const list = items.length ? items : [null];
    const cols = Math.ceil(list.length / PER_COL);
    const colY = [];
    for (let c = 0; c < cols; c++) colY.push(oy);
    let maxBottom = oy;
    for (let i = 0; i < list.length; i++) {
      const c = Math.floor(i / PER_COL);
      const s = makeSticky(list[i], fill);
      container.appendChild(s);
      s.x = ox + c * (STICKY_W + GAP_S);
      s.y = colY[c];
      colY[c] += s.height + GAP_S;
      if (colY[c] > maxBottom) maxBottom = colY[c];
    }
    const width = cols * STICKY_W + (cols - 1) * GAP_S;
    const height = maxBottom - oy - GAP_S;
    return { width, height };
  }
  function buildTopSection(def, data, ox, oy) {
    var _a;
    if (def.sources) return buildSourcesSection(def, ox, oy);
    const fill = (_a = PALETTE[def.colorKey]) != null ? _a : PALETTE.extra;
    const sec = figma.createSection();
    sec.name = def.title;
    sec.fills = [{ type: "SOLID", color: lighten(fill, 0.86) }];
    sec.x = ox;
    sec.y = oy;
    if (def.children) {
      let cx = PAD;
      const top = HEADER;
      let maxH = 0;
      for (const ch of def.children) {
        const sub = figma.createSection();
        sub.name = ch.title;
        sub.fills = [{ type: "SOLID", color: lighten(fill, 0.94) }];
        sec.appendChild(sub);
        sub.x = cx;
        sub.y = top;
        const bb = placeItems(sub, childItems(def, ch, data), fill, PAD, SUBHEADER);
        sub.resizeWithoutConstraints(bb.width + 2 * PAD, SUBHEADER + bb.height + PAD);
        cx += sub.width + GAP;
        if (sub.height > maxH) maxH = sub.height;
      }
      sec.resizeWithoutConstraints(Math.max(cx - GAP + PAD, MIN_SECTION_W), HEADER + maxH + PAD);
    } else {
      const bb = placeItems(sec, topItems(def, data), fill, PAD, SUBHEADER);
      sec.resizeWithoutConstraints(Math.max(bb.width + 2 * PAD, MIN_SECTION_W), SUBHEADER + bb.height + PAD);
    }
    return sec;
  }
  function leafInnerWidth(n) {
    const cols = Math.ceil(Math.max(1, n) / PER_COL);
    return cols * STICKY_W + (cols - 1) * GAP_S;
  }
  function sectionWidth(def, data) {
    if (def.sources) return SOURCES_W;
    if (def.children) {
      let w = PAD;
      for (const ch of def.children) {
        const n = normItems(childItems(def, ch, data)).length;
        w += leafInnerWidth(n) + 2 * PAD + GAP;
      }
      return Math.max(w - GAP + PAD, MIN_SECTION_W);
    }
    return Math.max(leafInnerWidth(normItems(topItems(def, data)).length) + 2 * PAD, MIN_SECTION_W);
  }
  function topItems(def, data) {
    return def._items !== void 0 ? def._items : data[def.key];
  }
  function childItems(def, ch, data) {
    if (ch._items !== void 0) return ch._items;
    const parent = data[def.key];
    return parent ? parent[ch.key] : void 0;
  }
  function extraDefs(data) {
    const extras = Array.isArray(data.extra) ? data.extra : [];
    return extras.map((e, i) => ({
      key: "__extra" + i,
      title: e.title || "Extra " + (i + 1),
      colorKey: "extra",
      _items: e.children ? void 0 : e.items,
      children: e.children ? e.children.map((c, j) => ({ key: "c" + j, title: c.title || "Group " + (j + 1), _items: c.items || [] })) : void 0
    }));
  }
  function sourcesDefs(data) {
    const src = (Array.isArray(data.sources) ? data.sources : []).filter((s) => s && s.name);
    if (!src.length) return [];
    return [{ key: "__sources", title: "Sources", colorKey: "slate", sources: src }];
  }
  function buildSourcesSection(def, ox, oy) {
    const sec = figma.createSection();
    sec.name = def.title;
    sec.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    sec.x = ox;
    sec.y = oy;
    const tx = figma.createText();
    tx.fontName = FONT;
    tx.fontSize = 15;
    tx.lineHeight = { value: 150, unit: "PERCENT" };
    sec.appendChild(tx);
    tx.x = PAD;
    tx.y = SUBHEADER;
    tx.resize(SOURCES_W - 2 * PAD, 10);
    tx.textAutoResize = "HEIGHT";
    const ranges = [];
    let body = "";
    (def.sources || []).forEach((s, i) => {
      if (i > 0) body += "\n\n";
      const titleStart = body.length;
      body += (s.name || "Source " + (i + 1)) + (s.date ? " \xB7 " + s.date : "");
      ranges.push({ start: titleStart, end: body.length, kind: "title" });
      if (s.url) {
        body += "\n" + s.url;
        ranges.push({ start: body.length - s.url.length, end: body.length, kind: "link" });
      }
      const items = normItems(s.items);
      for (const it of items) body += "\n\u2022  " + it.text;
      if (!s.url && !items.length) body += "\n(no details captured)";
    });
    tx.characters = body;
    for (const r of ranges) {
      if (r.kind === "title") {
        tx.setRangeFontName(r.start, r.end, BOLD_FONT);
        tx.setRangeFontSize(r.start, r.end, 18);
      } else {
        tx.setRangeFills(r.start, r.end, [{ type: "SOLID", color: hex("#2563eb") }]);
        try {
          tx.setRangeHyperlink(r.start, r.end, { type: "URL", value: tx.characters.slice(r.start, r.end) });
        } catch (e) {
        }
      }
    }
    sec.resizeWithoutConstraints(SOURCES_W, SUBHEADER + tx.height + PAD);
    return sec;
  }
  async function buildLearningCanvas(data) {
    await figma.loadFontAsync(FONT);
    await figma.loadFontAsync(BOLD_FONT);
    const defs = TEMPLATE.concat(extraDefs(data)).concat(sourcesDefs(data));
    const rows = [];
    let cur = [];
    let curW = 0;
    for (const def of defs) {
      const w = sectionWidth(def, data);
      if (cur.length && curW + w > MAX_ROW_W) {
        rows.push(cur);
        cur = [];
        curW = 0;
      }
      cur.push(def);
      curW += w + GAP_TOP;
    }
    if (cur.length) rows.push(cur);
    const sections = [];
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
  if (figma.editorType !== "figjam") {
    figma.notify("Learning Canvas Importer runs in FigJam only.");
    figma.closePlugin();
  } else {
    figma.showUI(__html__, { width: 400, height: 560, title: "Learning Canvas Importer" });
    figma.ui.onmessage = async (msg) => {
      if (msg.type === "generate") {
        let data;
        try {
          data = JSON.parse(msg.json || "");
        } catch (e) {
          figma.notify("Invalid JSON: " + e.message);
          figma.ui.postMessage({ type: "error", message: e.message });
          return;
        }
        try {
          await buildLearningCanvas(data);
          figma.notify("Learning Canvas created \u2713");
          figma.ui.postMessage({ type: "done" });
        } catch (e) {
          figma.notify("Build failed: " + e.message);
          figma.ui.postMessage({ type: "error", message: e.message });
        }
      } else if (msg.type === "cancel") {
        figma.closePlugin();
      }
    };
  }
})();
