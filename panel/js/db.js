/* ══ DASHBOARD — matches / torneos / equipos ════════════════════════════════
   El "home" del operador tras entrar. Gestiona la base LOCAL (persistida en el
   cliente con electron-json-storage) a través de `window.__easyDB`, que arma el
   shell. El panel es web puro: no toca `electronAPI`, solo `window.__easyDB`.

   - Matches:      crear/editar/borrar + Start (empuja la config a emisión).
   - Tournaments:  crear/editar/borrar; agrupan matches.
   - Teams:        la base reutilizable (se eligen al crear un match).

   El Start reusa `iniciaConfig` de panel.js (parchea al servidor), con el mapeo
   local→servidor del plan (equipos {name,tricode,url}, seriesInfo, tournamentInfo). */

import { iniciaConfig } from './panel.js';
import { cuenta, tokenSesion, API_CUENTAS, seguro, ponEmision, sal } from './sesion.js';
import { calientaAssets, mapaSplash } from './valassets.js';
import { animaConteo } from './contador.js';
import { activaSpotlight, activaRailProximidad, indicaPill } from './efectos.js';
import { calculaFinMapa } from './finmapa.js';
import { abreDetalleMatch } from './historial.js';

const $ = (id) => document.getElementById(id);
const DB = () => window.__easyDB;

/* Estado en memoria (se recarga desde la base al abrir el dashboard). */
let teams = [];
let matches = [];
let tournaments = [];
let alIniciar = null; // callback del shell: cierra el dashboard al arrancar un match

/* ── util ── */
const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const neededDe = (formato) => (formato === 'BO5' ? 3 : formato === 'BO1' ? 1 : 2); // BO2/BO3 = 2

/* Una serie está DECIDIDA cuando un lado llega a los mapas necesarios. Sirve
   para pasar el match a 'done' sin depender de que alguien lo marque a mano. */
const finalizada = (m) => {
  const n = m.needed ?? neededDe(m.formato);
  return (m.score?.wonLeft ?? 0) >= n || (m.score?.wonRight ?? 0) >= n;
};
/* El estado REAL a mostrar: 'done' explícito, o derivado si la serie ya se
   decidió por marcador (así un match cerrado no se queda en Live para siempre).
   No hay estado "draft": un match que no llegó a decidirse por marcador y deja
   de estar en antena se borra (ver terminaBroadcast), nunca queda en limbo. */
const estadoReal = (m) => (m.estado === 'done' || finalizada(m) ? 'done' : 'live');

/* Empty-state reutilizable: icono + título + subtítulo + CTA (abre el form). */
const ICOS = {
  match: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3"/>',
  tournament: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  team: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
};
const vacioHTML = (tipo, titulo, sub, cta) =>
  `<div class="vacio">` +
  `<svg class="vacio__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICOS[tipo]}</svg>` +
  `<h3 class="vacio__tit">${titulo}</h3>` +
  `<p class="vacio__sub">${sub}</p>` +
  `<button class="boton" type="button" data-nuevo="${tipo}">${cta}</button>` +
  `</div>`;
/* Stagger: pone --i por hijo para el retardo escalonado del CSS (tope 12 para
   que con muchas filas el retardo total no moleste). Solo en listas pobladas. */
const escalona = (c) => {
  const n = c?.children;
  if (!n) return;
  for (let i = 0; i < n.length; i++) n[i].style.setProperty('--i', String(Math.min(i, 12)));
};
const snap = (t) => (t ? { name: t.name || '', tricode: t.tricode || '', logoUrl: t.logoUrl || '' } : { name: '', tricode: '', logoUrl: '' });
const equipoPorId = (id) => teams.find((t) => t.id === id) || null;
const torneoPorId = (id) => tournaments.find((t) => t.id === id) || null;

/* ── Color de equipo ────────────────────────────────────────────────────────
   Regla de marca: el color VIENE DEL PARTIDO y solo vive en piezas de equipo
   (barras/chips del marcador), nunca como acento de un control. El modelo Team
   trae ahora un `color` opcional (hex, editable en el diálogo). Si no lo trae,
   se DERIVA uno estable del id/tricode/nombre para que la parrilla tenga la
   variedad del diseño sin inventar un acento de UI. Devuelve algo usable en CSS
   (hex del usuario o `hsl(...)` derivado). */
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
function colorEquipo(t) {
  if (t?.color && HEX.test(String(t.color).trim())) return String(t.color).trim();
  const semilla = String(t?.id || t?.tricode || t?.name || '?');
  let h = 0;
  for (let i = 0; i < semilla.length; i++) h = (h * 31 + semilla.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 62% 55%)`; // tono estable, sat/luz fijas para que se lea sobre negro
}

/* ── Mapas locales ──────────────────────────────────────────────────────────
   El panel ya trae los splash de mapa en panel/assets/maps/<mapa>.webp. Se usan
   como fondo de card/hero cuando el match NO está en vivo (o no hay red para el
   splash remoto de valorant-api). Normalizamos el nombre (minúsculas, sin
   símbolos) para casar "The Range" → therange, etc. */
const MAPAS_LOCALES = new Set([
  'ascent', 'split', 'fracture', 'bind', 'breeze', 'abyss', 'lotus', 'sunset',
  'pearl', 'summit', 'icebox', 'therange', 'corrode', 'haven',
]);
const mapaLocal = (nombre) => {
  const k = String(nombre || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  /* OJO: esta ruta se usa dentro de una CSS custom property (`--mc-img`), y las
     URLs relativas en una var se resuelven contra la HOJA (panel/css/…), no
     contra el documento. Por eso sube un nivel: css/ → panel/ → assets/maps/. */
  return MAPAS_LOCALES.has(k) ? `../assets/maps/${k}.webp` : '';
};

/* El mapa a MOSTRAR en la card de un match: la serie guarda la data del juego,
   así que se usa el PRIMER mapa de la serie (BO3/BO5 → foto del mapa 1), o el
   mapa actual. Si un match aún no tiene dato de mapa (p. ej. recién creado), se
   asigna uno LOCAL estable por su id para que TODAS las cards tengan fondo. */
const MAPAS_PARRILLA = [...MAPAS_LOCALES].filter((k) => k !== 'therange');
const mapaFallback = (id) => {
  const s = String(id || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return MAPAS_PARRILLA[h % MAPAS_PARRILLA.length];
};
const mapaDeMatch = (m) =>
  m?.mapInfo?.find((e) => e && e.map)?.map || m?.mapaActual || mapaFallback(m?.id);

/* Pieza de identidad de equipo: el LOGO si el equipo lo tiene; si no, la barra
   con el color del equipo (fallback). `cls` es la clase base (mc__bar/hero__bar);
   con logo se le añade `con-logo` para que el CSS la vuelva una caja con imagen. */
const barraEquipo = (t, cls) =>
  t?.logoUrl
    ? `<span class="${cls} con-logo" style="background-image:url('${esc(t.logoUrl)}')"></span>`
    : `<span class="${cls}" style="background:${colorEquipo(t)}"></span>`;

/* ── Ronda del match (adaptación del filtro del diseño) ──────────────────────
   Nuestro Match NO tiene campo de ronda, así que la DEDUCIMOS del nombre del
   match (Final/Semis/Quarters/Group), sin distinción de mayúsculas. El orden de
   comprobación importa: 'semi'/'quarter' van ANTES que 'final' porque
   "semifinal"/"quarterfinal" contienen "final". */
function rondaDe(nombre) {
  const s = String(nombre || '').toLowerCase();
  if (/semi/.test(s)) return 'semis';
  if (/quarter|\bqf\b/.test(s)) return 'quarters';
  if (/group|\bgs\b/.test(s)) return 'group';
  if (/final|\bgf\b/.test(s)) return 'final';
  return '';
}

/* Estado de los filtros del dashboard (todo client-side sobre `matches`). */
const filtro = { estado: '', torneo: '', ronda: '', formato: '', orden: 'recent' };

/* Aplica los filtros + orden en memoria. "Most recent": usa createdAt si existe;
   si no (la base no lo garantiza), cae al orden inverso de inserción. */
function matchesFiltrados() {
  let lista = matches.filter((m) => {
    if (filtro.estado && estadoReal(m) !== filtro.estado) return false;
    if (filtro.torneo && (m.tournamentId || '') !== filtro.torneo) return false;
    if (filtro.ronda && rondaDe(m.name) !== filtro.ronda) return false;
    if (filtro.formato && (m.formato || 'BO3') !== filtro.formato) return false;
    return true;
  });
  if (filtro.orden === 'recent') {
    lista = lista.slice().sort((a, b) => {
      const ta = Number(a.createdAt ?? 0);
      const tb = Number(b.createdAt ?? 0);
      if (ta || tb) return tb - ta;
      return matches.indexOf(b) - matches.indexOf(a); // sin fecha: los últimos creados primero
    });
  }
  return lista;
}

/* Fin de mapa: persiste el resultado en el match que está EN VIVO (solo puede
   haber uno). panel.js escucha el mismo evento para empujarlo al overlay; esto
   es aparte, para que el dashboard/historial no se quede con el score viejo.
   El cómputo (score/mapInfo) es compartido vía calculaFinMapa — el dedupe
   sigue siendo propio de cada listener (son consumidores distintos). */
let ultimaSerieGuardada = '';
window.addEventListener('serie-fin', async (e) => {
  const d = e.detail || {};
  const clave = d.matchId || `${d.map}-${d.izq}-${d.der}`;
  if (!clave || clave === ultimaSerieGuardada) return;
  ultimaSerieGuardada = clave;

  const m = matches.find((x) => x.estado === 'live');
  if (!m) return;
  const a = equipoPorId(m.teamAId) || m.teamASnap || {};
  const b = equipoPorId(m.teamBId) || m.teamBSnap || {};
  const { score, mapInfo } = calculaFinMapa(m, d, { izq: a.logoUrl ?? '', der: b.logoUrl ?? '' });
  /* Mutacion local optimista ANTES del await: si el siguiente mapa termina
     mientras esta escritura sigue en vuelo, ese segundo evento debe leer este
     resultado (no el viejo) o se pierde un mapa del historial. */
  m.score = score;
  m.mapInfo = mapInfo;
  await DB().matches.update(m.id, { score, mapInfo });
  await recarga();
});

/* ── carga ── */
async function recarga() {
  const [t, m, to] = await Promise.all([
    DB()?.teams?.list?.(),
    DB()?.matches?.list?.(),
    DB()?.tournaments?.list?.(),
  ]);
  teams = t?.items ?? [];
  matches = m?.items ?? [];
  tournaments = to?.items ?? [];
  pintaTeams();
  pintaTournaments();
  pintaMatches();
  pintaHero();
  /* Resuelve puuid/card/rango de todos los jugadores de todos los equipos en
     segundo plano, sin que el operador tenga que abrir cada equipo a mano —
     esto es la app arrancando, no una página web que carga bajo demanda.
     recarga() corre al iniciar el cliente y después de cada cambio, así que
     esta es también la vía natural para mantenerlo al día. */
  precargaJugadores();
}

let precargaEnCurso = false;
/* Recorre TODOS los jugadores de TODOS los equipos y resuelve los que falten
   (cuenta/card/rango), un poquito a la vez. Lo que ya está en cache (ver
   henrikCacheGet) se aplica al instante y sin red; solo lo que de verdad hay
   que pedirle a HenrikDev se espacía 200ms entre pedido y pedido, para no
   comerse el rate limit de golpe con equipos de varios jugadores. */
async function precargaJugadores() {
  if (precargaEnCurso) return;
  precargaEnCurso = true;
  try {
    for (const t of teams) {
      for (const j of t.players ?? []) {
        const cache = henrikCacheGet(j.name, j.tag);
        if (cache?.puuid && cache?.rango) {
          j.puuid = cache.puuid;
          j.cardUrl = cache.cardUrl || '';
          j.rango = cache.rango;
          j.rangoIconUrl = cache.rangoIconUrl || '';
          continue; // del cache, no hace falta red ni esperar
        }
        await enriqueceJugador(j);
        await new Promise((r) => setTimeout(r, 200));
      }
    }
  } finally {
    precargaEnCurso = false;
  }
}

/* ══ Teams ══ */
function pintaTeams() {
  const c = $('eq-lista');
  if (!c) return;
  if (teams.length === 0) {
    c.innerHTML = vacioHTML('team', 'No teams yet', 'Build your team database once and reuse them across every match.', 'New team');
    return;
  }
  c.innerHTML = teams
    .map((t) => {
      /* <img> con referrerpolicy, no CSS background-image: varios CDNs de logos
         de equipos (ej. el de VLR.gg) rechazan la carga si no llega Referer, y
         un background-image no lo manda de forma confiable. onerror cae al
         mismo bloque de iniciales que si nunca hubiera logoUrl. */
      const logo = t.logoUrl
        ? `<img class="eqc__logo" src="${esc(t.logoUrl)}" alt="" referrerpolicy="unsafe-url" ` +
          `onerror="this.outerHTML='<div class=&quot;eqc__logo eqc__logo--vacio&quot;>${esc((t.tricode || t.name || '?').slice(0, 3).toUpperCase())}</div>'" />`
        : `<div class="eqc__logo eqc__logo--vacio">${esc((t.tricode || t.name || '?').slice(0, 3).toUpperCase())}</div>`;
      /* El color del equipo (del diseño): filete lateral, el ÚNICO acento de
         color permitido, derivado estable con colorEquipo() si no hay hex. */
      return (
        `<div class="eqc" style="--eq:${colorEquipo(t)}">` +
        `<span class="eqc__bar" aria-hidden="true"></span>${logo}` +
        `<div class="eqc__txt"><b>${esc(t.name)}</b><span>${esc(t.tricode || '—')}</span></div>` +
        `<div class="eqc__acc">` +
        `<button class="ic-btn" data-eq-edit="${t.id}" title="Edit">✎</button>` +
        `<button class="ic-btn ic-btn--del" data-eq-del="${t.id}" title="Delete">✕</button>` +
        `</div></div>`
      );
    })
    .join('');
  escalona(c);
}

/* ══ Tournaments ══ */
function pintaTournaments() {
  const c = $('to-lista');
  if (!c) return;
  if (tournaments.length === 0) {
    c.innerHTML = vacioHTML('tournament', 'No tournaments yet', 'Group matches under a tournament — its name and logo show on the broadcast.', 'New tournament');
    return;
  }
  c.innerHTML = tournaments
    .map((t) => {
      const n = matches.filter((m) => m.tournamentId === t.id).length;
      const logo = t.logoUrl
        ? `<div class="fila__logo" style="background-image:url('${esc(t.logoUrl)}')"></div>`
        : '<div class="fila__logo fila__logo--vacio"></div>';
      /* Backdrop del torneo (del diseño): si lo hay, va de fondo con un scrim
         para que el texto siga legible; si no, la fila queda en glass plano. */
      const bg = t.backdropUrl ? ` style="--to-img:url('${esc(t.backdropUrl)}')" data-img="si"` : '';
      return (
        `<div class="fila fila--to"${bg}>${logo}` +
        `<div class="fila__txt"><b>${esc(t.name)}</b><span>${n} match${n === 1 ? '' : 'es'}</span></div>` +
        `<div class="fila__acc">` +
        `<button class="ic-btn" data-to-edit="${t.id}" title="Edit">✎</button>` +
        `<button class="ic-btn ic-btn--del" data-to-del="${t.id}" title="Delete">✕</button>` +
        `</div></div>`
      );
    })
    .join('');
  escalona(c);
}

/* ══ Matches ══ */
/* No existe un estado "programado"/draft: crear un match lo arranca en vivo al
   instante (ver guardaMatch/quickMatch). Solo quedan dos estados visibles al
   operador: live y done. */
const ESTADOS = { live: 'Live', done: 'Done' };

/* La barra de filtros del diseño: pills de estado con contador (a la vez filtro)
   en #m-pills, y dropdown de torneo + chips de ronda/formato + orden en
   #m-filtros. Todo se gobierna por eventos delegados (ver montaDashboard). Se
   repinta con cada pintaMatches para reflejar contadores y estado activo. */
function pintaFiltros() {
  const pills = $('m-pills');
  if (pills) {
    const cont = { live: 0, done: 0 };
    for (const m of matches) cont[estadoReal(m)] = (cont[estadoReal(m)] || 0) + 1;
    const pill = (k, cls) =>
      `<button class="pill${cls}${filtro.estado === k ? ' is-on' : ''}" type="button" data-m-estado="${k}">` +
      `<b id="pill-cnt-${k}">0</b> ${k}</button>`;
    pills.innerHTML = pill('live', ' pill--live') + pill('done', '');
    /* El "desde" vive en el dataset del propio contenedor #m-pills, no en un
       objeto aparte: el contenedor sobrevive a su innerHTML, sus hijos no. */
    for (const k of ['live', 'done']) {
      animaConteo($(`pill-cnt-${k}`), cont[k] || 0, { duracion: 0.45, desde: Number(pills.dataset[`c${k}`] ?? 0) });
      pills.dataset[`c${k}`] = cont[k] || 0;
    }
    indicaPill(pills);
  }
  const barra = $('m-filtros');
  if (!barra) return;
  const chip = (attr, val, etq, on) =>
    `<button class="chip${on ? ' is-on' : ''}" type="button" data-${attr}="${esc(val)}">${esc(etq)}</button>`;
  const ops = ['<option value="">All tournaments</option>']
    .concat(tournaments.map((t) => `<option value="${esc(t.id)}"${filtro.torneo === t.id ? ' selected' : ''}>${esc(t.name)}</option>`))
    .join('');
  const rondas = [['', 'All rounds'], ['final', 'Final'], ['semis', 'Semis'], ['quarters', 'Quarters'], ['group', 'Group']];
  const formatos = [['', 'All formats'], ['BO1', 'BO1'], ['BO2', 'BO2'], ['BO3', 'BO3'], ['BO5', 'BO5']];
  const hay = filtro.estado || filtro.torneo || filtro.ronda || filtro.formato;
  barra.innerHTML =
    `<select class="fdrop" id="m-torneo-filtro" aria-label="Filter by tournament">${ops}</select>` +
    `<span class="fbar__div"></span>` +
    rondas.map(([v, e]) => chip('m-ronda', v, e, filtro.ronda === v)).join('') +
    `<span class="fbar__div"></span>` +
    formatos.map(([v, e]) => chip('m-formato', v, e, filtro.formato === v)).join('') +
    `<span class="fbar__div"></span>` +
    `<button class="chip${filtro.orden === 'recent' ? ' is-on' : ''}" type="button" data-m-orden="recent">Most recent</button>` +
    (hay ? `<button class="fclear" type="button" data-m-clear="1">Clear filters</button>` : '');
}

function pintaMatches() {
  const c = $('m-lista');
  if (!c) return;
  pintaFiltros();
  if (matches.length === 0) {
    c.innerHTML = vacioHTML('match', 'No matches yet', 'Create a match with your teams and format, or start a quick one to go live now.', 'New match');
    return;
  }
  const lista = matchesFiltrados();
  if (lista.length === 0) {
    c.innerHTML =
      `<div class="vacio">` +
      `<h3 class="vacio__tit">No matches</h3>` +
      `<p class="vacio__sub">No match fits the current filters.</p>` +
      `<button class="boton" type="button" data-m-clear="1">Clear filters</button></div>`;
    return;
  }
  c.innerHTML = lista
    .map((m) => {
      const a = equipoPorId(m.teamAId) || m.teamASnap || {};
      const b = equipoPorId(m.teamBId) || m.teamBSnap || {};
      const torneo = torneoPorId(m.tournamentId);
      const wl = m.score?.wonLeft ?? 0;
      const wr = m.score?.wonRight ?? 0;
      const estado = estadoReal(m);
      const vivo = estado === 'live';

      /* Fondo del mapa: TODAS las cards llevan mapa (la serie guarda la data del
         juego → primer mapa; sin dato → fallback estable). En vivo se prefiere el
         splash remoto (nítido); si no, el .webp local; con el remoto de reserva. */
      const mapaNombre = mapaDeMatch(m);
      const splash = mapaSplash(mapaNombre);
      const local = mapaLocal(mapaNombre);
      const img = (vivo && splash) ? splash : (local || splash);
      const imgAttr = img ? ` style="--mc-img:url('${esc(img)}')" data-img="si"` : '';

      const triA = esc(a.tricode || a.name || 'TBD');
      const triB = esc(b.tricode || b.name || 'TBD');
      const sub =
        [m.name, torneo?.name].filter(Boolean).map(esc).join(' · ') ||
        (vivo ? 'Live now' : 'Finished');
      /* Done es automatico (lo cierra el servidor cuando la API confirma el fin
         de la serie): aqui solo queda REOPEN, para corregir si hizo falta. */
      const done = estado === 'done' ? `<button class="mc__ic" data-m-reopen="${m.id}" title="Reopen">↺</button>` : '';
      /* Terminado no se "arranca": si de verdad hay que retocarlo, es REOPEN
         primero (vuelve a estar en vivo), no jugar sobre un resultado ya cerrado. */
      const play = estado === 'done' ? '' : `<button class="mc__ic" data-m-start="${m.id}" title="${vivo ? 'Resume' : 'Start'}">▶</button>`;
      return (
        `<div class="mc spot" data-estado="${estado}" data-m-open="${m.id}"${imgAttr}>` +
        `<div class="mc__scrim" aria-hidden="true"></div>` +
        `<div class="mc__cont">` +
        `<div class="mc__top">` +
        `<span class="mc__estado"><i class="punto" aria-hidden="true"></i>${ESTADOS[estado] || estado}</span>` +
        `<span class="mc__fmt">${esc(m.formato || 'BO3')}</span>` +
        `</div>` +
        `<div class="mc__duelo">` +
        `<div class="mc__lado mc__lado--a">${barraEquipo(a, 'mc__bar')}<span class="mc__tri">${triA}</span></div>` +
        `<span class="mc__sc">${wl}<i>–</i>${wr}</span>` +
        `<div class="mc__lado mc__lado--b"><span class="mc__tri">${triB}</span>${barraEquipo(b, 'mc__bar')}</div>` +
        `</div>` +
        `<div class="mc__pie">` +
        `<span class="mc__sub">${sub}</span>` +
        `<div class="mc__acc">` +
        play +
        done +
        `<button class="mc__ic" data-m-edit="${m.id}" title="Edit">✎</button>` +
        `<button class="mc__ic mc__ic--del" data-m-del="${m.id}" title="Delete">✕</button>` +
        `</div>` +
        `</div>` +
        `</div>` +
        `</div>`
      );
    })
    .join('');
  escalona(c);
}

/* ══ Hero de Matches: match en vivo (o próximo) con el splash del mapa ══════ */
function pintaHero() {
  const el = $('m-hero');
  if (!el) return;
  /* El hero SIEMPRE muestra el match en EMISIÓN; si no hay ninguno, la ÚLTIMA
     partida (la más reciente por fecha, sin importar estado). Nunca un "próximo". */
  const live = matches.find((m) => estadoReal(m) === 'live');
  const reciente = matches
    .slice()
    .sort((x, y) => Number(y.createdAt ?? 0) - Number(x.createdAt ?? 0))[0];
  const next = live || reciente;
  if (!next) { el.hidden = true; return; }
  el.hidden = false;
  el.dataset.vivo = live ? 'si' : 'no';

  const a = equipoPorId(next.teamAId) || next.teamASnap || {};
  const b = equipoPorId(next.teamBId) || next.teamBSnap || {};
  const torneo = torneoPorId(next.tournamentId);
  const mapaNombre = mapaDeMatch(next);
  const img = mapaSplash(mapaNombre) || mapaLocal(mapaNombre);
  $('hero-kick-txt').textContent = live ? 'On air' : 'Last match';
  $('hero-img').style.backgroundImage = img ? `url('${img}')` : '';
  el.dataset.img = img ? 'si' : 'no';
  $('hero-nom-a').textContent = a.name || a.tricode || 'TBD';
  $('hero-nom-b').textContent = b.name || b.tricode || 'TBD';
  /* Identidad de equipo: LOGO si lo hay; si no, la barra con el color del equipo. */
  const ponBarra = (id, t) => {
    const el2 = $(id);
    if (!el2) return;
    if (t?.logoUrl) {
      el2.style.background = `center / cover no-repeat url('${t.logoUrl}')`;
      el2.classList.add('con-logo');
    } else {
      el2.style.background = colorEquipo(t);
      el2.classList.remove('con-logo');
    }
  };
  ponBarra('hero-bar-a', a);
  ponBarra('hero-bar-b', b);
  animaConteo($('hero-sc-a'), next.score?.wonLeft ?? 0);
  animaConteo($('hero-sc-b'), next.score?.wonRight ?? 0);
  /* Pie tipo "ASCENT · BO3 · EASY MASTERS 2026" (mapa · formato · torneo). */
  $('hero-foot').textContent = [mapaNombre ? mapaNombre.toUpperCase() : '', next.formato || 'BO3', torneo?.name || '']
    .filter(Boolean)
    .join(' · ');
  const go = $('hero-go');
  go.textContent = live ? 'Resume broadcast' : 'Start match';
  go.onclick = () => arrancaMatch(next.id);
  const end = $('hero-end');
  if (end) {
    end.hidden = !live;
    end.onclick = () => {
      if (confirm('End this broadcast?')) terminaBroadcast(next.id);
    };
  }
}

/* ── opciones de los selects del form de match ── */
function llenaSelectsMatch() {
  const opsEq = teams.map((t) => `<option value="${t.id}">${esc(t.name)} (${esc(t.tricode)})</option>`).join('');
  $('match-eqA').innerHTML = opsEq || '<option value="">— no teams —</option>';
  $('match-eqB').innerHTML = opsEq || '<option value="">— no teams —</option>';
  $('match-torneo').innerHTML =
    '<option value="">— None —</option>' +
    tournaments.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
}

/* ══ Diálogos ══ */
function abre(dlg) { $(dlg)?.showModal(); }
function cierra(dlg) { $(dlg)?.close(); }

/* Teams */
/* Jugadores del equipo que está abierto en el diálogo: copia de trabajo en
   memoria, se vuelca a team.players recién al guardar (igual que el resto del
   form). */
let jugadoresTeamActual = [];

function abreTeam(t) {
  $('dlg-team-tit').textContent = t ? 'Edit team' : 'New team';
  $('team-id').value = t?.id ?? '';
  $('team-name').value = t?.name ?? '';
  $('team-tri').value = t?.tricode ?? '';
  $('team-logo').value = t?.logoUrl ?? '';
  $('team-color').value = t?.color ?? '';
  jugadoresTeamActual = (t?.players ?? []).slice();
  const msg = $('team-jug-msg');
  if (msg) msg.hidden = true;
  if ($('team-jug-input')) $('team-jug-input').value = '';
  pintaJugadoresTeam();
  abre('dlg-team');
  /* Jugadores sembrados solo con name/tag (sin puuid/card todavía, ej. datos de
     prueba escritos a mano) se completan solos acá, sin que el operador tenga
     que volver a buscarlos uno por uno. */
  for (const j of jugadoresTeamActual) {
    if (!j.puuid) enriqueceJugador(j);
  }
}
async function guardaTeam(ev) {
  ev.preventDefault();
  const dato = {
    name: $('team-name').value.trim(),
    tricode: $('team-tri').value.trim(),
    logoUrl: $('team-logo').value.trim(),
    color: $('team-color').value.trim(), // hex opcional; vacío = color derivado (colorEquipo)
    players: jugadoresTeamActual,
  };
  if (!dato.name) return;
  const id = $('team-id').value;
  if (id) await DB().teams.update(id, dato);
  else await DB().teams.create(dato);
  cierra('dlg-team');
  await recarga();
}

function pintaJugadoresTeam() {
  const ul = $('team-jug-lista');
  if (!ul) return;
  ul.innerHTML = jugadoresTeamActual
    .map(
      (j) =>
        `<li class="team-jug-fila" data-puuid="${esc(j.puuid)}">` +
        (j.rangoIconUrl
          ? `<img class="team-jug-av" src="${esc(j.rangoIconUrl)}" alt="" />`
          : j.cardUrl
            ? `<img class="team-jug-av" src="${esc(j.cardUrl)}" alt="" />`
            : `<span class="team-jug-av team-jug-av--vacia"></span>`) +
        `<span class="team-jug-nom">${esc(j.name)}<span class="team-jug-tag">#${esc(j.tag)}</span></span>` +
        (j.rango
          ? `<span class="team-jug-rango">${esc(j.rango)}</span>`
          : `<span class="team-jug-rango team-jug-rango--vacio">—</span>`) +
        `<button class="team-jug-quitar" type="button" data-jug-quitar="${esc(j.puuid)}" title="Remove" aria-label="Remove">✕</button>` +
        `</li>`,
    )
    .join('');
}

/* Rango competitivo actual (MMR de HenrikDev v2, por shard/región — ver
   henrikRegion()). Se guarda en el jugador de la lista de trabajo y se
   repinta; si el jugador no tiene partidas competitivas o la región no
   coincide, HenrikDev devuelve 'Unrated' o falla — en ambos casos se deja sin
   rango en vez de romper el agregado. */
async function buscaRangoHenrik(jugador) {
  const cache = henrikCacheGet(jugador.name, jugador.tag);
  if (cache?.rango) {
    jugador.rango = cache.rango;
    jugador.rangoIconUrl = cache.rangoIconUrl || '';
    pintaJugadoresTeam();
    return;
  }
  const key = henrikKey();
  if (!key) return;
  try {
    const r = await fetch(
      `https://api.henrikdev.xyz/valorant/v2/mmr/${henrikRegion()}/${encodeURIComponent(jugador.name)}/${encodeURIComponent(jugador.tag)}`,
      { headers: { Authorization: key } },
    );
    if (!r.ok) return;
    const j = await r.json();
    const cd = j?.data?.current_data;
    if (!cd?.currenttierpatched) return;
    jugador.rango = cd.currenttierpatched;
    jugador.rangoIconUrl = cd.images?.small ?? '';
    henrikCacheSet(jugador.name, jugador.tag, { rango: jugador.rango, rangoIconUrl: jugador.rangoIconUrl });
    pintaJugadoresTeam();
  } catch {
    /* sin rango, no rompe nada — el jugador ya está agregado */
  }
}

/* HenrikDev exige API key en TODA llamada (no solo para subir el rate limit,
   sin key es 401 directo) — se guarda solo local, nunca va al servidor. */
function henrikKey() {
  try { return localStorage.getItem('easy.henrikKey') || ''; } catch { return ''; }
}
/* El MMR/rango es por shard: hay que preguntarle a la región donde el jugador
   compite, no a una fija — se guarda junto a la key. */
function henrikRegion() {
  try { return localStorage.getItem('easy.henrikRegion') || 'latam'; } catch { return 'latam'; }
}

/* Cache local (localStorage) de lo que ya se resolvió de HenrikDev, por
   Name#Tag. Sin esto, CADA vez que se abre el diálogo de un equipo se vuelve
   a pedir cuenta + rango por red para todos sus jugadores — ahí está la
   demora que se nota en pintar el ícono de rango. Con el cache, la segunda
   vez que se abre el mismo equipo todo sale de disco, instantáneo, cero
   espera. TTL de 24h: un rango de hace más de un día ya puede estar viejo. */
const HENRIK_CACHE_TTL = 24 * 60 * 60 * 1000;
const henrikCacheKey = (name, tag) => `easy.henrikCache.${(name || '').toLowerCase()}#${(tag || '').toLowerCase()}`;
function henrikCacheGet(name, tag) {
  try {
    const c = JSON.parse(localStorage.getItem(henrikCacheKey(name, tag)) || 'null');
    if (!c || Date.now() - c.ts > HENRIK_CACHE_TTL) return null;
    return c;
  } catch {
    return null;
  }
}
function henrikCacheSet(name, tag, patch) {
  try {
    const actual = henrikCacheGet(name, tag) || {};
    localStorage.setItem(henrikCacheKey(name, tag), JSON.stringify({ ...actual, ...patch, ts: Date.now() }));
  } catch {
    /* sin storage */
  }
}

/* Resuelve puuid/card para un jugador que ya tiene name+tag pero llegó sin
   esos datos (sembrado a mano, o una edición vieja). Primero mira el cache
   local; si hay algo fresco ahí ni siquiera pega a la red. Si no, usa el
   mismo lookup de cuenta que buscaJugadorHenrik, silencioso: si falla, el
   jugador se queda como está, no se saca del equipo. */
async function enriqueceJugador(jugador) {
  const cache = henrikCacheGet(jugador.name, jugador.tag);
  if (cache?.puuid) {
    jugador.puuid = cache.puuid;
    jugador.cardUrl = cache.cardUrl || '';
    jugador.rango = cache.rango || '';
    jugador.rangoIconUrl = cache.rangoIconUrl || '';
    pintaJugadoresTeam();
    /* Puede que el cache tenga cuenta pero no rango todavía (quedó a medio
       resolver la última vez) — buscaRangoHenrik también mira su propio
       cache primero, así que esto no pega a la red de más. */
    if (!cache.rango) buscaRangoHenrik(jugador);
    return;
  }
  const key = henrikKey();
  if (!key) return;
  try {
    const r = await fetch(`https://api.henrikdev.xyz/valorant/v2/account/${encodeURIComponent(jugador.name)}/${encodeURIComponent(jugador.tag)}`, {
      headers: { Authorization: key },
    });
    if (!r.ok) return;
    const d = (await r.json())?.data;
    if (!d?.puuid) return;
    jugador.puuid = d.puuid;
    jugador.cardUrl = d.card?.small ?? '';
    henrikCacheSet(jugador.name, jugador.tag, { puuid: jugador.puuid, cardUrl: jugador.cardUrl });
    pintaJugadoresTeam();
    buscaRangoHenrik(jugador);
  } catch {
    /* sin datos, se queda tal cual */
  }
}

/* Busca un Riot ID exacto (Name#Tag) contra HenrikDev y lo agrega a la lista de
   trabajo. HenrikDev no tiene búsqueda por nombre parcial — solo lookup exacto —
   así que esto confirma/enriquece (card, puuid), no autocompleta mientras se
   escribe. */
async function buscaJugadorHenrik() {
  const input = $('team-jug-input');
  const msg = $('team-jug-msg');
  const crudo = (input?.value ?? '').trim();
  const partes = crudo.split('#');
  if (partes.length !== 2 || !partes[0] || !partes[1]) {
    if (msg) { msg.textContent = 'Use the exact format Name#Tag.'; msg.hidden = false; }
    return;
  }
  const [nombre, tag] = partes;
  if (jugadoresTeamActual.some((j) => j.name.toLowerCase() === nombre.toLowerCase() && j.tag.toLowerCase() === tag.toLowerCase())) {
    if (msg) { msg.textContent = 'Already on this team.'; msg.hidden = false; }
    return;
  }
  const key = henrikKey();
  if (!key) {
    if (msg) { msg.textContent = 'Add a HenrikDev API key in Settings → Player lookup first.'; msg.hidden = false; }
    return;
  }
  if (msg) { msg.textContent = 'Looking up…'; msg.hidden = false; }
  try {
    const r = await fetch(`https://api.henrikdev.xyz/valorant/v2/account/${encodeURIComponent(nombre)}/${encodeURIComponent(tag)}`, {
      headers: { Authorization: key },
    });
    if (r.status === 401) { if (msg) msg.textContent = 'That HenrikDev API key was rejected — check it in Settings.'; return; }
    if (r.status === 404) { if (msg) msg.textContent = 'No player with that Riot ID.'; return; }
    if (r.status === 429) { if (msg) msg.textContent = 'Rate limited by HenrikDev — wait a bit and try again.'; return; }
    if (!r.ok) { if (msg) msg.textContent = `Lookup failed (${r.status}). Try again in a bit.`; return; }
    const j = await r.json();
    const d = j?.data;
    if (!d?.puuid) { if (msg) msg.textContent = 'No player with that Riot ID.'; return; }
    const jugador = {
      puuid: d.puuid,
      name: d.name ?? nombre,
      tag: d.tag ?? tag,
      cardUrl: d.card?.small ?? '',
      rango: '',
      rangoIconUrl: '',
    };
    henrikCacheSet(jugador.name, jugador.tag, { puuid: jugador.puuid, cardUrl: jugador.cardUrl });
    jugadoresTeamActual.push(jugador);
    if (input) input.value = '';
    if (msg) msg.hidden = true;
    pintaJugadoresTeam();
    /* El rango se resuelve después, sin bloquear el agregado: si la región está
       mal o el jugador no tiene partidas competitivas, el jugador igual queda
       en el equipo, solo sin rango. */
    buscaRangoHenrik(jugador);
  } catch {
    if (msg) msg.textContent = 'Could not reach the lookup service.';
  }
}

/* Tournaments */
function abreTournament(t) {
  $('dlg-to-tit').textContent = t ? 'Edit tournament' : 'New tournament';
  $('to-id').value = t?.id ?? '';
  $('to-name').value = t?.name ?? '';
  $('to-logo').value = t?.logoUrl ?? '';
  $('to-backdrop').value = t?.backdropUrl ?? '';
  abre('dlg-tournament');
}
async function guardaTournament(ev) {
  ev.preventDefault();
  const dato = {
    name: $('to-name').value.trim(),
    logoUrl: $('to-logo').value.trim(),
    backdropUrl: $('to-backdrop').value.trim(),
  };
  if (!dato.name) return;
  const id = $('to-id').value;
  if (id) await DB().tournaments.update(id, dato);
  else await DB().tournaments.create(dato);
  cierra('dlg-tournament');
  await recarga();
}

/* Matches */
function abreMatch(m) {
  $('dlg-match-tit').textContent = m ? 'Edit match' : 'New match';
  llenaSelectsMatch();
  $('match-id').value = m?.id ?? '';
  $('match-name').value = m?.name ?? '';
  $('match-formato').value = m?.formato ?? 'BO3';
  $('match-torneo').value = m?.tournamentId ?? '';
  if (teams.length > 0) {
    $('match-eqA').value = m?.teamAId ?? teams[0].id;
    $('match-eqB').value = m?.teamBId ?? (teams[1]?.id ?? teams[0].id);
  }
  abre('dlg-match');
}
function datosMatchDelForm() {
  const formato = $('match-formato').value;
  const teamAId = $('match-eqA').value;
  const teamBId = $('match-eqB').value;
  return {
    name: $('match-name').value.trim(),
    formato,
    needed: neededDe(formato),
    teamAId,
    teamBId,
    teamASnap: snap(equipoPorId(teamAId)),
    teamBSnap: snap(equipoPorId(teamBId)),
    tournamentId: $('match-torneo').value || null,
  };
}
async function guardaMatch(ev) {
  ev.preventDefault();
  const dato = datosMatchDelForm();
  const id = $('match-id').value;
  if (id) {
    /* Editar un match existente: guarda y se queda en la lista (no arranca). */
    await DB().matches.update(id, dato);
    cierra('dlg-match');
    await recarga();
    return;
  }
  /* Crear un match NUEVO no lo deja de draft en la lista: lo crea y lo ARRANCA
     (pasa a live y entra al lobby en vivo para empezar con el overlay). */
  const r = await DB().matches.create({ ...dato, score: { wonLeft: 0, wonRight: 0 }, mapInfo: [], estado: 'draft' });
  cierra('dlg-match');
  await recarga();
  if (r?.item?.id) await arrancaMatch(r.item.id);
}

/* ── Start: empuja la config del match a emisión ── */
async function arrancaMatch(id) {
  const m = matches.find((x) => x.id === id);
  if (!m) return;
  const a = equipoPorId(m.teamAId) || m.teamASnap || {};
  const b = equipoPorId(m.teamBId) || m.teamBSnap || {};
  const torneo = torneoPorId(m.tournamentId);
  iniciaConfig({
    tournamentInfo: {
      name: torneo?.name ?? '',
      logoUrl: torneo?.logoUrl ?? '',
      backdropUrl: torneo?.backdropUrl ?? '',
    },
    seriesInfo: {
      needed: m.needed ?? neededDe(m.formato),
      wonLeft: m.score?.wonLeft ?? 0,
      wonRight: m.score?.wonRight ?? 0,
      mapInfo: m.mapInfo ?? [],
    },
    equipos: [
      { name: a.name || '', tricode: a.tricode || '', url: a.logoUrl || '' },
      { name: b.name || '', tricode: b.tricode || '', url: b.logoUrl || '' },
    ],
  });
  /* Solo un match EN ANTENA a la vez: cualquier otro que estuviera 'live' deja
     de estarlo. Si ya se había decidido por marcador queda como 'done'; si no,
     no existe un estado intermedio donde guardarlo — se borra (no se programan
     partidas, así que una que no se completó nunca "existió"). */
  for (const otro of matches.slice()) {
    if (otro.id !== id && otro.estado === 'live') {
      if (finalizada(otro)) {
        await DB().matches.update(otro.id, { estado: 'done' });
        otro.estado = 'done';
      } else {
        await DB().matches.remove(otro.id);
        matches = matches.filter((x) => x.id !== otro.id);
      }
    }
  }
  await DB().matches.update(id, { estado: 'live' });
  m.estado = 'live';
  alIniciar?.(); // cierra el dashboard → vista operativa
}

/* End broadcast: saca el match de antena sin pasar por otro match. Si la
   serie ya se decidió por marcador, queda 'done'; si no, se borra (mismo
   criterio que arrancaMatch al reemplazar el match en vivo). */
async function terminaBroadcast(id) {
  const m = matches.find((x) => x.id === id);
  if (!m) return;
  if (finalizada(m)) {
    await DB().matches.update(id, { estado: 'done' });
  } else {
    await DB().matches.remove(id);
    matches = matches.filter((x) => x.id !== id);
  }
  await recarga();
}

/* Quick match: BO1 sin torneo, arranca al toque (sin equipos definidos aún). */
async function quickMatch() {
  const r = await DB().matches.create({
    name: '',
    formato: 'BO1',
    needed: 1,
    teamAId: null,
    teamBId: null,
    teamASnap: snap(null),
    teamBSnap: snap(null),
    tournamentId: null,
    score: { wonLeft: 0, wonRight: 0 },
    mapInfo: [],
    estado: 'draft',
  });
  await recarga();
  if (r?.item) await arrancaMatch(r.item.id);
}

/* ── Navegación de la sidebar ── */
function activa(panel) {
  for (const it of document.querySelectorAll('#menu-inicio .menu__item')) {
    it.classList.toggle('is-activo', it.dataset.panel === panel);
  }
  for (const s of document.querySelectorAll('#menu-inicio .menu__panel')) {
    s.classList.toggle('is-activo', s.dataset.panel === panel);
  }
  if (panel === 'teams') precargaJugadores();
}

/* ══ API para el shell ══ */
export function montaDashboard(cb) {
  alIniciar = cb;

  /* La lobby (fuera del dashboard) pide reabrir el dashboard en una sección con
     el evento 'abre-dashboard' (su raíl de iconos y el «← Matches»). Aquí se
     atiende: se muestra el dashboard y se activa el panel indicado. */
  window.addEventListener('abre-dashboard', (e) => {
    muestraDashboard(true);
    const p = e.detail;
    if (typeof p === 'string' && p) activa(p);
  });

  /* Settings vive como una sección MÁS del dashboard (a la derecha, sin tapar):
     se mueve `#vista-ajustes` (del panel viejo) al contenido y se convierte en
     un `menu__panel`. Sus campos siguen funcionando (delegados en document). */
  const aj = $('vista-ajustes');
  const cont = $('menu-inicio')?.querySelector('.menu__cont');
  if (aj && cont && aj.parentElement !== cont) {
    aj.classList.remove('vista');
    aj.classList.add('menu__panel');
    aj.dataset.panel = 'settings';
    aj.hidden = false; // lo gobierna `is-activo`, no el atributo
    cont.appendChild(aj);
  }

  /* API key de HenrikDev: se carga de localStorage y se guarda apenas se edita
     (mismo patrón que easy.foto/easy.sbColapsado — solo esta máquina). */
  const inKey = $('set-henrik-key');
  if (inKey) {
    inKey.value = henrikKey();
    inKey.addEventListener('change', () => {
      try { localStorage.setItem('easy.henrikKey', inKey.value.trim()); } catch { /* sin storage */ }
    });
  }
  const inRegion = $('set-henrik-region');
  if (inRegion) {
    inRegion.value = henrikRegion();
    inRegion.addEventListener('change', () => {
      try { localStorage.setItem('easy.henrikRegion', inRegion.value); } catch { /* sin storage */ }
    });
  }

  for (const it of document.querySelectorAll('#menu-inicio .menu__item[data-panel]')) {
    it.addEventListener('click', () => activa(it.dataset.panel));
  }

  /* Efectos: spotlight en cards/hero, proximidad en el raíl. Un solo listener
     por contenedor, no por card, así que sobreviven a cada repintado. */
  activaSpotlight($('m-lista'));
  activaSpotlight($('m-hero'));
  activaRailProximidad(document.querySelector('.sb__body'));

  /* Settings + Account: ítems de navegación normales. */
  $('sb-settings')?.addEventListener('click', () => activa('settings'));
  $('sb-acc')?.addEventListener('click', () => activa('account'));

  /* Ocultar/mostrar el sidebar (colapsa a rail de iconos), recordando el estado. */
  const caja = $('menu-inicio');
  $('sb-collapse')?.addEventListener('click', () => {
    const col = caja?.classList.toggle('is-colapsado');
    try { localStorage.setItem('easy.sbColapsado', col ? '1' : '0'); } catch { /* sin storage */ }
  });
  try { if (localStorage.getItem('easy.sbColapsado') === '1') caja?.classList.add('is-colapsado'); } catch { /* sin storage */ }

  /* Foto de perfil: se ve al instante en local y se sube al VPS. Si el servidor
     no está (o no hay sesión), se queda en este PC y se avisa. Tope 2 MB. */
  $('acc-subir')?.addEventListener('click', () => $('acc-file')?.click());
  $('acc-file')?.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { flash('Image is too large — under 2 MB, please.'); return; }
    const r = new FileReader();
    r.onload = async () => {
      const dataUrl = String(r.result);
      try { localStorage.setItem('easy.foto', dataUrl); } catch { /* sin storage */ }
      pintaCuenta();
      try {
        const resp = await apiPerfil('foto', { method: 'POST', body: JSON.stringify({ foto: dataUrl }) });
        if (resp.ok) {
          const d = await resp.json().catch(() => ({}));
          if (d.fotoUrl) { try { localStorage.setItem('easy.foto', d.fotoUrl); } catch { /* sin storage */ } pintaCuenta(); }
          flash('Photo saved');
        } else {
          flash('Saved on this PC only');
        }
      } catch { flash('Saved on this PC only'); }
    };
    r.readAsDataURL(f);
  });
  $('acc-quitar')?.addEventListener('click', async () => {
    try { localStorage.removeItem('easy.foto'); } catch { /* sin storage */ }
    pintaCuenta();
    try { await apiPerfil('foto', { method: 'POST', body: JSON.stringify({ foto: '' }) }); } catch { /* solo local */ }
  });

  /* Edición de cuenta: contraseña, logout y las filas inline (nombre/org). */
  $('acc-cambia-pass')?.addEventListener('click', () => { const e = $('pass-error'); if (e) e.hidden = true; abre('dlg-pass'); });
  $('form-pass')?.addEventListener('submit', cambiaPass);
  $('acc-salir')?.addEventListener('click', () => sal());

  /* Botones "New" y "Quick". */
  $('eq-nuevo')?.addEventListener('click', () => abreTeam(null));
  $('to-nuevo')?.addEventListener('click', () => abreTournament(null));
  $('m-nuevo')?.addEventListener('click', () => abreMatch(null));
  $('m-quick')?.addEventListener('click', quickMatch);

  /* Buscar/agregar jugador en el diálogo de equipo: botón, Enter en el input. */
  $('team-jug-add')?.addEventListener('click', buscaJugadorHenrik);
  $('team-jug-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); buscaJugadorHenrik(); }
  });

  /* Forms. */
  $('form-team')?.addEventListener('submit', guardaTeam);
  $('form-tournament')?.addEventListener('submit', guardaTournament);
  $('form-match')?.addEventListener('submit', guardaMatch);
  for (const b of document.querySelectorAll('[data-cerrar]')) {
    b.addEventListener('click', () => b.closest('dialog')?.close());
  }

  /* Filtros del dashboard (pills de estado, chips de ronda/formato, orden, clear).
     Toggle: pulsar el filtro activo lo apaga. Todo client-side; repinta cards. */
  const repintaFiltro = () => { pintaFiltros(); pintaMatches(); };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-m-estado],[data-m-ronda],[data-m-formato],[data-m-orden],[data-m-clear]');
    if (b === null) return;
    const d = b.dataset;
    if (d.mClear !== undefined) { filtro.estado = ''; filtro.torneo = ''; filtro.ronda = ''; filtro.formato = ''; return repintaFiltro(); }
    if (d.mEstado !== undefined) { filtro.estado = filtro.estado === d.mEstado ? '' : d.mEstado; return repintaFiltro(); }
    if (d.mRonda !== undefined) { filtro.ronda = filtro.ronda === d.mRonda ? '' : d.mRonda; return repintaFiltro(); }
    if (d.mFormato !== undefined) { filtro.formato = filtro.formato === d.mFormato ? '' : d.mFormato; return repintaFiltro(); }
    if (d.mOrden !== undefined) { filtro.orden = filtro.orden === 'recent' ? '' : 'recent'; return repintaFiltro(); }
  });
  /* El dropdown de torneo del filtro (se re-renderiza, así que va delegado). */
  document.addEventListener('change', (e) => {
    if (e.target?.id === 'm-torneo-filtro') { filtro.torneo = e.target.value; repintaFiltro(); }
  });

  /* Acciones delegadas de las listas. */
  document.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-nuevo],[data-eq-edit],[data-eq-del],[data-to-edit],[data-to-del],[data-m-edit],[data-m-del],[data-m-start],[data-m-reopen],[data-m-open],[data-acc-edit],[data-acc-save],[data-acc-cancel],[data-jug-quitar]');
    if (t === null) return;
    const d = t.dataset;
    if (d.jugQuitar) {
      jugadoresTeamActual = jugadoresTeamActual.filter((j) => j.puuid !== d.jugQuitar);
      pintaJugadoresTeam();
      return;
    }
    /* Clic en el CUERPO de la card (no en un botón): abre el match para editar.
       Los botones ▶/✎/✕ ganan por `closest` (están más cerca del clic). */
    if (d.mOpen) {
      const match = matches.find((x) => x.id === d.mOpen);
      if (match && estadoReal(match) === 'done') return abreDetalleMatch(match);
      return abreMatch(match);
    }
    if (d.accEdit) return editaCampo(d.accEdit, true);
    if (d.accCancel) return editaCampo(d.accCancel, false);
    if (d.accSave) return guardaCampo(d.accSave);
    /* Reopen tiene que borrar el marcador/mapInfo, no solo el estado: estadoReal
       deriva 'done' del marcador (finalizada()) sin importar m.estado, asi que
       si solo se tocara estado, la card seguiria mostrandose done para siempre.
       Después arranca de nuevo (vuelve a antena), igual que abrir cualquier match. */
    if (d.mReopen) {
      await DB().matches.update(d.mReopen, { estado: 'live', score: { wonLeft: 0, wonRight: 0 }, mapInfo: [] });
      const m = matches.find((x) => x.id === d.mReopen);
      if (m) { m.estado = 'live'; m.score = { wonLeft: 0, wonRight: 0 }; m.mapInfo = []; }
      await recarga();
      await arrancaMatch(d.mReopen);
      return;
    }
    if (d.nuevo === 'team') return abreTeam(null);
    if (d.nuevo === 'tournament') return abreTournament(null);
    if (d.nuevo === 'match') return abreMatch(null);
    if (d.eqEdit) return abreTeam(teams.find((x) => x.id === d.eqEdit));
    if (d.toEdit) return abreTournament(tournaments.find((x) => x.id === d.toEdit));
    if (d.mEdit) return abreMatch(matches.find((x) => x.id === d.mEdit));
    if (d.mStart) return arrancaMatch(d.mStart);
    if (d.eqDel) {
      /* Borrar un equipo no debe romper sus matches: el snapshot ya congela
         nombre/tricode/logo, pero el id queda colgando, así que se nullea. */
      const usan = matches.filter((m) => m.teamAId === d.eqDel || m.teamBId === d.eqDel);
      const msg = usan.length ? `Delete this team? ${usan.length} match${usan.length === 1 ? '' : 'es'} using it keep their saved copy.` : 'Delete this team?';
      if (confirm(msg)) {
        for (const m of usan) {
          const patch = {};
          if (m.teamAId === d.eqDel) patch.teamAId = null;
          if (m.teamBId === d.eqDel) patch.teamBId = null;
          await DB().matches.update(m.id, patch);
        }
        await DB().teams.remove(d.eqDel);
        await recarga();
      }
    }
    if (d.toDel) {
      /* Borrar un torneo no debe dejar matches apuntando a un id inexistente:
         se desasignan (tournamentId=null) antes de borrar. */
      const dentro = matches.filter((m) => m.tournamentId === d.toDel);
      const msg = dentro.length ? `Delete this tournament? Its ${dentro.length} match${dentro.length === 1 ? '' : 'es'} will be kept but unassigned.` : 'Delete this tournament?';
      if (confirm(msg)) {
        for (const m of dentro) await DB().matches.update(m.id, { tournamentId: null });
        await DB().tournaments.remove(d.toDel);
        await recarga();
      }
    }
    if (d.mDel && confirm('Delete this match?')) { await DB().matches.remove(d.mDel); await recarga(); }
  });
}

/* ══ Perfil (la cuenta en el VPS) ══════════════════════════════════════════
   El panel es web puro, pero SÍ puede `fetch` a un servicio externo (igual que
   el login en sesion.js). La edición de cuenta va directa a la API de cuentas
   con el token de sesión como Bearer. `nombre`/`org` viajan al VPS; el nombre
   vive DENTRO del token de emisión, así que el servidor lo re-emite y aquí se
   aplica con `ponEmision` — el cliente nunca se inventa su propio nombre. */
let perfil = { email: '', org: '', groupCode: '', plan: '' };

const nombreCuenta = () => { try { return cuenta()?.cliente || ''; } catch { return ''; } };

/** Flash efímero de confirmación en el pie del panel Account. */
let flashT = 0;
function flash(msg) {
  const el = $('acc-flash');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('vis');
  clearTimeout(flashT);
  flashT = setTimeout(() => el.classList.remove('vis'), 2400);
}

/** Una llamada a la API de cuentas con el Bearer y el guard de HTTPS del login. */
async function apiPerfil(ruta, opts = {}) {
  const tk = tokenSesion?.() || '';
  if (!tk) throw new Error('no-session');
  if (!seguro(API_CUENTAS)) throw new Error('insecure');
  return fetch(API_CUENTAS + ruta, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}`, ...(opts.headers || {}) },
  });
}

/** Trae el perfil del VPS al abrir el dashboard. Si no hay sesión/red, se queda
    con lo local sin romper nada. */
async function cargaPerfil() {
  try {
    const r = await apiPerfil('mi-perfil');
    if (!r.ok) return;
    const d = await r.json();
    perfil = { email: d.email || '', org: d.org || '', groupCode: d.groupCode || '', plan: d.plan || '' };
    if (d.fotoUrl) { try { localStorage.setItem('easy.foto', d.fotoUrl); } catch { /* sin storage */ } }
    pintaCuenta();
  } catch { /* sin sesión o sin red: se mantiene lo que haya en local */ }
}

/** Alterna una fila entre ver-valor y editar-input. */
function editaCampo(campo, on) {
  const fila = document.querySelector(`.acc__fila[data-campo="${campo}"]`);
  if (!fila) return;
  const meta = fila.querySelector('.acc__meta');
  const ed = fila.querySelector('.acc__edita');
  const lap = fila.querySelector('.acc__lapiz');
  if (on) {
    const inp = $(`acc-in-${campo}`);
    if (inp) inp.value = campo === 'nombre' ? nombreCuenta() : perfil.org;
    if (meta) meta.hidden = true;
    if (lap) lap.hidden = true;
    if (ed) ed.hidden = false;
    inp?.focus();
    inp?.select();
  } else {
    if (meta) meta.hidden = false;
    if (lap) lap.hidden = false;
    if (ed) ed.hidden = true;
  }
}

/** Guarda nombre/org en el VPS. El nombre re-emite el permiso (claim `c`). */
async function guardaCampo(campo) {
  const inp = $(`acc-in-${campo}`);
  if (!inp) return;
  const v = inp.value.trim();
  if (campo === 'nombre' && v.length < 1) { flash('Name can’t be empty'); return; }
  try {
    const r = await apiPerfil('perfil', { method: 'POST', body: JSON.stringify({ [campo]: v }) });
    if (!r.ok) throw new Error('http');
    const d = await r.json().catch(() => ({}));
    if (campo === 'org') perfil.org = v;
    if (campo === 'nombre' && d.overlayToken) ponEmision(d.overlayToken); // sidebar/cabecera al día
    editaCampo(campo, false);
    pintaCuenta();
    flash('Saved');
  } catch (e) {
    if (e.message === 'no-session') flash('Sign in to edit your account');
    else if (e.message === 'insecure') flash('Can’t reach a secure server');
    else flash('Couldn’t save — try again');
  }
}

/** Cambio de contraseña: acción sensible, directa al VPS, nada se guarda. */
async function cambiaPass(ev) {
  ev.preventDefault();
  const err = $('pass-error');
  const fail = (m) => { if (err) { err.textContent = m; err.hidden = false; } };
  const actual = $('pass-actual')?.value ?? '';
  const nueva = $('pass-nueva')?.value ?? '';
  const conf = $('pass-confirma')?.value ?? '';
  if (nueva.length < 8) return fail('Use at least 8 characters.');
  if (nueva !== conf) return fail('Passwords don’t match.');
  if (nueva === actual) return fail('New password must be different.');
  if (err) err.hidden = true;
  try {
    const r = await apiPerfil('contrasena', { method: 'POST', body: JSON.stringify({ actual, nueva }) });
    if (r.status === 401) return fail('Current password is incorrect.');
    if (!r.ok) return fail('Couldn’t change it — try again.');
    cierra('dlg-pass');
    flash('Password changed');
  } catch (e) {
    fail(e.message === 'no-session' ? 'Sign in to change your password.' : 'Can’t reach a secure server.');
  } finally {
    for (const id of ['pass-actual', 'pass-nueva', 'pass-confirma']) { const el = $(id); if (el) el.value = ''; }
  }
}

/** Cuenta: nombre, plan, avatar (foto o iniciales) + campos del panel Account. */
function pintaCuenta() {
  let c = null;
  try { c = cuenta?.() ?? null; } catch { c = null; }
  const nombre = c?.cliente || 'No session';
  const plan = perfil.plan || (c ? 'Broadcast permit' : '—');
  const iniciales = (nombre.replace(/[^A-Za-z0-9]/g, '') || 'EH').slice(0, 2).toUpperCase();
  let foto = '';
  try { foto = localStorage.getItem('easy.foto') || ''; } catch { foto = ''; }

  const set = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
  set('acc-nombre', nombre);            // footer
  set('acc-plan', plan);                // footer
  set('acc-val-nombre', nombre);        // panel: fila editable
  set('acc-val-org', perfil.org || '—');
  set('acc-val-email', perfil.email || '—');
  set('acc-val-grupo', perfil.groupCode || '—');
  set('acc-plan2', plan);

  /* Avatar del footer, el grande del panel y el del raíl de la lobby: foto si
     hay, si no las iniciales. */
  for (const el of [$('acc-av'), $('acc-foto'), $('lrail-av')]) {
    if (el === null) continue;
    if (foto) {
      el.style.backgroundImage = `url("${foto}")`;
      el.textContent = '';
      el.classList.add('con-foto');
    } else {
      el.style.backgroundImage = '';
      el.textContent = iniciales;
      el.classList.remove('con-foto');
    }
  }
  $('acc-quitar')?.toggleAttribute('hidden', !foto);
}

export function muestraDashboard(visible) {
  const caja = $('menu-inicio');
  if (caja === null) return;
  caja.hidden = !visible;
  if (visible) {
    activa('matches');
    pintaCuenta();
    cargaPerfil(); // trae email/org/grupo/plan/foto del VPS (si hay sesión)
    recarga();
    /* Los uuid de mapa/agente llegan async; al tenerlos, se repinta lo que usa
       imagen (hero + filas). Hasta entonces todo degrada a glass/gradiente. */
    calientaAssets().then(() => { pintaMatches(); pintaHero(); });
  }
}
