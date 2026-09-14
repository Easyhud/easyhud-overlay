/* EL BANCO DE PRUEBAS — el número que decide si esto está bien hecho.
   ==================================================================

   Abre las dos versiones de la pantalla de combate con el MISMO estado, les
   hace una foto a 1920×1080 y las compara píxel a píxel.

   Por qué un diff y no una comparación a ojo: la pregunta no era "¿se parece?"
   sino "¿es el mismo HUD?". Una deriva de medio píxel en la línea base de un
   nombre, un degradado con el ángulo mal resuelto o un color mezclado en el
   espacio equivocado no se ven mirando, y en emisión se acumulan. Aquí salen
   como un porcentaje y como una imagen donde lo distinto está en rojo.

   Lo que se compara es el estado ASENTADO: las dos versiones reciben la escena,
   se les deja terminar las entradas y las transiciones, y solo entonces se
   miran. Un fotograma en movimiento exigiría que los dos relojes estuvieran
   sincronizados al milisegundo, y no lo están; eso es otro banco.

       node banco/diff.mjs                 todas las escenas y secuencias
       node banco/diff.mjs duelo spike     solo esas

   Compara dos cosas distintas. Las ESCENAS son estados quietos: se le da el
   mismo estado a las dos versiones, se las deja asentar y se mira. Las
   SECUENCIAS son el movimiento: se da un salto de estado y se para el reloj en
   instantes concretos, con las dos versiones puestas en el mismo milisegundo.

   Deja en `banco/salida/` las tres imágenes de cada escena: la de referencia,
   la del lienzo y el mapa de diferencias. */

import { launch } from "puppeteer-core";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sirve } from "./servidor.mjs";
import { ESCENAS, SECUENCIAS } from "./escenas.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");
const SALIDA = join(AQUI, "salida");

const ANCHO = 1920;
const ALTO = 1080;

/*
 * Cuánto puede diferir un canal para no contar como diferencia.
 *
 * Es el umbral de pixelmatch, que trabaja en distancia perceptual y no en
 * diferencia de bytes. A 0.1 deja pasar el ruido del suavizado de bordes —dos
 * motores de rasterizado dan el mismo píxel con un par de unidades de
 * diferencia en los diagonales— y no deja pasar nada que se vea.
 */
const UMBRAL = 0.1;

const CHROME = process.env.CHROME
  ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

async function compara(pagina, base, q, etiqueta, detalle, filas) {
  const referencia = await foto(pagina, base + "/combate-wasm/banco/dom.html" + q);
  const lienzo = await foto(pagina, base + "/combate-wasm/banco/lienzo.html" + q);

  const mapa = new PNG({ width: ANCHO, height: ALTO });
  const distintos = pixelmatch(
    referencia.data, lienzo.data, mapa.data, ANCHO, ALTO,
    { threshold: UMBRAL, includeAA: false, alpha: 0.25, diffColor: [255, 0, 60] },
  );

  const pct = (distintos / (ANCHO * ALTO)) * 100;
  filas.push({ nombre: etiqueta, distintos, pct, detalle });

  await writeFile(join(SALIDA, etiqueta + "-dom.png"), PNG.sync.write(referencia));
  await writeFile(join(SALIDA, etiqueta + "-lienzo.png"), PNG.sync.write(lienzo));
  await writeFile(join(SALIDA, etiqueta + "-diff.png"), PNG.sync.write(mapa));

  console.log(
    etiqueta.padEnd(22),
    String(distintos).padStart(8) + " px",
    (pct.toFixed(4) + " %").padStart(11),
  );
  return pct;
}

async function foto(pagina, url) {
  await pagina.goto(url, { waitUntil: "load" });
  await pagina.waitForFunction("window.bancoListo === true", { timeout: 30000 });
  const bytes = await pagina.screenshot({
    omitBackground: true,
    clip: { x: 0, y: 0, width: ANCHO, height: ALTO },
  });
  return PNG.sync.read(Buffer.from(bytes));
}

async function main() {
  const pedidas = process.argv.slice(2);
  const escenas = pedidas.length === 0
    ? ESCENAS
    : ESCENAS.filter((e) => pedidas.includes(e.nombre));
  const secuencias = pedidas.length === 0
    ? SECUENCIAS
    : SECUENCIAS.filter((e) => pedidas.includes(e.nombre));

  if (escenas.length === 0 && secuencias.length === 0) {
    console.error("ninguna escena con ese nombre");
    process.exit(2);
  }

  await mkdir(SALIDA, { recursive: true });
  const { servidor, puerto } = await sirve(RAIZ);
  const base = "http://127.0.0.1:" + puerto;

  const navegador = await launch({
    executablePath: CHROME,
    headless: "new",
    args: [
      "--window-size=" + ANCHO + "," + ALTO,
      "--force-device-scale-factor=1",
      "--hide-scrollbars",
      /* El suavizado de tipografía de Windows cambia con el tamaño de la
         ventana y con el perfil; se fija para que dos ejecuciones den lo mismo. */
      "--font-render-hinting=none",
      "--disable-lcd-text",
    ],
  });

  const pagina = await navegador.newPage();
  await pagina.setViewport({ width: ANCHO, height: ALTO, deviceScaleFactor: 1 });

  const filas = [];
  let peor = 0;

  for (const escena of escenas) {
    const pct = await compara(pagina, base, "?escena=" + escena.nombre,
      escena.nombre, escena.detalle, filas);
    if (pct > peor) peor = pct;
  }

  console.log("");
  for (const sec of secuencias) {
    for (const t of sec.instantes) {
      const pct = await compara(pagina, base, "?secuencia=" + sec.nombre + "&t=" + t,
        sec.nombre + "-" + t + "ms", sec.detalle, filas);
      if (pct > peor) peor = pct;
    }
  }

  await navegador.close();
  servidor.close();

  console.log("");
  console.log("peor escena: " + peor.toFixed(4) + " %");
  console.log("imágenes en banco/salida/");

  await writeFile(join(SALIDA, "informe.json"), JSON.stringify({
    umbral: UMBRAL,
    fecha: new Date().toISOString(),
    filas,
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
