/* ── valassets.js — mapa/agente por NOMBRE → imagen valorant-api, cacheado ──
   GEP reporta el mapa/agente por displayName. Resolvemos a uuid una sola vez
   (índice de ~25 mapas / ~25 agentes), cacheamos en localStorage 7 días, y
   damos lookups síncronos. Todo degrada a '' si no hay red: la UI ya tiene
   fallback (glass / gradiente), así que un fallo aquí nunca rompe nada. */

const API = 'https://valorant-api.com/v1';
const MEDIA = 'https://media.valorant-api.com';
const TTL = 7 * 24 * 60 * 60 * 1000;
const norm = (s) => String(s || '').trim().toLowerCase();

let MAPAS = {}; // nombre normalizado → uuid
let AGENTES = {}; // nombre normalizado → uuid

function leeCache(k) {
  try {
    const raw = JSON.parse(localStorage.getItem(k) || 'null');
    if (raw && Date.now() - raw.t < TTL) return raw.v;
  } catch {
    /* sin storage */
  }
  return null;
}
function guardaCache(k, v) {
  try {
    localStorage.setItem(k, JSON.stringify({ t: Date.now(), v }));
  } catch {
    /* sin storage */
  }
}

/** Llamar una vez al abrir el dashboard. Idempotente y silenciosa. */
export async function calientaAssets() {
  const cm = leeCache('easy.val.maps');
  const ca = leeCache('easy.val.agents');
  if (cm) MAPAS = cm;
  if (ca) AGENTES = ca;
  if (cm && ca) return; // ya está fresco
  try {
    const [rm, ra] = await Promise.all([
      fetch(`${API}/maps`).then((r) => r.json()),
      fetch(`${API}/agents?isPlayableCharacter=true`).then((r) => r.json()),
    ]);
    MAPAS = {};
    for (const m of rm.data || []) {
      MAPAS[norm(m.displayName)] = m.uuid;
      // internal id, p.ej. "/Game/Maps/Ascent/Ascent" → "ascent"
      if (m.mapUrl) MAPAS[norm(m.mapUrl.split('/').pop())] = m.uuid;
    }
    AGENTES = {};
    for (const a of ra.data || []) AGENTES[norm(a.displayName)] = a.uuid;
    guardaCache('easy.val.maps', MAPAS);
    guardaCache('easy.val.agents', AGENTES);
  } catch {
    /* sin red: nos quedamos con lo cacheado o vacío; la UI degrada */
  }
}

export const mapaSplash = (nombre) => {
  const id = MAPAS[norm(nombre)];
  return id ? `${MEDIA}/maps/${id}/splash.png` : '';
};
export const mapaIcono = (nombre) => {
  const id = MAPAS[norm(nombre)];
  return id ? `${MEDIA}/maps/${id}/listViewIcon.png` : '';
};
export const agenteRetrato = (nombre) => {
  const id = AGENTES[norm(nombre)];
  return id ? `${MEDIA}/agents/${id}/fullPortrait.png` : '';
};
export const agenteIcono = (nombre) => {
  const id = AGENTES[norm(nombre)];
  return id ? `${MEDIA}/agents/${id}/displayIcon.png` : '';
};
