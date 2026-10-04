"use strict";
/* Kiespagina voor gast: lijst + kaart, keuzes in localStorage, bericht naar Bart via WhatsApp. */
const $ = id => document.getElementById(id);
const norm = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
const CATS = {
  gebouw: ["Gebouwen", "#b45309"], museum: ["Musea", "#7c3aed"], park: ["Parken", "#15803d"],
  markt: ["Markten", "#c2410c"], uitzicht: ["Uitzicht", "#0e7490"], straat: ["Straat/plein", "#475569"],
  fiets: ["Fiets", "#1d4ed8"], overig: ["Overig", "#6b7280"]
};
const catName = c => (CATS[c] || CATS.overig)[0];
const catColor = c => (CATS[c] || CATS.overig)[1];

const st = {places: [], byId: {}, sel: new Set(store.get("gastKies", store.get("mdKies", []))), q: "", cat: "", district: "", only: false, onlyNew: false, view: "lijst",
  map: null, markers: {}, open: null};

const NEWTAG = '<em class="newtag">NIEUW</em> ';
const BTN_ON = "✓ Wil ik langs fietsen", BTN_OFF = "Wil ik langs fietsen";
const rows = () => {
  const s = norm(st.q);
  return st.places.filter(p => (!st.cat || p.cat === st.cat) && (!st.district || p.district === st.district) &&
    (!st.only || st.sel.has(p.id)) && (!st.onlyNew || p.new) && (!s || s.split(/\s+/).every(w => p.hay.includes(w))));
};
const save = () => store.set("gastKies", [...st.sel]);
const chosen = () => st.places.filter(p => st.sel.has(p.id));

function toast(t) {
  const el = $("toast"); el.textContent = t; el.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 2200);
}

function buildMessage() {
  const c = chosen();
  const head = c.length ? `Hoi Bart! Dit wil ik langs fietsen (${c.length}):` : "Hoi Bart! Ik heb (nog) niets gekozen.";
  const lines = c.map(p => "- " + p.name).join("\n");
  return head + (lines ? "\n" + lines : "") + "\n\nCode (plak die in je app bij Importeer van gast):\n" + GASTC.encode(c.map(p => p.id));
}

function updateFoot() {
  const n = st.sel.size;
  $("cnt").textContent = n === 1 ? "1 gekozen" : n + " gekozen";
  $("msg").textContent = buildMessage();
}

function setBtn(b, on) { b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); b.textContent = on ? BTN_ON : BTN_OFF; }

function toggle(id) {
  st.sel.has(id) ? st.sel.delete(id) : st.sel.add(id);
  save();
  const on = st.sel.has(id);
  document.querySelectorAll(`[data-t="${id}"]`).forEach(b => setBtn(b, on));
  paintMarker(id);
  updateFoot();
  if (st.only && !on) renderList();
}

function renderList() {
  const r = rows();
  $("pcount").textContent = `${r.length} van ${st.places.length} plaatsen`;
  $("list").innerHTML = r.map(p => {
    const on = st.sel.has(p.id);
    return `<li class="card${on ? " sel" : ""}"><div class="ph">${p.photo ? `<button type="button" class="phb" data-zoom="${p.id}" aria-label="Foto van ${esc(p.name)} groter"><img src="${esc(p.photo)}" alt="" loading="lazy" width="96" height="96"></button>` : `<span class="noph" style="background:${catColor(p.cat)}"></span>`}</div>
      <div class="tx"><b>${esc(p.name)}</b><small>${p.new ? NEWTAG : ""}${esc(catName(p.cat))}${p.district ? " · " + esc(p.district) : ""}</small>
      <p>${esc(p.desc || "")}</p>
      <button type="button" class="tg${on ? " on" : ""}" data-t="${p.id}" aria-pressed="${on}">${on ? BTN_ON : BTN_OFF}</button></div></li>`;
  }).join("") || `<li class="empty">Niets gevonden. Wis het zoekveld of een filter.</li>`;
}

/* ---------- kaart ---------- */
function dotHtml(p) {
  const on = st.sel.has(p.id);
  return `<div class="dot${on ? " on" : ""}${p.new ? " isnew" : ""}" style="background:${on ? "#1d4ed8" : catColor(p.cat)}">${on ? "🚲" : ""}</div>`;
}
function paintMarker(id) {
  const m = st.markers[id]; if (!m) return;
  const p = st.byId[id], on = st.sel.has(id);
  m.setIcon(L.divIcon({className: "pinwrap", iconSize: [34, 34], iconAnchor: [17, 17], html: dotHtml(p)}));
  m.setZIndexOffset(on ? 500 : 0);
  if (st.open === id) renderMSheet();
}
function buildMap() {
  const map = st.map = L.map("map", {zoomControl: true}).setView([41.3935, 2.1686], 13);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom: 19, attribution: "© OpenStreetMap"}).addTo(map);
  for (const p of st.places) {
    st.markers[p.id] = L.marker([p.lat, p.lng], {icon: L.divIcon({className: "pinwrap", iconSize: [34, 34], iconAnchor: [17, 17], html: dotHtml(p)}),
      keyboard: false, title: p.name, zIndexOffset: st.sel.has(p.id) ? 500 : 0})
      .on("click", e => { L.DomEvent.stopPropagation(e); st.open = p.id; renderMSheet(); }).addTo(map);
  }
  map.on("click", () => { st.open = null; renderMSheet(); });
}
function refreshMap() {
  if (!st.map) buildMap();
  const show = new Set(rows().map(p => p.id)), pts = [];
  for (const p of st.places) {
    const m = st.markers[p.id], on = show.has(p.id);
    if (on && !st.map.hasLayer(m)) m.addTo(st.map);
    if (!on && st.map.hasLayer(m)) m.remove();
    if (on) pts.push([p.lat, p.lng]);
  }
  st.map.invalidateSize();
  if (pts.length > 1) st.map.fitBounds(pts, {padding: [24, 24], maxZoom: 15});
  else if (pts.length === 1) st.map.setView(pts[0], 15);
  if (st.open && !show.has(st.open)) st.open = null;
  renderMSheet();
}
function renderMSheet() {
  const el = $("msheet"), p = st.byId[st.open];
  if (!p) { el.innerHTML = `<p class="hint">Tik op een bol voor foto en uitleg. Blauwe bol met fiets = jouw keuze. Kleine afstand tussen bollen betekent dicht bij elkaar.</p>`; return; }
  const on = st.sel.has(p.id);
  el.innerHTML = `<div class="card in">${p.photo ? `<div class="ph"><button type="button" class="phb" data-zoom="${p.id}" aria-label="Foto groter"><img src="${esc(p.photo)}" alt="" width="96" height="96"></button></div>` : ""}
    <div class="tx"><b>${esc(p.name)}</b><small>${p.new ? NEWTAG : ""}${esc(catName(p.cat))}${p.district ? " · " + esc(p.district) : ""}</small><p>${esc(p.desc || "")}</p>
    <button type="button" class="tg${on ? " on" : ""}" data-t="${p.id}" aria-pressed="${on}">${on ? BTN_ON : BTN_OFF}</button></div></div>`;
}

/* ---------- weergave en filters ---------- */
function refresh() {
  document.querySelectorAll(".seg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === st.view));
  document.querySelectorAll("#cats [data-c]").forEach(b => b.setAttribute("aria-pressed", b.dataset.c === st.cat));
  $("onlysel").setAttribute("aria-pressed", st.only);
  $("onlynew").setAttribute("aria-pressed", st.onlyNew);
  $("list").hidden = st.view !== "lijst";
  $("mapview").hidden = st.view !== "kaart";
  $("credit").hidden = st.view !== "lijst";
  $("pcount").textContent = "";
  if (st.view === "lijst") renderList(); else { $("pcount").textContent = `${rows().length} van ${st.places.length} plaatsen`; refreshMap(); }
}

function zoom(id) {
  const p = st.byId[id]; if (!p || !p.photo) return;
  $("lbimg").src = p.photo; $("lbimg").alt = p.name;
  $("lbcap").innerHTML = `<b>${esc(p.name)}</b>${p.credit ? `<br><small>Foto: ${esc(p.credit)}</small>` : ""}`;
  $("lb").hidden = false;
}

async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch (e) {}
  try {
    const ta = document.createElement("textarea"); ta.value = t; ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(ta); ta.focus(); ta.select(); ta.setSelectionRange(0, t.length);
    const ok = document.execCommand("copy"); ta.remove(); return ok;
  } catch (e) { return false; }
}

function bind() {
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-t]"); if (t) { toggle(t.dataset.t); return; }
    const z = e.target.closest("[data-zoom]"); if (z) zoom(z.dataset.zoom);
  });
  $("lb").onclick = () => { $("lb").hidden = true; $("lbimg").src = ""; };
  document.addEventListener("keydown", e => { if (e.key === "Escape") $("lb").hidden = true; });
  document.querySelectorAll(".seg button").forEach(b => b.onclick = () => { st.view = b.dataset.v; refresh(); });
  $("q").oninput = e => { st.q = e.target.value; refresh(); };
  $("dist").onchange = e => { st.district = e.target.value; refresh(); };
  $("onlysel").onclick = () => { st.only = !st.only; refresh(); };
  $("onlynew").onclick = () => { st.onlyNew = !st.onlyNew; refresh(); };
  document.querySelectorAll("#cats [data-c]").forEach(b => b.onclick = () => { st.cat = st.cat === b.dataset.c ? "" : b.dataset.c; refresh(); });
  $("send").onclick = () => {
    if (!st.sel.size) { toast("Kies eerst minstens één plaats"); return; }
    location.href = "https://wa.me/?text=" + encodeURIComponent(buildMessage());
  };
  $("copy").onclick = async () => {
    if (!st.sel.size) { toast("Kies eerst minstens één plaats"); return; }
    toast(await copyText(buildMessage()) ? "Gekopieerd. Plak het in WhatsApp." : "Kopiëren lukt niet. Houd het bericht ingedrukt bij Bekijk bericht.");
  };
}

async function start() {
  try {
    const all = await (await fetch("data/places.json")).json();
    st.places = all.filter(p => p.list === "bcn").map(p => ({...p, hay: norm(p.name + " " + (p.district || "") + " " + (p.desc || "") + " " + catName(p.cat))}))
      .sort((a, b) => a.name.localeCompare(b.name, "nl"));
  } catch (e) {
    $("list").innerHTML = `<li class="empty">De lijst kon niet laden. Controleer je internet en probeer opnieuw.</li>`; return;
  }
  st.byId = Object.fromEntries(st.places.map(p => [p.id, p]));
  st.sel = new Set([...st.sel].filter(id => st.byId[id]));
  const used = new Set(st.places.map(p => p.cat));
  $("cats").innerHTML = Object.keys(CATS).filter(c => used.has(c)).map(c => `<button type="button" class="chip" data-c="${c}" aria-pressed="false">${CATS[c][0]}</button>`).join("");
  const ds = [...new Set(st.places.map(p => p.district).filter(Boolean))].sort((a, b) => a.localeCompare(b, "nl"));
  $("dist").insertAdjacentHTML("beforeend", ds.map(d => `<option>${esc(d)}</option>`).join(""));
  $("onlynew").hidden = !st.places.some(p => p.new);
  bind(); updateFoot(); refresh();
}
start();
