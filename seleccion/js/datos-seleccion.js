/* ADAPTADOR — la selección de agentes, con datos del servidor.
   ============================================================

   Sustituye al objeto de ejemplo que traía el paquete de diseño. La forma es
   la misma, así que el pintor solo ha cambiado en una cosa: se le llama
   cuando llegan datos en lugar de una vez al cargar.

   ## Esta pantalla es la única que aparece ANTES de la partida

   Mientras dura la selección no hay marcador, ni economía, ni bajas: solo
   diez jugadores decidiendo. Por eso se enciende con la fase `agentSelect` y
   se va en cuanto empieza la compra.
*/

import { PAPEL_DE_AGENTE, AGENTE_POR_INTERNO, AGENTES } from './catalogo.js';
import { avisa } from './aviso-dev.js';
import { abreFuente, GRUPO } from '../../comun/fuente.js';

/** Por si el servidor manda un agente que el catálogo no conoce todavía. */
const RUEDA = Object.keys(AGENTES).sort();

const MS_MOVER = 480 + 52 * 4;

/* ── El cartel entra y sale ──────────────────────────────────────────────── */

/** @type {HTMLElement} */
const escenario = document.querySelector('.escenario');
let puesto = false;
let moviendo = false;
let temporizador;

escenario.style.visibility = 'hidden';

function entra() {
  if (puesto) return;
  puesto = true;
  clearTimeout(temporizador);
  escenario.style.visibility = '';
  escenario.classList.remove('es-sale');
  escenario.classList.add('es-entra');
  moviendo = true;
  temporizador = setTimeout(() => {
    moviendo = false;
    escenario.classList.remove('es-entra');
  }, MS_MOVER);
}

function sale() {
  if (!puesto) return;
  puesto = false;
  clearTimeout(temporizador);
  escenario.classList.remove('es-entra');
  escenario.classList.add('es-sale');
  moviendo = true;
  temporizador = setTimeout(() => {
    moviendo = false;
    escenario.classList.remove('es-sale');
    escenario.style.visibility = 'hidden';
  }, MS_MOVER);
}

/* ── De nuestro estado a la forma del diseño ─────────────────────────────── */

/**
 * El logo, en dirección absoluta.
 *
 * Hace falta por un detalle feo: la cabecera pone el logo en una variable
 * CSS (`--logo`) y la hoja de estilos la usa con `var()`. Una ruta relativa
 * dentro de una sustitución así **la resuelve el navegador contra la hoja**,
 * no contra la página, así que `./assets/x.webp` acaba pidiendo
 * `css/assets/x.webp` y da 404. Con la dirección completa no hay duda.
 */
function absoluta(url) {
  if (url === '' || url === undefined || url === null) return '';
  try {
    return new URL(url, location.href).href;
  } catch {
    return url;
  }
}

function construye(match) {
  return {
    mapa: match.map,
    rueda: RUEDA,
    /* Se conserva por compatibilidad con el pintor; lo que manda de verdad
       es la marca por jugador. */
    elegidos: match.teams.map((t) => t.players.filter((p) => p.locked).length),
    equipos: match.teams.map((team) => ({
      tricode: team.shortName,
      nombre: team.name,
      bando: team.side === 'attack' ? 'ATK' : 'DEF',
      logo: absoluta(team.logoUrl),
      /*
       * Está eligiendo UNO por equipo, no todos los que faltan.
       *
       * El juego enseña el agente señalado antes de confirmarlo, así que
       * tener agente no basta para distinguir a quien está decidiendo: si se
       * usara eso, en cuanto el roster trae los diez agentes aparecerían
       * cuatro o cinco "eligiendo" a la vez y la pantalla perdería el sentido.
       * El que decide es el primero de la fila que aún no ha bloqueado.
       */
      jugadores: team.players.map((p, k) => {
        const clave = (AGENTE_POR_INTERNO[p.agentInternal] ?? p.agentName ?? '').toLowerCase();
        const turno = team.players.findIndex((otro) => otro.locked !== true);
        return {
          nick: p.identity?.name ?? '',
          agente: clave,
          nombre: p.agentName ?? '',
          papel: PAPEL_DE_AGENTE[clave] ?? '',
          elegido: p.locked === true,
          eligiendo: p.locked !== true && k === turno,
        };
      }),
    })),
  };
}

/* ── El golpe al confirmar ───────────────────────────────────────────────── */

/**
 * Quién estaba bloqueado en la foto anterior.
 *
 * El golpe es un cambio, no un estado: hay que compararlo. Se lanza después
 * de pintar, porque la celda que lo recibe se acaba de construir.
 */
const bloqueadoAntes = new Map();

function anotaBloqueos(datos) {
  /** @type {NodeListOf<HTMLElement>} */
  const celdas = document.querySelectorAll('.celda');
  datos.equipos.forEach((equipo, lado) => {
    equipo.jugadores.forEach((j, k) => {
      const clave = `${lado}:${k}`;
      const previo = bloqueadoAntes.get(clave);
      bloqueadoAntes.set(clave, j.elegido);
      if (previo !== false || !j.elegido) return;

      const celda = [...celdas].find(
        (c) => c.dataset.lado === String(lado) && c.dataset.pos === String(k),
      );
      if (celda === undefined) return;
      celda.classList.add('es-encaja');
      setTimeout(() => celda.classList.remove('es-encaja'), 470);
    });
  });
}

/* ── Conexión ────────────────────────────────────────────────────────────── */

/*
 * La fuente es el servidor (ver `comun/fuente.js`), que entrega el mismo
 * contrato `match` de siempre. Esta pantalla solo sale en la fase de selección
 * de agentes; en cualquier otra se retira. La reconexión la lleva socket.io.
 */
let firma = '';

if (GRUPO === '') avisa('Falta el código de grupo en la dirección.');
else avisa(`Conectando al grupo ${GRUPO}…`);

abreFuente({
  onMatch: (match) => {
    if (match.phase !== 'agentSelect') {
      sale();
      return;
    }
    avisa('');

    const datos = construye(match);
    const ahora = JSON.stringify(datos);
    const cambio = ahora !== firma;
    firma = ahora;

    /*
     * Como en las demás pantallas: no se repinta mientras se mueve, porque
     * unas celdas nuevas heredan la animación de entrada y la relanzan.
     */
    if (!puesto) {
      window.pintaSeleccion(datos);
      anotaBloqueos(datos);
      entra();
      return;
    }
    if (cambio && !moviendo) {
      window.pintaSeleccion(datos);
      anotaBloqueos(datos);
    }
  },
});
