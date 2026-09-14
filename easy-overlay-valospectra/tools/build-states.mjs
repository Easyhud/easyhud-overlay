/**
 * Genera el catálogo de pantallas del overlay, una por fichero.
 *
 *   node packages/overlay/tools/build-states.mjs
 *
 * Para qué: `build-static.mjs` congela **una** pantalla —el HUD de combate— y
 * eso ya está diseñado. Esto congela **todas las demás**, que son las que
 * faltan por fabricar: el cartel de ronda ganada, la fase de compra, el
 * historial, el tiempo muerto, el final de mapa, los avisos del operador y los
 * estados degradados.
 *
 * Mismas reglas que el otro generador, y por los mismos motivos:
 *
 *  - **Cero JavaScript.** El estado va escrito ya expandido en el HTML. Una
 *    herramienta de diseño que abra el overlay de producción ve una página en
 *    blanco, porque en producción el markup lo rellena un WebSocket.
 *  - **Cero ficheros aparte.** El CSS va dentro y las imágenes apuntan al CDN
 *    de Riot, así que cada fichero pesa kilobytes.
 *  - **1920x1080 exacto**, sin la transformación de escala de producción.
 *
 * Y una regla propia de este catálogo: **el diseño no es cosa de este
 * fichero**. Lo que sale de aquí es un andamio deliberadamente sobrio con
 * TODOS los datos de cada pantalla y de dónde sale cada uno. La forma la pone
 * quien diseña; lo que no puede pasar es que se diseñe una pantalla y luego
 * falte un dato o sobre un hueco.
 *
 * Cada fichero acaba con una ficha de datos que se puede borrar de un tijeretazo.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'mockups');
const API = 'https://valorant-api.com/v1';

/* ------------------------------ Estado fijo ------------------------------- */

const TEAMS = [
  { tricode: 'INF', name: 'Infinity', seeding: 'Grupo A', score: 8, side: 'attack', mapsWon: 1, timeouts: 1 },
  { tricode: 'PRX', name: 'Paper Rex', seeding: 'Grupo B', score: 9, side: 'defense', mapsWon: 0, timeouts: 2 },
];

/**
 * Los diez, con todo lo que la fase de compra necesita.
 *
 * `health: null` es el jugador que no corre el cliente auxiliar: su vida es
 * desconocida y **no se pinta**. Hay uno a propósito en cada pantalla que
 * enseñe vida, porque es la regla más importante del producto.
 */
const PLAYERS = [
  { team: 0, name: 'Kestrel89', agent: 'Jett',     alive: true,  health: 100,  armor: 'heavy', weapon: 'Vandal',   money: 4900, ult: [7, 7], kda: [18, 9, 4],  spike: false, observed: false, locked: true },
  { team: 0, name: 'Mirra72',   agent: 'Sova',     alive: true,  health: 64,   armor: 'light', weapon: 'Outlaw',   money: 3200, ult: [5, 8], kda: [11, 12, 9], spike: false, observed: false, locked: true },
  { team: 0, name: 'Volt18',    agent: 'Killjoy',  alive: false, health: 0,    armor: 'none',  weapon: '',         money: 0,    ult: [4, 8], kda: [7, 12, 2],  spike: false, observed: false, locked: true },
  { team: 0, name: 'Nyx61',     agent: 'Omen',     alive: false, health: 0,    armor: 'none',  weapon: '',         money: 1450, ult: [3, 7], kda: [9, 11, 6],  spike: true,  observed: false, locked: true },
  { team: 0, name: 'Sable74',   agent: 'Raze',     alive: true,  health: 100,  armor: 'heavy', weapon: 'Operator', money: 7600, ult: [8, 8], kda: [14, 8, 3],  spike: false, observed: true,  locked: true },

  { team: 1, name: 'Quill54',   agent: 'Viper',    alive: true,  health: 100,  armor: 'heavy', weapon: 'Vandal',   money: 5300, ult: [6, 7], kda: [15, 10, 5], spike: false, observed: false, locked: true },
  { team: 1, name: 'Harbor63',  agent: 'Cypher',   alive: true,  health: 87,   armor: 'light', weapon: 'Marshal',  money: 2450, ult: [2, 6], kda: [8, 11, 7],  spike: false, observed: false, locked: true },
  { team: 1, name: 'Ember20',   agent: 'Neon',     alive: false, health: 0,    armor: 'none',  weapon: '',         money: 0,    ult: [5, 7], kda: [10, 13, 3], spike: false, observed: false, locked: false },
  { team: 1, name: 'Onyx23',    agent: 'Chamber',  alive: true,  health: 45,   armor: 'heavy', weapon: 'Operator', money: 6800, ult: [8, 8], kda: [16, 9, 2],  spike: false, observed: false, locked: true },
  { team: 1, name: 'Rune81',    agent: 'Clove',    alive: true,  health: null, armor: 'light', weapon: 'Classic',  money: 800,  ult: [4, 7], kda: [6, 10, 8],  spike: false, observed: false, locked: true },
];

/** Historial de 17 rondas: la 13 es donde cambian los bandos. */
const HISTORY = [
  { round: 1,  winner: 0, reason: 'elimination' }, { round: 2,  winner: 1, reason: 'defuse' },
  { round: 3,  winner: 0, reason: 'detonate' },    { round: 4,  winner: 0, reason: 'timeout' },
  { round: 5,  winner: 1, reason: 'elimination' }, { round: 6,  winner: 1, reason: 'elimination' },
  { round: 7,  winner: 0, reason: 'detonate' },    { round: 8,  winner: 1, reason: 'timeout' },
  { round: 9,  winner: 0, reason: 'elimination' }, { round: 10, winner: 1, reason: 'defuse' },
  { round: 11, winner: 1, reason: 'elimination' }, { round: 12, winner: 0, reason: 'detonate' },
  { round: 13, winner: 1, reason: 'elimination' }, { round: 14, winner: 0, reason: 'timeout' },
  { round: 15, winner: 1, reason: 'detonate' },    { round: 16, winner: 0, reason: 'elimination' },
  { round: 17, winner: 1, reason: 'defuse' },
];

const SWITCH_ROUND = 13;

/* -------------------------------- Catálogo -------------------------------- */

function slug(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function fetchJson(path) {
  const response = await fetch(`${API}${path}`);
  if (!response.ok) throw new Error(`${path} devolvió ${response.status}`);
  return response.json();
}

/** URLs remotas de lo que aparece en el catálogo. Solo lo que se usa. */
async function buildUrls() {
  const [agents, weapons] = await Promise.all([
    fetchJson('/agents?isPlayableCharacter=true'),
    fetchJson('/weapons'),
  ]);

  const agentUrls = new Map();
  for (const agent of agents.data) {
    if (typeof agent.displayName !== 'string') continue;
    agentUrls.set(slug(agent.displayName), {
      icon: agent.displayIcon,
      portrait: agent.displayIconSmall ?? agent.displayIcon,
    });
  }

  const weaponUrls = new Map();
  for (const weapon of weapons.data) {
    if (typeof weapon.displayName !== 'string') continue;
    weaponUrls.set(slug(weapon.displayName), weapon.killStreamIcon ?? weapon.displayIcon);
  }

  return { agentUrls, weaponUrls };
}

/* --------------------------------- Piezas --------------------------------- */

const escape = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const money = (value) => `${value.toLocaleString('es-ES')}`;

/** Icono de agente, o las iniciales si no hay arte. */
function agentIcon(urls, name, size = 44) {
  const entry = urls.agentUrls.get(slug(name));
  if (entry?.icon === undefined || entry.icon === null) {
    return `<span class="inicial" style="--tam:${size}px">${escape(name.slice(0, 2))}</span>`;
  }
  return `<img class="agente" style="--tam:${size}px" src="${entry.icon}" alt="${escape(name)}" />`;
}

function weaponIcon(urls, name) {
  if (name === '') return '<span class="sin-arma">—</span>';
  const url = urls.weaponUrls.get(slug(name));
  if (url === undefined || url === null) return `<span class="sin-arma">${escape(name)}</span>`;
  return `<img class="arma" src="${url}" alt="${escape(name)}" />`;
}

const ARMOR_LABEL = { none: 'sin escudo', light: 'ligero', heavy: 'pesado', regen: 'regenerativo' };

const REASON_LABEL = {
  elimination: 'eliminación',
  defuse: 'desactivada',
  detonate: 'detonada',
  timeout: 'tiempo',
  unknown: 'sin determinar',
};

/** La barra superior, que ya está diseñada, en versión mínima como referencia. */
function topBar(round) {
  const [left, right] = TEAMS;
  return `
      <header class="barra">
        <div class="barra-equipo izquierda ${left.side}">
          <span class="tricode">${escape(left.tricode)}</span>
          <span class="marcador">${left.score}</span>
        </div>
        <div class="barra-centro">
          <span class="ronda">RONDA ${round}</span>
          <span class="reloj">0:24</span>
        </div>
        <div class="barra-equipo derecha ${right.side}">
          <span class="marcador">${right.score}</span>
          <span class="tricode">${escape(right.tricode)}</span>
        </div>
      </header>`;
}

/**
 * La ficha de datos de cada pantalla.
 *
 * Va fuera del fotograma y se puede borrar entera. Existe porque el riesgo de
 * diseñar una pantalla sin tener delante los datos es acabar con un hueco
 * bonito que el servidor no puede rellenar, o con un dato real que no cabe.
 */
function dataSheet(title, rows, notes = []) {
  const items = rows
    .map(
      ([field, source, note]) => `
          <tr>
            <td><code>${escape(field)}</code></td>
            <td><code>${escape(source)}</code></td>
            <td>${note === undefined ? '' : escape(note)}</td>
          </tr>`,
    )
    .join('');

  const extra = notes.map((note) => `<li>${note}</li>`).join('');

  return `
    <section class="ficha">
      <h2>Datos de «${escape(title)}»</h2>
      <p>
        Esto no es parte del overlay: es la ficha de lo que hay en pantalla y de
        dónde sale cada dato. <strong>Se puede borrar</strong> —desde
        <code>&lt;section class="ficha"&gt;</code> hasta el final— sin tocar el
        fotograma de arriba.
      </p>
      <table>
        <thead><tr><th>Lo que se pinta</th><th>Campo del estado</th><th>Ojo con</th></tr></thead>
        <tbody>${items}</tbody>
      </table>
      ${extra === '' ? '' : `<ul class="notas">${extra}</ul>`}
    </section>`;
}

/* ---------------------------------- Marco --------------------------------- */

const BASE_CSS = `
      /*
       * Andamio, no diseño.
       *
       * Los colores son los de la paleta por defecto del contrato
       * (DEFAULT_PALETTE) para que no chille, pero la forma es a propósito
       * sosa: cajas, rejillas y nada más. Lo que importa es que estén todos
       * los datos y en su sitio aproximado.
       */
      :root {
        --ataque: #D6455D;
        --defensa: #4A9E8F;
        --acento: #FF6470;
        --fondo: #08080A;
        --texto: #F5F5F7;
        --apagado: #8A8A94;
        --caja: rgba(18, 18, 22, .92);
        --borde: rgba(255, 255, 255, .10);
        color-scheme: dark;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: #101014;
        color: var(--texto);
        font: 400 15px/1.5 Poppins, system-ui, sans-serif;
      }

      /* El fotograma: 1920x1080 exacto, como en OBS. */
      .fotograma {
        position: relative;
        width: 1920px;
        height: 1080px;
        overflow: hidden;
        background: #1b1d22 url('https://media.valorant-api.com/maps/2fb9a4fd-47b8-4e7d-a969-74b4046ebd53/splash.png') center/cover no-repeat;
      }
      .fotograma::after {
        content: '';
        position: absolute;
        inset: 0;
        background: rgba(4, 5, 8, .35);
      }
      .capa { position: absolute; inset: 0; z-index: 2; }

      .agente { width: var(--tam); height: var(--tam); object-fit: cover; border-radius: 4px; }
      .inicial {
        display: grid; place-items: center;
        width: var(--tam); height: var(--tam);
        border-radius: 4px; background: rgba(255,255,255,.08);
        font: 600 calc(var(--tam) / 2.6)/1 Oswald, sans-serif; letter-spacing: .04em;
      }
      .arma { height: 22px; object-fit: contain; filter: brightness(1.4); }
      .sin-arma { color: var(--apagado); }

      /* Barra superior de referencia. */
      .barra {
        position: absolute; top: 0; left: 50%; transform: translateX(-50%);
        display: flex; align-items: stretch; height: 62px; min-width: 620px;
        background: var(--caja); border: 1px solid var(--borde); border-top: 0;
        font-family: Oswald, sans-serif;
      }
      .barra-equipo { display: flex; align-items: center; gap: 14px; padding: 0 20px; }
      .barra-equipo.attack { background: linear-gradient(180deg, rgba(214,69,93,.22), transparent); }
      .barra-equipo.defense { background: linear-gradient(180deg, rgba(74,158,143,.22), transparent); }
      .tricode { font-size: 22px; letter-spacing: .06em; }
      .marcador { font-size: 30px; font-weight: 600; }
      .barra-centro {
        display: grid; place-items: center; padding: 0 22px;
        border-left: 1px solid var(--borde); border-right: 1px solid var(--borde);
      }
      .ronda { font-size: 11px; letter-spacing: .18em; color: var(--apagado); }
      .reloj { font-size: 26px; font-weight: 600; }

      /* Ficha de datos, fuera del fotograma. */
      .ficha {
        max-width: 1100px; margin: 28px auto 60px; padding: 0 24px;
        font-size: 14px; color: #c9c9d2;
      }
      .ficha h2 { font: 600 18px/1.3 Oswald, sans-serif; letter-spacing: .04em; color: var(--texto); }
      .ficha table { width: 100%; border-collapse: collapse; margin-top: 14px; }
      .ficha th, .ficha td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #23232a; vertical-align: top; }
      .ficha th { font-size: 11px; text-transform: uppercase; letter-spacing: .12em; color: var(--apagado); }
      .ficha code { font: 12px/1.4 ui-monospace, monospace; color: #ffb3bb; }
      .ficha .notas { margin-top: 16px; padding-left: 18px; }
      .ficha .notas li { margin-bottom: 8px; }
      .rotulo {
        max-width: 1100px; margin: 26px auto 12px; padding: 0 24px;
        font: 600 13px/1.4 Oswald, sans-serif; letter-spacing: .16em;
        text-transform: uppercase; color: var(--acento);
      }`;

function page({ slug: name, title, css = '', frame, sheet }) {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Easy HUD — ${escape(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Poppins:wght@400;500;600&display=swap"
      rel="stylesheet"
    />
    <style>${BASE_CSS}${css}
    </style>
  </head>
  <body data-estado="${escape(name)}">
    <p class="rotulo">${escape(title)}</p>
    <div class="fotograma">
      <div class="capa">${frame}</div>
    </div>
${sheet}
  </body>
</html>
`;
}

/* ------------------------------- 1. Ceremonia ----------------------------- */

/**
 * Motivos por los que se gana una ronda.
 *
 * Aquí antes había cinco ceremonias —ace, clutch, team ace, flawless y ronda—
 * y se han quitado: la plataforma no da ninguna. Habria que deducirlas
 * contando el killfeed y muestreando quien esta vivo, y esa deduccion se
 * equivoca en cuanto se pierde una baja. Un cartel de ACE equivocado delante
 * de publico es peor que no tener cartel.
 *
 * Lo que se anuncia es lo que se sabe con certeza: quien gano la ronda y por
 * que. Los cuatro motivos salen juntos en el fotograma para verlos; en emision
 * sale uno.
 */
const ROUND_WINS = [
  { winner: 1, reason: 'elimination' },
  { winner: 0, reason: 'defuse' },
  { winner: 1, reason: 'detonate' },
  { winner: 0, reason: 'timeout' },
];

function ceremonyFrame() {
  const cards = ROUND_WINS.map((round) => {
    const team = TEAMS[round.winner];
    return `
          <article class="ceremonia" data-motivo="${round.reason}">
            <div class="ceremonia-equipo ${team.side}">
              <span class="tricode">${escape(team.tricode)}</span>
              <span class="ceremonia-nombre">${escape(team.name)}</span>
            </div>
            <div class="ceremonia-titulo">
              <strong>RONDA</strong>
              <span>${escape(team.side === 'attack' ? 'ataque' : 'defensa')}</span>
            </div>
            <div class="ceremonia-motivo">${escape(REASON_LABEL[round.reason])}</div>
          </article>`;
  }).join('');

  return `${topBar(18)}
        <div class="ceremonias">${cards}</div>`;
}

const CEREMONY_CSS = `
      .ceremonias {
        position: absolute; top: 120px; left: 50%; transform: translateX(-50%);
        display: grid; gap: 18px; width: 900px;
      }
      .ceremonia {
        display: grid; grid-template-columns: 240px 1fr auto; align-items: center; gap: 22px;
        padding: 16px 22px; background: var(--caja); border: 1px solid var(--borde); border-left: 4px solid var(--acento);
      }
      .ceremonia-equipo { display: flex; align-items: center; gap: 12px; font-family: Oswald, sans-serif; }
      .ceremonia-equipo.attack .tricode { color: var(--ataque); }
      .ceremonia-equipo.defense .tricode { color: var(--defensa); }
      .ceremonia-equipo .tricode { font-size: 20px; }
      .ceremonia-nombre { font-size: 13px; color: var(--apagado); }
      .ceremonia-titulo strong { display: block; font: 700 30px/1 Oswald, sans-serif; letter-spacing: .08em; }
      .ceremonia-titulo span { font-size: 12px; color: var(--apagado); letter-spacing: .06em; }
      .autor { display: flex; align-items: center; gap: 12px; }
      .autor-nombre { display: block; font: 600 17px/1.2 Poppins, sans-serif; }
      .autor-agente { display: block; font-size: 12px; color: var(--apagado); }
      .ceremonia-motivo {
        font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--apagado);
        border: 1px solid var(--borde); padding: 5px 10px;
      }`;

/* ------------------------------ 2. Fase de compra ------------------------- */

function buyFrame(urls) {
  const rows = (teamIndex) =>
    PLAYERS.filter((player) => player.team === teamIndex)
      .map((player) => {
        const health =
          player.health === null
            ? '<span class="sin-dato">sin dato de vida</span>'
            : `<span class="vida">${player.health}</span>`;
        return `
              <tr class="${player.alive ? '' : 'muerto'}">
                <td class="col-agente">${agentIcon(urls, player.agent, 36)}</td>
                <td class="col-nombre">
                  <span class="nombre">${escape(player.name)}</span>
                  <span class="agente-nombre">${escape(player.agent)}</span>
                </td>
                <td class="col-vida">${health}</td>
                <td class="col-escudo">${escape(ARMOR_LABEL[player.armor])}</td>
                <td class="col-arma">${weaponIcon(urls, player.weapon)}</td>
                <td class="col-ult">${player.ult[0]}/${player.ult[1]}</td>
                <td class="col-kda">${player.kda.join(' / ')}</td>
                <td class="col-credito">${money(player.money)}</td>
                <td class="col-spike">${player.spike ? 'spike' : ''}</td>
              </tr>`;
      })
      .join('');

  const table = (teamIndex) => {
    const team = TEAMS[teamIndex];
    const total = PLAYERS.filter((p) => p.team === teamIndex).reduce((sum, p) => sum + p.money, 0);
    return `
          <section class="compra-equipo ${team.side}">
            <header>
              <span class="tricode">${escape(team.tricode)}</span>
              <span class="compra-nombre">${escape(team.name)}</span>
              <span class="compra-total">${money(total)} en banco</span>
            </header>
            <table>
              <thead>
                <tr>
                  <th></th><th>jugador</th><th>vida</th><th>escudo</th>
                  <th>arma</th><th>ult</th><th>K / D / A</th><th>créditos</th><th></th>
                </tr>
              </thead>
              <tbody>${rows(teamIndex)}</tbody>
            </table>
          </section>`;
  };

  return `${topBar(18)}
        <div class="compra">
          <p class="compra-fase">Fase de compra · 0:24</p>
          <div class="compra-tablas">${table(0)}${table(1)}</div>
        </div>`;
}

const BUY_CSS = `
      .compra { position: absolute; inset: 90px 90px auto 90px; }
      .compra-fase {
        margin: 0 0 14px; font: 600 12px/1 Oswald, sans-serif;
        letter-spacing: .2em; text-transform: uppercase; color: var(--apagado); text-align: center;
      }
      .compra-tablas { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
      .compra-equipo { background: var(--caja); border: 1px solid var(--borde); }
      .compra-equipo.attack { border-top: 3px solid var(--ataque); }
      .compra-equipo.defense { border-top: 3px solid var(--defensa); }
      .compra-equipo header {
        display: flex; align-items: baseline; gap: 12px; padding: 14px 18px;
        border-bottom: 1px solid var(--borde); font-family: Oswald, sans-serif;
      }
      .compra-equipo .tricode { font-size: 20px; }
      .compra-nombre { font-size: 14px; color: var(--apagado); }
      .compra-total { margin-left: auto; font-size: 13px; color: var(--acento); }
      .compra-equipo table { width: 100%; border-collapse: collapse; }
      .compra-equipo th {
        padding: 8px 10px; font: 500 10px/1 Poppins, sans-serif; letter-spacing: .12em;
        text-transform: uppercase; color: var(--apagado); text-align: left;
      }
      .compra-equipo td { padding: 9px 10px; border-top: 1px solid rgba(255,255,255,.05); font-size: 14px; }
      .compra-equipo tr.muerto { opacity: .45; }
      .nombre { display: block; font-weight: 500; }
      .agente-nombre { display: block; font-size: 11px; color: var(--apagado); }
      .vida { font-variant-numeric: tabular-nums; }
      .sin-dato { font-size: 11px; letter-spacing: .06em; color: var(--acento); }
      .col-escudo, .col-ult, .col-kda, .col-credito, .col-spike { font-size: 13px; color: #d7d7de; }
      .col-credito { font-variant-numeric: tabular-nums; }
      .col-spike { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--acento); }`;

/* -------------------------------- 3. Historial ---------------------------- */

function historyFrame() {
  const cell = (record, teamIndex) => {
    const won = record.winner === teamIndex;
    const swap = record.round === SWITCH_ROUND ? ' cambio' : '';
    return `
                <div class="celda${won ? ' ganada' : ' perdida'}${swap}" data-ronda="${record.round}">
                  <span class="celda-ronda">${record.round}</span>
                  ${won ? `<span class="celda-motivo">${escape(REASON_LABEL[record.reason])}</span>` : ''}
                </div>`;
  };

  const row = (teamIndex) => {
    const team = TEAMS[teamIndex];
    return `
            <section class="historial-equipo ${team.side}">
              <header>
                <span class="tricode">${escape(team.tricode)}</span>
                <span class="historial-marcador">${team.score}</span>
              </header>
              <div class="historial-celdas">${HISTORY.map((r) => cell(r, teamIndex)).join('')}</div>
            </section>`;
  };

  return `${topBar(18)}
        <div class="historial">
          <p class="historial-titulo">Historial de rondas · primera a 13 · cambio de bando en la 13</p>
          ${row(0)}${row(1)}
        </div>`;
}

const HISTORY_CSS = `
      .historial { position: absolute; left: 50%; top: 110px; transform: translateX(-50%); width: 1500px; }
      .historial-titulo {
        margin: 0 0 14px; text-align: center; font: 500 11px/1 Poppins, sans-serif;
        letter-spacing: .16em; text-transform: uppercase; color: var(--apagado);
      }
      .historial-equipo {
        display: grid; grid-template-columns: 120px 1fr; align-items: center; gap: 18px;
        padding: 12px 18px; margin-bottom: 12px; background: var(--caja); border: 1px solid var(--borde);
      }
      .historial-equipo header { display: flex; align-items: baseline; gap: 12px; font-family: Oswald, sans-serif; }
      .historial-equipo.attack .tricode { color: var(--ataque); }
      .historial-equipo.defense .tricode { color: var(--defensa); }
      .historial-equipo .tricode { font-size: 20px; }
      .historial-marcador { font-size: 26px; font-weight: 600; }
      .historial-celdas { display: grid; grid-auto-flow: column; gap: 6px; }
      .celda {
        display: grid; place-items: center; gap: 3px; min-width: 70px; padding: 8px 4px;
        border: 1px solid var(--borde); background: rgba(255,255,255,.03);
      }
      .celda.ganada { background: rgba(255,100,112,.14); border-color: rgba(255,100,112,.4); }
      .celda.perdida { opacity: .45; }
      .celda.cambio { border-left: 3px solid var(--acento); }
      .celda-ronda { font: 600 15px/1 Oswald, sans-serif; }
      .celda-motivo { font-size: 9px; letter-spacing: .06em; text-transform: uppercase; color: var(--apagado); }`;

/* ------------------------------ 4. Tiempo muerto -------------------------- */

function timeoutFrame(urls) {
  const card = (kind, teamIndex, seconds) => {
    const team = teamIndex === null ? null : TEAMS[teamIndex];
    return `
          <article class="pausa ${kind}" data-tipo="${kind}">
            <p class="pausa-tipo">${kind === 'technical' ? 'Pausa técnica' : 'Tiempo muerto'}</p>
            ${
              team === null
                ? '<p class="pausa-equipo neutro">sin equipo — la pide la producción</p>'
                : `<p class="pausa-equipo ${team.side}">
                     <span class="tricode">${escape(team.tricode)}</span>
                     <span>${escape(team.name)}</span>
                   </p>`
            }
            <p class="pausa-reloj">${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}</p>
            ${
              team === null
                ? ''
                : `<p class="pausa-restantes">le quedan ${team.timeouts} tiempo(s) muerto(s)</p>`
            }
          </article>`;
  };

  return `${topBar(18)}
        <div class="pausas">
          ${card('tactical', 1, 47)}
          ${card('technical', null, 184)}
        </div>`;
}

const TIMEOUT_CSS = `
      .pausas {
        position: absolute; inset: 0; display: grid; grid-auto-flow: column;
        place-content: center; gap: 40px;
      }
      .pausa {
        width: 420px; padding: 34px 30px; text-align: center;
        background: var(--caja); border: 1px solid var(--borde); border-top: 4px solid var(--acento);
      }
      .pausa-tipo {
        margin: 0 0 18px; font: 600 12px/1 Oswald, sans-serif;
        letter-spacing: .22em; text-transform: uppercase; color: var(--apagado);
      }
      .pausa-equipo { display: grid; gap: 4px; margin: 0 0 20px; font-family: Oswald, sans-serif; }
      .pausa-equipo .tricode { font-size: 26px; }
      .pausa-equipo.attack .tricode { color: var(--ataque); }
      .pausa-equipo.defense .tricode { color: var(--defensa); }
      .pausa-equipo span:last-child { font: 400 13px/1.4 Poppins, sans-serif; color: var(--apagado); }
      .pausa-equipo.neutro { font: 400 13px/1.4 Poppins, sans-serif; color: var(--apagado); }
      .pausa-reloj { margin: 0; font: 600 64px/1 Oswald, sans-serif; font-variant-numeric: tabular-nums; }
      .pausa-restantes { margin: 14px 0 0; font-size: 12px; color: var(--apagado); }`;

/* ------------------------------ 5. Fin de mapa ---------------------------- */

function endFrame(urls) {
  const winner = TEAMS[1];
  const loser = TEAMS[0];

  const stats = [...PLAYERS]
    .sort((a, b) => b.kda[0] - a.kda[0])
    .slice(0, 3)
    .map(
      (player, index) => `
              <li>
                <span class="puesto">${index + 1}</span>
                ${agentIcon(urls, player.agent, 34)}
                <span class="stat-nombre">${escape(player.name)}</span>
                <span class="stat-kda">${player.kda.join(' / ')}</span>
              </li>`,
    )
    .join('');

  const pips = (team) =>
    Array.from(
      { length: 2 },
      (_, index) => `<span class="pip${index < team.mapsWon ? ' ganado' : ''}"></span>`,
    ).join('');

  return `
        <div class="final">
          <p class="final-titulo">Mapa terminado · Ascent</p>
          <div class="final-marcador">
            <div class="final-equipo perdedor ${loser.side}">
              <span class="tricode">${escape(loser.tricode)}</span>
              <span class="final-nombre">${escape(loser.name)}</span>
              <div class="pips">${pips(loser)}</div>
            </div>
            <div class="final-numeros">
              <span>${loser.score}</span><em>—</em><span>${winner.score}</span>
            </div>
            <div class="final-equipo ganador ${winner.side}">
              <span class="tricode">${escape(winner.tricode)}</span>
              <span class="final-nombre">${escape(winner.name)}</span>
              <div class="pips">${pips(winner)}</div>
            </div>
          </div>
          <p class="final-serie">Serie a 2 mapas · 1—1 · siguiente mapa por decidir</p>
          <ol class="final-stats">${stats}</ol>
        </div>`;
}

const END_CSS = `
      .final { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 26px; }
      .final-titulo {
        margin: 0; font: 600 12px/1 Oswald, sans-serif; letter-spacing: .24em;
        text-transform: uppercase; color: var(--apagado);
      }
      .final-marcador { display: grid; grid-auto-flow: column; align-items: center; gap: 46px; }
      .final-equipo { display: grid; justify-items: center; gap: 8px; font-family: Oswald, sans-serif; }
      .final-equipo .tricode { font-size: 40px; }
      .final-equipo.attack .tricode { color: var(--ataque); }
      .final-equipo.defense .tricode { color: var(--defensa); }
      .final-equipo.perdedor { opacity: .55; }
      .final-nombre { font: 400 13px/1 Poppins, sans-serif; color: var(--apagado); }
      .pips { display: flex; gap: 6px; }
      .pip { width: 22px; height: 5px; background: rgba(255,255,255,.16); }
      .pip.ganado { background: var(--acento); }
      .final-numeros { display: flex; align-items: center; gap: 18px; font: 600 84px/1 Oswald, sans-serif; }
      .final-numeros em { font-size: 34px; color: var(--apagado); font-style: normal; }
      .final-serie { margin: 0; font-size: 13px; color: var(--apagado); }
      .final-stats { display: grid; gap: 8px; margin: 10px 0 0; padding: 0; list-style: none; width: 460px; }
      .final-stats li {
        display: grid; grid-template-columns: 26px auto 1fr auto; align-items: center; gap: 14px;
        padding: 10px 14px; background: var(--caja); border: 1px solid var(--borde);
      }
      .puesto { font: 600 16px/1 Oswald, sans-serif; color: var(--acento); }
      .stat-nombre { font-weight: 500; }
      .stat-kda { font-variant-numeric: tabular-nums; color: #d7d7de; }`;

/* ----------------------------- 6. Avisos y marca -------------------------- */

function noticeFrame() {
  return `${topBar(18)}
        <div class="aviso equipo" data-variante="con-equipo">
          <p class="aviso-titulo">Tiempo muerto de PRX</p>
          <p class="aviso-texto">Volvemos en un minuto</p>
        </div>

        <div class="aviso neutro" data-variante="neutro">
          <p class="aviso-titulo">Problema técnico</p>
          <p class="aviso-texto">Reanudamos la ronda 18 en breve</p>
        </div>

        <div class="patrocinadores" data-rotacion="5000">
          <img src="https://media.valorant-api.com/agents/f94c3b30-42be-e959-889c-5aa313dba261/displayicon.png" alt="Patrocinador 1" />
        </div>

        <p class="marca">EASY OPEN · easyhud.net</p>`;
}

const NOTICE_CSS = `
      .aviso {
        position: absolute; left: 50%; transform: translateX(-50%);
        min-width: 460px; padding: 18px 26px; text-align: center;
        background: var(--caja); border: 1px solid var(--borde);
      }
      .aviso.equipo { top: 110px; border-left: 4px solid var(--defensa); }
      .aviso.neutro { top: 230px; border-left: 4px solid var(--acento); }
      .aviso-titulo { margin: 0 0 6px; font: 600 18px/1.2 Oswald, sans-serif; letter-spacing: .05em; }
      .aviso-texto { margin: 0; font-size: 14px; color: var(--apagado); }
      .patrocinadores {
        position: absolute; right: 44px; bottom: 44px; padding: 12px;
        background: var(--caja); border: 1px solid var(--borde);
      }
      .patrocinadores img { display: block; width: 120px; height: 120px; object-fit: contain; }
      .marca {
        position: absolute; left: 50%; bottom: 22px; transform: translateX(-50%); margin: 0;
        font: 500 11px/1 Poppins, sans-serif; letter-spacing: .22em;
        text-transform: uppercase; color: rgba(245,245,247,.5);
      }`;

/* --------------------------- 7. Estados degradados ----------------------- */

function degradedFrame(urls) {
  const player = PLAYERS[9];
  return `${topBar(18)}
        <div class="degradados">
          <article class="degradado" data-caso="stale">
            <p class="degradado-titulo">Datos congelados</p>
            <p class="degradado-texto">
              El cliente del observador lleva 6 s sin mandar nada. Lo que hay en
              pantalla es lo último que se sabe: <strong>no se borra</strong>.
            </p>
          </article>

          <article class="degradado" data-caso="sin-vida">
            <p class="degradado-titulo">Un jugador sin cliente</p>
            <div class="tarjeta-mini">
              ${agentIcon(urls, player.agent, 40)}
              <div>
                <span class="nombre">${escape(player.name)}</span>
                <span class="sin-dato">sin dato de vida</span>
              </div>
            </div>
            <p class="degradado-texto">
              Vivo o muerto se sabe; los puntos de vida no. Se pinta el hueco,
              nunca un 100 inventado.
            </p>
          </article>

          <article class="degradado" data-caso="sin-conexion">
            <p class="degradado-titulo">Overlay sin servidor</p>
            <p class="degradado-texto">
              Reintentando… El overlay <strong>no se vacía</strong> mientras
              reconecta: en directo, quieto es mejor que en blanco.
            </p>
          </article>

          <article class="degradado" data-caso="protocolo">
            <p class="degradado-titulo">Versión incompatible</p>
            <p class="degradado-texto">
              El servidor habla protocolo 2 y este overlay entiende 1. Se niega
              a pintar y lo dice: un overlay que miente es peor que uno que avisa.
            </p>
          </article>
        </div>`;
}

const DEGRADED_CSS = `
      .degradados {
        position: absolute; inset: 110px 90px auto 90px;
        display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;
      }
      .degradado { padding: 22px 24px; background: var(--caja); border: 1px solid var(--borde); border-left: 4px solid var(--acento); }
      .degradado-titulo { margin: 0 0 10px; font: 600 16px/1.2 Oswald, sans-serif; letter-spacing: .05em; }
      .degradado-texto { margin: 0; font-size: 14px; color: #c2c2cc; }
      .tarjeta-mini {
        display: flex; align-items: center; gap: 12px; margin-bottom: 12px;
        padding: 10px 12px; background: rgba(255,255,255,.04); border: 1px solid var(--borde);
      }`;

/* ------------------------------ 8. Selección ------------------------------ */

function selectFrame(urls) {
  const column = (teamIndex) => {
    const team = TEAMS[teamIndex];
    const cards = PLAYERS.filter((player) => player.team === teamIndex)
      .map(
        (player) => `
              <li class="${player.locked ? 'bloqueado' : 'eligiendo'}">
                ${agentIcon(urls, player.agent, 54)}
                <div>
                  <span class="nombre">${escape(player.name)}</span>
                  <span class="agente-nombre">${player.locked ? escape(player.agent) : 'eligiendo…'}</span>
                </div>
              </li>`,
      )
      .join('');

    return `
          <section class="seleccion-equipo ${team.side}">
            <header>
              <span class="tricode">${escape(team.tricode)}</span>
              <span class="compra-nombre">${escape(team.seeding)}</span>
            </header>
            <ul>${cards}</ul>
          </section>`;
  };

  return `
        <div class="seleccion">
          <p class="compra-fase">Selección de agentes · Ascent</p>
          <div class="seleccion-columnas">${column(0)}${column(1)}</div>
        </div>`;
}

const SELECT_CSS = `
      .seleccion { position: absolute; inset: 120px 120px auto 120px; }
      .seleccion-columnas { display: grid; grid-template-columns: 1fr 1fr; gap: 26px; }
      .seleccion-equipo { background: var(--caja); border: 1px solid var(--borde); }
      .seleccion-equipo.attack { border-top: 3px solid var(--ataque); }
      .seleccion-equipo.defense { border-top: 3px solid var(--defensa); }
      .seleccion-equipo header {
        display: flex; align-items: baseline; gap: 12px; padding: 14px 18px;
        border-bottom: 1px solid var(--borde); font-family: Oswald, sans-serif;
      }
      .seleccion-equipo .tricode { font-size: 20px; }
      .seleccion-equipo ul { margin: 0; padding: 0; list-style: none; }
      .seleccion-equipo li {
        display: flex; align-items: center; gap: 14px; padding: 12px 18px;
        border-top: 1px solid rgba(255,255,255,.05);
      }
      .seleccion-equipo li.eligiendo { opacity: .5; }
      .seleccion-equipo li.eligiendo .agente-nombre { color: var(--acento); }`;

/* -------------------------------- Generación ------------------------------ */

const STATES = [
  {
    slug: 'ceremonia',
    title: 'Ronda ganada',
    css: CEREMONY_CSS,
    frame: ceremonyFrame,
    sheet: () =>
      dataSheet(
        'Ronda ganada',
        [
          ['Se enseña al cerrar la ronda', 'evento roundEnd', ''],
          ['Equipo ganador', 'evento roundEnd, winnerIndex -> match.teams[i]', 'el índice es estable; el bando cambia en la segunda mitad'],
          ['Bando', 'evento roundEnd, winnerSide', 'attack o defense: tiñe el rótulo'],
          ['Motivo', 'evento roundEnd, reason', 'elimination · defuse · detonate · timeout · unknown'],
          ['Ceremonia', 'evento roundEnd, ceremony', 'hoy siempre roundWin, y es una decisión'],
        ],
        [
          '<strong>Hay una sola ceremonia.</strong> La plataforma no da ninguna: ace, clutch, flawless y team ace habría que deducirlos contando el killfeed, y esa deducción se equivoca en cuanto se pierde una baja. Un cartel de ACE equivocado delante de público no se arregla con una disculpa.',
          'Los cuatro motivos van uno debajo de otro <strong>solo para verlos juntos</strong>. En emisión sale un cartel y desaparece.',
          '<code>unknown</code> como motivo es legítimo: a veces no se puede deducir. Conviene que el diseño aguante no pintar motivo.',
          'El cartel no lleva duración: la pone el overlay. Un cartel que tapa la acción es peor que no tenerlo.',
        ],
      ),
  },
  {
    slug: 'compra',
    title: 'Fase de compra',
    css: BUY_CSS,
    frame: buyFrame,
    sheet: () =>
      dataSheet(
        'Fase de compra',
        [
          ['Cuándo se enseña', 'match.phase === "shopping"', 'y se esconde al pasar a combat'],
          ['Jugadores', 'match.teams[i].players[]', 'siempre cinco, ordenados por position'],
          ['Nombre', 'player.identity.displayName', 'el operador puede sobrescribirlo'],
          ['Agente', 'player.agentName', 'ya traducido; agentInternal es el nombre en clave'],
          ['Vida', 'player.health', 'solo si player.provenance.health === "player"'],
          ['Escudo', 'player.armor', 'none · light · heavy · regen'],
          ['Arma', 'player.weapon', 'nombre comercial; cadena vacía si no se sabe'],
          ['Ultimate', 'player.ultimate.points / .max', 'números reales: aquí sí se pueden pintar puntos'],
          ['Habilidades', 'player.abilities', 'tres booleanos: hay carga o no hay'],
          ['Cargas', 'player.abilities.charges', 'OPCIONAL: solo si la plataforma las da. Sin ellas, un solo estado'],
          ['K/D/A', 'player.stats.kills / .deaths / .assists', ''],
          ['Créditos', 'player.money', ''],
          ['Spike', 'player.hasSpike', 'solo un jugador del ataque'],
          ['Vivo', 'player.alive', 'en compra están todos vivos salvo resincronización'],
        ],
        [
          'El banco del equipo <strong>no viene sumado</strong>: si se quiere, lo suma el overlay.',
          'La fila con «sin dato de vida» es el jugador que no abrió el cliente auxiliar. Ese hueco tiene que estar diseñado, porque en un torneo real siempre falta alguien.',
        ],
      ),
  },
  {
    slug: 'historial',
    title: 'Historial de rondas',
    css: HISTORY_CSS,
    frame: historyFrame,
    sheet: () =>
      dataSheet(
        'Historial de rondas',
        [
          ['Una celda por ronda', 'match.teams[i].roundHistory[]', 'los dos equipos tienen fila completa'],
          ['Número de ronda', 'roundHistory[].round', ''],
          ['Ganada o perdida', 'roundHistory[].won', ''],
          ['Motivo', 'roundHistory[].reason', 'solo tiene sentido si won'],
          ['Bando de esa ronda', 'roundHistory[].side', 'cambia en la ronda de intercambio'],
          ['Dónde va la línea del cambio', 'match.rules.switchRound', '13 en formato estándar, configurable'],
          ['Cuántas rondas caben', 'match.rules.roundsToWin y overtimeStartRound', 'con prórroga puede pasar de 24'],
        ],
        [
          'El diseño tiene que aguantar <strong>prórroga</strong>: en formato estándar son 24 celdas, pero una prórroga larga añade más. Conviene que la rejilla comprima o desplace en lugar de desbordar.',
          'El motivo se pinta aquí como texto para que se vea el dato; en el diseño final serán iconos.',
        ],
      ),
  },
  {
    slug: 'tiempo-muerto',
    title: 'Tiempo muerto y pausa técnica',
    css: TIMEOUT_CSS,
    frame: timeoutFrame,
    sheet: () =>
      dataSheet(
        'Tiempo muerto y pausa técnica',
        [
          ['Hay pausa', 'match.timeout !== null', ''],
          ['Tipo', 'match.timeout.kind', 'tactical (de un equipo) o technical (de la producción)'],
          ['Equipo', 'match.timeout.teamIndex', 'null en la pausa técnica: no es de nadie'],
          ['Cuenta atrás', 'match.timeout.startedAt + durationSec', 'llega el INSTANTE, no los segundos que faltan'],
          ['Tiempos muertos que quedan', 'match.teams[i].timeoutsRemaining', ''],
        ],
        [
          'El servidor manda <code>startedAt</code> como instante y el overlay calcula lo que queda con su propio reloj. Mandar la cuenta atrás en cada tick la dejaría a merced del jitter de red y se vería temblar.',
          'Las dos variantes salen juntas para verlas; en emisión hay una o ninguna.',
        ],
      ),
  },
  {
    slug: 'fin-de-mapa',
    title: 'Fin de mapa y serie',
    css: END_CSS,
    frame: endFrame,
    sheet: () =>
      dataSheet(
        'Fin de mapa y serie',
        [
          ['Cuándo se enseña', 'match.phase === "gameOver"', ''],
          ['Marcador final', 'match.teams[i].roundsWon', ''],
          ['Mapas de la serie', 'match.teams[i].mapsWon', 'lo lleva el operador, no se deduce del juego'],
          ['Cuántos para ganar', 'match.series.mapsToWin', '1 = un solo mapa, sin pips'],
          ['Mapas de la serie', 'match.series.maps[]', 'name y state: past · live · upcoming'],
          ['Estadísticas', 'player.stats.kills / .deaths / .assists', 'el orden lo decide el overlay'],
          ['Mapa jugado', 'match.map', ''],
        ],
        [
          'El producto <strong>no elige un MVP</strong>: no hay ningún dato que lo justifique más allá de las bajas, y coronar a alguien por número de bajas es discutible en directo. Si se quiere, es una decisión de diseño, no un dato del juego.',
          'Con <code>mapsToWin: 1</code> los pips no se pintan: una serie de un mapa no tiene marcador de serie.',
        ],
      ),
  },
  {
    slug: 'avisos',
    title: 'Avisos del operador, patrocinadores y marca',
    css: NOTICE_CSS,
    frame: noticeFrame,
    sheet: () =>
      dataSheet(
        'Avisos del operador, patrocinadores y marca',
        [
          ['Se enseña el aviso', 'match.broadcast.toast.visible', 'lo enciende y apaga el panel'],
          ['Título y texto', 'toast.title, toast.message', 'los teclea el operador; pueden ser largos'],
          ['Color del aviso', 'toast.teamIndex', 'null = neutro; 0 o 1 = tiñe con el bando de ese equipo'],
          ['Patrocinadores', 'broadcast.sponsors.enabled / .urls[]', 'URLs remotas, no van empaquetadas'],
          ['Cada cuánto rotan', 'broadcast.sponsors.rotateMs', ''],
          ['Marca de agua', 'broadcast.watermark', 'texto libre; vacío = no se pinta'],
          ['Modo mínimo', 'broadcast.minimal', 'true = solo lo imprescindible, para clips o pantalla partida'],
          ['Paleta', 'broadcast.palette', 'attack, defense, accent, background, text'],
        ],
        [
          'El aviso lo escribe una persona en mitad de un directo: el diseño tiene que <strong>aguantar textos largos y feos</strong> sin romperse ni tapar la acción.',
          'La paleta llega en el estado y el operador puede cambiarla en caliente. Conviene atarla a variables CSS y no a colores escritos a mano.',
        ],
      ),
  },
  {
    slug: 'degradado',
    title: 'Estados degradados',
    css: DEGRADED_CSS,
    frame: degradedFrame,
    sheet: () =>
      dataSheet(
        'Estados degradados',
        [
          ['Datos congelados', 'evento stale', 'el observador lleva más de 5 s callado'],
          ['Vuelven los datos', 'evento fresh', 'quita el aviso'],
          ['Vida desconocida', 'player.provenance.health !== "player"', 'NO pintar barra ni número'],
          ['Resto de procedencias', 'player.provenance / match.provenance', 'observer · player · derived · operator · none'],
          ['Sin servidor', 'estado propio del overlay', 'no llega del contrato; lo sabe el cliente del overlay'],
          ['Protocolo incompatible', 'protocol del mensaje vs PROTOCOL_VERSION', 'si el servidor va por delante, no se pinta'],
        ],
        [
          'La regla de las cuatro: <strong>nunca vaciar la pantalla</strong>. Congelado con aviso es aceptable; en blanco a mitad de una ronda no.',
          'Un 100 de vida inventado es el peor fallo posible de este overlay, porque es indistinguible de un dato bueno. De ahí que la procedencia viaje campo a campo.',
          'Estas cuatro cajas están juntas para verlas; cada una aparece sola y en su sitio.',
        ],
      ),
  },
  {
    slug: 'seleccion',
    title: 'Selección de agentes',
    css: SELECT_CSS,
    frame: selectFrame,
    sheet: () =>
      dataSheet(
        'Selección de agentes',
        [
          ['Cuándo se enseña', 'match.phase === "agentSelect"', ''],
          ['Jugadores', 'match.teams[i].players[]', 'llegan a medida que el juego los manda'],
          ['Agente elegido', 'player.agentName', 'vacío mientras no ha elegido'],
          ['Ya ha bloqueado', 'player.locked', 'false = sigue eligiendo'],
          ['Nombre del equipo y seeding', 'match.teams[i].name / .seeding', 'los teclea el operador'],
          ['Mapa', 'match.map', 'puede llegar tarde'],
        ],
        [
          'Es la pantalla que más tiempo está en cámara antes de empezar, y la que más se usa para presentar los equipos.',
          'El roster puede llegar <strong>incompleto</strong> durante unos segundos. Conviene que los huecos tengan forma en lugar de reflotar la lista al llegar cada jugador.',
        ],
      ),
  },
];

function indexPage() {
  const items = STATES.map(
    (state) => `
        <li>
          <a href="${state.slug}.html">${escape(state.title)}</a>
          <code>${state.slug}.html</code>
        </li>`,
  ).join('');

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Easy HUD — catálogo de pantallas</title>
    <link
      href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Poppins:wght@400;500&display=swap"
      rel="stylesheet"
    />
    <style>${BASE_CSS}
      main { max-width: 900px; margin: 60px auto; padding: 0 24px; }
      h1 { font: 700 30px/1.2 Oswald, sans-serif; letter-spacing: .04em; margin: 0 0 8px; }
      p.intro { color: #c2c2cc; margin: 0 0 30px; }
      ul { list-style: none; margin: 0; padding: 0; }
      li {
        display: flex; align-items: baseline; gap: 14px; padding: 14px 18px;
        margin-bottom: 10px; background: var(--caja); border: 1px solid var(--borde);
      }
      li a { color: var(--texto); font: 500 17px/1.3 Poppins, sans-serif; text-decoration: none; }
      li a:hover { color: var(--acento); }
      li code { margin-left: auto; font: 12px/1 ui-monospace, monospace; color: var(--apagado); }
      .aparte { margin-top: 34px; color: #c2c2cc; }
      .aparte code { color: #ffb3bb; }
    </style>
  </head>
  <body>
    <main>
      <h1>Catálogo de pantallas</h1>
      <p class="intro">
        Un fichero por pantalla, sin JavaScript, con los datos ya escritos y las
        imágenes apuntando al CDN de Riot. Cada uno lleva al final una ficha con
        todos los campos del estado que aparecen y de dónde sale cada uno; esa
        ficha se puede borrar.
      </p>
      <ul>${items}</ul>
      <p class="aparte">
        El HUD de combate no está aquí: lo genera
        <code>build-static.mjs</code> en <code>easy-hud-static.html</code>, y ya
        está diseñado.
      </p>
      <p class="aparte">
        Generado por <code>tools/build-states.mjs</code>. Para regenerarlo:
        <code>node packages/overlay/tools/build-states.mjs</code>
      </p>
    </main>
  </body>
</html>
`;
}

async function main() {
  process.stdout.write('catálogo de Riot…\n');
  const urls = await buildUrls();

  await mkdir(OUT, { recursive: true });

  for (const state of STATES) {
    const html = page({
      slug: state.slug,
      title: state.title,
      css: state.css,
      frame: state.frame(urls),
      sheet: state.sheet(),
    });
    await writeFile(join(OUT, `${state.slug}.html`), html, 'utf8');
    process.stdout.write(`  ${state.slug}.html\n`);
  }

  await writeFile(join(OUT, 'index.html'), indexPage(), 'utf8');
  process.stdout.write(`  index.html\n\nlisto: ${OUT}\n`);
}

await main();
