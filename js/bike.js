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
    <div class="mapwrap"><div id="map"></div><div class="bleg"><i class="bdot cand"></i> voor fietsroute gemarkeerd</div>
      <button class="fab" id="locate" type="button" aria-label="Mijn locatie">&#x2316;</button></div>
    <div class="sheet bsheet" id="bsheet" hidden></div>`;
  const map = bk.map = L.map("map", {zoomControl: false}).setView([41.3935, 2.1686], 13);
  L.control.zoom({position: "topright"}).addTo(map);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom: 19, attribution: "© OpenStreetMap"}).addTo(map);
  bk.layer = L.layerGroup().addTo(map);
  map.on("click", () => { bk.sel = null; bk.mode = ""; renderBSheet(); });
  $("locate").onclick = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      const ll = [pos.coords.latitude, pos.coords.longitude];
      if (bk.me) bk.me.remove();
      bk.me = L.circleMarker(ll, {radius: 9, color: "#fff", weight: 3, fillColor: "#111827", fillOpacity: 1}).addTo(bk.map);
      bk.map.setView(ll, Math.max(bk.map.getZoom(), 15));
    }, () => { alert("Locatie niet beschikbaar. Zet de locatie van je gsm aan en geef toestemming."); }, {enableHighAccuracy: true, timeout: 10000});
  };
  const zc = () => $("map").classList.toggle("zsmall", map.getZoom() <= 13);
  map.on("zoomend", zc); zc();

  $("bundo").onclick = () => { pl.bike.pop(); savePl(); bk.sel = null; refreshBike(); };
  $("bclear").onclick = () => {
    if (pl.bike.length && confirm("Hele route wissen? Je blauwe bollen (plaatsen die je voor de fietsroute markeerde) blijven staan.")) { pl.bike = []; savePl(); bk.sel = null; bk.mode = ""; refreshBike(); }
  };
  $("blist").onclick = () => { bk.mode = bk.mode === "list" ? "" : "list"; bk.sel = null; renderBSheet(); };
  $("bloop").onclick = () => { bk.loop = !bk.loop; store.set("bcnLoop", bk.loop); refreshBike(); };
  document.querySelectorAll(".bbar [data-s]").forEach(b => b.onclick = () => { bk.show[b.dataset.s] = !bk.show[b.dataset.s]; refreshBike(); });
  refreshBike(true);
}

const numIcon = (n, last) => L.divIcon({className: "pinwrap", iconSize: [34, 34], iconAnchor: [17, 17],
  html: `<div class="bnum${last ? " last" : ""}">${n}</div>`});
const dotIcon = p => L.divIcon({className: "pinwrap", iconSize: [30, 30], iconAnchor: [15, 15],
  html: pl.cand.has(p.id) ? `<div class="bdot cand"></div>` : `<div class="bdot" style="background:${CATS[p.cat][1]}"></div>`});

function refreshBike(fit) {
  const stops = stopsOf(), sel = new Set(pl.bike), L_ = bk.layer;
  L_.clearLayers();
  for (const p of pl.all) {
    if (sel.has(p.id) || !bk.show[p.list]) continue;
    L.marker([p.lat, p.lng], {icon: dotIcon(p), keyboard: false, title: p.name, zIndexOffset: pl.cand.has(p.id) ? 500 : 0}).on("click", e => { L.DomEvent.stopPropagation(e); bk.sel = p.id; bk.mode = "cand"; renderBSheet(); }).addTo(L_);
  }
  const line = stops.map(p => [p.lat, p.lng]);
  if (bk.loop && line.length >= 2) line.push(line[0]);
  if (line.length >= 2) L.polyline(line, {color: "#1d4ed8", weight: 4, opacity: .85, dashArray: "8 8"}).addTo(L_);
  stops.forEach((p, i) => {
    L.marker([p.lat, p.lng], {icon: numIcon(i + 1, i === stops.length - 1), zIndexOffset: 1000, title: p.name})
      .on("click", e => { L.DomEvent.stopPropagation(e); bk.sel = p.id; bk.mode = "stop"; renderBSheet(); }).addTo(L_);
  });

  const n = stops.length, pts = bk.loop && n >= 2 ? stops.concat(stops[0]) : stops;
  $("bsum").innerHTML = n === 0 ? (pl.cand.size ? "Tik op een <b>blauwe bol</b> om je eerste stop te kiezen" : "Tik op een plaats om je <b>eerste stop</b> te kiezen")
    : `<b>${n} stop${n === 1 ? "" : "s"}</b>${n >= 2 ? " · ± " + routeKm(pts).toFixed(1).replace(".", ",") + " km" : " · kies de volgende"}`;
  $("bundo").disabled = $("bclear").disabled = n === 0;
  $("bloop").setAttribute("aria-pressed", bk.loop);
  $("blist").textContent = `☰ Stops (${n})`;
  document.querySelectorAll(".bbar [data-s]").forEach(b => b.setAttribute("aria-pressed", bk.show[b.dataset.s]));
  const urls = n >= 2 ? gmUrls(stops) : [];
  const pending = [...pl.cand].filter(id => !pl.bike.includes(id));
  $("bgm").innerHTML = (urls.length === 0 ? `<span class="bhint">Kies minstens 2 stops om in Google Maps te openen.</span>`
    : urls.map(u => `<a class="btn primary" href="${u.url}" target="_blank" rel="noopener">${urls.length === 1 ? "Open in Google Maps" : `Deel ${urls.indexOf(u) + 1} (stops ${u.from}–${u.to})`}</a>`).join(""))
    + (pending.length ? `<button class="btn" id="badall" type="button">＋ ${pending.length} blauwe in route</button>` : "");
  if (n) $("bgm").insertAdjacentHTML("beforeend", `<button class="btn" id="bfloat" type="button">🪟 Zwevend venster</button>`);
  if ($("bfloat")) $("bfloat").onclick = startFloat;
  if ($("badall")) $("badall").onclick = () => { pending.forEach(id => pl.bike.push(id)); savePl(); refreshBike(true); };
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
        ? `<button class="btn primary" id="badd" type="button">+ Stop ${nextN}</button>
           <button class="btn${pl.cand.has(p.id) ? " on" : ""}" id="bcand" type="button">${pl.cand.has(p.id) ? "🚲 Gemarkeerd ✓" : "🚲 Markeren"}</button>`
        : `<button class="btn" id="brem" type="button">Uit route (blijft blauw)</button>
           ${pl.cand.has(p.id) ? `<button class="btn" id="buncand" type="button">Niet meer markeren</button>` : ""}`}
      </div>`;
    s.hidden = false;
    $("bx").onclick = () => { bk.sel = null; bk.mode = ""; renderBSheet(); };
    if ($("badd")) $("badd").onclick = () => { pl.bike.push(p.id); savePl(); bk.sel = null; bk.mode = ""; refreshBike(); };
    if ($("bcand")) $("bcand").onclick = () => { toggleCand(p.id, false); refreshBike(); };
    if ($("buncand")) $("buncand").onclick = () => { toggleCand(p.id); bk.sel = null; bk.mode = ""; refreshBike(); };
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
  bk.me = null;
  bk.sel = null; bk.mode = "";
}

/* ---------- zwevend venster: de volgende stop (foto + naam) in een beeld-in-beeld-videovenster boven Google Maps ----------
   De app tekent de stop op een canvas, maakt daar een videostroom van en zet die in Picture-in-Picture.
   De knoppen "vorige/volgende" van dat venster (mediabediening) schuiven door naar de vorige of volgende stop van je route. */
const fl = {canvas: null, video: null, idx: 0, imgs: {}, timer: null, on: false};
const FL_W = 640, FL_H = 360;
function flStops() { const s = stopsOf(); if (bk.loop && s.length >= 2) return s.concat([Object.assign({}, s[0], {back: true})]); return s; }
function flImg(p) {
  if (!p.photo) return null;
  if (!fl.imgs[p.photo]) { const im = new Image(); im.onload = () => { if (fl.on) flDraw(); }; im.src = p.photo; fl.imgs[p.photo] = im; }
  const im = fl.imgs[p.photo]; return im.complete && im.naturalWidth ? im : null;
}
function flWrap(ctx, text, maxW, maxLines) {
  const words = text.split(" "), lines = []; let cur = "";
  for (const w of words) { const t = cur ? cur + " " + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/.{0,2}$/, "…"); }
  return lines;
}
function flDraw() {
  const stops = flStops(); if (!fl.canvas) return;
  fl.idx = Math.max(0, Math.min(fl.idx, stops.length - 1));
  const p = stops[fl.idx], c = fl.canvas.getContext("2d");
  c.fillStyle = p ? (CATS[p.cat] || CATS.overig)[1] : "#111827"; c.fillRect(0, 0, FL_W, FL_H);
  if (!p) { c.fillStyle = "#fff"; c.font = "bold 36px sans-serif"; c.fillText("Geen stops", 30, 190); return; }
  const im = flImg(p);
  if (im) {   // foto: "cover"
    const r = Math.max(FL_W / im.naturalWidth, FL_H / im.naturalHeight), w = im.naturalWidth * r, h = im.naturalHeight * r;
    c.drawImage(im, (FL_W - w) / 2, (FL_H - h) / 2, w, h);
  }
  const g = c.createLinearGradient(0, FL_H * .38, 0, FL_H); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.85)");
  c.fillStyle = g; c.fillRect(0, FL_H * .38, FL_W, FL_H * .62);
  c.fillStyle = "#1d4ed8"; c.beginPath(); c.arc(54, 54, 40, 0, 7); c.fill();
  c.fillStyle = "#fff"; c.textAlign = "center"; c.textBaseline = "middle"; c.font = "bold 44px sans-serif";
  c.fillText(p.back ? "↺" : String(fl.idx + 1), 54, 56);
  c.textAlign = "left"; c.textBaseline = "alphabetic";
  c.font = "bold 46px sans-serif"; const lines = flWrap(c, p.name, FL_W - 50, 2);
  const y0 = FL_H - 56 - (lines.length - 1) * 52;
  c.shadowColor = "#000"; c.shadowBlur = 6; c.fillStyle = "#fff";
  lines.forEach((l, i) => c.fillText(l, 24, y0 + i * 52));
  c.font = "26px sans-serif"; c.fillStyle = "#e5e7eb";
  c.fillText((p.back ? "Terug naar start · " : "") + `stop ${Math.min(fl.idx + 1, flStops().length)} van ${flStops().length}` + (p.district ? " · " + p.district : ""), 24, FL_H - 16);
  c.shadowBlur = 0;
  c.fillStyle = (Date.now() / 1000 | 0) % 2 ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.2)"; c.fillRect(FL_W - 8, FL_H - 8, 4, 4);   // houdt de videostroom levend
  if ("mediaSession" in navigator) navigator.mediaSession.metadata = new MediaMetadata({title: p.name, artist: `Stop ${fl.idx + 1} van ${flStops().length}`});
}
function flStep(d) { fl.idx += d; flDraw(); }
async function startFloat() {
  const msg = t => { const el = $("bgm"); const old = el.querySelector(".bhint.fl"); if (old) old.remove(); el.insertAdjacentHTML("beforeend", `<span class="bhint fl">${t}</span>`); };
  if (!document.pictureInPictureEnabled || !HTMLCanvasElement.prototype.captureStream) { msg("Zwevend venster wordt door deze browser niet ondersteund."); return; }
  try {
    if (document.pictureInPictureElement) { await document.exitPictureInPicture(); return; }
    if (!fl.canvas) { fl.canvas = document.createElement("canvas"); fl.canvas.width = FL_W; fl.canvas.height = FL_H; }
    if (!fl.video) {
      const v = fl.video = document.createElement("video");
      v.muted = true; v.playsInline = true; v.setAttribute("playsinline", ""); v.style.cssText = "position:fixed;left:-9999px;width:2px;height:2px";
      document.body.appendChild(v);
      v.addEventListener("leavepictureinpicture", () => { fl.on = false; clearInterval(fl.timer); });
    }
    if (fl.idx >= flStops().length) fl.idx = 0;
    flStops().forEach(flImg);
    flDraw();
    fl.video.srcObject = fl.canvas.captureStream(5);
    await fl.video.play();
    await fl.video.requestPictureInPicture();
    fl.on = true; clearInterval(fl.timer); fl.timer = setInterval(flDraw, 1000);
    if ("mediaSession" in navigator) {
      const ms = navigator.mediaSession;
      for (const [a, f] of [["previoustrack", () => flStep(-1)], ["nexttrack", () => flStep(1)], ["play", () => fl.video.play()], ["pause", () => fl.video.play()]]) { try { ms.setActionHandler(a, f); } catch (e) {} }
      ms.playbackState = "playing";
    }
    msg("Zwevend venster staat aan. Ga naar Google Maps; met de knoppen ◀ ▶ in het venster wissel je van stop.");
  } catch (e) { msg("Zwevend venster lukt niet: " + (e && e.message || e)); }
}