/* Cuánto cuesta esto: en milisegundos por fotograma y en líneas de código.
   El primero decide si aguanta una emisión a 60 fps; el segundo, cuánto
   trabajo son las otras seis pantallas. */
import { launch } from "puppeteer-core";
import { sirve } from "./servidor.mjs";
import { readFileSync, statSync, readdirSync } from "node:fs";
import { dirname, join, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");

function lineas(f) {
  return readFileSync(f, "utf8").split("\n").filter((l) => l.trim() !== "").length;
}
function cuenta(dir, exts) {
  let n = 0;
  for (const f of readdirSync(dir)) {
    if (exts.includes(extname(f))) n += lineas(join(dir, f));
  }
  return n;
}

const base = resolve(AQUI, "..");
console.log("── código ──");
console.log("  assembly/ (composición en wasm) ", cuenta(join(base, "assembly"), [".ts"]), "líneas");
console.log("  web/      (intérprete y puente) ", cuenta(join(base, "web"), [".js"]), "líneas");
console.log("  banco/    (pruebas)             ", cuenta(join(base, "banco"), [".js", ".mjs", ".html"]), "líneas");
console.log("  escena.wasm                     ", statSync(join(base, "web/escena.wasm")).size, "bytes");

const { servidor, puerto } = await sirve(RAIZ);
const nav = await launch({ executablePath: process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--force-device-scale-factor=1"] });
const pag = await nav.newPage();
await pag.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

async function mide(url, fn) {
  await pag.goto(url);
  await pag.waitForFunction("window.bancoListo === true");
  return pag.evaluate(fn);
}

console.log("");
console.log("── tiempo por fotograma (1920×1080, escena completa) ──");

const lienzo = await mide(`http://127.0.0.1:${puerto}/combate-wasm/banco/lienzo.html?escena=completa`, () => {
  const h = window.hud;
  const t = [];
  for (let k = 0; k < 300; k++) {
    const a = performance.now();
    h.pinta(5000 + k);
    t.push(performance.now() - a);
  }
  t.sort((x, y) => x - y);
  return { mediana: +t[150].toFixed(3), p99: +t[296].toFixed(3), ordenes: window.hud.wasm.cuantas() };
});
console.log("  lienzo+wasm  mediana", lienzo.mediana, "ms · p99", lienzo.p99, "ms ·", lienzo.ordenes, "ranuras de órdenes");

const dom = await mide(`http://127.0.0.1:${puerto}/combate-wasm/banco/dom.html?escena=completa`, async () => {
  const { pon } = await import("../combate-wasm/banco/datos-falso.js");
  const { ESCENAS, prepara } = await import("../combate-wasm/banco/escenas.js");
  const e = prepara(ESCENAS[0]);
  const t = [];
  for (let k = 0; k < 300; k++) {
    e.jugadores[0][0].vida = 40 + (k % 60);
    const a = performance.now();
    pon(e);
    void document.body.offsetHeight;
    t.push(performance.now() - a);
  }
  t.sort((x, y) => x - y);
  return { mediana: +t[150].toFixed(3), p99: +t[296].toFixed(3) };
});
console.log("  DOM+CSS      mediana", dom.mediana, "ms · p99", dom.p99, "ms  (repintado + recálculo de estilo)");

await nav.close(); servidor.close();
