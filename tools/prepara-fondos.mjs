#!/usr/bin/env node
/**
 * Prepara los vídeos de fondo de UN mapa para la pantalla de selección de agentes.
 *
 * Uso:
 *   node tools/prepara-fondos.mjs <mapa> "<carpeta con los vídeos originales>" [--rapido] [--rehacer]
 *
 * Ejemplo:
 *   node tools/prepara-fondos.mjs haven "D:\Trabajo\Easy  V3\videos-mapas\haven"
 *
 * Qué hace con cada vídeo (.mp4 / .mov / .mkv de la carpeta, por orden alfabético):
 *   · lo pasa a 1080p y 60 fps, sin audio, ralentizado a la MITAD con interpolación de movimiento (así no se ve
 *     trabado y va más tranquilo de fondo), con compresión ligera (≈5 MB por clip);
 *   · lo guarda como `seleccion/assets/fondos/<mapa>/01.mp4`, `02.mp4`…;
 *   · anota cuántos hay en `seleccion/assets/fondos/fondos.json`, que es lo que lee la pantalla (no se edita a mano).
 *
 * Opciones:
 *   --rapido   sin interpolación (mucho más rápido de preparar, algo menos suave).
 *   --rehacer  vuelve a hacer los que ya existen (por defecto se saltan, así se puede reanudar).
 *
 * Necesita ffmpeg en el PATH. Los clips son de sus autores: respeta su licencia (crédito, uso comercial) y apúntalo en
 * `seleccion/assets/fondos/CREDITOS.md`.
 */

import { spawn, spawnSync } from 'node:child_process';
import { cpus } from 'node:os';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FONDOS = join(RAIZ, 'seleccion', 'assets', 'fondos');
const EXT = new Set(['.mp4', '.mov', '.mkv', '.webm', '.m4v']);

const args = process.argv.slice(2);
const opciones = new Set(args.filter((a) => a.startsWith('--')));
const [mapaCrudo, origen] = args.filter((a) => !a.startsWith('--'));

function falla(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

if (!mapaCrudo || !origen) falla('Uso: node tools/prepara-fondos.mjs <mapa> "<carpeta con los vídeos>" [--rapido] [--rehacer]');
const mapa = mapaCrudo.toLowerCase().replace(/[^a-z]/g, '');
if (mapa === '') falla(`«${mapaCrudo}» no es un nombre de mapa válido (letras sin espacios: ascent, haven, split…).`);
if (!existsSync(origen) || !statSync(origen).isDirectory()) falla(`No existe la carpeta de vídeos: ${origen}`);
if (spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status !== 0) {
  falla('No encuentro ffmpeg. Instálalo (winget install Gyan.FFmpeg), cierra y abre la terminal, y vuelve a probar.');
}

const videos = readdirSync(origen)
  .filter((f) => EXT.has(extname(f).toLowerCase()))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
if (videos.length === 0) falla(`No hay vídeos (${[...EXT].join(', ')}) en ${origen}`);

const destino = join(FONDOS, mapa);
mkdirSync(destino, { recursive: true });

const rapido = opciones.has('--rapido');
const filtro = rapido
  ? 'scale=1920:1080:flags=lanczos,setpts=2.0*PTS,fps=60'
  : 'scale=1920:1080:flags=lanczos,setpts=2.0*PTS,minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1';

function codifica(entrada, salida) {
  return new Promise((ok, ko) => {
    const tmp = `${salida}.parcial.mp4`;
    const p = spawn(
      'ffmpeg',
      ['-v', 'error', '-y', '-i', entrada, '-an', '-vf', filtro, '-c:v', 'libx264', '-preset', 'medium', '-crf', '25', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', tmp],
      { stdio: ['ignore', 'inherit', 'inherit'] },
    );
    p.on('error', ko);
    p.on('close', (c) => {
      if (c === 0) {
        renameSync(tmp, salida);
        ok();
      } else {
        rmSync(tmp, { force: true });
        ko(new Error(`ffmpeg salió con código ${c} en ${entrada}`));
      }
    });
  });
}

console.log(`Mapa «${mapa}»: ${videos.length} vídeo(s) → ${destino}${rapido ? '  (modo rápido, sin interpolación)' : ''}`);
const paralelo = Math.max(1, Math.min(3, Math.floor(cpus().length / 4)));
let siguiente = 0;
let hechos = 0;
const fallos = [];

async function trabajador() {
  while (siguiente < videos.length) {
    const i = siguiente++;
    const nombre = `${String(i + 1).padStart(2, '0')}.mp4`;
    const salida = join(destino, nombre);
    if (existsSync(salida) && !opciones.has('--rehacer')) {
      hechos++;
      continue;
    }
    try {
      await codifica(join(origen, videos[i]), salida);
      hechos++;
      console.log(`  ✓ ${nombre}  (${hechos}/${videos.length})  ← ${videos[i]}`);
    } catch (e) {
      fallos.push(`${videos[i]}: ${e.message}`);
      console.error(`  ✗ ${videos[i]}: ${e.message}`);
    }
  }
}

await Promise.all(Array.from({ length: paralelo }, trabajador));
if (fallos.length > 0) falla(`${fallos.length} vídeo(s) fallaron; vuelve a ejecutar el mismo comando para reanudar.`);

// El listado que lee la pantalla: cuántos clips hay de cada mapa.
const ruta = join(FONDOS, 'fondos.json');
let listado = {};
try {
  listado = JSON.parse(readFileSync(ruta, 'utf8'));
} catch {
  /* no había (o estaba roto): se rehace */
}
listado[mapa] = videos.length;
writeFileSync(ruta, JSON.stringify(listado, null, 2) + '\n');
console.log(`\n✓ Listo: ${videos.length} clips de ${mapa}. fondos.json = ${JSON.stringify(listado)}`);
console.log('  Recuerda apuntar el crédito del autor en seleccion/assets/fondos/CREDITOS.md y reiniciar el observador.');
