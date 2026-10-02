"use strict";
/* Fietsroutes: stops kiezen op de kaart, volgorde bepalen, openen in Google Maps */

const bk = {map: null, layer: null, sel: null, mode: "", show: {bcn: true, bar: true, shop: true}, loop: store.get("bcnLoop", false)};
const MAX_PTS = 11;   // Google Maps: start + 9 tussenpunten + einde

const stopsOf = () => pl.bike.map(id => pl.byId[id]).filter(Boolean);
function routeKm(pts) {
  let km = 0;
  for (let i = 1; i < pts.length; i++) km += distKm(pts[i - 1], pts[i]);
  return km * 1.3;   // vogelvlucht x 1,3
}
function gmUrls(stops) {
  const pts = stops.map(p => p.lat + "," + p.lng);
  if (bk.loop && pts.length >= 2) pts.push(pts[0]);
  const urls = [];
  for (let i = 0; i < pts.length - 1;) {
    const end = Math.min(i + MAX_PTS - 1, pts.length - 1), seg = pts.slice(i, end + 1);
    let u = "https://www.google.com/maps/dir/?api=1&travelmode=bicycling&origin=" + seg[0] + "&destination=" + seg[seg.length - 1];
    if (seg.length > 2) u += "&waypoints=" + encodeURIComponent(seg.slice(1, -1).join("|"));
    urls.push({url: u, from: i + 1, to: end + 1});
    i = end;
  }
  return urls;
}

async function viewBike() {
  await ensurePlaces();
  document.body.classList.add("full");
  app.classList.add("full");
  app.innerHTML = `
    <div class="pbar bbar">
      <div class="bsumrow"><div class="bsum" id="bsum"></div>
        <button class="chip" id="bundo" type="button">↶ Ongedaan</button>
        <button class="chip" id="bclear" type="button" aria-label="Hele route wissen">🗑 Wissen</button></div>
      <div class="brow" id="bgm"></div>
      <div class="chips">
        <button class="chip" id="blist" type="button">☰ Stops</button>
        <button class="chip" id="bloop" type="button" aria-pressed="false">↺ Rondrit</button>
        <button class="chip" data-s="bcn" aria-pressed="true">Te zien</button>
        <button class="chip" data-s="bar" aria-pressed="true">Bars</button>
        <button class="chip" data-s="shop" aria-pressed="true">Shops</button>
      </div>
    </div>
    <div class="mapwrap"><div id="map"></div></div>
    <div class="sheet bsheet" id="bsheet" hidden></div>`;
  const map = bk.map = L.map("map", {zoomControl: false}).setView([41.3935, 2.1686], 13);
  L.control.zoom({position: "topright"}).addTo(map);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom: 19, attribution: "© OpenStreetMap"}).addTo(map);
  bk.layer = L.layerGroup().addTo(map);
  map.on("click", () => { bk.sel = null; bk.mode = ""; renderBSheet(); });
  const zc = () => $("map").classList.toggle("zsmall", map.getZoom() <= 13);
  map.on("zoomend", zc); zc();

  $("bundo").onclick = () => { pl.bike.pop(); savePl(); bk.sel = null; refreshBike(); };
  $("bclear").onclick = () => {
    if (pl.bike.length && confirm("Hele fietsroute wissen? Dit kan niet ongedaan gemaakt worden.")) { pl.bike = []; savePl(); bk.sel = null; bk.mode = ""; refreshBike(); }
  };
  $("blist").onclick = () => { bk.mode = bk.mode === "list" ? "" : "list"; bk.sel = null; renderBSheet(); };
  $("bloop").onclick = () => { bk.loop = !bk.loop; store.set("bcnLoop", bk.loop); refreshBike(); };
  document.querySelectorAll(".bbar [data-s]").forEach(b => b.onclick = () => { bk.show[b.dataset.s] = !bk.show[b.dataset.s]; refreshBike(); });
  refreshBike(true);
}

const numIcon = (n, last) => L.divIcon({className: "pinwrap", iconSize: [34, 34], iconAnchor: [17, 17],
  html: `<div class="bnum${last ? " last" : ""}">${n}</div>`});
const dotIcon = p => L.divIcon({className: "pinwrap", iconSize: [30, 30], iconAnchor: [15, 15],
  html: `<div class="bdot" style="background:${CATS[p.cat][1]}"></div>`});

function refreshBike(fit) {
  const stops = stopsOf(), sel = new Set(pl.bike), L_ = bk.layer;
  L_.clearLayers();
  for (const p of pl.all) {
    if (sel.has(p.id) || !bk.show[p.list]) continue;
    L.marker([p.lat, p.lng], {icon: dotIcon(p), keyboard: false, title: p.name}).on("click", e => { L.DomEvent.stopPropagation(e); bk.sel = p.id; bk.mode = "cand"; renderBSheet(); }).addTo(L_);
  }
  const line = stops.map(p => [p.lat, p.lng]);
  if (bk.loop && line.length >= 2) line.push(line[0]);
  if (line.length >= 2) L.polyline(line, {color: "#1d4ed8", weight: 4, opacity: .85, dashArray: "8 8"}).addTo(L_);
  stops.forEach((p, i) => {
    L.marker([p.lat, p.lng], {icon: numIcon(i + 1, i === stops.length - 1), zIndexOffset: 1000, title: p.name})
      .on("click", e => { L.DomEvent.stopPropagation(e); bk.sel = p.id; bk.mode = "stop"; renderBSheet(); }).addTo(L_);
  });

  const n = stops.length, pts = bk.loop && n >= 2 ? stops.concat(stops[0]) : stops;
  $("bsum").innerHTML = n === 0 ? "Tik op een plaats om je <b>eerste stop</b> te kiezen"
    : `<b>${n} stop${n === 1 ? "" : "s"}</b>${n >= 2 ? " · ± " + routeKm(pts).toFixed(1).replace(".", ",") + " km" : " · kies de volgende"}`;
  $("bundo").disabled = $("bclear").disabled = n === 0;
  $("bloop").setAttribute("aria-pressed", bk.loop);
  $("blist").textContent = `☰ Stops (${n})`;
  document.querySelectorAll(".bbar [data-s]").forEach(b => b.setAttribute("aria-pressed", bk.show[b.dataset.s]));
  const urls = n >= 2 ? gmUrls(stops) : [];
  $("bgm").innerHTML = urls.length === 0 ? `<span class="bhint">Kies minstens 2 stops om in Google Maps te openen.</span>`
    : urls.map(u => `<a class="btn primary" href="${u.url}" target="_blank" rel="noopener">${urls.length === 1 ? "Open in Google Maps" : `Deel ${urls.indexOf(u) + 1} (stops ${u.from}–${u.to})`}</a>`).join("");
  if (fit && n) bk.map.fitBounds(L.latLngBounds(line).pad(0.25));
  setTimeout(() => { if (bk.map) bk.map.invalidateSize(); }, 40);
  renderBSheet();
}

function renderBSheet() {
  const s = $("bsheet"); if (!s) return;
  const nextN = pl.bike.length + 1;
  if (bk.mode === "cand" || bk.mode === "stop") {
    const p = pl.byId[bk.sel]; if (!p) { s.hidden = true; return; }
    const i = pl.bike.indexOf(p.id);
    s.className = "sheet bsheet";
    s.innerHTML = `
      <div class="bcard">
        <span class="dot" style="background:${CATS[p.cat][1]}">${svg(p.cat, 18)}</span>
        <div class="shname"><h2>${esc(p.name)}</h2><small>${esc(CATS[p.cat][0])}${p.district ? " · " + esc(p.district) : ""}${i >= 0 ? " · stop " + (i + 1) : ""}</small></div>
        <button class="sxp" id="bx" type="button" aria-label="Sluiten">×</button>
      </div>
      ${p.desc ? `<p class="sdesc bdesc">${esc(p.desc)}</p>` : ""}
      <div class="sbtn">${i < 0
        ? `<button class="btn primary" id="badd" type="button">+ Stop ${nextN}</button>`
        : `<button class="btn" id="brem" type="button">Verwijder stop ${i + 1}</button>`}
      </div>`;
    s.hidden = false;
    $("bx").onclick = () => { bk.sel = null; bk.mode = ""; renderBSheet(); };
    if ($("badd")) $("badd").onclick = () => { pl.bike.push(p.id); savePl(); bk.sel = null; bk.mode = ""; refreshBike(); };
    if ($("brem")) $("brem").onclick = () => { pl.bike.splice(i, 1); savePl(); bk.sel = null; bk.mode = ""; refreshBike(); };
  } else if (bk.mode === "list") {
    const stops = stopsOf();
    s.className = "sheet bsheet";
    s.innerHTML = `<div class="bcard"><div class="shname"><h2>Stops</h2></div><button class="sxp" id="bx" type="button" aria-label="Sluiten">×</button></div>
      ${stops.length ? `<ol class="bstops">${stops.map((p, i) => `<li><span class="bnum sm">${i + 1}</span><span class="bname">${esc(p.name)}</span>
        <button data-up="${i}" ${i === 0 ? "disabled" : ""} aria-label="Omhoog">▲</button>
        <button data-dn="${i}" ${i === stops.length - 1 ? "disabled" : ""} aria-label="Omlaag">▼</button>
        <button data-rm="${i}" aria-label="Verwijderen">✕</button></li>`).join("")}</ol>` : `<p class="bhint">Nog geen stops.</p>`}`;
    s.hidden = false;
    $("bx").onclick = () => { bk.mode = ""; renderBSheet(); };
    s.querySelector("ol") && (s.querySelector("ol").onclick = e => {
      const b = e.target.closest("button"); if (!b || b.disabled) return;
      const d = b.dataset;
      if (d.up != null) { const i = +d.up; [pl.bike[i - 1], pl.bike[i]] = [pl.bike[i], pl.bike[i - 1]]; }
      else if (d.dn != null) { const i = +d.dn; [pl.bike[i + 1], pl.bike[i]] = [pl.bike[i], pl.bike[i + 1]]; }
      else if (d.rm != null) pl.bike.splice(+d.rm, 1);
      savePl(); refreshBike();
    });
  } else {
    s.hidden = true;
  }
}

function leaveBike() {
  if (bk.map) { bk.map.remove(); bk.map = null; }
  bk.sel = null; bk.mode = "";
}
