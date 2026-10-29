/* LOS CAMPOS NUEVOS DEL SERVIDOR, YA TRADUCIDOS.
   =============================================

   Rama `copia-funcional`. El servidor manda, además de lo de siempre, cinco
   campos que el overlay original (ValoSpectra/Spectra-Frontend) sí sabe leer:

     tools.seedingInfo     cabeza de serie bajo cada equipo
     tools.nameOverrides   alias de visualización de los jugadores
     tools.roundWinBox     qué decora la ceremonia de fin de ronda
     tools.minimal         el modo mínimo
     spikeDetonationTime   cuándo explota la spike (instante del servidor)

   Aquí vive la lógica PURA de esos campos, sin navegador ni socket, para poder
   probarla sola. `traduccion.js` la llama; los pintores solo leen el resultado.

   Adaptado de ValoSpectra/Spectra-Frontend (Elastic License 2.0) — en cada
   función se dice de qué fichero sale la regla. */

/* ── Direcciones ─────────────────────────────────────────────────────────── */

/**
 * Una dirección de imagen que se puede meter sin romper nada en `url('…')`, en un atributo `style` o en un `src`.
 *
 * El servidor ya quita controles y `javascript:`, pero deja pasar comillas, paréntesis y espacios, que cierran la
 * comilla de un atributo o el paréntesis de `url()`. Se codifican (`%22`, `%28`…): para el navegador siguen siendo la
 * misma dirección, incluidas las `data:` con el dibujo SVG sin codificar.
 *
 * @param {unknown} u
 * @returns {string}
 */
export function limpiaUrl(u) {
  if (typeof u !== 'string') return '';
  return u.trim().replace(/["'()\\\s<>`]/g, (c) => encodeURIComponent(c));
}

/* ── Alias de visualización ──────────────────────────────────────────────── */

/**
 * Lee la lista de alias que manda el servidor.
 *
 * Llega como TEXTO JSON de una lista de pares `[["Nombre#TAG", "alias"], …]`
 * (así viaja en el original), pero se aceptan también la lista ya parseada y un
 * objeto `{ "Nombre#TAG": "alias" }`. Lo que no se entiende se ignora: un alias
 * roto no puede dejar el HUD sin nombres.
 *
 * Adaptado de ValoSpectra/Spectra-Frontend (Elastic License 2.0) — services/displayName.service.ts
 *
 * @param {unknown} crudo
 * @returns {Map<string, string>}
 */
export function leeAlias(crudo) {
  let o = crudo;
  if (o !== null && typeof o === 'object' && !Array.isArray(o) && 'overrides' in o) o = o.overrides;
  if (typeof o === 'string') {
    if (o.trim() === '') return new Map();
    try {
      o = JSON.parse(o);
    } catch {
      return new Map();
    }
  }
  /** @type {Array<[unknown, unknown]>} */
  let pares = [];
  if (Array.isArray(o)) {
    pares = o.filter((e) => Array.isArray(e) && e.length >= 2).map((e) => [e[0], e[1]]);
  } else if (o !== null && typeof o === 'object') {
    pares = Object.entries(o);
  }
  const mapa = new Map();
  for (const [k, a] of pares) {
    if (typeof k !== 'string' || typeof a !== 'string') continue;
    const clave = k.trim();
    const alias = a.trim();
    if (clave !== '' && alias !== '') mapa.set(clave, alias);
  }
  return mapa;
}

/**
 * El alias de un jugador, o cadena vacía si no tiene.
 *
 * Se busca por `Nombre#TAG` exacto y, si no, sin distinguir mayúsculas (el
 * operador teclea el alias a mano y el nombre de Riot no siempre se escribe
 * igual). `claves` son los nombres con los que se puede conocer al jugador.
 *
 * @param {Map<string, string>} mapa
 * @param {...string} claves
 */
export function buscaAlias(mapa, ...claves) {
  if (!(mapa instanceof Map) || mapa.size === 0) return '';
  const validas = claves.filter((c) => typeof c === 'string' && c !== '' && c !== '#');
  for (const c of validas) {
    const a = mapa.get(c);
    if (a !== undefined) return a;
  }
  const minus = validas.map((c) => c.toLowerCase());
  for (const [k, a] of mapa) {
    if (minus.includes(k.toLowerCase())) return a;
  }
  return '';
}

/* ── La caja de la ceremonia de fin de ronda ─────────────────────────────── */

const TIPOS_CAJA = ['disabled', 'tournamentInfo', 'sponsors'];
const GANADOR_CAJA = ['all', 'left', 'right'];
const CEREMONIAS_CAJA = ['all', 'normal', 'ace', 'clutch', 'teamAce', 'flawless', 'thrifty'];

/** La ceremonia del overlay (`ceremoniaDe`) → el nombre que usa la caja. */
export const CEREMONIA_A_CAJA = {
  roundWin: 'normal',
  ace: 'ace',
  clutch: 'clutch',
  teamAce: 'teamAce',
  flawless: 'flawless',
  thrifty: 'thrifty',
};

/**
 * `tools.roundWinBox` con la forma garantizada, venga lo que venga.
 *
 * El servidor ya la sanea, pero un servidor antiguo (o una grabación vieja) no
 * la manda: entonces sale `disabled` sin patrocinadores, que es «ceremonia
 * como siempre».
 *
 * @param {any} caja
 * @returns {{ type: 'disabled'|'tournamentInfo'|'sponsors', sponsors: Array<{ wonTeam: 'all'|'left'|'right', roundCeremony: string[], iconUrl: string, backdropUrl: string }> }}
 */
export function normalizaCaja(caja) {
  const type = TIPOS_CAJA.includes(caja?.type) ? caja.type : 'disabled';
  const lista = Array.isArray(caja?.sponsors) ? caja.sponsors : [];
  const sponsors = lista
    .filter((s) => s !== null && typeof s === 'object')
    .map((s) => {
      const ceremonias = (Array.isArray(s.roundCeremony) ? s.roundCeremony : []).filter((c) => CEREMONIAS_CAJA.includes(c));
      return {
        wonTeam: GANADOR_CAJA.includes(s.wonTeam) ? s.wonTeam : 'all',
        roundCeremony: ceremonias.length > 0 ? ceremonias : ['all'],
        iconUrl: limpiaUrl(s.iconUrl),
        backdropUrl: limpiaUrl(s.backdropUrl),
      };
    });
  return { type, sponsors };
}

/**
 * Qué lleva la ceremonia de esta ronda: el icono de arriba y el telón de fondo.
 *
 * - `disabled`: nada (la ceremonia sale con el logo del equipo, como siempre).
 * - `tournamentInfo`: el logo y el fondo del torneo.
 * - `sponsors`: el primer patrocinador que case con el equipo que ganó y con la
 *   ceremonia; si ninguno casa, el primero de la lista.
 *
 * `ganadorLado` es 0 si ganó el equipo de la IZQUIERDA del panel (el «Left» de
 * la pestaña Equipos) y 1 si ganó el de la derecha. No es el lado de la
 * pantalla: los equipos cambian de lado al cambiar de mitad y la caja habla de
 * equipos, no de posiciones.
 *
 * Adaptado de ValoSpectra/Spectra-Frontend (Elastic License 2.0) — components/combat/endround-banner/endround-banner.component.ts
 * (calculateSponsor, bannerBackgroundUrl y bannerTopIconUrl).
 *
 * @param {any} caja Lo que sale de `normalizaCaja`.
 * @param {string} ceremonia Una de `ceremoniaDe`: roundWin, ace, clutch…
 * @param {number} ganadorLado 0 o 1.
 * @param {{ logoUrl?: string, backdropUrl?: string }} torneo
 * @returns {{ tipo: string, iconUrl: string, backdropUrl: string }}
 */
export function eligeCaja(caja, ceremonia, ganadorLado, torneo = {}) {
  const c = normalizaCaja(caja);
  if (c.type === 'tournamentInfo') {
    return { tipo: c.type, iconUrl: torneo.logoUrl ?? '', backdropUrl: torneo.backdropUrl ?? '' };
  }
  if (c.type !== 'sponsors' || c.sponsors.length === 0) {
    return { tipo: 'disabled', iconUrl: '', backdropUrl: '' };
  }
  const clave = CEREMONIA_A_CAJA[ceremonia] ?? 'normal';
  const elegido =
    c.sponsors.find(
      (s) =>
        (s.wonTeam === 'all' || (s.wonTeam === 'left' && ganadorLado === 0) || (s.wonTeam === 'right' && ganadorLado === 1)) &&
        (s.roundCeremony.includes('all') || s.roundCeremony.includes(clave)),
    ) ?? c.sponsors[0];
  return { tipo: 'sponsors', iconUrl: elegido.iconUrl, backdropUrl: elegido.backdropUrl };
}

/* ── La spike ────────────────────────────────────────────────────────────── */

/**
 * Cuándo se plantó la spike, según el servidor.
 *
 * El servidor manda `spikeDetonationTime` (su reloj, en ms) y la spike tarda
 * `duracionMs` en explotar, así que el plantado es esa hora menos la duración.
 * Así la cuenta atrás no se reinicia a 45 al recargar la fuente de OBS.
 *
 * Los relojes del PC y del servidor pueden no coincidir. Si el instante que sale
 * está fuera de lo posible (aún no se ha plantado o ya tendría que haber
 * explotado, con un margen de 3 s), se descarta y quien llama usa su propio
 * reloj, que es lo que se hacía antes.
 *
 * @param {unknown} detona
 * @param {number} ahora
 * @param {number} [duracionMs]
 * @returns {number | null}
 */
export function plantadoSegunServidor(detona, ahora, duracionMs = 45_000) {
  if (typeof detona !== 'number' || !Number.isFinite(detona)) return null;
  const plantado = detona - duracionMs;
  const margen = 3000;
  if (ahora - plantado < -margen || ahora - plantado > duracionMs + margen) return null;
  return plantado;
}
