/**
 * Genera `dise/js/catalogo.js` del catálogo público de VALORANT.
 *
 * El diseño traía a mano diez agentes y ocho armas, que es lo que hacía falta
 * para maquetar. En una partida de verdad sale cualquiera de los veintinueve
 * agentes y de las diecinueve armas, y un identificador que falte es un icono
 * roto en directo.
 *
 * De aquí salen tres cosas:
 *
 *   - El identificador de cada agente y de cada arma, para pedir su imagen.
 *   - El puente del nombre en clave del juego (`Wushu`) a la clave del
 *     catálogo (`jett`), porque lo que manda la telemetría es el primero.
 *   - Los cuatro papeles.
 *
 * No descarga ninguna imagen: solo identificadores. El arte se pide al CDN de
 * Riot en el momento de pintarlo y **nunca se guarda en el repositorio**.
 *
 *   node packages/overlay/tools/fetch-catalogo.mjs
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENTS } from '../../client/src/tables.generated.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const SALIDA = join(HERE, '..', 'dise', 'js', 'catalogo.js');
const API = 'https://valorant-api.com/v1';

/** Clave de catálogo a partir de un nombre comercial: `KAY/O` -> `kayo`. */
function clave(nombre) {
  return nombre.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function traer(ruta) {
  const respuesta = await fetch(`${API}/${ruta}`);
  if (!respuesta.ok) throw new Error(`${ruta}: ${respuesta.status}`);
  const { data } = await respuesta.json();
  return data;
}

const agentes = await traer('agents?isPlayableCharacter=true');
const armas = await traer('weapons');

const AGENTES = {};
const PAPEL_DE_AGENTE = {};
const PAPELES = {};
for (const agente of agentes) {
  AGENTES[clave(agente.displayName)] = agente.uuid;
  const papel = agente.role;
  if (papel) {
    const nombre = papel.displayName.toLowerCase();
    PAPELES[nombre] = papel.uuid;
    PAPEL_DE_AGENTE[clave(agente.displayName)] = nombre;
  }
}

const ARMAS = {};
for (const arma of armas) ARMAS[clave(arma.displayName)] = arma.uuid;

/*
 * El puente que hacía falta: la telemetría manda el nombre en clave de
 * desarrollo (`Wushu`), el catálogo se indexa por el comercial (`jett`). La
 * tabla de agentes del cliente ya tiene esa correspondencia, así que se
 * reutiliza en vez de mantener dos listas que se separarían.
 */
const PUENTE = {};
for (const [interno, comercial] of Object.entries(AGENTS)) {
  const k = clave(comercial);
  if (AGENTES[k] !== undefined) PUENTE[interno] = k;
}

const faltan = Object.entries(AGENTS)
  .filter(([interno]) => PUENTE[interno] === undefined)
  .map(([interno, comercial]) => `${interno} (${comercial})`);

const lineas = (objeto) =>
  Object.keys(objeto)
    .sort()
    .map((k) => `  ${/^[a-z][a-z0-9]*$/.test(k) ? k : `'${k}'`}: '${objeto[k]}',`)
    .join('\n');

writeFileSync(
  SALIDA,
  `/* GENERADO por tools/fetch-catalogo.mjs — no editar a mano.
   Del catálogo público de VALORANT, ${new Date().toISOString().slice(0, 10)}.
   ${agentes.length} agentes, ${armas.length} armas, ${Object.keys(PAPELES).length} papeles. */

export const AGENTES = {
${lineas(AGENTES)}
};

export const ARMAS = {
${lineas(ARMAS)}
};

export const PAPELES = {
${lineas(PAPELES)}
};

/** Qué papel juega cada agente. El diseño lo usa en la selección. */
export const PAPEL_DE_AGENTE = {
${lineas(PAPEL_DE_AGENTE)}
};

/* El nombre en clave que manda la telemetría -> la clave del catálogo.
   \`Wushu\` es Jett, y sin este puente el retrato no se pide nunca. */
export const AGENTE_POR_INTERNO = {
${lineas(PUENTE)}
};

/** El nombre comercial del arma que manda el servidor -> clave del catálogo. */
export const ARMA_POR_NOMBRE = {
${Object.keys(ARMAS)
  .sort()
  .map((k) => `  ${JSON.stringify(k.charAt(0).toUpperCase() + k.slice(1))}: '${k}',`)
  .join('\n')}
};
`,
  'utf8',
);

console.log(`catalogo.js: ${agentes.length} agentes, ${armas.length} armas`);
if (faltan.length > 0) {
  console.log(`SIN PUENTE (el catálogo no los conoce): ${faltan.join(', ')}`);
}
