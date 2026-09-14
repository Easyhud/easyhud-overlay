/* Lo que consigue quien quiere copiarte, sin leer una sola línea tuya.
   Veinte líneas que envuelven el contexto 2D y apuntan cada llamada. Da igual
   lo ofuscado que esté el intérprete y da igual que la composición viva en el
   wasm: esto es lo que acaba llegando al lienzo. */
import { launch } from "puppeteer-core";
import { sirve } from "./servidor.mjs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const { servidor, puerto } = await sirve(RAIZ);
const nav = await launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new" });
const pag = await nav.newPage();
await pag.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

/* El espía se instala ANTES de que cargue nada del HUD. */
await pag.evaluateOnNewDocument(() => {
  window.__espia = [];
  const P = CanvasRenderingContext2D.prototype;
  for (const nombre of Object.getOwnPropertyNames(P)) {
    const d = Object.getOwnPropertyDescriptor(P, nombre);
    if (typeof d.value === "function") {
      const original = d.value;
      P[nombre] = function (...args) {
        window.__espia.push(nombre + "(" + args.map(a => typeof a === "number" ? +a.toFixed(2) : (a && a.constructor ? a.constructor.name : String(a))).join(",") + ")");
        return original.apply(this, args);
      };
    } else if (d.set) {
      Object.defineProperty(P, nombre, {
        get: d.get,
        set(v) { window.__espia.push(nombre + " = " + v); d.set.call(this, v); },
      });
    }
  }
});

await pag.goto(`http://127.0.0.1:${puerto}/combate-wasm/banco/lienzo.html?escena=completa`);
await pag.waitForFunction("window.bancoListo === true");
const r = await pag.evaluate(() => ({ total: window.__espia.length, muestra: window.__espia.slice(-70, -40) }));
console.log("llamadas capturadas en UN fotograma:", r.total);
console.log("");
console.log(r.muestra.join("\n"));
await nav.close(); servidor.close();
