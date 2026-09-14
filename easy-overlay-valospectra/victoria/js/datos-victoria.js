/* ADAPTADOR — la pantalla de victoria, con el resultado real.
   ===========================================================

   Sustituye al objeto de ejemplo del paquete de diseño. Del pintor solo
   cambia que se le llama cuando la partida termina en vez de al cargar.

   ## Esta pantalla va con un SUCESO, no con el estado

   Es la diferencia con casi todas las demás. El fin de un mapa es un
   instante: el servidor lo anuncia una vez, con quién ganó, y ya está. La
   pantalla se enciende ahí.

   Pero además se mira el estado, por un motivo práctico: si esta fuente se
   abre —o se recarga— **después** de que la partida acabara, el suceso ya
   pasó y no vuelve. Con la fase `gameOver` en el estado se reconstruye igual,
   y eso evita que un refresco accidental en medio de la celebración deje la
   pantalla en negro.
*/

import { abreFuente } from '../../comun/fuente.js';

/** Cuánto se queda. En emisión la corta el operador cambiando de escena. */
const MS_EN_PANTALLA = 0;

const MS_MOVER = 520;

/**
 * Direcciones absolutas para los logos.
 *
 * El escudo se pinta con una variable CSS (`--logo`) que la hoja usa con
 * `var()`, y una ruta relativa ahí **la resuelve el navegador contra la hoja
 * de estilos**, no contra la página: `./assets/x.webp` acabaría pidiendo
 * `css/assets/x.webp`. Ya mordió en la pantalla de selección.
 */
function absoluta(url) {
  if (url === '' || url === undefined || url === null) return '';
  try {
    return new URL(url, location.href).href;
  } catch {
    return url;
  }
}

/* ── Entrada y salida ────────────────────────────────────────────────────── */

/** @type {HTMLElement} */
const vic = document.querySelector('.vic');
let puesto = false;
let temporizador;

vic.style.visibility = 'hidden';

function entra() {
  if (puesto) return;
  puesto = true;
  clearTimeout(temporizador);
  vic.style.visibility = '';
  vic.classList.remove('es-sale');
  vic.classList.add('es-entra');
  temporizador = setTimeout(() => vic.classList.remove('es-entra'), MS_MOVER);
}

function sale() {
  if (!puesto) return;
  puesto = false;
  clearTimeout(temporizador);
  vic.classList.remove('es-entra');
  vic.classList.add('es-sale');
  temporizador = setTimeout(() => {
    vic.classList.remove('es-sale');
    vic.style.visibility = 'hidden';
  }, MS_MOVER);
}

/* ── Quién ganó ──────────────────────────────────────────────────────────── */

/**
 * La palabra grande.
 *
 * Por defecto «VICTORIA». En la última de una serie el operador puede querer
 * otra cosa, así que se puede forzar desde la dirección: `&palabra=CAMPEÓN`.
 * No se deduce sola de los mapas ganados: en un torneo, saber si esta era la
 * final es cosa del operador, no del marcador.
 */
const params = new URLSearchParams(location.search);
const PALABRA = (params.get('palabra') ?? 'VICTORIA').toUpperCase();

function construye(match, ganador) {
  return {
    ganador,
    palabra: PALABRA,
    equipos: match.teams.map((team) => ({
      tricode: team.shortName,
      nombre: team.name,
      logo: absoluta(team.logoUrl),
    })),
    filasMuro: 9,
    repeticiones: 6,
  };
}

/**
 * Quién ganó, cuando el suceso no lo dice.
 *
 * Pasa al reconstruir desde el estado tras un refresco. Se toma el marcador,
 * y si está empatado no se enseña nada: una pantalla de victoria sin ganador
 * claro es peor que ninguna.
 */
function delMarcador(match) {
  const [a, b] = match.teams.map((t) => t.roundsWon);
  if (a === b) return null;
  return a > b ? 0 : 1;
}

/* ── Conexión ────────────────────────────────────────────────────────────── */

/*
 * La fuente es ValoSpectra (ver `comun/fuente.js`). El fin del mapa lo deduce
 * el puente por marcador y lo manda como suceso `matchEnd`; además marca la
 * fase `gameOver` mientras el mapa esté decidido, que es lo que permite el
 * repesque cuando esta pantalla se abre tarde.
 */
let anunciado = false;
let ultimo = null;

function muestra(match, ganador) {
  if (ganador === null || ganador === undefined) return;
  window.pintaVictoria(construye(match, ganador));
  entra();
  if (MS_EN_PANTALLA > 0) setTimeout(() => sale(), MS_EN_PANTALLA);
}

abreFuente({
  onMatch: (match) => {
    ultimo = match;

    /* El repesque: la partida ya estaba terminada cuando esta pantalla se
       abrió, así que el suceso no va a llegar nunca. */
    if (!anunciado && match.phase === 'gameOver') {
      anunciado = true;
      muestra(match, delMarcador(match));
    }
    /* Una partida nueva apaga la pantalla y rearma el anuncio. */
    if (anunciado && match.phase !== 'gameOver') {
      anunciado = false;
      sale();
    }
  },
  onEvents: (eventos) => {
    for (const evento of eventos) {
      if (evento.type !== 'matchEnd' || ultimo === null) continue;
      anunciado = true;
      muestra(ultimo, evento.winnerIndex ?? delMarcador(ultimo));
    }
  },
});

/*
 * Este fichero es un MÓDULO, aunque no importe nada.
 *
 * Sin un `import` o un `export`, TypeScript lo trata como un script suelto y
 * sus variables de nivel superior chocan con las de las demás pantallas
 * —`room`, `token`, `reintento`— aunque en el navegador cada una viva en su
 * propio ámbito. Se carga con `type="module"`, así que esto solo lo dice.
 */
export {};
