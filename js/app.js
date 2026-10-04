"use strict";
const $ = id => document.getElementById(id);
const norm = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const esc = s => s.replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};

const ROUTES = [
  {id: "zinnen",   tab: "Zinnen", ico: "💬", name: "Vertalingen", sub: "Zinnen in het Catalaans en Spaans"},
  {id: "tapas",    tab: "Tapas", ico: "🍤", name: "Tapas",       sub: "Zoek, filter en toon aan de ober"},
  {id: "bezoeken", tab: "Bezoeken", ico: "📍", name: "Te bezoeken", sub: "Kaart en lijst met plaatsen"},
  {id: "fietsen",  tab: "Fietsen", ico: "🚲", name: "Fietsroutes", sub: "Stops kiezen en openen in Maps"}
];

/* ---------- data ---------- */
const data = {};
async function load(name) {
  if (!data[name]) {
    const r = await fetch("data/" + name + ".json");
    data[name] = await r.json();
  }
  return data[name];
}

/* ---------- "toon aan de ober" overlay ---------- */
let showCtx = null;
function openShow(ctx) {
  showCtx = ctx;
  $("sHint").textContent = ctx.hint;
  $("sBig").textContent = ctx.big;
  $("sEs").textContent = ctx.es;
  $("sNl").textContent = ctx.nl;
  $("sTags").innerHTML = ctx.tags || "";
  $("sPhoto").hidden = !ctx.photo; $("sPhoto").src = ctx.photo ? ctx.photo.file : "";
  $("sCredit").hidden = !ctx.photo; $("sCredit").textContent = ctx.photo ? "Foto: " + ctx.photo.credit : "";
  $("sFav").hidden = !ctx.fav;
  updFav();
  $("show").hidden = false;
  $("sClose").focus();
}
function updFav() {
  if (showCtx && showCtx.fav) $("sFav").textContent = showCtx.fav.has() ? "★ Van mijn lijstje halen" : "☆ Op mijn lijstje";
}
function closeShow() {
  $("show").hidden = true;
  const c = showCtx; showCtx = null;
  if (c && c.onClose) c.onClose();
}
$("sClose").addEventListener("click", closeShow);
$("sFav").addEventListener("click", () => { showCtx.fav.toggle(); updFav(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("show").hidden) closeShow(); });

/* ---------- tab bar ---------- */
function renderTabs(cur) {
  $("tabs").innerHTML =
    `<a href="#/" ${cur === "" ? 'aria-current="page"' : ""}><span>🏠</span>Start</a>` +
    ROUTES.map(r => `<a href="#/${r.id}" ${cur === r.id ? 'aria-current="page"' : ""}><span>${r.ico}</span>${r.tab}</a>`).join("");
}

/* ---------- views ---------- */
const app = $("app");

function viewHome() {
  app.innerHTML = `
    <header><h1>Barcelona <span>reisgids</span></h1>
    <p class="sub">Alles werkt ook zonder internet.</p></header>
    <div class="home">${ROUTES.map(r => `
      <a class="tile${r.soon ? " soon" : ""}" href="#/${r.id}">
        <span class="ico">${r.ico}</span>
        <span><b>${r.name}</b><small>${r.soon ? "Komt binnenkort" : r.sub}</small></span>
      </a>`).join("")}</div>`;
}

function viewSoon(id) {
  const r = ROUTES.find(x => x.id === id);
  app.innerHTML = `<header><h1>${r.name}</h1><p class="sub">${r.sub}</p></header>
    <div class="soonbox">Dit onderdeel wordt in de volgende stap gebouwd.</div>`;
}

/* tapas */
const SYM = {f: "−", m: "+", c: "*", x: "++"}, ORDER = "fmcx";
const KIND = {f: "vis", m: "vlees", c: "kaas", x: "gefrituurd"};
const tapasState = {q: "", active: new Set()};
let favs = new Set(store.get("tapesFav", []));
const saveFavs = () => store.set("tapesFav", [...favs]);

function prepTapas(rows) {
  return rows.map((r, i) => {
    const tags = r.tags.split(/\s+/).filter(Boolean).map(t => ({k: t[0], soms: t.endsWith("?")}));
    return {id: i, ca: r.ca, es: r.es, nl: r.nl, tags,
      has: k => tags.some(t => t.k === k), hay: norm(r.ca + " " + r.es + " " + r.nl)};
  });
}
function tagHTML(d) {
  const t = [...d.tags].sort((a, b) => ORDER.indexOf(a.k) - ORDER.indexOf(b.k));
  if (!t.length) return '<b class="t v" title="Zonder vis, vlees, kaas">veg</b>';
  return t.map(x => `<b class="t ${x.k}${x.soms ? " soms" : ""}" title="${x.soms ? "soms " : ""}${KIND[x.k]}">${SYM[x.k]}</b>`).join("");
}
const CLASH = {onlyFish: ["noFish", "onlyMeat", "veg"], onlyMeat: ["noMeat", "onlyFish", "veg"],
  noFish: ["onlyFish"], noMeat: ["onlyMeat"], veg: ["onlyFish", "onlyMeat"]};
const FILTERS = [["noFish", "Geen vis"], ["noMeat", "Geen vlees"], ["veg", "Vegetarisch"], ["noFried", "Niet gefrituurd"],
  ["noCheese", "Geen kaas"], ["onlyFish", "Alleen vis"], ["onlyMeat", "Alleen vlees"], ["fav", "★ Mijn lijstje"]];

async function viewTapas() {
  const D = prepTapas(await load("tapas"));
  const PH = await load("tapas-photos").catch(() => ({}));
  const st = tapasState;
  app.innerHTML = `
    <header><h1>Tapes de <span>Barcelona</span></h1>
    <p class="sub">Zoek in het Catalaans, Spaans of Nederlands. Tik op een tapa om ze groot aan de ober te tonen.</p></header>
    <div class="bar">
      <label class="search" for="q"><span aria-hidden="true">⌕</span>
        <input id="q" type="search" placeholder="bv. pop, gambas, kroket…" autocomplete="off" enterkeyhint="search">
        <button id="clear" type="button" aria-label="Zoekveld leegmaken" hidden>×</button></label>
      <div class="chips" role="group" aria-label="Filters">
        ${FILTERS.map(f => `<button class="chip" data-f="${f[0]}" aria-pressed="false">${f[1]}</button>`).join("")}
      </div>
    </div>
    <div class="legend">
      <span><b class="t f">−</b> vis / waterdieren</span><span><b class="t m">+</b> vlees</span>
      <span><b class="t c">*</b> kaas</span><span><b class="t x">++</b> gefrituurd</span>
      <span><b class="t f soms">−</b> soms</span>
    </div>
    <div class="count" id="count"></div>
    <ul id="list"></ul>
    <p class="empty" id="empty" hidden>Niets gevonden. Probeer een ander woord of zet een filter uit.</p>
    <p class="note">Gestippelde labels betekenen "soms": het hangt van de bar af. Vraag bij twijfel: <i>Porta peix / carn / formatge?</i> (Catalaans) of <i>¿Lleva pescado / carne / queso?</i> (Spaans). Slakken staan bij vis/waterdieren. Je ★-lijstje wordt alleen op dit toestel bewaard.</p>`;
  const q = $("q"), list = $("list");
  q.value = st.q;

  function pass(d) {
    const s = norm(q.value), a = st.active;
    if (s && !s.split(/\s+/).every(w => d.hay.includes(w))) return false;
    if (a.has("noFish") && d.has("f")) return false;
    if (a.has("noMeat") && d.has("m")) return false;
    if (a.has("noCheese") && d.has("c")) return false;
    if (a.has("noFried") && d.has("x")) return false;
    if (a.has("veg") && (d.has("f") || d.has("m"))) return false;
    if (a.has("onlyFish") && !d.has("f")) return false;
    if (a.has("onlyMeat") && !d.has("m")) return false;
    if (a.has("fav") && !favs.has(d.ca)) return false;
    return true;
  }
  function render() {
    st.q = q.value;
    const rows = D.filter(pass);
    list.innerHTML = rows.map(d => `<li><button class="item${favs.has(d.ca) ? " fav" : ""}${PH[d.ca] ? " hasph" : ""}" data-id="${d.id}">
      ${PH[d.ca] ? `<img class="tthumb" src="${esc(PH[d.ca].file)}" alt="" loading="lazy" width="64" height="64">` : ""}<span class="cat">${esc(d.ca)}</span>
      <span class="tags">${tagHTML(d)}<span class="star" aria-label="${favs.has(d.ca) ? "op mijn lijstje" : ""}">★</span></span>
      <span class="es">${esc(d.es)}</span><span class="nl">${esc(d.nl)}</span></button></li>`).join("");
    $("count").textContent = `${rows.length} van ${D.length} tapes`;
    $("empty").hidden = rows.length > 0;
    $("clear").hidden = !q.value;
    document.querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", st.active.has(x.dataset.f)));
  }
  q.addEventListener("input", render);
  $("clear").addEventListener("click", () => { q.value = ""; render(); q.focus(); });
  document.querySelectorAll(".chip").forEach(c => c.addEventListener("click", () => {
    const f = c.dataset.f, on = !st.active.has(f);
    if (on) (CLASH[f] || []).forEach(o => st.active.delete(o));
    on ? st.active.add(f) : st.active.delete(f);
    render();
  }));
  list.addEventListener("click", e => {
    const b = e.target.closest(".item"); if (!b) return;
    const d = D[+b.dataset.id];
    openShow({hint: "Toon dit aan de ober", photo: PH[d.ca], big: d.ca, es: d.es, nl: d.nl, tags: tagHTML(d),
      fav: {has: () => favs.has(d.ca), toggle: () => { favs.has(d.ca) ? favs.delete(d.ca) : favs.add(d.ca); saveFavs(); }},
      onClose: render});
  });
  render();
}

/* vertalingen */
const GROUPS = [["all", "Alles"], ["groet", "Groeten"], ["feest", "Receptie"], ["bar", "Bar"], ["eten", "Eten"], ["weg", "Stad"],
  ["museum", "Museum"], ["fiets", "Fiets"], ["nood", "Nood"]];
const phraseState = {q: "", g: "all"};

async function viewZinnen() {
  const P = (await load("phrases")).map((p, i) => ({...p, id: i, hay: norm(p.ca + " " + p.es + " " + p.nl)}));
  const st = phraseState;
  app.innerHTML = `
    <header><h1>Zinnen <span>CA · ES</span></h1>
    <p class="sub">Op volgorde van gebruik. Tik op een zin om ze groot te tonen.</p></header>
    <div class="bar">
      <label class="search" for="q"><span aria-hidden="true">⌕</span>
        <input id="q" type="search" placeholder="bv. rekening, toilet, gracias…" autocomplete="off" enterkeyhint="search">
        <button id="clear" type="button" aria-label="Zoekveld leegmaken" hidden>×</button></label>
      <div class="chips" role="group" aria-label="Onderwerp">
        ${GROUPS.map(g => `<button class="chip" data-g="${g[0]}" aria-pressed="false">${g[1]}</button>`).join("")}
      </div>
    </div>
    <div class="count" id="count"></div>
    <ul id="list"></ul>
    <p class="empty" id="empty" hidden>Niets gevonden.</p>
    <p class="note">Catalaans is in Barcelona de eerste taal, maar iedereen verstaat Spaans. Een Catalaanse groet wordt gewaardeerd.</p>`;
  const q = $("q"), list = $("list");
  q.value = st.q;
  function render() {
    st.q = q.value;
    const s = norm(q.value);
    const rows = P.filter(p => (st.g === "all" || p.g === st.g) && (!s || s.split(/\s+/).every(w => p.hay.includes(w))));
    list.innerHTML = rows.map(p => `<li><button class="item phrase" data-id="${p.id}">
      <span class="cat">${esc(p.ca)}</span><span class="es">${esc(p.es)}</span><span class="nl">${esc(p.nl)}</span></button></li>`).join("");
    $("count").textContent = `${rows.length} zinnen`;
    $("empty").hidden = rows.length > 0;
    $("clear").hidden = !q.value;
    document.querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", x.dataset.g === st.g));
  }
  q.addEventListener("input", render);
  $("clear").addEventListener("click", () => { q.value = ""; render(); q.focus(); });
  document.querySelectorAll(".chip").forEach(c => c.addEventListener("click", () => { st.g = c.dataset.g; render(); }));
  list.addEventListener("click", e => {
    const b = e.target.closest(".item"); if (!b) return;
    const p = P[+b.dataset.id];
    openShow({hint: "Toon dit aan de ander", big: p.ca, es: p.es, nl: p.nl});
  });
  render();
}

/* ---------- router ---------- */
async function route() {
  if (typeof leavePlaces === "function") leavePlaces();
  if (typeof leaveBike === "function") leaveBike();
  if (!$("show").hidden) { $("show").hidden = true; showCtx = null; }
  const id = location.hash.replace(/^#\/?/, "");
  renderTabs(id);
  window.scrollTo(0, 0);
  try {
    if (id === "tapas") await viewTapas();
    else if (id === "zinnen") await viewZinnen();
    else if (id === "bezoeken") await viewPlaces();
    else if (id === "fietsen") await viewBike();
    else viewHome();
  } catch (e) {
    app.innerHTML = '<p class="empty">Kon de gegevens niet laden. Open de app één keer met internet.</p>';
  }
}
window.addEventListener("hashchange", route);
window.addEventListener("load", route);

/* ---------- service worker + update melding ---------- */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").then(reg => {
    const offer = w => {
      $("update").hidden = false;
      $("reload").onclick = () => w.postMessage("SKIP_WAITING");
    };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener("updatefound", () => {
      const w = reg.installing;
      w.addEventListener("statechange", () => {
        if (w.state === "installed" && navigator.serviceWorker.controller) offer(w);
      });
    });
  }).catch(() => {});
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return; reloading = true; location.reload();
  });
}
