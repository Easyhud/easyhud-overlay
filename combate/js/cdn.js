/* Arte del juego, del CDN público de Valorant.
   ============================================

   Los identificadores no están aquí a mano: viven en `catalogo.js`, que se
   genera del catálogo público con `tools/fetch-catalogo.mjs`. En una partida
   sale cualquiera de los veintinueve agentes y de las veinte armas, y un
   identificador que falte es un icono roto en directo.

   El arte se pide al CDN en el momento de pintarlo y **nunca se guarda en el
   repositorio**: es de Riot.

   Los nombres de fichero van en MINÚSCULA. `fullPortrait.png` devuelve 404;
   el bueno es `fullportrait.png`. */

import { AGENTES, ARMAS } from './catalogo.js';

const CDN = 'https://media.valorant-api.com';

/*
 * Una clave desconocida devuelve cadena vacía, no una URL con `undefined`
 * dentro: esa URL el navegador la pide, recibe un 404 y pinta el icono roto.
 * Vacío deja el hueco limpio, que es lo que el diseño espera cuando un dato
 * no está.
 */
const ruta = (mapa, clave, cola) => {
  const id = mapa[clave];
  return id === undefined ? '' : CDN + cola.replace('%s', id);
};

export const iconoAgente = (a) => ruta(AGENTES, a, '/agents/%s/displayicon.png');
export const iconoArma = (w) => ruta(ARMAS, w, '/weapons/%s/displayicon.png');

/* Los tres huecos básicos, en el orden en que el pie los pinta: C, Q, E. */
const HUECOS = ['grenade', 'ability1', 'ability2'];
export const iconoHabilidad = (a, i) =>
  ruta(AGENTES, a, `/agents/%s/abilities/${HUECOS[i]}/displayicon.png`);
export const iconoUltimate = (a) => ruta(AGENTES, a, '/agents/%s/abilities/ultimate/displayicon.png');

/* ── RANGO ────────────────────────────────────────────────────────────────
   El icono de rango sale del mismo CDN, pero el identificador del set de tiers
   cambia cada episodio; fijarlo a mano se pudriría. En vez de eso se pide una
   sola vez el catálogo de `competitivetiers` y se arma el mapa tier→icono. El
   número de tier (0..27) llega en el estado, resuelto por el cliente del
   observador. Hasta que el catálogo carga, `iconoRango` devuelve '' (sin icono);
   el overlay repinta a 5 fps, así que el icono aparece solo en cuanto llega. */
const iconosRango = new Map(); // tier (1..27) → URL del icono pequeño
let rangoPedido = false;
async function cargaRangos() {
  if (rangoPedido) return;
  rangoPedido = true;
  try {
    const r = await fetch('https://valorant-api.com/v1/competitivetiers');
    const data = (await r.json())?.data ?? [];
    const set = data[data.length - 1]; // el episodio actual es el último
    for (const t of set?.tiers ?? []) {
      if (t.smallIcon) iconosRango.set(t.tier, t.smallIcon);
    }
  } catch {
    rangoPedido = false; // sin red aún; se reintenta al próximo pintado
  }
}
cargaRangos();

export const iconoRango = (tier) => {
  if (!tier || tier <= 0) return '';
  if (iconosRango.size === 0) cargaRangos();
  return iconosRango.get(tier) ?? '';
};

/* Lo local, que sí va en el repositorio. */
export const CREDITOS = './assets/credits-icon.webp';
export const SPIKE = './assets/spike-ink.png';
export const OJO = './assets/ojo.svg';
