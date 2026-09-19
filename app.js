/* ==================================================================
   Editable page app
   - Renders the page from a JSON document (content.js = original)
   - Edit mode: click any text to edit in place, click images to swap
   - Each saved edit can carry a short "why" note
   - Comment mode: click any block to open its comment thread
   - Compare tab: change summary with before/after snippets + side by side
   - Persistence: localStorage (this browser) + Export/Import edits.json.
     Commit edits.json to the repo and everyone sees the edits on GitHub Pages.
   ================================================================== */
(function () {
  "use strict";

  const STORAGE_KEY = "veris-editable-v1";
  const ORIGINAL = window.ORIGINAL_CONTENT;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const textOf = (html) => { const d = document.createElement("div"); d.innerHTML = html || ""; return d.textContent.replace(/\s+/g, " ").trim(); };
  const ls = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }, remove: (k) => { try { localStorage.removeItem(k); } catch (e) {} } };
  const fmtTime = (ts) => new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

  /* ---------------- state ---------------- */
  let state = { doc: clone(ORIGINAL), changes: [], comments: [] };
  let mode = "view";               // view | edit | comment
  let author = ls.get(STORAGE_KEY + ":author") || "";
  let commentFilter = "open";

  /* ---------------- persistence ----------------
     Two back-ends behind the same save()/load():
     - shared: the artifact's `db` capability (claude.use("db")) — every viewer
       sees edits and comments live. Documents: page/state {meta, footer, order},
       blocks/<id> (only blocks that differ from the original), changes/<id>,
       comments/<id>.
     - local: localStorage (GitHub Pages / file:// / no capability). */
  let db = null, shadow = null, syncing = false, resync = false, pendingRender = false, readOnly = false;
  let uploader = null;   // async (file) => url — set by whichever shared back-end is connected
  let backend = "local"; // local | claude | supabase
  const ORIGINAL_IDS = ORIGINAL.blocks.map((b) => b.id);

  function setStatus(msg, warn) { const s = $("#status"); s.textContent = msg; s.className = "status" + (warn ? " dirty" : ""); }
  function busy() { return !!editing || $("#modal").classList.contains("open"); }

  function stateToDocs() {
    const blocks = {};
    state.doc.blocks.forEach((b) => { const o = originalBlock(b.id); if (!o || JSON.stringify(o) !== JSON.stringify(b)) blocks[b.id] = b; });
    const page = { meta: state.doc.meta, footer: state.doc.footer, order: state.doc.blocks.map((b) => b.id), parked: state.parked || [] };
    const changes = {}; state.changes.forEach((c) => (changes[c.id] = c));
    const comments = {}; state.comments.forEach((c) => (comments[c.id] = c));
    return { blocks, page, changes, comments };
  }
  function rebuildFromShadow() {
    const pg = shadow.page || {};
    state.doc.meta = Object.assign({}, ORIGINAL.meta, pg.meta || {});
    state.doc.footer = Object.assign({}, ORIGINAL.footer, pg.footer || {});
    const order = pg.order || ORIGINAL_IDS;
    state.doc.blocks = order.map((id) => shadow.blocks[id] || originalBlock(id)).filter(Boolean).map(clone);
    state.parked = clone(pg.parked || []);
    state.changes = Object.values(shadow.changes).map(clone).sort((a, b) => a.ts - b.ts);
    state.comments = Object.values(shadow.comments).map(clone).sort((a, b) => a.ts - b.ts);
  }
  function remoteChanged() {
    if (syncing) return;
    if (busy()) { pendingRender = true; return; }
    rebuildFromShadow();
    const v = $$(".tab").find((t) => t.classList.contains("active")).dataset.view;
    renderPage(); if (v === "comments") renderCommentsView(); if (v === "compare") renderCompare();
    setStatus("live · shared");
  }

  async function syncToDb() {
    if (syncing) { resync = true; return; }
    syncing = true; setStatus("saving…");
    try {
      const want = stateToDocs();
      const ops = [];
      const diffMap = (col, w, h) => {
        Object.keys(w).forEach((id) => { if (JSON.stringify(w[id]) !== JSON.stringify(h[id])) ops.push(() => db.doc(col + "/" + id).set(w[id]).then(() => (h[id] = clone(w[id])))); });
        Object.keys(h).forEach((id) => { if (!(id in w)) ops.push(() => db.doc(col + "/" + id).delete().then(() => delete h[id])); });
      };
      diffMap("blocks", want.blocks, shadow.blocks);
      diffMap("changes", want.changes, shadow.changes);
      diffMap("comments", want.comments, shadow.comments);
      if (JSON.stringify(want.page) !== JSON.stringify(shadow.page)) ops.push(() => db.doc("page/state").set(want.page).then(() => (shadow.page = clone(want.page))));
      for (const op of ops) await op();
      setStatus("saved · shared with everyone");
    } catch (e) {
      const code = e && e.code;
      if (code === "invalid_argument" || code === "not_granted") { readOnly = true; setStatus("read-only: you can't change this page", true); }
      else if (code === "quota_exceeded") setStatus("storage full — delete some comments/changes", true);
      else setStatus("could not save: " + (e && e.message ? e.message : e), true);
    } finally {
      syncing = false;
      if (resync) { resync = false; syncToDb(); }
      else if (pendingRender && !busy()) { pendingRender = false; remoteChanged(); }
    }
  }

  function save() {
    updateBadges();
    if (db) return syncToDb();
    if (ls.set(STORAGE_KEY, JSON.stringify(state))) setStatus("saved in this browser"); else setStatus("could not save (storage blocked or full)", true);
  }

  /* Supabase adapter: exposes the same tiny doc/collection API the claude `db`
     capability has, backed by one table `docs (col text, id text, data jsonb)`.
     See README → "Shared editing on GitHub Pages". */
  function supabaseAdapter(sb) {
    const docL = {}, colL = {};
    const err = (e) => ({ code: e && (e.code === "42501" || e.code === "PGRST301") ? "invalid_argument" : "unavailable", message: e && e.message ? e.message : String(e) });
    const snap = (path, row) => ({ id: path.split("/").pop(), exists: !!row, data: () => (row ? row.data : undefined), metadata: { fromCache: false, hasPendingWrites: false } });
    const split = (p) => { const i = p.lastIndexOf("/"); return [p.slice(0, i), p.slice(i + 1)]; };
    const doc = (path) => { const [col, id] = split(path); return {
      id, path,
      get: async () => { const { data, error } = await sb.from("docs").select("data").eq("col", col).eq("id", id).maybeSingle(); if (error) throw err(error); return snap(path, data); },
      set: async (d) => { const { error } = await sb.from("docs").upsert({ col, id, data: d, updated_at: new Date().toISOString() }); if (error) throw err(error); },
      update: async (d) => { const cur = await doc(path).get(); if (!cur.exists) throw { code: "invalid_argument", message: "missing" }; return doc(path).set(Object.assign({}, cur.data(), d)); },
      delete: async () => { const { error } = await sb.from("docs").delete().eq("col", col).eq("id", id); if (error) throw err(error); },
      onSnapshot: (next, onErr) => { (docL[path] = docL[path] || []).push(next); doc(path).get().then(next).catch(onErr || (() => {})); return () => { docL[path] = (docL[path] || []).filter((f) => f !== next); }; },
      collection: (sub) => collection(path + "/" + sub)
    }; };
    const collection = (col) => ({
      path: col,
      doc: (id) => doc(col + "/" + (id || uid())),
      add: async (d) => { const r = doc(col + "/" + uid()); await r.set(d); return r; },
      get: async () => { const { data, error } = await sb.from("docs").select("id,data").eq("col", col); if (error) throw err(error); const docs = (data || []).map((r) => snap(col + "/" + r.id, r)); return { docs, size: docs.length, empty: !docs.length, docChanges: () => docs.map((d) => ({ type: "added", doc: d })), metadata: {} }; },
      onSnapshot: (next, onErr) => { (colL[col] = colL[col] || []).push(next); collection(col).get().then(next).catch(onErr || (() => {})); return () => { colL[col] = (colL[col] || []).filter((f) => f !== next); }; }
    });
    sb.channel("docs-live").on("postgres_changes", { event: "*", schema: "public", table: "docs" }, (p) => {
      const row = p.eventType === "DELETE" ? p.old : p.new; if (!row || !row.col) return;
      const path = row.col + "/" + row.id; const type = p.eventType === "DELETE" ? "removed" : p.eventType === "INSERT" ? "added" : "modified";
      const d = type === "removed" ? Object.assign(snap(path, { data: row.data || {} }), { exists: true }) : snap(path, row);
      (docL[path] || []).forEach((f) => f(type === "removed" ? snap(path, null) : d));
      (colL[row.col] || []).forEach((f) => f({ docs: [], size: 0, empty: true, docChanges: () => [{ type, doc: d }], metadata: {} }));
    }).subscribe();
    return { doc, collection };
  }

  async function connectSupabase() {
    const cfg = window.SITE_CONFIG || {};
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) return false;
    try {
      const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
      const { error } = await sb.from("docs").select("id").limit(1); if (error) throw error;
      db = supabaseAdapter(sb); backend = "supabase";
      uploader = async (file) => {
        const name = Date.now().toString(36) + "-" + file.name.replace(/[^\w.\-]+/g, "_");
        const { error } = await sb.storage.from(cfg.bucket || "images").upload(name, file, { upsert: false }); if (error) throw error;
        return sb.storage.from(cfg.bucket || "images").getPublicUrl(name).data.publicUrl;
      };
      return true;
    } catch (e) { console.warn("Supabase not reachable, falling back to local storage:", e); db = null; return false; }
  }

  async function connectDb() {
    if (window.claude && typeof window.claude.use === "function") {
      try { db = await window.claude.use("db"); } catch (e) { db = null; }
      if (db) { backend = "claude"; uploader = async (file) => { const assets = await window.claude.use("assets"); if (!assets) throw new Error("no asset storage"); return (await assets.upload(file)).url; }; }
    }
    if (!db && !(await connectSupabase())) return false;
    shadow = { blocks: {}, page: null, changes: {}, comments: {} };
    // first load: read everything once, then subscribe for live updates
    const [pg, bl, ch, cm] = await Promise.all([db.doc("page/state").get(), db.collection("blocks").get(), db.collection("changes").get(), db.collection("comments").get()]);
    if (pg.exists) shadow.page = pg.data();
    bl.docs.forEach((d) => (shadow.blocks[d.id] = d.data()));
    ch.docs.forEach((d) => (shadow.changes[d.id] = d.data()));
    cm.docs.forEach((d) => (shadow.comments[d.id] = d.data()));
    rebuildFromShadow();
    const onErr = (e) => setStatus("live updates paused (" + (e && e.code) + ")", true);
    db.doc("page/state").onSnapshot((d) => { const v = d.exists ? d.data() : null; if (JSON.stringify(v) !== JSON.stringify(shadow.page)) { shadow.page = v; remoteChanged(); } }, onErr);
    const watch = (col) => db.collection(col).onSnapshot((snap) => {
      let touched = false;
      snap.docChanges().forEach((c) => {
        if (c.type === "removed") { if (c.doc.id in shadow[col]) { delete shadow[col][c.doc.id]; touched = true; } }
        else { const v = c.doc.data(); if (JSON.stringify(v) !== JSON.stringify(shadow[col][c.doc.id])) { shadow[col][c.doc.id] = v; touched = true; } }
      });
      if (touched) remoteChanged();
    }, onErr);
    watch("blocks"); watch("changes"); watch("comments");
    // prefill the author name from the viewer's profile when available
    try { const user = backend === "claude" ? await window.claude.use("user") : null; if (user && !author) { const me = await user.me(); if (me && me.name) { author = me.name; ls.set(STORAGE_KEY + ":author", author); } } } catch (e) {}
    return true;
  }

  async function load() {
    if (await connectDb()) return "shared";
    // 1. published edits (committed edits.json in the repo), 2. local edits (newer)
    let published = null;
    try {
      const r = await fetch("edits.json", { cache: "no-store" });
      if (r.ok) { const j = await r.json(); if (j && j.doc) published = j; }
    } catch (e) { /* no edits.json — fine */ }
    let local = null;
    try { local = JSON.parse(ls.get(STORAGE_KEY) || "null"); } catch (e) {}
    if (local && local.doc) state = local;
    else if (published) state = published;
    state.changes = state.changes || []; state.comments = state.comments || []; state.parked = state.parked || [];
    state.doc.meta = Object.assign({}, ORIGINAL.meta, state.doc.meta);
    state.doc.footer = Object.assign({}, ORIGINAL.footer, state.doc.footer);
    return local ? "local" : published ? "published" : "original";
  }

  /* ---------------- path helpers ---------------- */
  function getPath(obj, path) { return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj); }
  function setPath(obj, path, val) {
    const ks = path.split("."); let o = obj;
    for (let i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = {}; o = o[ks[i]]; }
    o[ks[ks.length - 1]] = val;
  }
  function blockById(doc, id) { return doc.blocks.find((b) => b.id === id); }
  function originalBlock(id) { return blockById(ORIGINAL, id); }
  function blockLabel(b) {
    if (!b) return "block";
    const names = { group: "Collapsible section", h2: "Heading", h3: "Subheading", p: "Paragraph", chart: b.label || "Chart", quotebox: "Conversation excerpt", context: "Callout", table: "Table", spec: "Spec comparison", code: "Code block", cta: "Call to action", image: "Image" };
    return names[b.type] || b.type;
  }
  function prettyField(f) {
    if (!f || f === "*" || f === "html") return "";
    let m;
    if ((m = f.match(/^children\.(\d+)\.(.*)$/))) return `item ${+m[1] + 1}${prettyField(m[2]) ? " · " + prettyField(m[2]) : ""}`;
    if ((m = f.match(/^rows\.(\d+)\.(a|b|label|delta|tag)$/))) return `row ${+m[1] + 1} · ${{ a: "Veris value", b: "τ² value", label: "label", delta: "delta", tag: "tag" }[m[2]]}`;
    if ((m = f.match(/^turns\.(\d+)\.(role|html)$/))) return `turn ${+m[1] + 1}${m[2] === "role" ? " · role" : ""}`;
    if ((m = f.match(/^(left|right)\.items\.(\d+)$/))) return `${m[1] === "left" ? "τ²" : "Veris"} column · item ${+m[2] + 1}`;
    if ((m = f.match(/^(left|right)\.(\w+)$/))) return `${m[1] === "left" ? "τ²" : "Veris"} column · ${m[2]}`;
    if ((m = f.match(/^(\w+)\.(\d+)$/))) return `${m[1]} ${+m[2] + 1}`;
    return { heroImage: "hero image", title: "title", caption: "caption", legendA: "legend A", legendB: "legend B", footnote1: "footnote 1", footnote2: "footnote 2", kicker: "kicker", sub: "subtitle", button: "button label", backLink: "back link", date: "date", author: "author", logo: "logo", tagline: "tagline", copyright: "copyright" }[f] || f;
  }
  function blockSummary(b) {
    if (!b) return "";
    const t = b.type === "group" ? (b.label || "Collapsible section") : b.type === "chart" ? b.title : b.type === "quotebox" ? b.title : b.type === "table" ? (b.caption || textOf(b.html.replace(/<\/(td|th)>/g, " · ").replace(/<\/tr>/g, " / "))) : b.type === "image" ? (b.caption || b.alt || "image") : b.type === "spec" ? "τ² vs Veris fields" : b.type === "cta" ? b.title : textOf(b.html);
    return (t || "").slice(0, 70) + ((t || "").length > 70 ? "…" : "");
  }

  /* ---------------- rendering ---------------- */
  // ed(blockId, field) => attributes that make an element editable in edit mode
  const ed = (id, field) => ` data-edit="${id}" data-field="${field}"`;

  function renderNav(doc, live) {
    const m = doc.meta;
    return `<span class="logo"${live ? ed("__meta", "logo") : ""}>${m.logo}</span>
      <div class="links">${m.nav.map((n, i) => `<span${live ? ed("__meta", "nav." + i) : ""}>${n}</span>`).join("")}</div>
      <div class="right"><span class="theme">☼ ▭ ☾</span><span class="pill">▤ DOCS</span><span class="pill demo">DEMO</span></div>`;
  }
  function renderHead(doc, live) {
    const m = doc.meta;
    return `<span class="back"${live ? ed("__meta", "backLink") : ""}>${m.backLink}</span>
      <div class="post-date"${live ? ed("__meta", "date") : ""}>${m.date}</div>
      <h1 class="post-title head-target block" data-block="__title"${live ? ed("__meta", "title") : ""}>${m.title}</h1>
      <div class="post-author"${live ? ed("__meta", "author") : ""}>${m.author}</div>`;
  }
  function renderHero(doc, live) {
    return `<img src="${doc.meta.heroImage}" alt="${esc(doc.meta.heroAlt || "")}" ${live ? 'data-img="__meta" data-field="heroImage" title="Click to replace image"' : ""}>`;
  }
  function renderFooter(doc, live) {
    const f = doc.footer;
    return `<div class="inner">
      <div><div class="tagline"${live ? ed("__footer", "tagline") : ""}>${f.tagline}</div>
        ${f.buttons.map((b, i) => `<span class="fbtn ${i === 1 ? "solid" : ""}"${live ? ed("__footer", "buttons." + i) : ""}>${b}</span>`).join("")}</div>
      <div class="col"><div class="col-label">${f.partnersLabel}</div>${f.partners.map((p, i) => `<div${live ? ed("__footer", "partners." + i) : ""}>${p}</div>`).join("")}</div>
      <div class="col"><div class="col-label">${f.complianceLabel}</div>${f.compliance.map((p, i) => `<div${live ? ed("__footer", "compliance." + i) : ""}>${p}</div>`).join("")}</div>
    </div>
    <div class="bottom"><span${live ? ed("__footer", "copyright") : ""}>${f.copyright}</span><span>${f.links.map((l, i) => `<span${live ? ed("__footer", "links." + i) : ""}>${l}</span>`).join(" &nbsp;·&nbsp; ")}</span></div>`;
  }

  function renderBlock(b, live, ctx) {
    const id = ctx ? ctx.id : b.id; const P = ctx ? ctx.prefix : ""; let inner = "";
    switch (b.type) {
      case "h2": inner = `<h2${live ? ed(id, P + "html") : ""}>${b.html}</h2>`; break;
      case "h3": inner = `<h3${live ? ed(id, P + "html") : ""}>${b.html}</h3>`; break;
      case "p": inner = `<p${live ? ed(id, P + "html") : ""}>${b.html}</p>`; break;
      case "code": inner = `<pre class="codeblock"${live ? ed(id, P + "html") : ""}>${esc(b.html)}</pre>`; break;
      case "context":
        inner = `<div class="context"><div class="ctx-title"${live ? ed(id, P + "title") : ""}>${b.title}</div><div${live ? ed(id, P + "html") : ""}>${b.html}</div></div>`; break;
      case "table":
        { const cap = b.caption != null ? `<div class="caption ${b.captionBelow ? "below" : ""}"${live ? ed(id, P + "caption") : ""}>${b.caption}</div>` : "";
          inner = `<div class="tablewrap">${b.captionBelow ? "" : cap}<div${live ? ed(id, P + "html") : ""}>${b.html}</div>${b.captionBelow ? cap : ""}</div>`; } break;
      case "chart": {
        const rows = b.rows.map((r, i) => `<div class="row">
          <div class="row-head"><span><span${live ? ed(id, P + "rows." + i + ".label") : ""}>${r.label}</span>${r.tag ? `<span class="tag"${live ? ed(id, P + "rows." + i + ".tag") : ""}>${r.tag}</span>` : ""}</span><span class="delta"${live ? ed(id, P + "rows." + i + ".delta") : ""}>${r.delta}</span></div>
          <div class="bar a"><span>VERIS</span><div class="track"><div class="fill" style="width:${Math.max(0, Math.min(100, +r.a || 0))}%"></div></div><b${live ? ed(id, P + "rows." + i + ".a") : ""}>${Number(r.a).toFixed(1)}%</b></div>
          <div class="bar b"><span>τ²</span><div class="track"><div class="fill" style="width:${Math.max(0, Math.min(100, +r.b || 0))}%"></div></div><b${live ? ed(id, P + "rows." + i + ".b") : ""}>${Number(r.b).toFixed(1)}%</b></div>
        </div>`).join("");
        inner = `<div class="chart ${b.small ? "small" : ""}"><h2 class="chart-title"${live ? ed(id, P + "title") : ""}>${b.title}</h2>
          <div class="legend"><span class="a"><i></i><span${live ? ed(id, P + "legendA") : ""}>${b.legendA}</span></span><span class="b"><i></i><span${live ? ed(id, P + "legendB") : ""}>${b.legendB}</span></span></div>
          ${rows}${b.footnote1 || b.footnote2 ? `<div class="foot"><span${live ? ed(id, P + "footnote1") : ""}>${b.footnote1 || ""}</span><span${live ? ed(id, P + "footnote2") : ""}>${b.footnote2 || ""}</span></div>` : ""}</div>`;
        break;
      }
      case "quotebox":
        inner = `<div class="quotebox ${b.tone}"><div class="qb-head"><span class="kicker"${live ? ed(id, P + "kicker") : ""}>${b.kicker}</span><span class="qb-title"${live ? ed(id, P + "title") : ""}>${b.title}</span><span class="qb-sub"${live ? ed(id, P + "sub") : ""}>${b.sub || ""}</span></div>
          ${b.turns.map((t, i) => `<div class="turn"><span class="role ${t.role.toLowerCase()}"${live ? ed(id, P + "turns." + i + ".role") : ""}>${t.role}</span><div class="content"${live ? ed(id, P + "turns." + i + ".html") : ""}>${t.html}</div></div>`).join("")}
          <div class="caption"${live ? ed(id, P + "caption") : ""}>${b.caption || ""}</div></div>`; break;
      case "spec": {
        const col = (c, side) => `<div class="col ${c.tone}"><div class="kicker"${live ? ed(id, P + side + ".kicker") : ""}>${c.kicker}</div><div class="sub"${live ? ed(id, P + side + ".sub") : ""}>${c.sub}</div><span class="count"${live ? ed(id, P + side + ".count") : ""}>${c.count}</span>
          <ul>${c.items.map((it, i) => `<li${live ? ed(id, P + side + ".items." + i) : ""}>${it}</li>`).join("")}</ul></div>`;
        inner = `<div class="spec">${col(b.left, "left")}${col(b.right, "right")}</div>`; break;
      }
      case "cta":
        inner = `<div class="cta"><h2${live ? ed(id, P + "title") : ""}>${b.title}</h2><p${live ? ed(id, P + "html") : ""}>${b.html}</p><a class="btn" href="${esc(b.href)}" ${live ? 'onclick="return false"' : ""}><span${live ? ed(id, P + "button") : ""}>${b.button}</span></a></div>`; break;
      case "image":
        inner = `<figure class="imgblock"><img src="${b.src}" alt="${esc(b.alt || "")}" ${live ? `data-img="${id}" data-field="${P}src" title="Click to replace image"` : ""}><figcaption class="caption"${live ? ed(id, P + "caption") : ""}>${b.caption || ""}</figcaption></figure>`; break;
      case "group":
        inner = `<details class="group" ${b.open ? "open" : ""}><summary><span${live ? ed(id, P + "label") : ""}>${b.label || "Show more"}</span><span class="grp-hint">(always open while editing)</span></summary><div class="group-body">${(b.children || []).map((c, i) => renderBlock(c, live, { id, prefix: P + "children." + i + "." })).join("")}</div></details>`; break;
      default: inner = `<p>${b.html || ""}</p>`;
    }
    if (ctx) return `<div class="sub-block">${inner}</div>`;
    const tools = live ? `<div class="block-tools"><button class="grip" draggable="true" title="Drag to move">⠿ drag</button><button data-act="up" title="Move up">↑</button><button data-act="down" title="Move down">↓</button><button data-act="park" title="Save for later (remove from page, keep in the tray)">⤓ save for later</button><button data-act="delete" class="danger" title="Delete block">✕</button></div>` : "";
    const n = live ? commentsFor(id).filter((c) => !c.resolved).length : 0;
    const pin = live ? `<button class="comment-pin ${n ? "has" : ""}" data-pin="${id}" title="Comments">💬 ${n || ""}</button>` : "";
    const changed = live && isChanged(id) ? `<span class="changed-marker" title="Edited"></span>` : "";
    return `<div class="block" data-block="${id}">${changed}${tools}${pin}${inner}</div>`;
  }
  const insertButtons = `<button data-ins="h2">+ Title</button><button data-ins="h3">+ Subtitle</button><button data-ins="p">+ Text</button><button data-ins="image">+ Image</button>`;
  const insertBar = (idx) => `<div class="insert-bar" data-idx="${idx}"><div class="plus">${insertButtons}</div></div>`;
  function renderParked() {
    const list = state.parked || [];
    return `<div class="add-section"><span class="lab">Add a section</span>${insertButtons.replace(/data-ins/g, 'data-ins-end="1" data-ins')}</div>
      <div class="parked" id="parked"><div class="lab">Saved for later ${list.length ? `(${list.length})` : ""}</div>
      ${list.length ? list.map((b) => `<div class="parked-item" data-parked="${b.id}" draggable="true" title="Drag back into the page, or use Put back"><span class="ptype">${esc(blockLabel(b))}</span><span class="ptext">${esc(blockSummary(b)) || "(image)"}</span><span class="pbtns"><button data-restore="${b.id}">↩ Put back</button><button data-pdel="${b.id}" class="danger">Delete</button></span></div>`).join("") : `<div class="pempty">Nothing here yet. Use "save for later" on any section to park it here instead of deleting it.</div>`}</div>`;
  }

  function renderPage() {
    const doc = state.doc, live = true;
    $("#site-nav").innerHTML = renderNav(doc, live);
    $("#post-head").innerHTML = renderHead(doc, live);
    $("#hero").innerHTML = renderHero(doc, live);
    $("#post-body").innerHTML = insertBar(0) + doc.blocks.map((b, i) => renderBlock(b, live) + insertBar(i + 1)).join("") + renderParked();
    $("#site-footer").innerHTML = renderFooter(doc, live);
    applyMode();
    updateBadges();
    renderOutline();
  }

  /* ---------------- outline sidebar ---------------- */
  function renderOutline() {
    const list = $("#outline-list"); if (!list) return;
    const items = [{ id: "__title", cls: "top", text: textOf(state.doc.meta.title) }].concat(
      state.doc.blocks.flatMap((b) => b.type === "h2" || b.type === "h3" ? [{ id: b.id, cls: b.type, text: textOf(b.html) || "(untitled)" }] : b.type === "group" ? [{ id: b.id, cls: "h3", text: "▸ " + (b.label || "Collapsible section") }] : []));
    list.innerHTML = items.length > 1 ? items.map((i) => `<a class="${i.cls}" data-go="${i.id}" title="${esc(i.text)}">${esc(i.text)}</a>`).join("") : `<div class="o-empty">No headings yet.</div>`;
    $$("[data-go]", list).forEach((a) => (a.onclick = () => {
      const view = $(".view.active"); const el = view && (view.querySelector(`[data-block="${a.dataset.go}"]`) || view.querySelector(`[data-cmp="${a.dataset.go === "__title" ? "__meta" : a.dataset.go}"]`));
      if (!el) { if (view && view.id !== "view-comments") return; showView("page"); return setTimeout(() => renderOutline() || $(`#outline-list [data-go="${a.dataset.go}"]`).click(), 60); }
      const y = el.getBoundingClientRect().top + window.scrollY - 90; window.scrollTo({ top: y, behavior: "smooth" });
      document.body.classList.remove("outline-open");
    }));
    updateOutlineActive();
  }
  function updateOutlineActive() {
    const view = $(".view.active"); if (!view || view.id === "view-comments") return;
    const links = $$("#outline-list [data-go]"); if (!links.length) return;
    let current = links[0].dataset.go;
    links.forEach((a) => { const el = view.querySelector(`[data-block="${a.dataset.go}"]`); if (el && el.getBoundingClientRect().top - 100 <= 0) current = a.dataset.go; });
    links.forEach((a) => a.classList.toggle("active", a.dataset.go === current));
  }

  /* ---------------- change tracking ---------------- */
  function isChanged(id) { return state.changes.some((c) => c.blockId === id); }
  function findChange(blockId, field) { return state.changes.find((c) => c.blockId === blockId && c.field === field); }

  function recordChange({ blockId, field, kind, before, after, note }) {
    let c = findChange(blockId, field);
    const now = Date.now();
    if (c) {
      c.after = after; c.ts = now; c.author = author || c.author;
      if (note) c.notes = (c.notes || []).concat([{ note, author, ts: now }]);
      // reverting to the original removes the change entry entirely
      if (kind === "text" && JSON.stringify(c.before) === JSON.stringify(after)) state.changes = state.changes.filter((x) => x !== c);
    } else {
      state.changes.push({ id: uid(), blockId, field, kind, before, after, notes: note ? [{ note, author, ts: now }] : [], author, ts: now });
    }
  }

  /* ---------------- editing ---------------- */
  let editing = null; // {el, blockId, field, before}

  function targetObj(blockId) {
    if (blockId === "__meta") return state.doc.meta;
    if (blockId === "__footer") return state.doc.footer;
    return blockById(state.doc, blockId);
  }
  function origObj(blockId) {
    if (blockId === "__meta") return ORIGINAL.meta;
    if (blockId === "__footer") return ORIGINAL.footer;
    return originalBlock(blockId);
  }

  function beginEdit(el) {
    if (editing && editing.el !== el) commitEdit();
    editing = { el, blockId: el.dataset.edit, field: el.dataset.field, before: el.innerHTML };
  }
  function readValue(el, blockId, field) {
    let b = targetObj(blockId); let f = field;
    const m = f.match(/^((?:children\.\d+\.)+)(.*)$/); if (m && b) { b = getPath(b, m[1].slice(0, -1)); f = m[2]; }
    if (b && b.type === "code") return el.textContent;
    if (b && b.type === "chart" && /^rows\.\d+\.[ab]$/.test(f)) return parseFloat(el.textContent.replace(/[^\d.]/g, "")) || 0;
    // sanitize a little: strip scripts/handlers
    const d = document.createElement("div"); d.innerHTML = el.innerHTML;
    $$("script,style,iframe", d).forEach((n) => n.remove());
    $$("*", d).forEach((n) => Array.from(n.attributes).forEach((a) => { if (/^on/i.test(a.name)) n.removeAttribute(a.name); }));
    // remove editing attrs that may have been copied
    $$("[data-edit],[contenteditable]", d).forEach((n) => { n.removeAttribute("data-edit"); n.removeAttribute("data-field"); n.removeAttribute("contenteditable"); });
    return d.innerHTML.trim();
  }

  function commitEdit() {
    if (!editing) return;
    const { el, blockId, field, before } = editing; editing = null;
    if (!document.body.contains(el)) return;
    if (el.innerHTML === before) return;
    const obj = targetObj(blockId); if (!obj) return;
    const newVal = readValue(el, blockId, field);
    const oldVal = getPath(obj, field);
    if (String(newVal) === String(oldVal)) return;
    const o = origObj(blockId); const origVal = o ? getPath(o, field) : undefined;
    openModal(`
      <h3>Save this change?</h3>
      <div class="hint">${esc(blockLabel(obj))}${prettyField(field) ? " · " + esc(prettyField(field)) : ""}</div>
      <div class="snippet">${diffHtml(textOf(String(oldVal)), textOf(String(newVal)))}</div>
      <label>Why this change? <span style="color:var(--muted)">(shows in the Compare tab)</span></label>
      <textarea id="m-note" placeholder="e.g. Updated the number after the re-run; softened the claim; fixed typo…"></textarea>
      <div class="row"><button id="m-discard">Discard</button><button class="primary" id="m-save">Save change</button></div>`);
    $("#m-note").focus();
    $("#m-save").onclick = () => {
      setPath(obj, field, newVal);
      const kind = /src|Image/.test(field) ? "image" : "text";
      recordChange({ blockId, field, kind, before: origVal !== undefined ? origVal : oldVal, after: newVal, note: $("#m-note").value.trim() });
      closeModal(); save(); renderPage();
    };
    $("#m-discard").onclick = () => { closeModal(); renderPage(); };
  }

  // ---- images
  function pickImage(blockId, field) {
    const obj = targetObj(blockId); const cur = getPath(obj, field);
    openModal(`
      <h3>Replace image</h3>
      <div class="hint">Paste an image URL, or upload a file (stored inside the page data; keep uploads small, ~1 MB max).</div>
      <div class="snippet"><img src="${esc(cur)}" style="max-height:120px;max-width:100%"></div>
      <input type="url" id="m-url" placeholder="https://…/image.png" value="${/^data:/.test(cur) ? "" : esc(cur)}">
      <button id="m-upload">Upload from computer…</button>
      <input type="text" id="m-alt" placeholder="Alt text (describe the image)" value="${esc(obj.alt || obj.heroAlt || "")}">
      <label>Why this change? <span style="color:var(--muted)">(optional)</span></label>
      <textarea id="m-note"></textarea>
      <div class="row"><button id="m-cancel">Cancel</button><button class="primary" id="m-save">Save image</button></div>`);
    let dataUrl = null;
    $("#m-upload").onclick = () => { const f = $("#file-image"); f.value = ""; f.onchange = () => {
      const file = f.files[0]; if (!file) return;
      const preview = (src) => { dataUrl = src; $("#m-url").value = ""; $(".snippet img", $("#modal-body")).src = src; };
      if (uploader) {
        setStatus("uploading image…");
        uploader(file).then((url) => { preview(url); setStatus("image uploaded"); }).catch((e) => {
          if (file.size > 150e3) { alert("Upload failed (" + (e && e.message ? e.message : e) + "). Paste an image URL instead, or keep uploads under 150 KB."); return; }
          const r = new FileReader(); r.onload = () => preview(r.result); r.readAsDataURL(file);
        });
        return;
      }
      if (file.size > 1.5e6 && !confirm("This image is larger than 1.5 MB and will make the page data heavy. Continue?")) return;
      const r = new FileReader(); r.onload = () => preview(r.result); r.readAsDataURL(file);
    }; f.click(); };
    $("#m-cancel").onclick = closeModal;
    $("#m-save").onclick = () => {
      const src = dataUrl || $("#m-url").value.trim(); if (!src) return;
      const o = origObj(blockId); const origVal = o ? getPath(o, field) : cur;
      setPath(obj, field, src);
      const altField = blockId === "__meta" ? "heroAlt" : "alt"; obj[altField] = $("#m-alt").value.trim();
      recordChange({ blockId, field, kind: "image", before: origVal, after: src, note: $("#m-note").value.trim() });
      closeModal(); save(); renderPage();
    };
  }

  // ---- add / delete / move blocks
  function addBlock(idx, type) {
    const id = type + "-" + uid();
    const b = type === "image" ? { id, type, src: "", alt: "", caption: "Caption" } : type === "h2" ? { id, type, html: "New title" } : type === "h3" ? { id, type, html: "New subtitle" } : { id, type: "p", html: "New text — click to edit." };
    state.doc.blocks.splice(idx, 0, b);
    recordChange({ blockId: id, field: "*", kind: "add", before: null, after: b, note: "" });
    save(); renderPage();
    if (type === "image") pickImage(id, "src");
    else { const el = $(`[data-block="${id}"] [data-edit]`); if (el) { el.focus(); document.execCommand && document.execCommand("selectAll", false, null); } }
  }
  function deleteBlock(id) {
    const b = blockById(state.doc, id); if (!b) return;
    openModal(`<h3>Delete this ${esc(blockLabel(b).toLowerCase())}?</h3><div class="snippet">${esc(blockSummary(b))}</div>
      <label>Why? <span style="color:var(--muted)">(optional)</span></label><textarea id="m-note"></textarea>
      <div class="row"><button id="m-cancel">Cancel</button><button class="danger" id="m-del">Delete</button></div>`);
    $("#m-cancel").onclick = closeModal;
    $("#m-del").onclick = () => {
      state.doc.blocks = state.doc.blocks.filter((x) => x.id !== id);
      const wasAdded = state.changes.find((c) => c.blockId === id && c.kind === "add");
      state.changes = state.changes.filter((c) => c.blockId !== id);
      if (!wasAdded) recordChange({ blockId: id, field: "*", kind: "delete", before: originalBlock(id) || b, after: null, note: $("#m-note").value.trim() });
      closeModal(); save(); renderPage();
    };
  }
  function parkBlock(id) {
    const b = blockById(state.doc, id); if (!b) return;
    state.parked = state.parked || [];
    state.doc.blocks = state.doc.blocks.filter((x) => x.id !== id);
    state.parked.push(b);
    const wasAdded = state.changes.find((c) => c.blockId === id && c.kind === "add");
    state.changes = state.changes.filter((c) => !(c.blockId === id && (c.kind === "move" || c.kind === "park")));
    if (!wasAdded) recordChange({ blockId: id, field: "*", kind: "park", before: originalBlock(id) || b, after: null, note: "" });
    save(); renderPage();
    const tray = $("#parked"); if (tray) { tray.scrollIntoView({ block: "center" }); tray.classList.add("flash"); setTimeout(() => tray.classList.remove("flash"), 1200); }
  }
  function restoreBlock(id, atIdx) {
    const i = (state.parked || []).findIndex((b) => b.id === id); if (i < 0) return;
    const [b] = state.parked.splice(i, 1);
    // back to its original place when possible, otherwise the end
    let idx = atIdx;
    if (idx == null) { const oi = ORIGINAL_IDS.indexOf(id); idx = state.doc.blocks.length; if (oi >= 0) { const after = ORIGINAL_IDS.slice(0, oi).reverse().find((x) => state.doc.blocks.some((k) => k.id === x)); idx = after ? state.doc.blocks.findIndex((k) => k.id === after) + 1 : 0; } }
    state.doc.blocks.splice(idx, 0, b);
    state.changes = state.changes.filter((c) => !(c.blockId === id && c.kind === "park"));
    save(); renderPage();
    const el = $(`[data-block="${id}"]`); if (el) el.scrollIntoView({ block: "center" });
  }
  function deleteParked(id) {
    const b = (state.parked || []).find((x) => x.id === id); if (!b) return;
    if (!confirm("Delete this saved section for good?")) return;
    state.parked = state.parked.filter((x) => x.id !== id);
    state.changes = state.changes.filter((c) => !(c.blockId === id && c.kind === "park"));
    if (originalBlock(id)) recordChange({ blockId: id, field: "*", kind: "delete", before: originalBlock(id), after: null, note: "" });
    save(); renderPage();
  }
  function moveBlock(id, dir) {
    const i = state.doc.blocks.findIndex((b) => b.id === id);
    moveBlockTo(id, i + dir);
  }
  function moveBlockTo(id, j) {
    const i = state.doc.blocks.findIndex((b) => b.id === id);
    if (i < 0 || j < 0 || j >= state.doc.blocks.length || i === j) return;
    const [b] = state.doc.blocks.splice(i, 1); state.doc.blocks.splice(j, 0, b);
    const origIdx = ORIGINAL.blocks.findIndex((x) => x.id === id);
    const existing = findChange(id, "position");
    if (origIdx === j) { state.changes = state.changes.filter((c) => !(c.blockId === id && c.field === "position")); }
    else if (existing) { existing.after = j; existing.ts = Date.now(); }
    else state.changes.push({ id: uid(), blockId: id, field: "position", kind: "move", before: origIdx, after: j, notes: [], author, ts: Date.now() });
    save(); renderPage();
    const el = $(`[data-block="${id}"]`); if (el) el.scrollIntoView({ block: "center" });
  }

  /* ---------------- comments ---------------- */
  function commentsFor(blockId) { return state.comments.filter((c) => (c.blockId || null) === (blockId || null) && !c.parent); }
  function addComment(blockId, text, parent) {
    if (!text.trim()) return;
    state.comments.push({ id: uid(), blockId: blockId || null, parent: parent || null, author: author || "Anonymous", text: text.trim(), ts: Date.now(), resolved: false });
    save();
  }
  function anchorText(blockId) {
    if (!blockId) return "General";
    if (blockId === "__title") return "Title";
    return blockLabel(blockById(state.doc, blockId)) + " · " + blockSummary(blockById(state.doc, blockId));
  }
  function openThread(blockId) {
    const render = () => {
      const roots = commentsFor(blockId);
      const items = roots.map((c) => {
        const replies = state.comments.filter((r) => r.parent === c.id);
        return `<div class="c ${c.resolved ? "resolved" : ""}"><div class="who"><span>${esc(c.author)} · ${fmtTime(c.ts)}</span><span><button data-reply="${c.id}">Reply</button> <button data-resolve="${c.id}">${c.resolved ? "Reopen" : "Resolve"}</button> <button data-delc="${c.id}">Delete</button></span></div><div class="body">${esc(c.text)}</div>
          ${replies.map((r) => `<div class="c reply"><div class="who"><span>${esc(r.author)} · ${fmtTime(r.ts)}</span><button data-delc="${r.id}">Delete</button></div><div class="body">${esc(r.text)}</div></div>`).join("")}</div>`;
      }).join("") || `<div class="empty">No comments here yet.</div>`;
      openModal(`<h3>Comments</h3><div class="hint">${esc(anchorText(blockId))}</div>
        ${blockId && blockId !== "__title" ? `<div class="snippet">${esc(blockSummary(blockById(state.doc, blockId)))}</div>` : ""}
        <textarea id="m-text" placeholder="Write a comment…"></textarea>
        <div class="row"><button id="m-close">Close</button><button class="primary" id="m-post">Post</button></div>
        <div class="thread">${items}</div>`);
      $("#m-close").onclick = closeModal;
      $("#m-post").onclick = () => { addComment(blockId, $("#m-text").value); render(); $("#m-text").focus(); };
      $("#m-text").focus();
      $$("[data-reply]", $("#modal-body")).forEach((b) => (b.onclick = () => { const t = prompt("Reply:"); if (t) { addComment(blockId, t, b.dataset.reply); render(); } }));
      $$("[data-resolve]", $("#modal-body")).forEach((b) => (b.onclick = () => { const c = state.comments.find((x) => x.id === b.dataset.resolve); c.resolved = !c.resolved; save(); render(); }));
      $$("[data-delc]", $("#modal-body")).forEach((b) => (b.onclick = () => { if (!confirm("Delete this comment?")) return; state.comments = state.comments.filter((x) => x.id !== b.dataset.delc && x.parent !== b.dataset.delc); save(); render(); }));
    };
    render();
    // refresh pins when closed
    const backdrop = $("#modal"); const obs = new MutationObserver(() => { if (!backdrop.classList.contains("open")) { obs.disconnect(); renderPage(); } }); obs.observe(backdrop, { attributes: true });
  }

  function renderCommentsView() {
    const list = $("#comment-list");
    const roots = state.comments.filter((c) => !c.parent).filter((c) => commentFilter === "all" || (commentFilter === "resolved" ? c.resolved : !c.resolved)).sort((a, b) => b.ts - a.ts);
    if (!roots.length) { list.innerHTML = `<div class="empty">No ${commentFilter === "all" ? "" : commentFilter} comments yet. Use <b>Comment</b> mode on the Page tab to pin a comment to any paragraph, table or image.</div>`; return; }
    list.innerHTML = roots.map((c) => {
      const replies = state.comments.filter((r) => r.parent === c.id);
      const b = c.blockId && c.blockId !== "__title" ? blockById(state.doc, c.blockId) : null;
      return `<div class="thread-card ${c.resolved ? "resolved" : ""}"><div class="anchor"><span>${esc(anchorText(c.blockId).split(" · ")[0])}</span>${c.blockId ? `<a data-jump="${c.blockId}">Jump to it ↗</a>` : ""}</div>
        ${b ? `<div class="quote">${esc(blockSummary(b))}</div>` : c.blockId === "__title" ? `<div class="quote">${esc(textOf(state.doc.meta.title))}</div>` : ""}
        <div class="c"><div class="who">${esc(c.author)} · ${fmtTime(c.ts)}</div><div class="body">${esc(c.text)}</div></div>
        ${replies.map((r) => `<div class="c reply"><div class="who">${esc(r.author)} · ${fmtTime(r.ts)}</div><div class="body">${esc(r.text)}</div></div>`).join("")}
        <div class="actions"><button data-reply="${c.id}">Reply</button><button data-resolve="${c.id}">${c.resolved ? "Reopen" : "Resolve"}</button><button data-delc="${c.id}">Delete</button></div></div>`;
    }).join("");
    $$("[data-jump]", list).forEach((a) => (a.onclick = () => jumpTo(a.dataset.jump)));
    $$("[data-reply]", list).forEach((b) => (b.onclick = () => { const c = state.comments.find((x) => x.id === b.dataset.reply); const t = prompt("Reply:"); if (t) { addComment(c.blockId, t, c.id); renderCommentsView(); } }));
    $$("[data-resolve]", list).forEach((b) => (b.onclick = () => { const c = state.comments.find((x) => x.id === b.dataset.resolve); c.resolved = !c.resolved; save(); renderCommentsView(); }));
    $$("[data-delc]", list).forEach((b) => (b.onclick = () => { if (!confirm("Delete this comment thread?")) return; state.comments = state.comments.filter((x) => x.id !== b.dataset.delc && x.parent !== b.dataset.delc); save(); renderCommentsView(); }));
  }

  /* ---------------- diff + compare ---------------- */
  function wordDiff(a, b) {
    const A = a.split(/(\s+)/).filter(Boolean), B = b.split(/(\s+)/).filter(Boolean);
    const n = A.length, m = B.length;
    if (n * m > 4e6) return [["-", a], ["+", b]]; // too big — show whole
    const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const out = []; let i = 0, j = 0;
    const push = (t, s) => { const last = out[out.length - 1]; if (last && last[0] === t) last[1] += s; else out.push([t, s]); };
    while (i < n && j < m) { if (A[i] === B[j]) { push("=", A[i]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) { push("-", A[i]); i++; } else { push("+", B[j]); j++; } }
    while (i < n) push("-", A[i++]); while (j < m) push("+", B[j++]);
    return out;
  }
  function diffHtml(a, b) {
    return wordDiff(a, b).map(([t, s]) => t === "=" ? esc(s) : t === "-" ? `<del>${esc(s)}</del>` : `<ins>${esc(s)}</ins>`).join("");
  }
  function snippetAround(diffParts, side) {
    // keep changed parts with ~8 words of context on each side, ellipsize the rest
    const keep = side === "before" ? ["=", "-"] : ["=", "+"];
    const parts = diffParts.filter(([t]) => keep.includes(t));
    let html = "";
    parts.forEach(([t, s], idx) => {
      if (t !== "=") { html += t === "-" ? `<del>${esc(s)}</del>` : `<ins>${esc(s)}</ins>`; return; }
      const words = s.split(/(\s+)/).filter(Boolean);
      const first = idx === 0, last = idx === parts.length - 1, ctx = 16; // tokens (words+spaces)
      if (words.length <= ctx * 2 + 2) { html += esc(s); return; }
      if (first) html += "… " + esc(words.slice(-ctx).join(""));
      else if (last) html += esc(words.slice(0, ctx).join("")) + " …";
      else html += esc(words.slice(0, ctx).join("")) + " … " + esc(words.slice(-ctx).join(""));
    });
    return html || "<i>(empty)</i>";
  }
  function autoSummary(c) {
    if (c.kind === "add") return `Added a new ${blockLabel(c.after).toLowerCase()}.`;
    if (c.kind === "delete") return `Removed a ${blockLabel(c.before).toLowerCase()}.`;
    if (c.kind === "park") return `Saved a ${blockLabel(c.before).toLowerCase()} for later (it is in the tray at the bottom of the Page tab).`;
    if (c.kind === "move") return `Moved from position ${c.before + 1} to ${c.after + 1}.`;
    if (c.kind === "image") return `Image replaced.`;
    const a = textOf(String(c.before)), b = textOf(String(c.after));
    if (typeof c.after === "number" || (/^[\d.+\-%]+$/.test(a) && /^[\d.+\-%]+$/.test(b))) return `Value changed ${a} → ${b}.`;
    const d = wordDiff(a, b); const rem = d.filter(([t]) => t === "-").reduce((n, [, s]) => n + s.split(/\s+/).filter(Boolean).length, 0);
    const add = d.filter(([t]) => t === "+").reduce((n, [, s]) => n + s.split(/\s+/).filter(Boolean).length, 0);
    const wa = a.split(/\s+/).filter(Boolean).length, wb = b.split(/\s+/).filter(Boolean).length;
    const pct = wa ? Math.round((100 * Math.max(rem, add)) / wa) : 100;
    const scale = pct < 15 ? "Minor wording tweak" : pct < 50 ? "Partial rewrite" : "Substantial rewrite";
    return `${scale}: −${rem} / +${add} words (${wa} → ${wb}).`;
  }

  function changeCardHtml(c) {
    const cur = targetObj(c.blockId); const label = c.blockId === "__meta" ? "Page header" : c.blockId === "__footer" ? "Footer" : blockLabel(cur || c.before || c.after);
    const notes = (c.notes || []).length ? c.notes.map((n) => `<div class="why"><b>Why:</b> ${esc(n.note)} <span style="color:var(--muted);font-size:12px">— ${esc(n.author || "Anonymous")}</span></div>`).join("") : `<div class="why none">No reason was typed for this change.</div>`;
    let snips = "";
    if (c.kind === "image") snips = `<div class="snips"><div class="snip"><div class="lab">Before</div><img src="${esc(c.before || "")}"></div><div class="snip"><div class="lab">After</div><img src="${esc(c.after || "")}"></div></div>`;
    else if (c.kind === "add") snips = `<div class="snips"><div class="snip"><div class="lab">Before</div><i>(nothing)</i></div><div class="snip"><div class="lab">After</div><ins>${esc(blockSummary(c.after))}</ins></div></div>`;
    else if (c.kind === "delete" || c.kind === "park") snips = `<div class="snips"><div class="snip"><div class="lab">Before</div><del>${esc(blockSummary(c.before))}</del></div><div class="snip"><div class="lab">After</div><i>(${c.kind === "park" ? "saved for later" : "removed"})</i></div></div>`;
    else if (c.kind === "move") snips = "";
    else { const d = wordDiff(textOf(String(c.before)), textOf(String(c.after))); snips = `<div class="snips"><div class="snip"><div class="lab">Before</div>${snippetAround(d, "before")}</div><div class="snip"><div class="lab">After</div>${snippetAround(d, "after")}</div></div>`; }
    return `<div class="change-card"><div class="ch-head"><span><span class="kind">${esc(c.kind)}</span>${esc(label)}${prettyField(c.field) ? ` · ${esc(prettyField(c.field))}` : ""}</span><span>${esc(c.author || "Anonymous")} · ${fmtTime(c.ts)}</span></div>${notes}${snips}<div class="auto">${esc(autoSummary(c))}</div></div>`;
  }
  function openChangeInfo(blockId) {
    const list = state.changes.filter((c) => c.blockId === blockId).sort((a, b) => a.ts - b.ts);
    const obj = targetObj(blockId); const label = blockId === "__meta" ? "Page header" : blockId === "__footer" ? "Footer" : blockLabel(obj);
    $("#modal-body").classList.add("wide"); openModal(`<h3>${esc(label)}</h3><div class="hint">${list.length ? list.length + (list.length === 1 ? " change" : " changes") + " to this section" : "This section is unchanged from the original."}</div>
      ${list.map(changeCardHtml).join("")}
      <div class="row"><button id="m-close">Close</button></div>`);
    $("#m-close").onclick = closeModal;
  }

  function renderCompare() {
    const ch = state.changes.slice().sort((a, b) => a.ts - b.ts);
    const deleted = ch.filter((c) => c.kind === "delete" || c.kind === "park");
    const stats = [
      [ch.filter((c) => c.kind === "text" || c.kind === "image").length, "edits"],
      [ch.filter((c) => c.kind === "add").length, "added"],
      [ch.filter((c) => c.kind === "delete").length, "removed"],
      [ch.filter((c) => c.kind === "park").length, "saved for later"],
      [ch.filter((c) => c.kind === "move").length, "moved"],
      [ch.filter((c) => (c.notes || []).length).length, "with a reason"]
    ];
    $("#compare-stats").innerHTML = stats.map(([n, l]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join("");
    const changed = new Set(ch.map((c) => c.blockId));
    const origIds = new Set(ORIGINAL_IDS);
    const mark = (html, id, cls) => html.replace('class="block"', `class="block cmp ${cls}" data-cmp="${id}" title="Click to see why this changed"`);
    let body = state.doc.blocks.map((b) => {
      const h = renderBlock(b, false);
      if (!origIds.has(b.id)) return mark(h, b.id, "added");
      if (changed.has(b.id)) return mark(h, b.id, "diff");
      return h;
    }).join("");
    // removed blocks are shown faintly where they used to be
    deleted.forEach((c) => {
      const i = ORIGINAL_IDS.indexOf(c.blockId); const nextId = ORIGINAL_IDS.slice(i + 1).find((id) => state.doc.blocks.some((b) => b.id === id));
      const ghost = mark(renderBlock(c.before, false), c.blockId, c.kind === "park" ? "removed park" : "removed");
      if (nextId && body.includes(`data-block="${nextId}"`)) body = body.replace(`<div class="block" data-block="${nextId}"`, ghost + `<div class="block" data-block="${nextId}"`).replace(`<div class="block cmp diff" data-cmp="${nextId}"`, ghost + `<div class="block cmp diff" data-cmp="${nextId}"`).replace(`<div class="block cmp added" data-cmp="${nextId}"`, ghost + `<div class="block cmp added" data-cmp="${nextId}"`);
      else body += ghost;
    });
    const headCls = changed.has("__meta") ? "cmp diff" : "";
    $("#cmp-page").innerHTML = `<div class="wrap post-head ${headCls}" data-cmp="__meta">${renderHead(state.doc, false)}</div><div class="hero ${headCls}" data-cmp="__meta">${renderHero(state.doc, false)}</div><div class="post-body">${body}</div>` +
      (changed.has("__footer") ? `<div class="site-footer cmp diff" data-cmp="__footer">${renderFooter(state.doc, false)}</div>` : "");
    $("#cmp-page").onclick = (e) => { const t = e.target.closest("[data-cmp]"); if (t) openChangeInfo(t.dataset.cmp); };
    $("#cmp-legend").hidden = !ch.length;
    renderOutline();
    $("#cmp-empty").hidden = !!ch.length;
  }

  /* ---------------- views / modes ---------------- */
  function showView(v) {
    commitEdit();
    $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === v));
    $$(".view").forEach((s) => s.classList.toggle("active", s.id === "view-" + v));
    if (v === "comments") renderCommentsView();
    if (v === "compare") renderCompare();
    window.scrollTo(0, 0);
  }
  function jumpTo(blockId) {
    showView("page");
    const el = $(`[data-block="${blockId}"]`); if (!el) return;
    setTimeout(() => { el.scrollIntoView({ block: "center" }); el.style.transition = "background .3s"; el.style.background = "#fff3bf"; setTimeout(() => (el.style.background = ""), 1600); }, 50);
  }
  function passcodeOk() {
    const want = (window.SITE_CONFIG || {}).editPasscode; if (!want) return true;
    if (ls.get(STORAGE_KEY + ":pass") === want) return true;
    const got = prompt("This page is protected. Enter the edit passcode:"); if (got === want) { ls.set(STORAGE_KEY + ":pass", got); return true; }
    if (got !== null) alert("Wrong passcode."); return false;
  }
  function setMode(m) {
    if (m !== "view" && mode !== m && !passcodeOk()) return;
    commitEdit();
    mode = mode === m ? "view" : m;
    applyMode();
  }
  function applyMode() {
    document.body.classList.toggle("editing", mode === "edit");
    document.body.classList.toggle("commenting", mode === "comment");
    $("#btn-edit").classList.toggle("on", mode === "edit");
    $("#btn-comment").classList.toggle("on", mode === "comment");
    $("#mode-hint").textContent = mode === "edit" ? "EDIT MODE — click any text to edit it, click an image to replace it, hover between blocks to add one. Click away to save." : mode === "comment" ? "COMMENT MODE — click any paragraph, table, chart or image to open its comment thread." : "";
    $$("[data-edit]").forEach((el) => { el.contentEditable = mode === "edit" ? "true" : "false"; el.spellcheck = false; });
    $$("#view-page details.group").forEach((d) => { const b = blockById(state.doc, d.closest("[data-block]").dataset.block); d.open = mode === "edit" ? true : !!(b && b.open); });
  }
  function updateBadges() {
    const nc = state.comments.filter((c) => !c.parent && !c.resolved).length, nch = state.changes.length;
    const b1 = $("#badge-comments"), b2 = $("#badge-changes");
    b1.textContent = nc; b1.hidden = !nc; b2.textContent = nch; b2.hidden = !nch;
  }

  /* ---------------- modal ---------------- */
  function openModal(html) { $("#modal-body").innerHTML = html; $("#modal").classList.add("open"); }
  function closeModal() { $("#modal").classList.remove("open"); $("#modal-body").innerHTML = ""; $("#modal-body").classList.remove("wide"); if (pendingRender && !editing && !syncing) { pendingRender = false; setTimeout(remoteChanged, 0); } }

  /* ---------------- export / import / reset ---------------- */
  function exportJSON() {
    const json = JSON.stringify(state, null, 2);
    if (window.claude && typeof window.claude.use === "function") {
      window.claude.use("downloads").then((dl) => {
        if (!dl) { setStatus("downloads aren't available in this viewer", true); return; }
        return dl.save({ filename: "edits.json", data: json }).then(() => setStatus("exported edits.json")).catch((e) => setStatus("export cancelled", true));
      });
      return;
    }
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "edits.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setStatus("exported edits.json");
  }
  function importJSON(file) {
    const r = new FileReader(); r.onload = () => { try { const j = JSON.parse(r.result); if (!j.doc) throw 0; state = j; state.changes = state.changes || []; state.comments = state.comments || []; save(); renderPage(); showView("page"); } catch (e) { alert("That file is not a valid edits.json"); } }; r.readAsText(file);
  }
  function resetAll() {
    if (!confirm(db ? "Reset the page to the original FOR EVERYONE? All shared edits, change notes and comments will be deleted." : "Discard ALL local edits and comments in this browser and go back to the original page?")) return;
    ls.remove(STORAGE_KEY); state = { doc: clone(ORIGINAL), changes: [], comments: [], parked: [] }; renderPage(); showView("page"); save(); setStatus("reset to original");
  }

  /* ---------------- events ---------------- */
  function wire() {
    $$(".tab").forEach((t) => (t.onclick = () => showView(t.dataset.view)));
    $("#btn-edit").onclick = () => setMode("edit");
    if (ls.get(STORAGE_KEY + ":outline") === "hidden") document.body.classList.add("outline-hidden");
    $("#outline-toggle").onclick = () => { document.body.classList.add("outline-hidden"); document.body.classList.remove("outline-open"); ls.set(STORAGE_KEY + ":outline", "hidden"); };
    $("#outline-show").onclick = () => { document.body.classList.remove("outline-hidden"); document.body.classList.add("outline-open"); ls.set(STORAGE_KEY + ":outline", "shown"); renderOutline(); };
    let spyT = null; window.addEventListener("scroll", () => { if (spyT) return; spyT = setTimeout(() => { spyT = null; updateOutlineActive(); }, 120); }, { passive: true });
    $("#btn-comment").onclick = () => setMode("comment");
    $("#btn-export").onclick = exportJSON;
    $("#btn-import").onclick = () => { const f = $("#file-import"); f.value = ""; f.onchange = () => f.files[0] && importJSON(f.files[0]); f.click(); };
    $("#btn-reset").onclick = resetAll;
    const au = $("#author"); au.value = author; au.oninput = () => { author = au.value.trim(); ls.set(STORAGE_KEY + ":author", author); };
    $("#modal").addEventListener("click", (e) => { if (e.target === e.currentTarget) closeModal(); });
    $$(".filters button").forEach((b) => (b.onclick = () => { commentFilter = b.dataset.filter; $$(".filters button").forEach((x) => x.classList.toggle("active", x === b)); renderCommentsView(); }));
    $("#btn-general-comment").onclick = () => { const t = $("#general-comment"); addComment(null, t.value); t.value = ""; renderCommentsView(); };

    const page = $("#view-page");
    page.addEventListener("focusin", (e) => { if (mode === "edit" && e.target.dataset && e.target.dataset.edit) beginEdit(e.target); });
    page.addEventListener("focusout", (e) => { if (editing && e.target === editing.el) setTimeout(() => { if (editing && editing.el === e.target && !$("#modal").classList.contains("open")) commitEdit(); }, 10); });
    page.addEventListener("keydown", (e) => {
      if (!editing) return;
      if (e.key === "Escape") { editing.el.innerHTML = editing.before; editing = null; e.target.blur(); }
      if (e.key === "Enter" && !e.shiftKey && /^(H1|H2|H3|SPAN|B|FIGCAPTION)$/.test(e.target.tagName)) { e.preventDefault(); e.target.blur(); }
    });
    page.addEventListener("paste", (e) => { if (!editing) return; e.preventDefault(); document.execCommand("insertText", false, (e.clipboardData || window.clipboardData).getData("text")); });
    page.addEventListener("click", (e) => {
      const t = e.target;
      if (mode === "edit") {
        if (t.closest("summary")) e.preventDefault();
        if (t.dataset && t.dataset.img) { e.preventDefault(); pickImage(t.dataset.img, t.dataset.field); return; }
        const act = t.closest("[data-act]"); if (act) { const id = act.closest(".block").dataset.block; if (act.dataset.act === "delete") deleteBlock(id); else if (act.dataset.act === "park") parkBlock(id); else moveBlock(id, act.dataset.act === "up" ? -1 : 1); return; }
        const ins = t.closest("[data-ins]"); if (ins) { addBlock(ins.dataset.insEnd ? state.doc.blocks.length : +ins.closest(".insert-bar").dataset.idx, ins.dataset.ins); return; }
        const rs = t.closest("[data-restore]"); if (rs) { restoreBlock(rs.dataset.restore); return; }
        const pd = t.closest("[data-pdel]"); if (pd) { deleteParked(pd.dataset.pdel); return; }
        if (t.closest("a") && !t.dataset.edit) e.preventDefault();
      }
      if (mode === "comment") {
        if (t.closest("a")) e.preventDefault();
        const blk = t.closest("[data-block]"); if (blk) { openThread(blk.dataset.block); return; }
      }
      const pin = t.closest("[data-pin]"); if (pin) { e.stopPropagation(); openThread(pin.dataset.pin); }
    });
    // drag & drop reordering (edit mode): drag the ⠿ handle onto another block
    let dragId = null, dragParked = false;
    page.addEventListener("dragstart", (e) => {
      const grip = e.target.closest && e.target.closest(".grip, .parked-item");
      if (!grip || mode !== "edit") { e.preventDefault(); return; }
      dragParked = grip.classList.contains("parked-item");
      dragId = dragParked ? grip.dataset.parked : grip.closest(".block").dataset.block;
      e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", dragId); } catch (x) {}
      const blk = dragParked ? grip : grip.closest(".block"); blk.classList.add("dragging");
      if (!dragParked) e.dataTransfer.setDragImage(blk, 20, 20);
    });
    page.addEventListener("dragover", (e) => {
      if (!dragId) return; const blk = e.target.closest && e.target.closest(".block, .insert-bar"); if (!blk) return;
      e.preventDefault(); e.dataTransfer.dropEffect = "move";
      $$(".drop-before, .drop-after").forEach((x) => x.classList.remove("drop-before", "drop-after"));
      if (blk.classList.contains("insert-bar")) { blk.classList.add("drop-after"); return; }
      const r = blk.getBoundingClientRect(); blk.classList.add(e.clientY < r.top + r.height / 2 ? "drop-before" : "drop-after");
    });
    page.addEventListener("dragleave", (e) => { const blk = e.target.closest && e.target.closest(".block, .insert-bar"); if (blk && !blk.contains(e.relatedTarget)) blk.classList.remove("drop-before", "drop-after"); });
    page.addEventListener("drop", (e) => {
      if (!dragId) return; e.preventDefault();
      const blk = e.target.closest(".block, .insert-bar"); const id = dragId, fromParked = dragParked; dragId = null;
      $$(".dragging").forEach((x) => x.classList.remove("dragging"));
      if (!blk) return;
      let idx;
      if (blk.classList.contains("insert-bar")) idx = +blk.dataset.idx;
      else { const r = blk.getBoundingClientRect(); const ti = state.doc.blocks.findIndex((b) => b.id === blk.dataset.block); if (ti < 0) return; idx = e.clientY < r.top + r.height / 2 ? ti : ti + 1; }
      if (fromParked) { restoreBlock(id, idx); return; }
      const from = state.doc.blocks.findIndex((b) => b.id === id); if (from < 0) return;
      if (idx > from) idx -= 1;
      moveBlockTo(id, idx);
    });
    page.addEventListener("dragend", () => { dragId = null; $$(".dragging, .drop-before, .drop-after").forEach((x) => x.classList.remove("dragging", "drop-before", "drop-after")); });
    document.addEventListener("keydown", (e) => {
      if (e.target.isContentEditable || /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (e.key === "Escape" && $("#modal").classList.contains("open")) closeModal();
      if (e.key.toLowerCase() === "e" && !e.metaKey && !e.ctrlKey) { showView("page"); setMode("edit"); }
      if (e.key.toLowerCase() === "c" && !e.metaKey && !e.ctrlKey) { showView("page"); setMode("comment"); }
    });
  }

  /* ---------------- boot ---------------- */
  load().then((src) => { wire(); renderPage(); setStatus({ shared: "live · shared with everyone" + (backend === "supabase" ? " (supabase)" : ""), local: "local edits loaded", published: "published edits loaded", original: "original" }[src]); document.body.classList.toggle("shared", !!db); });
})();
