"use strict";
/* Te bezoeken: kaart + lijst op basis van data/places.json */

const ICONS = {
  gebouw:   '<path d="M3 10l9-6 9 6M5 10v9M9 10v9M15 10v9M19 10v9M3 21h18"/>',
  museum:   '<rect x="4" y="5" width="16" height="14" rx="1.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4 4 3 3-2 4 3"/>',
  park:     '<path d="M12 21v-6"/><path d="M12 3c4 0 6 3 6 6s-2 6-6 6-6-3-6-6 2-6 6-6z"/>',
  markt:    '<path d="M3 9l2-5h14l2 5M3 9h18M5 9v11h14V9M9 20v-6h6v6"/>',
  uitzicht: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  straat:   '<path d="M12 3v18"/><path d="M5 6h10l3 3-3 3H5z"/>',
  overig:   '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5l-5.4 3 1.2-6L3.3 9.3l6.1-.7z"/>',
  fiets:    '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-8h5l3 8M10 8H8M13 12H8.5"/>',
  bar:      '<path d="M4 4h16l-8 9zM12 13v7M8 20h8"/>',
  shop:     '<path d="M6 8h12l1 12H5zM9 8a3 3 0 016 0"/>'
};
const CATS = {
  gebouw: ["Gebouwen", "#b45309"], museum: ["Musea", "#7c3aed"], park: ["Parken", "#15803d"],
  markt: ["Markten", "#c2410c"], uitzicht: ["Uitzicht", "#0e7490"], straat: ["Straat/plein", "#475569"],
  fiets: ["Fiets", "#1d4ed8"], overig: ["Overig", "#6b7280"], bar: ["Bars", "#be185d"], shop: ["Shops", "#0f766e"]
};
const LISTS = [["all", "Alles"], ["bcn", "Te zien"], ["bar", "Bars"], ["shop", "Shops"]];
const svg = (cat, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[cat] || ICONS.overig}</svg>`;

const pl = {
  all: null, view: "kaart", list: "all", cat: "", fav: false, todo: false, q: "", district: "",
  sortNear: false, pos: null,
  favs: new Set(store.get("bcnFav", [])), seen: new Set(store.get("bcnSeen", [])),
  map: null, markers: {}, me: null, sel: null
};
const savePl = () => { store.set("bcnFav", [...pl.favs]); store.set("bcnSeen", [...pl.seen]); };
const dirUrl = (p, mode) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=${mode}`;
function distKm(a, b) {
  const R = 6371, rad = x => x * Math.PI / 180, dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const fmtDist = km => km < 1 ? Math.round(km * 10) * 100 + " m" : km.toFixed(1).replace(".", ",") + " km";

function placePass(p) {
  if (pl.list !== "all" && p.list !== pl.list) return false;
  if (pl.cat && p.cat !== pl.cat) return false;
  if (pl.fav && !pl.favs.has(p.id)) return false;
  if (pl.todo && pl.seen.has(p.id)) return false;
  if (pl.district && p.district !== pl.district) return false;
  const s = norm(pl.q);
  if (s && !s.split(/\s+/).every(w => p.hay.includes(w))) return false;
  return true;
}

async function viewPlaces() {
  if (!pl.all) {
    pl.all = (await load("places")).map(p => ({...p, hay: norm(p.name + " " + (p.district || "") + " " + (p.desc || "") + " " + (CATS[p.cat] ? CATS[p.cat][0] : ""))}));
  }
  document.body.classList.add("full");
  app.classList.add("full");
  const districts = [...new Set(pl.all.map(p => p.district).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  app.innerHTML = `
    <div class="pbar">
      <div class="seg" role="tablist"><button data-v="kaart">Kaart</button><button data-v="lijst">Lijst</button></div>
      <div class="chips" id="lchips">${LISTS.map(l => `<button class="chip" data-l="${l[0]}" aria-pressed="false">${l[1]}</button>`).join("")}
        <button class="chip" data-x="fav" aria-pressed="false">★ Lijstje</button>
        <button class="chip" data-x="todo" aria-pressed="false">Nog te doen</button></div>
      <div class="chips" id="cchips">${Object.keys(CATS).filter(c => c !== "bar" && c !== "shop").map(c => `<button class="chip cat-${c}" data-c="${c}" aria-pressed="false">${CATS[c][0]}</button>`).join("")}</div>
      <div class="lonly" id="lonly">
        <label class="search" for="pq"><span aria-hidden="true">⌕</span>
          <input id="pq" type="search" placeholder="Zoek een plaats of wijk…" autocomplete="off"><button id="pclear" type="button" aria-label="Zoekveld leegmaken" hidden>×</button></label>
        <div class="row2"><select id="dist" aria-label="Wijk"><option value="">Alle wijken</option>${districts.map(d => `<option>${esc(d)}</option>`).join("")}</select>
        <button class="chip" id="near" aria-pressed="false">Dichtstbij</button></div>
      </div>
    </div>
    <div class="mapwrap" id="mapwrap"><div id="map"></div>
      <button class="fab" id="locate" type="button" aria-label="Mijn locatie">⌖</button></div>
    <div class="plist" id="plist" hidden><div class="count" id="pcount"></div><ul id="pul"></ul></div>
    <div class="sheet" id="sheet" hidden></div>`;
  buildMap();
  bindPlaces();
  refreshPlaces(true);
}

function buildMap() {
  pl.markers = {};
  const map = pl.map = L.map("map", {zoomControl: false, attributionControl: true}).setView([41.3935, 2.1686], 13);
  L.control.zoom({position: "topright"}).addTo(map);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom: 19, attribution: "© OpenStreetMap"}).addTo(map);
  for (const p of pl.all) {
    const m = L.marker([p.lat, p.lng], {
      icon: L.divIcon({className: "pinwrap", iconSize: [38, 38], iconAnchor: [19, 19],
        html: `<div class="pin" style="background:${CATS[p.cat][1]}">${svg(p.cat)}<i class="pinstar">★</i><i class="pinseen">✓</i></div>`}),
      keyboard: false, title: p.name
    });
    m.on("click", () => openSheet(p.id));
    pl.markers[p.id] = m;
  }
  map.on("click", closeSheet);
  const zc = () => $("map").classList.toggle("zsmall", map.getZoom() <= 13);
  map.on("zoomend", zc); zc();
  setTimeout(() => map.invalidateSize(), 50);
}

function bindPlaces() {
  document.querySelectorAll(".seg button").forEach(b => b.onclick = () => { pl.view = b.dataset.v; refreshPlaces(); });
  document.querySelectorAll("#lchips [data-l]").forEach(b => b.onclick = () => { pl.list = b.dataset.l; if (pl.list === "bar" || pl.list === "shop") pl.cat = ""; refreshPlaces(); });
  document.querySelectorAll("#lchips [data-x]").forEach(b => b.onclick = () => { const k = b.dataset.x; pl[k] = !pl[k]; refreshPlaces(); });
  document.querySelectorAll("#cchips [data-c]").forEach(b => b.onclick = () => { pl.cat = pl.cat === b.dataset.c ? "" : b.dataset.c; if (pl.cat && pl.list !== "bcn") pl.list = "bcn"; refreshPlaces(); });
  const q = $("pq"); q.value = pl.q;
  q.oninput = () => { pl.q = q.value; refreshPlaces(); };
  $("pclear").onclick = () => { pl.q = ""; q.value = ""; refreshPlaces(); };
  $("dist").value = pl.district; $("dist").onchange = e => { pl.district = e.target.value; refreshPlaces(); };
  $("near").onclick = () => { if (pl.sortNear) { pl.sortNear = false; refreshPlaces(); } else locate(true); };
  $("locate").onclick = () => locate(false);
  $("pul").onclick = e => {
    const star = e.target.closest("[data-star]");
    if (star) { toggleFav(star.dataset.star); refreshPlaces(); return; }
    const b = e.target.closest("[data-id]"); if (b) openSheet(b.dataset.id);
  };
}

function locate(forSort) {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(pos => {
    pl.pos = {lat: pos.coords.latitude, lng: pos.coords.longitude};
    if (pl.me) pl.me.remove();
    if (pl.map) {
      pl.me = L.circleMarker([pl.pos.lat, pl.pos.lng], {radius: 8, color: "#fff", weight: 3, fillColor: "#1d4ed8", fillOpacity: 1}).addTo(pl.map);
      if (!forSort) pl.map.setView([pl.pos.lat, pl.pos.lng], Math.max(pl.map.getZoom(), 15));
    }
    if (forSort) pl.sortNear = true;
    refreshPlaces();
  }, () => { alert("Locatie niet beschikbaar. Zet de locatie van je gsm aan en geef toestemming."); }, {enableHighAccuracy: true, timeout: 10000});
}

function toggleFav(id) { pl.favs.has(id) ? pl.favs.delete(id) : pl.favs.add(id); savePl(); }
function toggleSeen(id) { pl.seen.has(id) ? pl.seen.delete(id) : pl.seen.add(id); savePl(); }

function refreshPlaces(fit) {
  const rows = pl.all.filter(placePass);
  const shown = new Set(rows.map(r => r.id));
  document.querySelectorAll(".seg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === pl.view));
  document.querySelectorAll("#lchips [data-l]").forEach(b => b.setAttribute("aria-pressed", b.dataset.l === pl.list));
  document.querySelectorAll("#lchips [data-x]").forEach(b => b.setAttribute("aria-pressed", !!pl[b.dataset.x]));
  document.querySelectorAll("#cchips [data-c]").forEach(b => b.setAttribute("aria-pressed", b.dataset.c === pl.cat));
  $("near").setAttribute("aria-pressed", pl.sortNear);
  $("cchips").hidden = pl.list !== "bcn";
  $("lonly").hidden = pl.view !== "lijst";
  $("mapwrap").hidden = pl.view !== "kaart";
  $("plist").hidden = pl.view !== "lijst";
  $("pclear").hidden = !pl.q;

  for (const p of pl.all) {
    const m = pl.markers[p.id], on = shown.has(p.id);
    if (on && !pl.map.hasLayer(m)) m.addTo(pl.map);
    if (!on && pl.map.hasLayer(m)) m.remove();
    const el = m.getElement && m.getElement();
    if (el) { el.classList.toggle("isfav", pl.favs.has(p.id)); el.classList.toggle("isseen", pl.seen.has(p.id)); }
  }
  if (pl.view === "kaart") {
    setTimeout(() => pl.map.invalidateSize(), 30);
    if (fit && rows.length === pl.all.length) pl.map.setView([41.3935, 2.1686], 13);
  } else {
    let r = rows.slice();
    if (pl.sortNear && pl.pos) { r.forEach(p => p._d = distKm(pl.pos, p)); r.sort((a, b) => a._d - b._d); }
    else r.sort((a, b) => a.name.localeCompare(b.name, "nl"));
    $("pcount").textContent = `${r.length} van ${pl.all.length} plaatsen`;
    $("pul").innerHTML = r.map(p => `<li><div class="item prow${pl.favs.has(p.id) ? " fav" : ""}${pl.seen.has(p.id) ? " seen" : ""}">
      <button class="pmain" data-id="${p.id}"><span class="dot" style="background:${CATS[p.cat][1]}">${svg(p.cat, 16)}</span>
        <span class="ptxt"><b>${esc(p.name)}</b><small>${esc(CATS[p.cat][0])}${p.district ? " · " + esc(p.district) : ""}${pl.sortNear && pl.pos ? " · " + fmtDist(p._d) : ""}</small></span></button>
      <button class="pstar" data-star="${p.id}" aria-label="${pl.favs.has(p.id) ? "Van lijstje halen" : "Op lijstje zetten"}">★</button></div></li>`).join("");
  }
  if (pl.sel) renderSheet();
}

/* kaartje onderaan */
function openSheet(id) {
  pl.sel = id; renderSheet();
  const p = pl.all.find(x => x.id === id);
  if (pl.view === "kaart" && pl.map) {
    // pin in het zichtbare deel boven het kaartje houden
    const h = ($("sheet").offsetHeight || 0) / 2, z = pl.map.getZoom();
    pl.map.panTo(pl.map.unproject(pl.map.project([p.lat, p.lng], z).add([0, h]), z), {animate: true});
  }
}
function closeSheet() { pl.sel = null; const s = $("sheet"); if (s) s.hidden = true; }
function renderSheet() {
  const p = pl.all.find(x => x.id === pl.sel); const s = $("sheet");
  if (!p || !s) return;
  const fav = pl.favs.has(p.id), seen = pl.seen.has(p.id);
  s.innerHTML = `
    ${p.photo ? `<img class="sphoto" src="${esc(p.photo)}" alt="${esc(p.name)}" loading="lazy">` : ""}
    <div class="sbody">
      <button class="sx" id="sx" type="button" aria-label="Sluiten">×</button>
      <div class="sh"><span class="dot" style="background:${CATS[p.cat][1]}">${svg(p.cat, 18)}</span>
        <div><h2>${esc(p.name)}</h2><small>${esc(CATS[p.cat][0])}${p.district ? " · " + esc(p.district) : ""}</small></div></div>
      ${p.desc ? `<p class="sdesc">${esc(p.desc)}</p>` : ""}
      ${p.address ? `<p class="saddr">📍 ${esc(p.address)}</p>` : ""}
      <div class="sbtn">
        <a class="btn primary" href="${dirUrl(p, "transit")}" target="_blank" rel="noopener">Route met OV</a>
        <a class="btn" href="${dirUrl(p, "walking")}" target="_blank" rel="noopener">Te voet</a>
        <a class="btn" href="${dirUrl(p, "bicycling")}" target="_blank" rel="noopener">Fiets</a>
        <a class="btn" href="${esc(p.maps)}" target="_blank" rel="noopener">Open in Maps</a>
        <button class="btn${fav ? " on" : ""}" id="sfav" type="button">${fav ? "★ Op lijstje" : "☆ Op lijstje"}</button>
        <button class="btn${seen ? " on" : ""}" id="sseen" type="button">${seen ? "✓ Bezocht" : "Bezocht?"}</button>
      </div>
      ${p.credit ? `<p class="scredit">Foto: ${esc(p.credit)}</p>` : ""}
    </div>`;
  s.hidden = false;
  $("sx").onclick = closeSheet;
  $("sfav").onclick = () => { toggleFav(p.id); refreshPlaces(); };
  $("sseen").onclick = () => { toggleSeen(p.id); refreshPlaces(); };
}

/* opruimen bij het verlaten van de pagina */
function leavePlaces() {
  document.body.classList.remove("full");
  app.classList.remove("full");
  if (pl.map) { pl.map.remove(); pl.map = null; }
  pl.me = null; pl.sel = null;
}
