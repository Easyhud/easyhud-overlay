/**
 * Descarga el arte del juego a local, una vez.
 *
 *   node packages/overlay/tools/fetch-assets.mjs
 *
 * Por qué existe: en emisión, el overlay no debe salir a la red a por
 * imágenes. Una petición lenta o un DNS caído a mitad de un torneo se traduce
 * en tarjetas sin icono de agente, y el operador no puede hacer nada al
 * respecto en directo. Así que se baja todo antes y el overlay lee ficheros
 * locales.
 *
 * De dónde sale: `valorant-api.com`, que publica el catálogo del juego con las
 * URLs del CDN de Riot. **El arte es de Riot Games y no entra en el
 * repositorio**: esta carpeta está en `.gitignore` y cada máquina la genera
 * ejecutando este script. Cuando exista el cliente de Overwolf, su instalador
 * hará esto mismo en la máquina del operador.
 *
 * Es idempotente: los ficheros que ya están no se vuelven a bajar, así que
 * relanzarlo tras un parche del juego solo trae lo nuevo.
 */

import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'game');
const MANIFEST = join(ROOT, 'manifest.json');

const API = 'https://valorant-api.com/v1';

/**
 * Ranuras de habilidad que nos interesan.
 *
 * `Passive` se deja fuera: solo la tienen dos agentes y no se pinta en las
 * tarjetas. Bajarla sería peso muerto.
 */
const ABILITY_SLOTS = ['Grenade', 'Ability1', 'Ability2', 'Ultimate'];

/** Nombre de fichero seguro a partir de un nombre del juego. */
function slug(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

let downloaded = 0;
let skipped = 0;
let failed = 0;

/**
 * Baja un fichero si no está ya.
 *
 * Un fallo NO aborta la descarga entera: se anota y se sigue. Si un solo
 * icono de un agente que nadie va a jugar no está disponible, no tiene sentido
 * quedarse sin los otros ciento setenta.
 */
async function download(url, target) {
  if (await exists(target)) {
    skipped += 1;
    return true;
  }
  try {
    const response = await fetch(url);
    if (!response.ok) {
      process.stderr.write(`  fallo ${response.status}: ${url}\n`);
      failed += 1;
      return false;
    }
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(await response.arrayBuffer()));
    downloaded += 1;
    return true;
  } catch (error) {
    process.stderr.write(`  fallo de red: ${url} (${error.message})\n`);
    failed += 1;
    return false;
  }
}

async function fetchJson(path) {
  const response = await fetch(`${API}${path}`);
  if (!response.ok) throw new Error(`${path} devolvió ${response.status}`);
  return response.json();
}

async function main() {
  await mkdir(ROOT, { recursive: true });

  /**
   * El manifiesto anterior se reutiliza como base.
   *
   * Importa para no perder entradas: si el catálogo cambia y un agente
   * desaparece de la respuesta, su icono sigue en disco y una grabación vieja
   * que lo mencione debe seguir pintándose.
   */
  let manifest = { agents: {}, weapons: {}, fetchedAt: 0 };
  if (await exists(MANIFEST)) {
    try {
      manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
    } catch {
      process.stderr.write('manifiesto anterior ilegible; se rehace\n');
    }
  }

  process.stdout.write('agentes...\n');
  const agents = await fetchJson('/agents?isPlayableCharacter=true');

  for (const agent of agents.data) {
    const name = agent.displayName;
    if (typeof name !== 'string' || name === '') continue;
    const key = slug(name);

    const entry = { name, abilities: {} };

    if (typeof agent.displayIcon === 'string') {
      const file = `agents/${key}.png`;
      if (await download(agent.displayIcon, join(ROOT, file))) {
        entry.icon = file;
      }
    }

    for (const ability of agent.abilities ?? []) {
      if (!ABILITY_SLOTS.includes(ability.slot)) continue;
      if (typeof ability.displayIcon !== 'string') continue;
      const file = `abilities/${key}-${slug(ability.slot)}.png`;
      if (await download(ability.displayIcon, join(ROOT, file))) {
        entry.abilities[ability.slot] = {
          file,
          // El nombre de la habilidad no se pinta hoy, pero cuesta cero
          // guardarlo y es lo que hará falta para un tooltip en el panel.
          name: ability.displayName ?? '',
        };
      }
    }

    manifest.agents[key] = { ...manifest.agents[key], ...entry };
  }

  process.stdout.write('armas...\n');
  const weapons = await fetchJson('/weapons');

  for (const weapon of weapons.data) {
    const name = weapon.displayName;
    if (typeof name !== 'string' || name === '') continue;
    const key = slug(name);

    /*
     * Se prefiere el icono de killfeed al de tienda.
     *
     * El de killfeed es la silueta que el propio juego usa en su feed de
     * bajas: es plano, ancho y legible a 40 px de ancho sobre un fondo oscuro.
     * El de tienda está iluminado y con perspectiva, y a ese tamaño se
     * convierte en una mancha.
     */
    const source =
      typeof weapon.killfeedIcon === 'string'
        ? weapon.killfeedIcon
        : typeof weapon.displayIcon === 'string'
          ? weapon.displayIcon
          : null;
    if (source === null) continue;

    const file = `weapons/${key}.png`;
    if (await download(source, join(ROOT, file))) {
      manifest.weapons[key] = { name, file };
    }
  }

  /*
   * Escudos.
   *
   * El catálogo los llama "gear" y solo trae tres: Heavy, Light y Regen. No
   * hay icono de "sin escudo" porque en el juego eso es la ausencia de icono;
   * el nuestro es un contorno vacío dibujado por nosotros, en `icons/`.
   *
   * Las claves se normalizan a las del contrato (`heavy`, `light`, `regen`),
   * que no coinciden con los nombres del catálogo ("Heavy Armor", "Regen
   * Shield"): el contrato manda y la traducción vive aquí, en el borde.
   */
  process.stdout.write('escudos...\n');
  const gear = await fetchJson('/gear');
  manifest.armor = manifest.armor ?? {};

  for (const item of gear.data) {
    const name = item.displayName;
    if (typeof name !== 'string' || typeof item.displayIcon !== 'string') continue;

    const lower = name.toLowerCase();
    const kind = lower.includes('heavy')
      ? 'heavy'
      : lower.includes('light')
        ? 'light'
        : lower.includes('regen')
          ? 'regen'
          : null;
    if (kind === null) continue;

    const file = `armor/${kind}.png`;
    if (await download(item.displayIcon, join(ROOT, file))) {
      manifest.armor[kind] = { name, file };
    }
  }

  manifest.fetchedAt = Date.now();
  manifest.source = API;
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 1), 'utf8');

  process.stdout.write(
    `\nlisto: ${downloaded} descargados, ${skipped} ya estaban, ${failed} fallidos\n` +
      `agentes: ${Object.keys(manifest.agents).length}` +
      ` · armas: ${Object.keys(manifest.weapons).length}\n` +
      `manifiesto: ${MANIFEST}\n`,
  );

  // Un fallo puntual no es motivo para devolver error: el overlay degrada a
  // iniciales por cada pieza que falte. Solo se falla si no hay NADA.
  if (Object.keys(manifest.agents).length === 0) process.exit(1);
}

await main();
