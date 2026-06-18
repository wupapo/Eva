/* Eva — Tech Architecture deck generator (pptxgenjs) */
const path = require("path");
const GROOT = "/Users/user1/.npm-global/lib/node_modules";
const pptxgen = require(path.join(GROOT, "pptxgenjs"));
const React = require(path.join(GROOT, "react"));
const ReactDOMServer = require(path.join(GROOT, "react-dom/server"));
const sharp = require(path.join(GROOT, "sharp"));
const FA = require(path.join(GROOT, "react-icons/fa"));

// ---------- palette ----------
const C = {
  bg:       "0E1521",   // deep navy (dominant)
  bg2:      "0B111B",
  panel:    "18222F",   // card
  panel2:   "1E2A3A",   // card alt
  border:   "2C3A4E",
  teal:     "2DD4BF",   // primary accent
  tealDeep: "12A594",
  amber:    "F5A623",   // sharp accent
  amberSoft:"FBBF24",
  white:    "F1F5F9",
  mute:     "93A3B8",
  faint:    "5C6B80",
  red:      "F87171",
  green:    "34D399",
};

const FH = "Georgia";     // header font (personality)
const FB = "Calibri";     // body font

// ---------- icon rasterizer ----------
async function icon(IconComponent, color = "#2DD4BF", size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color, size: String(size) })
  );
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + png.toString("base64");
}
const hx = (c) => "#" + c; // react-icons wants leading #

const pres = new pptxgen();
pres.defineLayout({ name: "W", width: 13.333, height: 7.5 });
pres.layout = "W";
pres.author = "Eva";
pres.title = "Eva — Tech Architecture";
const W = 13.333, H = 7.5;

const shadow = () => ({ type: "outer", color: "000000", blur: 9, offset: 3, angle: 90, opacity: 0.35 });

// ---------- reusable pieces ----------
function bgFill(slide, color = C.bg) { slide.background = { color }; }

// faint dotted/section motif: a thin teal tab on the left of section headers (NOT under title)
function header(slide, kicker, title, num) {
  // top kicker
  slide.addText(kicker.toUpperCase(), {
    x: 0.7, y: 0.42, w: 9, h: 0.3, fontFace: FB, fontSize: 12, bold: true,
    color: C.teal, charSpacing: 3, align: "left", margin: 0,
  });
  slide.addText(title, {
    x: 0.7, y: 0.72, w: 11.2, h: 0.85, fontFace: FH, fontSize: 32, bold: true,
    color: C.white, align: "left", margin: 0,
  });
  // slide number chip top-right
  slide.addText(String(num).padStart(2, "0"), {
    x: 12.1, y: 0.42, w: 0.9, h: 0.5, fontFace: FB, fontSize: 14, bold: true,
    color: C.faint, align: "right", margin: 0,
  });
}

function footer(slide, label) {
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.7, y: 7.06, w: 0.28, h: 0.05, fill: { color: C.amber } });
  slide.addText(label, { x: 1.05, y: 6.86, w: 8, h: 0.35, fontFace: FB, fontSize: 9.5, color: C.faint, margin: 0 });
  slide.addText("Eva · fully offline AI journaling companion", {
    x: 7.3, y: 6.86, w: 5.3, h: 0.35, fontFace: FB, fontSize: 9.5, color: C.faint, align: "right", margin: 0,
  });
}

function card(slide, x, y, w, h, fill = C.panel) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, rectRadius: 0.08, fill: { color: fill },
    line: { color: C.border, width: 1 }, shadow: shadow(),
  });
}

// icon inside a colored circle
function iconCircle(slide, data, x, y, d, circleColor) {
  slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: circleColor } });
  const pad = d * 0.26;
  slide.addImage({ data, x: x + pad, y: y + pad, w: d - pad * 2, h: d - pad * 2 });
}

async function build() {
  const I = {}; // preloaded icons
  const set = {
    rocket: FA.FaRocket, lock: FA.FaLock, shield: FA.FaShieldAlt, layer: FA.FaLayerGroup,
    react: FA.FaReact, rust: FA.FaCogs, server: FA.FaServer, brain: FA.FaBrain,
    db: FA.FaDatabase, mic: FA.FaMicrophone, volume: FA.FaVolumeUp, file: FA.FaFileAlt,
    plug: FA.FaPlug, route: FA.FaProjectDiagram, micro: FA.FaMicrochip, mem: FA.FaMemory,
    book: FA.FaBookOpen, check: FA.FaCheckCircle, ban: FA.FaBan, bolt: FA.FaBolt,
    sitemap: FA.FaSitemap, code: FA.FaCode, heart: FA.FaHeartbeat, search: FA.FaSearch,
    upload: FA.FaUpload, cubes: FA.FaCubes, wifi: FA.FaWifi, gauge: FA.FaTachometerAlt,
    arrow: FA.FaArrowRight, apple: FA.FaApple, comments: FA.FaComments, chart: FA.FaChartLine,
    user: FA.FaUserCircle, exchange: FA.FaExchangeAlt,
  };
  for (const k of Object.keys(set)) I[k] = await icon(set[k], hx(C.teal));
  // amber + white variants for some
  const Iw = {}, Ia = {};
  for (const k of Object.keys(set)) { Iw[k] = await icon(set[k], hx(C.bg)); Ia[k] = await icon(set[k], hx(C.amber)); }

  // =========================================================
  // SLIDE 1 — TITLE
  // =========================================================
  let s = pres.addSlide(); bgFill(s, C.bg2);
  // ambient panel
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: 0.12, fill: { color: C.teal } });
  s.addShape(pres.shapes.OVAL, { x: 9.6, y: -2.2, w: 6.2, h: 6.2, fill: { color: C.panel }, line: { color: C.border, width: 1 } });
  s.addShape(pres.shapes.OVAL, { x: 10.7, y: -1.0, w: 4.0, h: 4.0, fill: { color: C.panel2 } });
  iconCircle(s, Iw.lock, 11.7, 1.5, 1.4, C.teal);

  s.addText("TECHNICAL ARCHITECTURE", {
    x: 0.9, y: 1.85, w: 8, h: 0.4, fontFace: FB, fontSize: 15, bold: true, color: C.teal, charSpacing: 4, margin: 0,
  });
  s.addText("Eva", {
    x: 0.85, y: 2.25, w: 8, h: 1.5, fontFace: FH, fontSize: 96, bold: true, color: C.white, margin: 0,
  });
  s.addText("A fully offline desktop AI journaling companion.", {
    x: 0.9, y: 3.75, w: 9, h: 0.6, fontFace: FB, fontSize: 22, color: C.mute, margin: 0,
  });
  // chips
  const chips = ["Apple Silicon · M1 Air", "8 GB RAM budget", "Metal GPU offload", "Zero telemetry · English only"];
  let cx = 0.9;
  for (const t of chips) {
    const cw = 0.22 + t.length * 0.105;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx, y: 4.7, w: cw, h: 0.5, rectRadius: 0.25, fill: { color: C.panel }, line: { color: C.border, width: 1 } });
    s.addText(t, { x: cx, y: 4.7, w: cw, h: 0.5, fontFace: FB, fontSize: 12, color: C.white, align: "center", valign: "middle", margin: 0 });
    cx += cw + 0.25;
  }
  s.addText("Tauri (Rust)  ·  React + Vite  ·  Python FastAPI  ·  llama.cpp  ·  SQLite  ·  ChromaDB  ·  Markdown vault", {
    x: 0.9, y: 6.4, w: 11.5, h: 0.4, fontFace: FB, fontSize: 12.5, italic: true, color: C.faint, margin: 0,
  });

  // =========================================================
  // SLIDE 2 — SYSTEM OVERVIEW
  // =========================================================
  s = pres.addSlide(); bgFill(s);
  header(s, "Section 01", "System Overview — four cooperating processes", 2);
  const layers = [
    { ic: I.apple, t: "Tauri Shell (Rust)", d: "Native macOS window · packaging · entitlements" },
    { ic: I.react, t: "React + Vite Frontend", d: "Feature screens · token-based design system" },
    { ic: I.server, t: "Python FastAPI Backend", d: "Orchestration brain · ~28 endpoints" },
    { ic: I.brain, t: "llama-server (llama.cpp)", d: "Native LLM binary · port 11500 · Metal GPU" },
  ];
  let ly = 1.85;
  layers.forEach((L, i) => {
    card(s, 0.7, ly, 8.0, 1.05, i % 2 ? C.panel2 : C.panel);
    iconCircle(s, L.ic, 0.95, ly + 0.225, 0.6, C.bg2);
    s.addText(L.t, { x: 1.75, y: ly + 0.18, w: 6.6, h: 0.4, fontFace: FB, fontSize: 17, bold: true, color: C.white, margin: 0 });
    s.addText(L.d, { x: 1.75, y: ly + 0.58, w: 6.6, h: 0.35, fontFace: FB, fontSize: 12.5, color: C.mute, margin: 0 });
    if (i < layers.length - 1) {
      s.addImage({ data: I.exchange, x: 8.78, y: ly + 0.78, w: 0.34, h: 0.34, rotate: 90 });
    }
    ly += 1.25;
  });
  // datastores column
  s.addText("DERIVED DATA STORES", { x: 9.55, y: 1.85, w: 3.3, h: 0.3, fontFace: FB, fontSize: 11, bold: true, color: C.amber, charSpacing: 2, margin: 0 });
  const stores = [["Markdown Vault", "source of truth"], ["SQLite", "structured facts"], ["ChromaDB", "vector retrieval"]];
  let dy = 2.3;
  stores.forEach(([t, d]) => {
    card(s, 9.55, dy, 3.25, 1.05, C.panel2);
    iconCircle(s, t === "Markdown Vault" ? Ia.file : Ia.db, 9.8, dy + 0.225, 0.6, C.bg2);
    s.addText(t, { x: 10.6, y: dy + 0.2, w: 2.1, h: 0.4, fontFace: FB, fontSize: 15, bold: true, color: C.white, margin: 0 });
    s.addText(d, { x: 10.6, y: dy + 0.58, w: 2.1, h: 0.35, fontFace: FB, fontSize: 11.5, color: C.mute, margin: 0 });
    dy += 1.25;
  });
  footer(s, "Everything runs inside a single laptop — no cloud, no remote services");

  // =========================================================
  // SLIDE 3 — PRIVACY ARCHITECTURE
  // =========================================================
  s = pres.addSlide(); bgFill(s);
  header(s, "Section 02", "Privacy Architecture — enforced in code, not policy", 3);
  // left: the funnel of libraries
  s.addText("EVERY NETWORKING LIBRARY", { x: 0.7, y: 2.0, w: 3.6, h: 0.3, fontFace: FB, fontSize: 11, bold: true, color: C.mute, charSpacing: 2, margin: 0 });
  const libs = ["requests", "httpx", "urllib", "aiohttp", "chromadb", "huggingface_hub"];
  let liy = 2.45;
  libs.forEach((t) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.7, y: liy, w: 3.0, h: 0.5, rectRadius: 0.06, fill: { color: C.panel }, line: { color: C.border, width: 1 } });
    s.addText(t, { x: 0.7, y: liy, w: 3.0, h: 0.5, fontFace: "Consolas", fontSize: 13, color: C.white, align: "center", valign: "middle", margin: 0 });
    liy += 0.62;
  });
  // arrows to gate
  s.addImage({ data: I.arrow, x: 3.95, y: 4.0, w: 0.7, h: 0.7 });
  // center: the gate (socket.connect)
  card(s, 4.85, 2.7, 3.3, 2.4, C.panel2);
  iconCircle(s, I.shield, 5.9, 2.95, 1.2, C.bg2);
  s.addText("socket.connect", { x: 4.95, y: 4.2, w: 3.1, h: 0.4, fontFace: "Consolas", fontSize: 16, bold: true, color: C.teal, align: "center", margin: 0 });
  s.addText("the single guarded choke-point", { x: 4.95, y: 4.6, w: 3.1, h: 0.35, fontFace: FB, fontSize: 12, color: C.mute, align: "center", margin: 0 });
  // blocked outbound
  s.addImage({ data: Iw.ban ? await icon(FA.FaBan, hx(C.red)) : I.ban, x: 8.45, y: 3.05, w: 0.6, h: 0.6 });
  s.addText("Outbound  blocked", { x: 9.1, y: 3.05, w: 3.6, h: 0.6, fontFace: FB, fontSize: 16, bold: true, color: C.red, valign: "middle", margin: 0 });
  s.addImage({ data: await icon(FA.FaWifi, hx(C.green)), x: 8.45, y: 3.95, w: 0.6, h: 0.6 });
  s.addText([{ text: "One allowed arrow:\n", options: { bold: true, color: C.green } }, { text: "first-run model download", options: { color: C.mute } }], { x: 9.1, y: 3.85, w: 3.7, h: 0.8, fontFace: FB, fontSize: 13, valign: "middle", margin: 0 });
  // bottom strip
  card(s, 4.85, 5.4, 7.95, 1.25, C.panel);
  s.addImage({ data: await icon(FA.FaCheckCircle, hx(C.green)), x: 5.1, y: 5.62, w: 0.55, h: 0.55 });
  s.addText([
    { text: "“Offline ✓” badge is truthful — ", options: { bold: true, color: C.white } },
    { text: "the block sits beneath it. ", options: { color: C.mute } },
    { text: "Audited via ", options: { color: C.mute } },
    { text: "/privacy/audit", options: { fontFace: "Consolas", color: C.teal } },
  ], { x: 5.8, y: 5.5, w: 6.9, h: 1.05, fontFace: FB, fontSize: 14, valign: "middle", margin: 0 });
  footer(s, "net_guard.py monkeypatches the socket layer at startup — catches libraries not yet imported");

  // =========================================================
  // SLIDE 4 — FRONTEND LAYER
  // =========================================================
  s = pres.addSlide(); bgFill(s);
  header(s, "Section 03", "Frontend Layer — React + Vite", 4);
  // left: design tokens hub
  card(s, 0.7, 2.0, 3.7, 4.6, C.panel2);
  iconCircle(s, Ia.cubes, 1.05, 2.35, 0.9, C.bg2);
  s.addText("Design System", { x: 2.1, y: 2.45, w: 2.2, h: 0.4, fontFace: FB, fontSize: 18, bold: true, color: C.white, margin: 0 });
  s.addText("token-based · dark mode · calm motion", { x: 1.05, y: 3.45, w: 3.0, h: 0.6, fontFace: FB, fontSize: 12.5, color: C.mute, margin: 0 });
  s.addText([
    { text: "tokens.css", options: { bullet: true, breakLine: true, fontFace: "Consolas", color: C.teal } },
    { text: "per-feature stylesheets", options: { bullet: true, breakLine: true } },
    { text: "Button · Card · Badge", options: { bullet: true, breakLine: true } },
    { text: "Input · EmptyState · Icon", options: { bullet: true } },
  ], { x: 1.05, y: 4.2, w: 3.1, h: 2.2, fontFace: FB, fontSize: 13.5, color: C.white, paraSpaceAfter: 8, margin: 0 });
  // right: feature screens grid 4x2
  s.addText("FEATURE SCREENS", { x: 4.75, y: 2.0, w: 5, h: 0.3, fontFace: FB, fontSize: 11, bold: true, color: C.amber, charSpacing: 2, margin: 0 });
  const screens = [["Chat", I.comments], ["Journal", I.book], ["Insights", I.chart], ["Library", I.search], ["Profile", I.user], ["Settings", I.route], ["First-Run", I.rocket], ["Voice", I.mic]];
  let gx = 4.75, gy = 2.45;
  screens.forEach((sc, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const x = gx + col * 2.05, y = gy + row * 2.0;
    card(s, x, y, 1.9, 1.8, C.panel);
    iconCircle(s, sc[1], x + 0.62, y + 0.32, 0.66, C.bg2);
    s.addText(sc[0], { x, y: y + 1.15, w: 1.9, h: 0.4, fontFace: FB, fontSize: 14, bold: true, color: C.white, align: "center", margin: 0 });
  });
  footer(s, "ui/src — useHealth & useTheme hooks wire live backend status into the shell");

  // =========================================================
  // SLIDE 5 — TAURI / DESKTOP SHELL
  // =========================================================
  s = pres.addSlide(); bgFill(s);
  header(s, "Section 04", "Tauri / Desktop Shell — wrapping the web UI native", 5);
  // pipeline: Web UI -> Rust wrap -> .app
  const steps5 = [
    { ic: I.react, t: "Web UI", d: "React + Vite build" },
    { ic: I.rust, t: "Rust Shell", d: "tauri.conf · capabilities" },
    { ic: I.apple, t: "macOS .app", d: "Info.plist · entitlements · icons" },
  ];
  let px = 0.9;
  steps5.forEach((st, i) => {
    card(s, px, 2.3, 3.5, 2.0, i === 1 ? C.panel2 : C.panel);
    iconCircle(s, st.ic, px + 1.4, 2.55, 0.7, C.bg2);
    s.addText(st.t, { x: px, y: 3.35, w: 3.5, h: 0.4, fontFace: FB, fontSize: 17, bold: true, color: C.white, align: "center", margin: 0 });
    s.addText(st.d, { x: px, y: 3.75, w: 3.5, h: 0.4, fontFace: FB, fontSize: 12, color: C.mute, align: "center", margin: 0 });
    if (i < 2) s.addImage({ data: I.arrow, x: px + 3.6, y: 3.05, w: 0.55, h: 0.55 });
    px += 4.1;
  });
  // setup.sh strip
  card(s, 0.9, 4.8, 11.5, 1.5, C.panel);
  iconCircle(s, Ia.bolt, 1.2, 5.1, 0.9, C.bg2);
  s.addText([
    { text: "setup.sh", options: { fontFace: "Consolas", bold: true, color: C.teal } },
    { text: "  — one-shot install pipeline", options: { bold: true, color: C.white } },
  ], { x: 2.35, y: 5.0, w: 9.8, h: 0.45, fontFace: FB, fontSize: 17, margin: 0 });
  s.addText("Installs all dependencies and downloads every model — the only moment Eva is allowed to touch the network.", { x: 2.35, y: 5.5, w: 9.8, h: 0.7, fontFace: FB, fontSize: 13.5, color: C.mute, margin: 0 });
  footer(s, "ui/src-tauri — the Rust shell turns the local web app into a signed, sandboxed desktop binary");

  // =========================================================
  // SLIDE 6 — BACKEND API SURFACE
  // =========================================================
  s = pres.addSlide(); bgFill(s);
  header(s, "Section 05", "Backend API Surface — FastAPI, ~28 endpoints", 6);
  const groups = [
    { t: "Chat", ic: I.comments, e: "WS /chat · /chat/conversations" },
    { t: "Journal", ic: I.book, e: "/entry · /journal/* · media" },
    { t: "Insights", ic: I.chart, e: "/insights/mood · graph · growth" },
    { t: "Profile", ic: I.user, e: "/profile  (GET · PUT)" },
    { t: "Corpus", ic: I.upload, e: "/corpus/* upload · list · delete" },
    { t: "Voice", ic: I.mic, e: "/stt" },
    { t: "System", ic: I.heart, e: "/health · /settings" },
    { t: "Privacy", ic: I.shield, e: "/privacy/audit · /vault/reveal" },
  ];
  let bx = 0.7, by = 2.0;
  groups.forEach((g, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const x = bx + col * 3.08, y = by + row * 2.35;
    card(s, x, y, 2.92, 2.1, row % 2 ? C.panel2 : C.panel);
    iconCircle(s, g.ic, x + 0.28, y + 0.28, 0.7, C.bg2);
    s.addText(g.t, { x: x + 1.1, y: y + 0.42, w: 1.7, h: 0.45, fontFace: FB, fontSize: 18, bold: true, color: C.white, margin: 0, valign: "middle" });
    s.addText(g.e, { x: x + 0.28, y: y + 1.2, w: 2.4, h: 0.75, fontFace: "Consolas", fontSize: 11.5, color: C.teal, margin: 0 });
  });
  footer(s, "backend/app.py — a thin HTTP/WebSocket surface over the memory, LLM and voice subsystems");

  // =========================================================
  // SLIDE 7 — LLM SERVING
  // =========================================================
  s = pres.addSlide(); bgFill(s);
  header(s, "Section 06", "LLM Serving — gemma-4-E2B on Metal", 7);
  // client -> http -> server -> GPU
  card(s, 0.7, 2.1, 2.9, 2.0, C.panel);
  iconCircle(s, I.code, 1.75, 2.35, 0.7, C.bg2);
  s.addText("FastAPI client", { x: 0.7, y: 3.15, w: 2.9, h: 0.4, fontFace: FB, fontSize: 16, bold: true, color: C.white, align: "center", margin: 0 });
  s.addText("client.py · per-request sampling", { x: 0.7, y: 3.55, w: 2.9, h: 0.4, fontFace: FB, fontSize: 11.5, color: C.mute, align: "center", margin: 0 });
  // arrow w/ port label
  s.addImage({ data: I.arrow, x: 3.72, y: 2.85, w: 0.7, h: 0.7 });
  s.addText("HTTP : 11500", { x: 3.4, y: 3.55, w: 1.4, h: 0.3, fontFace: "Consolas", fontSize: 10.5, color: C.amber, align: "center", margin: 0 });
  // server + GPU
  card(s, 4.65, 2.1, 4.0, 2.0, C.panel2);
  iconCircle(s, I.server, 6.3, 2.35, 0.7, C.bg2);
  s.addText("llama-server (llama.cpp)", { x: 4.65, y: 3.15, w: 4.0, h: 0.4, fontFace: FB, fontSize: 16, bold: true, color: C.white, align: "center", margin: 0 });
  s.addText("launched & supervised by server.py", { x: 4.65, y: 3.55, w: 4.0, h: 0.4, fontFace: FB, fontSize: 11.5, color: C.mute, align: "center", margin: 0 });
  s.addImage({ data: I.arrow, x: 8.78, y: 2.85, w: 0.7, h: 0.7 });
  card(s, 9.7, 2.1, 3.1, 2.0, C.panel);
  iconCircle(s, Ia.micro, 10.95, 2.35, 0.7, C.bg2);
  s.addText("Apple M1 · Metal GPU", { x: 9.7, y: 3.15, w: 3.1, h: 0.4, fontFace: FB, fontSize: 14, bold: true, color: C.white, align: "center", margin: 0 });
  s.addText("all layers offloaded (-1)", { x: 9.7, y: 3.55, w: 3.1, h: 0.4, fontFace: FB, fontSize: 11.5, color: C.green, align: "center", margin: 0 });
  // flag tags
  const flags = ["Q4_K_XL GGUF", "q8_0 KV cache", "--flash-attn on", "--jinja template", "--reasoning off", "8192 ctx"];
  let fx = 0.7;
  s.addText("KEY FLAGS", { x: 0.7, y: 4.5, w: 4, h: 0.3, fontFace: FB, fontSize: 11, bold: true, color: C.amber, charSpacing: 2, margin: 0 });
  flags.forEach((t) => {
    const cw = 0.3 + t.length * 0.115;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: fx, y: 4.85, w: cw, h: 0.55, rectRadius: 0.27, fill: { color: C.panel }, line: { color: C.border, width: 1 } });
    s.addText(t, { x: fx, y: 4.85, w: cw, h: 0.55, fontFace: "Consolas", fontSize: 12, color: C.teal, align: "center", valign: "middle", margin: 0 });
    fx += cw + 0.25;
  });
  s.addText([
    { text: "Clean process boundary:  ", options: { bold: true, color: C.white } },
    { text: "the backend venv needs no llama-cpp-python — it talks to the server over plain HTTP.", options: { color: C.mute } },
  ], { x: 0.7, y: 5.7, w: 12, h: 0.6, fontFace: FB, fontSize: 14, margin: 0 });
  footer(s, "backend/llm — chat temp 1.0 / top_p 0.95 / top_k 64 · extraction temp 0.3");

  // =========================================================
  // SLIDE 8 — MEMORY & DATA LAYER
  // =========================================================
  s = pres.addSlide(); bgFill(s);
  header(s, "Section 07", "Memory & Data Layer — the heart of Eva", 8);
  // top: source of truth
  card(s, 3.6, 1.85, 6.1, 1.0, C.panel2);
  iconCircle(s, Ia.file, 3.85, 2.05, 0.6, C.bg2);
  s.addText([{ text: "Markdown Vault   ", options: { bold: true, color: C.white } }, { text: "source of truth on disk", options: { color: C.amber } }], { x: 4.65, y: 1.85, w: 4.9, h: 1.0, fontFace: FB, fontSize: 16, valign: "middle", margin: 0 });
  s.addImage({ data: I.arrow, x: 6.35, y: 3.0, w: 0.6, h: 0.6, rotate: 90 });
  s.addText("derived · rebuildable", { x: 7.0, y: 3.1, w: 3, h: 0.4, fontFace: FB, fontSize: 11, italic: true, color: C.faint, margin: 0 });
  // two DBs
  card(s, 2.5, 3.75, 3.7, 1.0, C.panel);
  iconCircle(s, I.db, 2.75, 3.95, 0.6, C.bg2);
  s.addText([{ text: "SQLite\n", options: { bold: true, color: C.white } }, { text: "structured facts · schema.sql", options: { color: C.mute, fontSize: 11 } }], { x: 3.55, y: 3.75, w: 2.6, h: 1.0, fontFace: FB, fontSize: 15, valign: "middle", margin: 0 });
  card(s, 7.1, 3.75, 3.7, 1.0, C.panel);
  iconCircle(s, I.db, 7.35, 3.95, 0.6, C.bg2);
  s.addText([{ text: "ChromaDB\n", options: { bold: true, color: C.white } }, { text: "vector embeddings", options: { color: C.mute, fontSize: 11 } }], { x: 8.15, y: 3.75, w: 2.6, h: 1.0, fontFace: FB, fontSize: 15, valign: "middle", margin: 0 });
  // module chain at bottom
  s.addText("PROCESSING & DERIVED INTELLIGENCE", { x: 0.7, y: 5.0, w: 8, h: 0.3, fontFace: FB, fontSize: 11, bold: true, color: C.amber, charSpacing: 2, margin: 0 });
  const mods = ["capture", "extract", "vector", "retrieval", "graph", "growth", "profile"];
  let mx = 0.7;
  mods.forEach((t, i) => {
    const cw = 0.3 + t.length * 0.135;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: mx, y: 5.4, w: cw, h: 0.62, rectRadius: 0.08, fill: { color: i < 4 ? C.panel : C.panel2 }, line: { color: C.border, width: 1 } });
    s.addText(t + ".py", { x: mx, y: 5.4, w: cw, h: 0.62, fontFace: "Consolas", fontSize: 12, color: i < 4 ? C.teal : C.amberSoft, align: "center", valign: "middle", margin: 0 });
    mx += cw + 0.22;
  });
  footer(s, "backend/memory — databases are always rebuildable from the Markdown; Markdown never depends on them");

  // =========================================================
  // SLIDE 9 — INGESTION / CORPUS
  // =========================================================
  s = pres.addSlide(); bgFill(s);
  header(s, "Section 08", "Ingestion — user documents become context", 9);
  const pipe = [
    { ic: I.upload, t: "Upload", d: "/corpus/upload", file: "loaders.py" },
    { ic: I.file, t: "Loaders", d: "parse to text", file: "loaders.py" },
    { ic: I.cubes, t: "Chunker", d: "split into passages", file: "chunker.py" },
    { ic: I.db, t: "Corpus Store", d: "embed → ChromaDB", file: "corpus.py" },
  ];
  let qx = 0.75;
  pipe.forEach((p, i) => {
    card(s, qx, 2.6, 2.7, 2.4, i % 2 ? C.panel2 : C.panel);
    iconCircle(s, p.ic, qx + 1.0, 2.85, 0.7, C.bg2);
    s.addText(p.t, { x: qx, y: 3.65, w: 2.7, h: 0.4, fontFace: FB, fontSize: 17, bold: true, color: C.white, align: "center", margin: 0 });
    s.addText(p.d, { x: qx, y: 4.05, w: 2.7, h: 0.35, fontFace: FB, fontSize: 12, color: C.mute, align: "center", margin: 0 });
    s.addText(p.file, { x: qx, y: 4.5, w: 2.7, h: 0.35, fontFace: "Consolas", fontSize: 11, color: C.teal, align: "center", margin: 0 });
    if (i < 3) s.addImage({ data: I.arrow, x: qx + 2.78, y: 3.5, w: 0.55, h: 0.55 });
    qx += 3.08;
  });
  s.addText("Once ingested, uploaded documents are retrievable alongside journal entries — feeding the same RAG context that grounds Eva's replies.", { x: 0.75, y: 5.45, w: 11.8, h: 0.8, fontFace: FB, fontSize: 14.5, color: C.mute, align: "center", margin: 0 });
  footer(s, "backend/ingest — a conveyor from raw file to retrievable passage");

  // =========================================================
  // SLIDE 10 — VOICE PIPELINE
  // =========================================================
  s = pres.addSlide(); bgFill(s);
  header(s, "Section 09", "Voice Pipeline — lazy-loaded STT & TTS", 10);
  // STT row
  card(s, 0.7, 2.05, 11.9, 1.5, C.panel);
  iconCircle(s, I.mic, 1.0, 2.3, 0.9, C.bg2);
  s.addText("Speech → Text", { x: 2.15, y: 2.2, w: 3.2, h: 0.4, fontFace: FB, fontSize: 17, bold: true, color: C.white, margin: 0 });
  s.addText([{ text: "faster-whisper", options: { fontFace: "Consolas", color: C.teal } }, { text: "   ·   stt.py   ·   /stt endpoint", options: { color: C.mute } }], { x: 2.15, y: 2.68, w: 6, h: 0.5, fontFace: FB, fontSize: 13.5, margin: 0 });
  s.addImage({ data: I.arrow, x: 8.4, y: 2.55, w: 0.6, h: 0.6 });
  s.addText("transcript", { x: 9.0, y: 2.6, w: 3.4, h: 0.5, fontFace: FB, fontSize: 14, italic: true, color: C.faint, valign: "middle", margin: 0 });
  // TTS row
  card(s, 0.7, 3.75, 11.9, 1.5, C.panel2);
  iconCircle(s, I.volume, 1.0, 4.0, 0.9, C.bg2);
  s.addText("Text → Speech", { x: 2.15, y: 3.9, w: 3.2, h: 0.4, fontFace: FB, fontSize: 17, bold: true, color: C.white, margin: 0 });
  s.addText([{ text: "Kokoro TTS", options: { fontFace: "Consolas", color: C.teal } }, { text: "   ·   tts.py   →   ", options: { color: C.mute } }, { text: "sentence_queue.py", options: { fontFace: "Consolas", color: C.amberSoft } }, { text: " streams audio sentence-by-sentence", options: { color: C.mute } }], { x: 2.15, y: 4.38, w: 9.5, h: 0.5, fontFace: FB, fontSize: 13.5, margin: 0 });
  // budget callout
  card(s, 0.7, 5.5, 11.9, 1.1, C.panel);
  iconCircle(s, Ia.mem, 1.0, 5.62, 0.85, C.bg2);
  s.addText([
    { text: "Lazy-loaded on first use — never at startup.  ", options: { bold: true, color: C.white } },
    { text: "Voice models stay off the 8 GB budget until the user actually speaks or listens.", options: { color: C.mute } },
  ], { x: 2.15, y: 5.5, w: 10.2, h: 1.1, fontFace: FB, fontSize: 14, valign: "middle", margin: 0 });
  footer(s, "backend/voice — the single biggest memory lever on the M1 Air");

  // =========================================================
  // SLIDE 11 — INTENT, SAFETY & PROMPTING
  // =========================================================
  s = pres.addSlide(); bgFill(s);
  header(s, "Section 10", "Intent, Safety & Prompting — responsible AI", 11);
  s.addText("Every user message passes three gates before it reaches the model.", { x: 0.7, y: 1.7, w: 11.5, h: 0.4, fontFace: FB, fontSize: 15, color: C.mute, margin: 0 });
  const gates = [
    { ic: I.route, t: "Intent Classifier", d: "routes the turn to the right behaviour", file: "intent/classifier.py", col: C.teal },
    { ic: I.shield, t: "Crisis Safety Check", d: "guards sensitive / at-risk content", file: "safety/crisis_check.py", col: C.amber },
    { ic: I.sitemap, t: "Prompt Assembly", d: "builds system + extraction prompts", file: "prompts/assembly.py", col: C.teal },
  ];
  let tx = 0.75;
  gates.forEach((g, i) => {
    card(s, tx, 2.4, 3.65, 2.7, i === 1 ? C.panel2 : C.panel);
    iconCircle(s, i === 1 ? Ia.shield : g.ic, tx + 1.45, 2.7, 0.75, C.bg2);
    s.addText(g.t, { x: tx, y: 3.6, w: 3.65, h: 0.4, fontFace: FB, fontSize: 16, bold: true, color: C.white, align: "center", margin: 0 });
    s.addText(g.d, { x: tx + 0.2, y: 4.0, w: 3.25, h: 0.6, fontFace: FB, fontSize: 12.5, color: C.mute, align: "center", margin: 0 });
    s.addText(g.file, { x: tx, y: 4.65, w: 3.65, h: 0.35, fontFace: "Consolas", fontSize: 10.5, color: g.col, align: "center", margin: 0 });
    if (i < 2) s.addImage({ data: I.arrow, x: tx + 3.72, y: 3.5, w: 0.5, h: 0.5 });
    tx += 4.18;
  });
  card(s, 0.75, 5.45, 11.85, 1.1, C.panel);
  s.addText([
    { text: "Prompt sources live as editable Markdown:  ", options: { color: C.white, bold: true } },
    { text: "eva_system.md", options: { fontFace: "Consolas", color: C.teal } },
    { text: "  ·  ", options: { color: C.faint } },
    { text: "extract_entry.md", options: { fontFace: "Consolas", color: C.teal } },
    { text: "  — Eva's voice is reviewable, not buried in code.", options: { color: C.mute } },
  ], { x: 1.0, y: 5.45, w: 11.4, h: 1.1, fontFace: FB, fontSize: 14, valign: "middle", margin: 0 });
  footer(s, "backend/intent · backend/safety · backend/prompts");

  // =========================================================
  // SLIDE 12 — DATA FLOW WALKTHROUGHS
  // =========================================================
  s = pres.addSlide(); bgFill(s);
  header(s, "Section 11", "Data Flow — two end-to-end journeys", 12);
  function flowRow(y, title, color, steps) {
    s.addText(title, { x: 0.7, y: y - 0.38, w: 11.5, h: 0.32, fontFace: FB, fontSize: 13, bold: true, color, charSpacing: 1, margin: 0 });
    let x = 0.7;
    const wEach = 1.42, gap = 0.27;
    steps.forEach((t, i) => {
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: wEach, h: 0.85, rectRadius: 0.07, fill: { color: i % 2 ? C.panel2 : C.panel }, line: { color: C.border, width: 1 } });
      s.addText(t, { x: x + 0.05, y, w: wEach - 0.1, h: 0.85, fontFace: FB, fontSize: 10.5, bold: true, color: C.white, align: "center", valign: "middle", margin: 0 });
      if (i < steps.length - 1) s.addImage({ data: i % 2 ? Ia.arrow : I.arrow, x: x + wEach + 0.01, y: y + 0.27, w: 0.3, h: 0.3 });
      x += wEach + gap;
    });
  }
  flowRow(2.55, "A CHAT TURN", C.teal, ["UI", "WS /chat", "Retrieval", "Prompt", "llama-server", "Stream back", "Capture"]);
  flowRow(4.75, "A JOURNAL ENTRY", C.amber, ["Markdown write", "Extract", "SQLite", "ChromaDB", "Graph update"]);
  card(s, 0.7, 5.85, 11.9, 0.85, C.panel);
  s.addText([
    { text: "Same backbone both ways:  ", options: { bold: true, color: C.white } },
    { text: "Markdown is written first, then the derived stores update — so a turn or an entry is never lost if a database is rebuilt.", options: { color: C.mute } },
  ], { x: 1.0, y: 5.85, w: 11.4, h: 0.85, fontFace: FB, fontSize: 13.5, valign: "middle", margin: 0 });
  footer(s, "sequence overview — numbered handoffs across the four processes");

  // =========================================================
  // SLIDE 13 — MEMORY FOOTPRINT & PERFORMANCE
  // =========================================================
  s = pres.addSlide(); bgFill(s);
  header(s, "Section 12", "Memory Footprint — designing for 8 GB", 13);
  // big stat
  s.addText([{ text: "8", options: { fontSize: 72, bold: true, color: C.teal } }, { text: " GB", options: { fontSize: 30, bold: true, color: C.mute } }], { x: 0.7, y: 2.0, w: 3.2, h: 1.4, fontFace: FH, valign: "middle", margin: 0 });
  s.addText("total RAM — the hard ceiling that drove every choice", { x: 0.75, y: 3.35, w: 3.3, h: 0.9, fontFace: FB, fontSize: 14, color: C.mute, margin: 0 });
  // budget bar (stacked)
  const barX = 4.4, barY = 2.2, barW = 8.2, barH = 0.95;
  const segs = [
    { t: "LLM on Metal GPU", w: 0.46, c: C.teal },
    { t: "q8_0 KV cache", w: 0.16, c: C.tealDeep },
    { t: "Backend + UI", w: 0.18, c: C.amber },
    { t: "Voice (lazy)", w: 0.20, c: C.panel2 },
  ];
  let sx = barX;
  segs.forEach((sg, i) => {
    const w = barW * sg.w;
    s.addShape(pres.shapes.RECTANGLE, { x: sx, y: barY, w, h: barH, fill: { color: sg.c }, line: { color: C.bg, width: 2 } });
    s.addText(sg.t, { x: sx, y: barY, w, h: barH, fontFace: FB, fontSize: 10.5, bold: true, color: i === 3 ? C.mute : C.bg, align: "center", valign: "middle", margin: 0 });
    sx += w;
  });
  s.addText("Voice segment is dashed-empty until first use", { x: barX, y: barY + barH + 0.12, w: barW, h: 0.3, fontFace: FB, fontSize: 11, italic: true, color: C.faint, align: "right", margin: 0 });
  // levers
  const levers = [
    { ic: I.micro, t: "All layers on Metal", d: "GPU offload, not CPU — 3–5× faster" },
    { ic: I.db, t: "q8_0 KV cache", d: "halves KV-cache RAM (needs flash-attn)" },
    { ic: I.mem, t: "Lazy voice models", d: "loaded only on first speak/listen" },
    { ic: I.cubes, t: "Q4_K_XL quantization", d: "compact GGUF tuned for the M1 Air" },
  ];
  let lx = 0.7, lyy = 4.5;
  levers.forEach((L, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = lx + col * 6.1, y = lyy + row * 1.15;
    card(s, x, y, 5.85, 1.0, row % 2 ? C.panel2 : C.panel);
    iconCircle(s, L.ic, x + 0.22, y + 0.2, 0.6, C.bg2);
    s.addText([{ text: L.t + "\n", options: { bold: true, color: C.white, fontSize: 14 } }, { text: L.d, options: { color: C.mute, fontSize: 12 } }], { x: x + 1.0, y, w: 4.7, h: 1.0, fontFace: FB, valign: "middle", margin: 0 });
  });
  footer(s, "the M1 Air constraint is the design — every tradeoff traces back to this bar");

  // =========================================================
  // SLIDE 14 — PRINCIPLES (CLOSING, DARK)
  // =========================================================
  s = pres.addSlide(); bgFill(s, C.bg2);
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: 0.12, fill: { color: C.amber } });
  s.addText("IN SUMMARY", { x: 0.9, y: 0.7, w: 8, h: 0.4, fontFace: FB, fontSize: 14, bold: true, color: C.amber, charSpacing: 4, margin: 0 });
  s.addText("Five architecture principles", { x: 0.85, y: 1.05, w: 11.5, h: 0.9, fontFace: FH, fontSize: 38, bold: true, color: C.white, margin: 0 });
  const princ = [
    { ic: I.lock, t: "Privacy by code", d: "the network block lives in net_guard.py, not a policy doc" },
    { ic: I.file, t: "Markdown is truth", d: "human-readable entries on disk are the source of record" },
    { ic: I.db, t: "DBs are rebuildable", d: "SQLite & ChromaDB are derived and disposable" },
    { ic: I.sitemap, t: "Clean process seams", d: "UI, backend and LLM server talk over thin interfaces" },
    { ic: I.cubes, t: "Stubs behind real seams", d: "demo stubs implement the interface their real version will" },
  ];
  let py = 2.2;
  princ.forEach((p, i) => {
    card(s, 0.9, py, 11.55, 0.86, i % 2 ? C.panel : C.panel2);
    iconCircle(s, i % 2 ? Ia[Object.keys({})] || p.ic : p.ic, 1.12, py + 0.13, 0.6, C.bg);
    s.addText([
      { text: p.t + "    ", options: { bold: true, color: C.white, fontSize: 17 } },
      { text: p.d, options: { color: C.mute, fontSize: 13.5 } },
    ], { x: 2.0, y: py, w: 10.2, h: 0.86, fontFace: FB, valign: "middle", margin: 0 });
    py += 0.94;
  });

  await pres.writeFile({ fileName: "/Users/user1/Eva_01/docs/ppt/Eva_Tech_Architecture.pptx" });
  console.log("WROTE Eva_Tech_Architecture.pptx");
}
build().catch((e) => { console.error(e); process.exit(1); });
