/**
 * Genera un HTML único, estático y autosuficiente del HUD.
 *
 *   node packages/overlay/tools/build-static.mjs
 *
 * Para qué: llevarse el HUD a una herramienta de diseño. El overlay de
 * producción es markup vacío que rellena JavaScript desde un WebSocket, y eso
 * a una herramienta de diseño no le sirve de nada: abre el fichero y ve una
 * página en blanco.
 *
 * Así que aquí se hace lo contrario de lo que hace el overlay real:
 *
 *  - **Cero JavaScript.** El estado se congela y se escribe ya expandido como
 *    HTML. Diez tarjetas escritas, el killfeed escrito, el marcador escrito.
 *  - **Cero ficheros aparte.** El CSS va dentro del `<style>` y las imágenes
 *    apuntan al CDN de Riot por URL, así que el fichero pesa kilobytes en vez
 *    de arrastrar 14 MB de arte.
 *  - **Tamaño fijo 1920x1080**, sin la transformación de escala que usa
 *    producción: una herramienta de diseño quiere dimensiones reales.
 *
 * El estado congelado está elegido a mano para que se vea CADA variante en un
 * solo fotograma: vivo y muerto, vida completa y parcial, ultimate lista y
 * cargando, con spike y sin, portador observado por la cámara, y un jugador
 * sin datos de cliente auxiliar para que se vea cómo se esconde la vida.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OVERLAY = join(HERE, '..');
const OUT = join(OVERLAY, 'easy-hud-static.html');

const API = 'https://valorant-api.com/v1';

/* ------------------------------ Estado fijo ------------------------------- */

/**
 * Los diez jugadores, elegidos para cubrir todos los estados posibles.
 *
 * `health: null` significa que ese jugador no corre el cliente auxiliar: su
 * vida es desconocida y el overlay debe esconder la barra en lugar de pintar
 * un 100 inventado. Es la regla más importante del producto y por eso hay un
 * caso así en el fotograma.
 */
const PLAYERS = [
  // Equipo izquierdo: atacante.
  { team: 0, name: 'Kestrel89', agent: 'Jett', alive: true, health: 100, ult: [7, 7], weapon: 'Vandal', armor: 'heavy', kda: [14, 9, 3], money: 4900, observed: true, spike: false },
  { team: 0, name: 'Mirra72', agent: 'Sova', alive: true, health: 64, ult: [5, 8], weapon: 'Phantom', armor: 'light', kda: [9, 11, 6], money: 3200, observed: false, spike: false },
  { team: 0, name: 'Volt18', agent: 'Killjoy', alive: false, health: 0, ult: [4, 8], weapon: 'Spectre', armor: 'none', kda: [7, 12, 2], money: 2100, observed: false, spike: false },
  { team: 0, name: 'Nyx61', agent: 'Omen', alive: true, health: 28, ult: [3, 7], weapon: 'Sheriff', armor: 'none', kda: [6, 10, 4], money: 1450, observed: false, spike: true },
  { team: 0, name: 'Sable74', agent: 'Raze', alive: true, health: 100, ult: [8, 8], weapon: 'Operator', armor: 'heavy', kda: [15, 8, 5], money: 7600, observed: false, spike: false },

  // Equipo derecho: defensor.
  { team: 1, name: 'Quill54', agent: 'Viper', alive: true, health: 100, ult: [6, 7], weapon: 'Vandal', armor: 'heavy', kda: [12, 9, 4], money: 5300, observed: false, spike: false },
  { team: 1, name: 'Harbor63', agent: 'Cypher', alive: true, health: 87, ult: [2, 6], weapon: 'Marshal', armor: 'light', kda: [8, 10, 7], money: 2450, observed: false, spike: false },
  { team: 1, name: 'Ember20', agent: 'Neon', alive: false, health: 0, ult: [5, 7], weapon: 'Judge', armor: 'none', kda: [10, 13, 3], money: 1900, observed: false, spike: false },
  { team: 1, name: 'Onyx23', agent: 'Chamber', alive: true, health: 45, ult: [8, 8], weapon: 'Operator', armor: 'heavy', kda: [16, 6, 2], money: 6800, observed: false, spike: false },
  // Sin cliente auxiliar: vida y habilidades desconocidas.
  { team: 1, name: 'Rune81', agent: 'Clove', alive: true, health: null, ult: [4, 7], weapon: 'Classic', armor: 'light', kda: [5, 11, 8], money: 800, observed: false, spike: false },
];

/** Qué habilidades tiene disponibles cada jugador, por índice. */
const ABILITIES_READY = [
  [true, true, true],
  [true, false, true],
  [false, false, false],
  [true, true, false],
  [true, true, true],
  [false, true, true],
  [true, true, true],
  [false, false, true],
  [true, false, true],
  [false, false, false], // se ignora: no hay datos de este jugador
];

const MATCH = {
  round: 18,
  map: 'Ascent',
  spikePlanted: true,
  teams: [
    { tricode: 'ESY', name: 'Easy Esports', seeding: 'Grupo A', score: 8, side: 'attack', mapsWon: 1 },
    { tricode: 'RVL', name: 'Rival Collective', seeding: 'Grupo B', score: 9, side: 'defense', mapsWon: 0 },
  ],
  mapsToWin: 2,
  watermark: 'EASY OPEN · easyhud.net',
};

/** Killfeed. La última fila lleva un nombre sin resolver, a propósito. */
const KILLFEED = [
  { killer: 'Kestrel89', killerSide: 'attack', assists: ['Mirra72'], weapon: 'Vandal', hs: true, victim: 'Ember20', victimSide: 'defense' },
  { killer: 'Sable74', killerSide: 'attack', assists: [], weapon: 'Operator', hs: false, victim: 'Onyx23', victimSide: 'defense' },
  { killer: 'Quill54', killerSide: 'defense', assists: [], weapon: 'Judge', hs: false, victim: 'Volt18', victimSide: 'attack' },
  { killer: 'ZeroCool', killerSide: 'unknown', assists: [], weapon: 'Phantom', hs: false, victim: 'Nyx61', victimSide: 'attack' },
];

const MAX_ULT_PIPS = 10;

/* ------------------------------ Catálogo ---------------------------------- */

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

/**
 * URLs remotas de los agentes y armas que aparecen en el fotograma.
 *
 * Solo se resuelven los que se usan: el fichero tiene que quedar ligero y
 * legible, no traer el catálogo entero.
 */
async function buildUrls() {
  const agents = await fetchJson('/agents?isPlayableCharacter=true');
  const weapons = await fetchJson('/weapons');

  const agentUrls = new Map();
  for (const agent of agents.data) {
    if (typeof agent.displayName !== 'string') continue;
    const abilities = {};
    for (const ability of agent.abilities ?? []) {
      if (typeof ability.displayIcon === 'string') {
        abilities[ability.slot] = ability.displayIcon;
      }
    }
    agentUrls.set(slug(agent.displayName), { icon: agent.displayIcon, abilities });
  }

  const weaponUrls = new Map();
  for (const weapon of weapons.data) {
    if (typeof weapon.displayName !== 'string') continue;
    const icon = weapon.killfeedIcon ?? weapon.displayIcon;
    if (typeof icon === 'string') weaponUrls.set(slug(weapon.displayName), icon);
  }

  const gear = await fetchJson('/gear');
  const armorUrls = new Map();
  for (const item of gear.data) {
    const lower = String(item.displayName ?? '').toLowerCase();
    const kind = lower.includes('heavy')
      ? 'heavy'
      : lower.includes('light')
        ? 'light'
        : lower.includes('regen')
          ? 'regen'
          : null;
    if (kind !== null && typeof item.displayIcon === 'string') {
      armorUrls.set(kind, item.displayIcon);
    }
  }

  return { agentUrls, weaponUrls, armorUrls };
}

/* ------------------------------- Markup ----------------------------------- */

const ABILITY_SLOTS = ['Grenade', 'Ability1', 'Ability2'];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function playerCard(player, index, side, urls) {
  const agent = urls.agentUrls.get(slug(player.agent));
  const known = player.health !== null;
  const ready = ABILITIES_READY[index] ?? [false, false, false];
  const [ultPoints, ultMax] = player.ult;
  const ultReady = ultPoints >= ultMax;
  const showKda = !player.alive;

  const abilities = player.alive
    ? ABILITY_SLOTS.map((slot, i) => {
        const url = agent?.abilities?.[slot];
        if (url === undefined) return '';
        const isReady = known && ready[i] === true;
        return `<img class="ability" data-ready="${isReady}" data-known="${known}" src="${url}" alt="" />`;
      }).join('\n            ')
    : '';

  const ultPips = ultReady
    ? ''
    : Array.from({ length: Math.min(ultMax, MAX_ULT_PIPS) }, (_, i) =>
        `<span class="ult-pip${i < ultPoints ? ' full' : ''}"></span>`,
      ).join('');

  const ultIcon =
    ultReady && agent?.abilities?.Ultimate !== undefined
      ? `<img class="ult-icon" src="${agent.abilities.Ultimate}" alt="" />`
      : '';

  const weaponUrl = urls.weaponUrls.get(slug(player.weapon));
  const armorUrl =
    player.armor === 'none' ? null : urls.armorUrls.get(player.armor);

  // El contorno vacío de "sin escudo" es arte propio, así que va incrustado
  // como data URI para que el fichero siga siendo autosuficiente.
  const armorNone =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" ' +
        'stroke="#a0a2a8" stroke-width="1.6" stroke-linejoin="miter">' +
        '<path d="M8 1.8 13.6 4v4.4C13.6 11.4 11.2 13.6 8 14.6 4.8 13.6 2.4 11.4 2.4 8.4V4Z"/></svg>',
    );

  const credits =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" ' +
        'stroke="#4ad991" stroke-width="1.8" stroke-linejoin="miter">' +
        '<path d="M8 1.6 14.4 8 8 14.4 1.6 8Z"/><path d="M5.2 8h5.6"/></svg>',
    );

  const sideColor = side === 'attack' ? 'var(--attack)' : 'var(--defense)';

  return `        <div class="pcard" data-alive="${player.alive}" data-observed="${player.observed}" style="--side-color: ${sideColor}">
          ${agent?.icon ? `<img class="agent-icon" src="${agent.icon}" alt="${escapeHtml(player.agent)}" />` : `<div class="agent-fallback">${escapeHtml(player.agent.slice(0, 2).toUpperCase())}</div>`}
          <div class="pmain">
            <span class="pname">${escapeHtml(player.name)}</span>
            <div class="prow">
            ${abilities}
              <div class="ult" data-ready="${ultReady}">${ultPips}${ultIcon}</div>
            </div>
          </div>
          <div class="pside">
            ${showKda ? '' : `<div class="pmoney"><img class="credits-mark" src="${credits}" alt="" /><span class="pmoney-value">${player.money}</span></div>`}
            ${showKda ? `<span class="pkda">${player.kda.join('/')}</span>` : ''}
            ${
              player.alive
                ? `<div class="pgear">
              <img class="parmor" src="${armorUrl ?? armorNone}" alt="" />
              ${weaponUrl ? `<img class="pweapon-icon" src="${weaponUrl}" alt="${escapeHtml(player.weapon)}" />` : `<span class="pweapon-text">${escapeHtml(player.weapon)}</span>`}
            </div>`
                : ''
            }
          </div>
          ${player.spike && player.alive ? '<span class="pspike"></span>' : ''}
          ${known && player.alive ? `<span class="phealth" style="--hp: ${player.health}%"></span>` : ''}
        </div>`;
}

function killfeedRow(kill) {
  const assists =
    kill.assists.length > 0
      ? `<span class="assists">+ ${escapeHtml(kill.assists.join(', '))}</span>`
      : '';
  const hs = kill.hs ? '<span class="hs">HS</span>' : '';
  return `        <div class="kill">
          <span class="who ${kill.killerSide}">${escapeHtml(kill.killer)}</span>
          ${assists}${hs}
          <span class="weapon">${escapeHtml(kill.weapon)}</span>
          <span class="who ${kill.victimSide}">${escapeHtml(kill.victim)}</span>
        </div>`;
}

function seriesPips() {
  const target = MATCH.mapsToWin;
  if (target <= 1) return '';
  const left = [];
  const right = [];
  for (let i = 0; i < target; i += 1) {
    left.unshift(`<span class="pip${i < MATCH.teams[0].mapsWon ? ' won' : ''}"></span>`);
    right.push(`<span class="pip${i < MATCH.teams[1].mapsWon ? ' won' : ''}"></span>`);
  }
  return `<div id="series-pips">${left.join('')}${right.join('')}</div>`;
}

function teamBlock(team, position) {
  const color = team.side === 'attack' ? 'var(--attack)' : 'var(--defense)';
  const text = `<div class="team-text">
            <span class="team-tricode">${escapeHtml(team.tricode)}</span>
            <span class="team-seeding">${escapeHtml(team.seeding)}</span>
          </div>`;
  return `        <div class="team-block ${position}" style="--side-color: ${color}">
          ${text}
        </div>`;
}

/* -------------------------------- Ensamblaje ------------------------------ */

async function main() {
  process.stdout.write('resolviendo URLs del catálogo...\n');
  const urls = await buildUrls();

  process.stdout.write('leyendo la hoja de estilos...\n');
  /*
   * LAS HOJAS, EN PLURAL Y EN ORDEN.
   *
   * Esto pedia un `style.css` que ya no existe: el CSS se repartio por
   * pantallas hace tiempo y esta herramienta se quedo atras sin que nadie se
   * enterara, porque no la ejecuta nadie hasta que hace falta — y cuando hace
   * falta es con prisa. Fallo en el peor momento posible: haciendo las capturas
   * para ensenar el producto.
   *
   * El orden es el mismo del index.html de combate: los tokens primero, porque
   * las otras dos leen sus variables.
   */
  const HOJAS = ['combate/css/tokens.css', 'combate/css/hud.css', 'combate/css/combate.css'];
  const partes = [];
  for (const hoja of HOJAS) {
    partes.push(`/* ===== ${hoja} ===== */`);
    partes.push(await readFile(join(OVERLAY, hoja), 'utf8'));
  }
  let css = partes.join('

');

  // La escala la aplica JavaScript en producción; aquí el lienzo va a tamaño
  // real para que una herramienta de diseño trabaje con medidas de verdad.
  css = css.replace('transform: scale(var(--scale, 1));', 'transform: none;');

  const left = PLAYERS.filter((p) => p.team === 0);
  const right = PLAYERS.filter((p) => p.team === 1);

  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Easy HUD — HUD estático para rediseño</title>

    <!--
      ESTE FICHERO ES UNA FOTO FIJA DEL HUD, PARA REDISEÑARLO.

      Qué es y qué no es:

        · No lleva JavaScript. Todo el markup está escrito ya expandido: las
          diez tarjetas, el killfeed, el marcador. Lo que se ve es lo que hay
          en el HTML, así que se puede mover y reestilar directamente.
        · Las imágenes apuntan al CDN de Riot por URL, no a ficheros locales.
          En producción se descargan y se sirven en local, porque un overlay
          de emisión no puede depender de la red; aquí interesa que el fichero
          sea uno solo y pese kilobytes.
        · El lienzo está a 1920x1080 reales. En producción se escala entero
          con una transformación para adaptarse al tamaño de la fuente de OBS.
        · Las tipografías vienen de Google Fonts, por lo mismo. En producción
          están autoalojadas.

      El fotograma está elegido para que se vea CADA estado a la vez:

        · Kestrel89  vivo, seguido por la cámara (contorno ámbar), ultimate lista
        · Mirra72    vivo al 64% de vida, ultimate a medio cargar
        · Volt18     muerto: en gris, sin arma, y con K/D/A en vez de dinero
        · Nyx61      vivo al 28%, lleva la spike (marca roja arriba)
        · Sable74    vivo, ultimate lista, arma y escudo pesados
        · Rune81     SIN cliente auxiliar: no hay barra de vida ni habilidades

      Ese último caso es la regla más importante del producto: la vida solo se
      pinta cuando es un dato real. Si el jugador no corre su cliente, el HUD
      esconde la barra en lugar de pintar un 100 inventado. Al rediseñar, esa
      tarjeta tiene que seguir estando bien sin esos datos.

      Piezas que todavía NO existen y habrá que diseñar: scoreboard de fase de
      compra, historial de rondas, banner de ceremonia de fin de ronda, cuenta
      atrás de tiempo muerto y caja de patrocinador.

      Generado por packages/overlay/tools/build-static.mjs
    -->

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Poppins:wght@400;500;600&display=swap"
      rel="stylesheet"
    />

    <style>
${css}

/* ---------------------------------------------------------------------------
   Añadidos solo de este fichero estático. No están en el overlay real.
   --------------------------------------------------------------------------- */

/* Fondo de referencia: en OBS el overlay va sobre el vídeo del juego y el
   fondo es transparente. Aquí hace falta algo debajo para poder juzgar
   contrastes. */
/* La hoja de producción fija "height: 100%" y "overflow: hidden" porque allí
   el overlay ocupa exactamente la fuente de OBS. Aquí el documento tiene que
   crecer con su contenido, o queda un hueco muerto al final.
   (Sin acentos graves en este comentario: va dentro de un template literal). */
html,
body {
  height: auto;
  min-height: 100%;
  overflow: auto;
}

body {
  background-color: #1b1d22;
  background-image:
    linear-gradient(rgb(255 255 255 / 4%) 1px, transparent 1px),
    linear-gradient(90deg, rgb(255 255 255 / 4%) 1px, transparent 1px);
  background-size: 48px 48px;
}

/* El lienzo a tamaño real, no absoluto, para que quepa la tira de piezas
   auxiliares debajo. */
#stage {
  position: relative;
  margin: 0 auto;
}

/* Tira de piezas que en el HUD solo aparecen en ciertos momentos y que aquí
   se muestran juntas para poder diseñarlas. */
.appendix {
  width: 1920px;
  margin: 0 auto;
  padding: 48px 28px 96px;
  font-family: var(--text);
}

.appendix h2 {
  font-family: var(--display);
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--grey-300);
  margin-bottom: 6px;
}

.appendix p {
  font-size: 14px;
  color: var(--grey-400);
  margin-bottom: 28px;
  max-width: 900px;
  line-height: 1.5;
}

.appendix-row {
  display: flex;
  align-items: flex-start;
  gap: 40px;
  flex-wrap: wrap;
}

/*
 * Dentro del apéndice, estas piezas se colocan en el flujo en vez de ancladas
 * a la pantalla.
 *
 * Los dos selectores tienen que incluir el id, no solo la clase: un selector
 * de id gana a cualquier número de clases, así que ".appendix .appendix-toast"
 * no podía con el "#toast" de la hoja de producción y el rótulo se quedaba
 * anclado al centro de la pantalla, encima del HUD.
 */
.appendix #status,
.appendix #toast {
  position: relative;
  top: auto;
  left: auto;
  translate: none;
}
    </style>
  </head>

  <body>
    <div id="stage">
      <div id="topbar">
${teamBlock(MATCH.teams[0], 'left')}

        <div class="score-core">
          <div class="score-line">
            <span class="score attack">${MATCH.teams[0].score}</span>
            <span class="score defense">${MATCH.teams[1].score}</span>
          </div>
          <span class="round-label">ronda ${MATCH.round}</span>
          ${seriesPips()}
        </div>

${teamBlock(MATCH.teams[1], 'right')}
      </div>

      <div id="spike" data-urgent="true"><span>SPIKE PLANTADA</span></div>

      <div id="killfeed">
${KILLFEED.map(killfeedRow).join('\n')}
      </div>

      <div id="combat">
        <div class="card-group left">
${left.map((p) => playerCard(p, PLAYERS.indexOf(p), MATCH.teams[0].side, urls)).join('\n')}
        </div>
        <div class="card-group right">
${right.map((p) => playerCard(p, PLAYERS.indexOf(p), MATCH.teams[1].side, urls)).join('\n')}
        </div>
      </div>

      <div id="watermark">${escapeHtml(MATCH.watermark)}</div>
    </div>

    <div class="appendix">
      <h2>Piezas auxiliares</h2>
      <p>
        En el HUD real estas dos solo aparecen en ciertos momentos, así que no
        se ven en el fotograma de arriba. El aviso de estado se enciende cuando
        se corta la conexión o el cliente del observador deja de mandar datos:
        es pequeño y va en una esquina a propósito, porque tiene que ser visible
        para el operador y casi invisible para el espectador. El rótulo lo
        escribe el operador desde el panel para un &laquo;volvemos en cinco&raquo;
        o un problema técnico.
      </p>

      <div class="appendix-row">
        <div id="status" data-state="lost">
          <span class="dot"></span>
          <span>datos detenidos</span>
        </div>

        <div class="appendix-toast" id="toast" style="--toast-color: var(--attack)">
          <div class="toast-title">Pausa técnica</div>
          <div class="toast-message">
            Volvemos en cinco minutos. Seguimos con el mapa 2 de la semifinal.
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
`;

  await writeFile(OUT, html, 'utf8');
  const kb = Math.round(Buffer.byteLength(html) / 1024);
  process.stdout.write(`\nlisto: ${OUT} (${kb} KB)\n`);
}

await main();
