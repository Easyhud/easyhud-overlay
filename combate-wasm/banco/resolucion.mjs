/* ¿Aguanta el lienzo por encima de 1080p?
   Se pintan las dos versiones en una ventana de 2560×1440 y se compara un
   recorte de la misma tarjeta: el DOM se rasteriza a la resolución de salida,
   y hay que ver si el lienzo hace lo mismo o estira un mapa de bits de 1080p. */
import { launch } from "puppeteer-core";
import { PNG } from "pngjs";
import { writeFile } from "node:fs/promises";
import { sirve } from "./servidor.mjs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");
const [W, H] = [2560, 1440];

const { servidor, puerto } = await sirve(RAIZ);
const nav = await launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--force-device-scale-factor=1", "--hide-scrollbars"] });
const pag = await nav.newPage();
await pag.setViewport({ width: W, height: H, deviceScaleFactor: 1 });

async function foto(url, nombre) {
  await pag.goto(url);
  await pag.waitForFunction("window.bancoListo === true");
  /* La tarjeta de arriba a la izquierda, a escala 4/3 respecto de 1080p. */
  const bytes = await pag.screenshot({ clip: { x: 20, y: 740, width: 460, height: 120 }, omitBackground: true });
  await writeFile(join(AQUI, "salida", nombre), bytes);
}

const base = `http://127.0.0.1:${puerto}/combate-wasm/banco/`;
await foto(base + "dom.html?escena=completa", "res-dom.png");
await foto(base + "lienzo.html?escena=completa&ajustar=1", "res-lienzo.png");
await nav.close(); servidor.close();
console.log("listo");
