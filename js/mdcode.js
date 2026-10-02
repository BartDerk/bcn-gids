"use strict";
/* Korte code voor de keuzes van md: per plaats een vaste sleutel van 4 tekens (hash van het id).
   Zo klopt de code ook als places.json later verandert. Gebruikt door kiezen.html en de hoofdapp. */
const MDC = {
  PREFIX: "BCN1-",
  key(id) {
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 1679616).toString(36).padStart(4, "0");
  },
  encode(ids) { return MDC.PREFIX + ids.map(MDC.key).join(""); },
  // geeft null als er geen code in de tekst staat, anders {ids, unknown}
  decode(text, places) {
    const m = /BCN1-([0-9a-z]*)/i.exec(text || "");
    if (!m) return null;
    const s = m[1].toLowerCase(), map = {}, dup = {};
    for (const p of places) { const k = MDC.key(p.id); if (map[k]) dup[k] = 1; map[k] = p.id; }
    const ids = []; let unknown = 0;
    for (let i = 0; i + 4 <= s.length; i += 4) {
      const k = s.slice(i, i + 4);
      if (map[k] && !dup[k]) { if (!ids.includes(map[k])) ids.push(map[k]); } else unknown++;
    }
    return {ids, unknown};
  }
};
