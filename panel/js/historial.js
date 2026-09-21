/* ══ Historial de un match terminado ══════════════════════════════════════
   Antes vivia dentro de db.js (CRUD del dashboard); es una feature aparte
   -leer, no gestionar- asi que tiene su propio modulo, como el resto del
   panel (self-contained, sin arbol de imports). */
const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* Un bloque por mapa jugado (mapInfo con roster), ganador arriba, tabla de
   agente + K/D/A por jugador (sin ADR: GEP no lo reporta en este set de
   features). Sin datos de prueba: solo pinta lo que de verdad llegó por GEP. */
export function abreDetalleMatch(m) {
  $('dmd-tit').textContent = [m.name, m.formato].filter(Boolean).join(' · ') || 'Match';
  const mapas = (m.mapInfo ?? []).filter((e) => e && e.map);
  const cont = $('dmd-mapas');
  if (mapas.length === 0) {
    cont.innerHTML = '<p class="dmd-vacio">No map data recorded for this match.</p>';
  } else {
    cont.innerHTML = mapas
      .map((e) => {
        const ganaIzq = (e.left?.score ?? 0) > (e.right?.score ?? 0);
        const filas = (e.roster ?? [])
          .map(
            (j) =>
              `<tr class="dmd-fila" data-equipo="${j.team === 0 ? 'a' : 'b'}">` +
              `<td>${esc(j.name)}${j.tagline ? `<span class="dmd-tag">#${esc(j.tagline)}</span>` : ''}</td>` +
              `<td>${esc(j.agentInternal || '—')}</td>` +
              `<td class="dmd-num">${j.kills ?? 0}/${j.deaths ?? 0}/${j.assists ?? 0}</td>` +
              `</tr>`,
          )
          .join('');
        return (
          `<div class="dmd-mapa">` +
          `<div class="dmd-mapa__cab">` +
          `<b>${esc(e.map)}</b>` +
          `<span>${e.left?.score ?? 0}–${e.right?.score ?? 0} · ${ganaIzq ? 'Left won' : 'Right won'}</span>` +
          `</div>` +
          (filas
            ? `<table class="dmd-tabla"><thead><tr><th>Player</th><th>Agent</th><th>K/D/A</th></tr></thead><tbody>${filas}</tbody></table>`
            : `<p class="dmd-vacio">No roster/KDA captured for this map.</p>`) +
          `</div>`
        );
      })
      .join('');
  }
  $('dlg-match-detalle')?.showModal();
}
