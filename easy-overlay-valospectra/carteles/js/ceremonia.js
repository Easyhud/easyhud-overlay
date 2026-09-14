/* CEREMONIA — gana la ronda.
   ==========================

   Se dispara con el suceso de fin de ronda, no con el estado: una ceremonia
   es un instante, no una situación. El servidor la manda una vez y ya está;
   si se perdiera, no se repite.

   Sale, se queda unos segundos y se va sola. */

import { cartel, conecta, relieve, tinta } from './enlace.js';

/**
 * TOPE de cuánto se queda puesto.
 *
 * Lo normal es que lo quite la fase de COMPRA, que es la señal del juego de que
 * la ronda siguiente ha empezado de verdad (ver `alEstado`). Esto es el tope
 * para que no se quede clavado si esa fase no llega nunca —el observador se
 * cayó, la plataforma se atascó—.
 *
 * Con solo el reloj quedaban los dos errores posibles: si la pantalla de fin de
 * ronda del juego dura más, el cartel se va con el juego todavía en ella; si
 * dura menos, el cartel se queda encima de la fase de compra, tapando lo único
 * que hay que mirar ahí.
 */
const MS_EN_PANTALLA = 4200;

const caja = cartel();
const nodo = document.querySelector('.cartel');
const etq = document.querySelector('.cartel__etq');
const dato = document.querySelector('.cartel__dato');
const pie = document.querySelector('.cer__pie');
const logo = document.querySelector('.cer__logo');
const fondo = document.querySelector('.cer__fondo > div');

caja.escondeYa();

/** Lo último que dijo el estado, para saber QUIÉN ganó cuando llegue el aviso. */
let equipos = [];
let ronda = 0;

/**
 * El texto que corona el cartel.
 *
 * El cartel de diseño dice "Gana la ronda" y nada más, pero el servidor
 * deduce cinco ceremonias. Se aprovechan: son el motivo por el que un cartel
 * de ronda merece la pena mirarlo.
 *
 * El orden de prioridad lo decide el servidor, no esto: aquí solo se traduce
 * la que haya llegado. Y si llegara una que este overlay no conoce —porque el
 * servidor se actualice antes— se cae a «Gana la ronda» en lugar de dejar el
 * cartel sin título.
 */
const TITULOS = {
  ace: 'Ace',
  clutch: 'Clutch',
  teamAce: 'Ace de equipo',
  thrifty: 'Ronda ahorrada',
  flawless: 'Ronda impecable',
  roundWin: 'Gana la ronda',
};

let temporizador;

function anuncia(evento) {
  const equipo = equipos[evento.winnerIndex];
  if (equipo === undefined) return;

  /*
   * Verde fijo, no el color del bando.
   *
   * Es una decisión del diseño y está escrita en su LEEME: "gana el defensor
   * y el cartel sigue en verde a propósito". Un cartel que cambia de color
   * cada ronda compite con el marcador en lugar de acompañarlo.
   */
  tinta(nodo, 0);

  etq.textContent = TITULOS[evento.ceremony] ?? TITULOS.roundWin;
  dato.textContent = equipo.name;

  const tri = logo?.querySelector('span');
  if (tri !== null && tri !== undefined) tri.textContent = equipo.shortName;
  const icono = logo?.querySelector('i');
  if (icono !== null && icono !== undefined) {
    icono.style.backgroundImage = equipo.logoUrl === '' ? '' : `url(${equipo.logoUrl})`;
  }
  relieve(fondo, equipo.logoUrl);

  if (pie !== null) {
    const [texto, , lado] = pie.children;
    if (texto !== undefined) texto.textContent = `ronda ${ronda}`;
    if (lado !== undefined) {
      lado.textContent = evento.winnerSide === 'attack' ? 'atacante' : 'defensor';
    }
  }

  caja.entra();
  puesto = true;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    puesto = false;
    caja.sale();
  }, MS_EN_PANTALLA);
}

/** Si el cartel está puesto ahora mismo. */
let puesto = false;

conecta({
  alEstado: (match) => {
    equipos = match.teams;
    ronda = match.round;

    /*
     * La compra se lleva el cartel.
     *
     * Y solo la compra: `roundEnd` sigue siendo la fase en la que el cartel
     * TIENE que estar, y el fin de partida tiene su propia pantalla. Se
     * comprueba `puesto` para no llamar a `sale()` en cada estado —llegan diez
     * por segundo—, que relanzaría la animación de salida sin parar.
     */
    if (puesto && match.phase === 'shopping') {
      clearTimeout(temporizador);
      puesto = false;
      caja.sale();
    }
  },
  alSuceso: (evento) => {
    if (evento.type === 'roundEnd') anuncia(evento);
  },
});
