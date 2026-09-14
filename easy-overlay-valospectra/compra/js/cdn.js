/* Arte del juego, del CDN público de Valorant.
   ============================================

   Mismo papel que el `cdn.js` que salió de diseño, con una diferencia: los
   identificadores no están aquí a mano. Vienen de `catalogo.js`, que se
   genera del catálogo público con `tools/fetch-catalogo.mjs`.

   El fichero original traía diez agentes y ocho armas, que es lo que hacía
   falta para maquetar. En una partida sale cualquiera de los veintinueve y de
   las veinte, y un identificador que falte es un icono roto en directo.

   El arte se pide al CDN al pintarlo y **nunca se guarda en el repositorio**:
   es de Riot. */

import { AGENTES, ARMAS } from './catalogo.js';

const CDN = 'https://media.valorant-api.com';

/*
 * Una clave desconocida devuelve cadena vacía, no una URL con `undefined`
 * dentro: esa URL el navegador la pide, recibe un 404 y pinta el icono roto.
 */
const ruta = (mapa, clave, cola) => {
  const id = mapa[clave];
  return id === undefined ? '' : CDN + cola.replace('%s', id);
};

/* Los tres huecos básicos, en el orden en que el tablero los pinta. */
const HUECOS = ['grenade', 'ability1', 'ability2'];

window.HUD = window.HUD || {};
Object.assign(window.HUD, {
  iconoAgente: (a) => ruta(AGENTES, a, '/agents/%s/displayicon.png'),
  iconoArma: (w) => ruta(ARMAS, w, '/weapons/%s/displayicon.png'),
  iconoHabilidad: (a, i) => ruta(AGENTES, a, `/agents/%s/abilities/${HUECOS[i]}/displayicon.png`),
  iconoUltimate: (a) => ruta(AGENTES, a, '/agents/%s/abilities/ultimate/displayicon.png'),
  CREDITOS: './assets/credits-icon.webp',
});
