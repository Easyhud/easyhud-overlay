/**
 * Descarga y autoaloja las tipografías de marca.
 *
 *   node packages/overlay/tools/fetch-fonts.mjs
 *
 * Por qué: el overlay cargaba Oswald y Poppins desde Google Fonts, y eso es
 * una dependencia de red en una pieza que no puede tener ninguna. Una fuente
 * de navegador de OBS se refresca a veces sola; si en ese momento no hay red o
 * el DNS tarda, el HUD sale con la tipografía de reserva a mitad de emisión y
 * se nota muchísimo más que un icono que falta.
 *
 * A diferencia del arte del juego, **estos ficheros SÍ van al repositorio**:
 * Oswald y Poppins están bajo SIL Open Font License 1.1, que permite
 * redistribuirlos. La licencia se guarda al lado, que es justo lo que la OFL
 * exige.
 *
 * Se ejecuta una vez y se comitea el resultado. No hace falta en cada máquina.
 */

import { mkdir, writeFile, access, rename, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'fonts');

/**
 * Familias y pesos que usa el overlay.
 *
 * Solo los pesos que se usan de verdad: cada peso extra es un fichero más que
 * el navegador tiene que leer al arrancar, y en la guía de marca solo hay tres
 * de Oswald y tres de Poppins.
 */
const FAMILIES = [
  { name: 'Oswald', weights: [500, 600, 700] },
  { name: 'Poppins', weights: [400, 500, 600] },
];

/**
 * User-agent de un Chrome moderno.
 *
 * Google Fonts sirve un CSS distinto según el navegador que pregunta: sin esto
 * responde con `truetype` en lugar de `woff2`, que pesa el triple. La cadena
 * es el precio de pedir el formato bueno.
 */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' +
  ' (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Saca los pares (peso, url) del CSS que devuelve Google Fonts.
 *
 * Solo se queda con los bloques `latin`: el overlay pinta nicks y nombres de
 * equipo, y arrastrar cirílico, griego y vietnamita multiplicaría el peso por
 * cinco para caracteres que no se van a usar.
 */
function parseFaces(css) {
  const faces = [];
  const blocks = css.split('@font-face').slice(1);
  let latinOnly = false;

  for (const block of blocks) {
    // Google precede cada bloque de un comentario con el nombre del subconjunto.
    const weight = /font-weight:\s*(\d+)/.exec(block)?.[1];
    const url = /url\((https:[^)]+\.woff2)\)/.exec(block)?.[1];
    const unicode = /unicode-range:\s*([^;]+)/.exec(block)?.[1] ?? '';
    if (weight === undefined || url === undefined) continue;

    // El subconjunto `latin` es el que NO incluye rangos altos de cirílico
    // (U+04..) ni vietnamita (U+1EA0..). Se filtra por ausencia.
    const isLatin = !/U\+04|U\+1EA0|U\+0370|U\+0100/.test(unicode);
    if (!isLatin) continue;
    latinOnly = true;
    faces.push({ weight: Number(weight), url, unicode });
  }

  if (!latinOnly) {
    // Sin rangos reconocibles se cogen todos: mejor pesar más que no tener
    // tipografía.
    for (const block of blocks) {
      const weight = /font-weight:\s*(\d+)/.exec(block)?.[1];
      const url = /url\((https:[^)]+\.woff2)\)/.exec(block)?.[1];
      if (weight !== undefined && url !== undefined) {
        faces.push({ weight: Number(weight), url, unicode: '' });
      }
    }
  }
  return faces;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const written = [];

  for (const family of FAMILIES) {
    const spec = `${family.name}:wght@${family.weights.join(';')}`;
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(spec)}&display=swap`;

    process.stdout.write(`${family.name}...\n`);
    const response = await fetch(cssUrl, { headers: { 'user-agent': UA } });
    if (!response.ok) {
      process.stderr.write(`  no se pudo pedir el CSS (${response.status})\n`);
      continue;
    }

    const faces = parseFaces(await response.text());
    const seen = new Set();

    for (const face of faces) {
      if (!family.weights.includes(face.weight)) continue;
      if (seen.has(face.weight)) continue;
      seen.add(face.weight);

      const slug = family.name.toLowerCase();
      const file = `${slug}-${face.weight}.woff2`;
      const target = join(OUT, file);

      if (await exists(target)) {
        process.stdout.write(`  ${file} ya estaba\n`);
        written.push({ family: family.name, weight: face.weight, file });
        continue;
      }

      const font = await fetch(face.url, { headers: { 'user-agent': UA } });
      if (!font.ok) {
        process.stderr.write(`  fallo ${font.status} en ${file}\n`);
        continue;
      }
      const bytes = Buffer.from(await font.arrayBuffer());
      await writeFile(target, bytes);
      process.stdout.write(`  ${file} (${Math.round(bytes.length / 1024)} KB)\n`);
      written.push({
        family: family.name,
        weight: face.weight,
        file,
        hash: createHash('md5').update(bytes).digest('hex'),
      });
    }
  }

  /*
   * Colapsa las familias variables en un solo fichero.
   *
   * Google sirve el MISMO woff2 variable para todos los pesos de una familia
   * como Oswald, con una URL distinta por peso. Si se dejan tal cual, el
   * navegador ve tres orígenes diferentes y descarga y decodifica tres copias
   * idénticas: 64 KB en lugar de 21. Con un `@font-face` de rango de pesos
   * (`font-weight: 500 700`) el motor interpola desde un único fichero, que es
   * para lo que existen las fuentes variables.
   */
  const collapsed = [];
  for (const family of FAMILIES) {
    const mine = written.filter((face) => face.family === family.name);
    if (mine.length === 0) continue;

    const hashes = new Set(mine.map((face) => face.hash));
    if (hashes.size === 1 && mine.length > 1) {
      const weights = mine.map((face) => face.weight).sort((a, b) => a - b);
      const keep = mine[0];
      const variableFile = `${family.name.toLowerCase()}-var.woff2`;

      await rename(join(OUT, keep.file), join(OUT, variableFile));
      for (const face of mine.slice(1)) {
        await rm(join(OUT, face.file), { force: true });
      }

      process.stdout.write(
        `  ${family.name}: variable, ${mine.length} copias colapsadas en una\n`,
      );
      collapsed.push({
        family: family.name,
        file: variableFile,
        weight: `${weights[0]} ${weights[weights.length - 1]}`,
      });
    } else {
      for (const face of mine) {
        collapsed.push({
          family: family.name,
          file: face.file,
          weight: String(face.weight),
        });
      }
    }
  }
  written.length = 0;
  written.push(...collapsed);

  // Reglas @font-face listas para importar desde la hoja de estilos.
  const css = [
    '/*',
    ' * GENERADO por tools/fetch-fonts.mjs — no editar a mano.',
    ' *',
    ' * Tipografías autoalojadas: el overlay no pide fuentes por red. Ver',
    ' * fonts/NOTICE.md para la licencia.',
    ' */',
    '',
    ...written.map((face) =>
      [
        '@font-face {',
        `  font-family: '${face.family}';`,
        "  font-style: normal;",
        `  font-weight: ${face.weight};`,
        '  font-display: block;',
        `  src: url('./fonts/${face.file}') format('woff2');`,
        '}',
        '',
      ].join('\n'),
    ),
  ].join('\n');

  await writeFile(join(OUT, '..', 'fonts.css'), css, 'utf8');

  const notice = [
    '# Tipografías',
    '',
    'Ficheros autoalojados para que el overlay no dependa de la red.',
    '',
    '| Familia | Pesos | Licencia |',
    '|---|---|---|',
    '| Oswald | 500, 600, 700 | SIL Open Font License 1.1 |',
    '| Poppins | 400, 500, 600 | SIL Open Font License 1.1 |',
    '',
    'Las dos son familias de Google Fonts bajo **SIL OFL 1.1**, que permite',
    'usarlas, incrustarlas y redistribuirlas, incluso en un producto de pago,',
    'siempre que la licencia se distribuya con ellas y no se vendan las fuentes',
    'por separado.',
    '',
    '- Oswald: https://fonts.google.com/specimen/Oswald',
    '- Poppins: https://fonts.google.com/specimen/Poppins',
    '- Texto de la licencia: https://openfontlicense.org/',
    '',
    '**Pendiente antes de distribuir:** incluir el texto completo de la OFL 1.1',
    'como `OFL.txt` en esta carpeta. El enlace no sustituye al fichero.',
    '',
    `Generado el ${new Date().toISOString().slice(0, 10)} por`,
    '`tools/fetch-fonts.mjs`.',
    '',
  ].join('\n');

  await writeFile(join(OUT, 'NOTICE.md'), notice, 'utf8');

  process.stdout.write(
    `\nlisto: ${written.length} ficheros\n` +
      `reglas: packages/overlay/fonts.css\n` +
      `licencia: packages/overlay/fonts/NOTICE.md\n`,
  );
  if (written.length === 0) process.exit(1);
}

await main();
