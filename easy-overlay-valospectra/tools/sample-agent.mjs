/**
 * Saca los assets de UN agente a una carpeta suelta, para diseñar.
 *
 *   node packages/overlay/tools/sample-agent.mjs Raze
 *   node packages/overlay/tools/sample-agent.mjs Neon --out C:/donde/sea
 *
 * Para qué: al diseñar una tarjeta de jugador hacen falta las piezas de un
 * agente concreto a mano y con nombres legibles, no repartidas por el árbol de
 * assets con la nomenclatura del manifiesto.
 *
 * Los ficheros van con el nombre de la TECLA delante (`c-`, `q-`, `e-`, `x-`)
 * porque es como los piensa quien diseña y como los llama el jugador, no como
 * los llama el catálogo (`Grenade`, `Ability1`…).
 *
 * **Es arte de Riot Games**: la carpeta que genera no entra en el repositorio.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://valorant-api.com/v1';
const HERE = dirname(fileURLToPath(import.meta.url));

const agentName = process.argv[2];
if (agentName === undefined) {
  process.stderr.write('uso: sample-agent.mjs <NombreDelAgente> [--out <ruta>]\n');
  process.exit(1);
}

const outFlag = process.argv.indexOf('--out');
const OUT =
  outFlag >= 0 && process.argv[outFlag + 1] !== undefined
    ? process.argv[outFlag + 1]
    : join(HERE, '..', 'assets', 'design', agentName.toLowerCase());

/** Slot del catálogo -> tecla, que es como lo piensa quien diseña. */
const KEYS = { Grenade: 'c', Ability1: 'q', Ability2: 'e', Ultimate: 'x' };

/** Armas y escudos que suelen hacer falta en una tarjeta de ejemplo. */
const WEAPONS = ['Vandal', 'Phantom', 'Operator', 'Sheriff', 'Classic'];

const saved = [];

async function grab(url, file) {
  const response = await fetch(url);
  if (!response.ok) {
    process.stderr.write(`  fallo ${response.status}: ${file}\n`);
    return;
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(join(OUT, file), bytes);
  saved.push({ file, kb: Math.round(bytes.length / 1024) });
  process.stdout.write(`  ${file} (${Math.round(bytes.length / 1024)} KB)\n`);
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const agents = await fetch(`${API}/agents?isPlayableCharacter=true`).then((r) =>
    r.json(),
  );
  const agent = agents.data.find(
    (a) => String(a.displayName).toLowerCase() === agentName.toLowerCase(),
  );
  if (agent === undefined) {
    process.stderr.write(`no existe el agente "${agentName}"\n`);
    process.exit(1);
  }

  process.stdout.write(`${agent.displayName} (${agent.developerName})\n`);

  // Retratos: los tres formatos que sirven para una tarjeta.
  if (agent.displayIcon) await grab(agent.displayIcon, 'agente-icono.png');
  if (agent.fullPortrait) await grab(agent.fullPortrait, 'agente-cuerpo.png');
  if (agent.killfeedPortrait) {
    await grab(agent.killfeedPortrait, 'agente-killfeed.png');
  }

  const abilities = [];
  for (const ability of agent.abilities ?? []) {
    const key = KEYS[ability.slot];
    if (key === undefined || typeof ability.displayIcon !== 'string') continue;
    const file = `habilidad-${key}.png`;
    await grab(ability.displayIcon, file);
    abilities.push({ key, file, name: ability.displayName ?? '' });
  }

  const weapons = await fetch(`${API}/weapons`).then((r) => r.json());
  for (const name of WEAPONS) {
    const weapon = weapons.data.find((w) => w.displayName === name);
    const icon = weapon?.killfeedIcon ?? weapon?.displayIcon;
    if (typeof icon === 'string') await grab(icon, `arma-${name.toLowerCase()}.png`);
  }

  const gear = await fetch(`${API}/gear`).then((r) => r.json());
  for (const item of gear.data) {
    const lower = String(item.displayName ?? '').toLowerCase();
    const kind = lower.includes('heavy')
      ? 'pesado'
      : lower.includes('light')
        ? 'ligero'
        : lower.includes('regen')
          ? 'regenerativo'
          : null;
    if (kind !== null && typeof item.displayIcon === 'string') {
      await grab(item.displayIcon, `escudo-${kind}.png`);
    }
  }

  const readme = [
    `# ${agent.displayName} — assets de ejemplo`,
    '',
    `Rol: ${agent.role?.displayName ?? '—'}`,
    `Nombre interno en la telemetría del juego: \`${agent.developerName}\``,
    '',
    '## Retratos',
    '',
    '| Fichero | Qué es |',
    '|---|---|',
    '| `agente-icono.png` | Icono cuadrado. Es el que usa la tarjeta de combate |',
    '| `agente-cuerpo.png` | Retrato de cuerpo entero. Para selección de agentes o MVP |',
    '| `agente-killfeed.png` | Silueta plana del killfeed |',
    '',
    '## Habilidades',
    '',
    'Nombradas por la TECLA, que es como las llama el jugador.',
    '',
    '| Fichero | Tecla | Nombre |',
    '|---|---|---|',
    ...abilities
      .sort((a, b) => 'cqex'.indexOf(a.key) - 'cqex'.indexOf(b.key))
      .map((a) => `| \`${a.file}\` | ${a.key.toUpperCase()} | ${a.name} |`),
    '',
    '**La ultimate (X) no funciona como las otras tres.** Las de C, Q y E son',
    'booleanas —la tiene o no la tiene— y solo se saben si ese jugador corre el',
    'cliente auxiliar. La ultimate llega siempre y para los diez, con puntos',
    'actuales y máximo, así que se puede dibujar un medidor.',
    '',
    '## Armas y escudos',
    '',
    'Los iconos de arma son los del killfeed: planos, anchos y legibles a poca',
    'altura. Los de tienda están iluminados y en perspectiva, y a 12 px son una',
    'mancha.',
    '',
    'El escudo tiene un cuarto estado, "sin escudo", que **no existe en el',
    'juego** —allí es la ausencia de icono— y es arte propio nuestro. Está en',
    '`packages/overlay/icons/armor-none.svg`, junto al glifo de créditos, que',
    'tampoco lo publica el catálogo.',
    '',
    '## Resolución',
    '',
    'Todo viene muy por encima del tamaño de pintado: el icono de agente es',
    '512×512 y se pinta a 54 px, las habilidades son 128×128 a 16 px. Hay margen',
    'de sobra incluso a 4K, así que se puede ampliar sin que se degrade.',
    '',
    '## Legal',
    '',
    '**Este arte es de Riot Games.** No entra en el repositorio: se descarga',
    'en cada máquina con `packages/overlay/tools/fetch-assets.mjs`. Esta carpeta',
    'la genera `tools/sample-agent.mjs` y está en `.gitignore`.',
    '',
    `Descargado de ${API} el ${new Date().toISOString().slice(0, 10)}.`,
    '',
  ].join('\n');

  await writeFile(join(OUT, 'LEEME.md'), readme, 'utf8');

  process.stdout.write(`\n${saved.length} ficheros en:\n${OUT}\n`);
}

await main();
