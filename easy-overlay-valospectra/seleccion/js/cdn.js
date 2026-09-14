/* Arte del juego, del CDN público de Valorant.
   ============================================

   Mismo papel que el `cdn.js` que salió de diseño, con los identificadores
   traídos de `catalogo.js` en vez de escritos a mano: los veintinueve
   agentes y los cuatro papeles, no diez.

   Los nombres de fichero van en MINÚSCULA: `fullPortrait.png` da 404. */

import { AGENTES, PAPELES } from './catalogo.js';

const CDN = 'https://media.valorant-api.com';

/* Sin identificador, cadena vacía: una URL con `undefined` dentro la pide el
   navegador, recibe un 404 y pinta el icono roto. */
const ruta = (mapa, clave, cola) => {
  const id = mapa[clave];
  return id === undefined ? '' : CDN + cola.replace('%s', id);
};

window.HUD = window.HUD || {};
Object.assign(window.HUD, {
  retratoAgente: (a) => ruta(AGENTES, a, '/agents/%s/fullportrait.png'),
  iconoAgente: (a) => ruta(AGENTES, a, '/agents/%s/displayicon.png'),
  iconoPapel: (r) => ruta(PAPELES, r, '/agents/roles/%s/displayicon.png'),
});
