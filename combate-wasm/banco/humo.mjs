/* Comprobación de humo de la página de producción: que arranca, que no hay
   errores en consola y que el lienzo tiene píxeles pintados. Sin servidor
   detrás no hay datos, así que se le inyecta un estado por el mismo camino. */
import { launch } from "puppeteer-core";
import { sirve } from "./servidor.mjs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const { servidor, puerto } = await sirve(RAIZ);
const nav = await launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new" });
const pag = await nav.newPage();
await pag.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
const fallos = [];
pag.on("console", (m) => { if (m.type() === "error") fallos.push(m.text()); });
pag.on("pageerror", (e) => fallos.push("excepción: " + e.message));
pag.on("requestfailed", (r) => fallos.push("falló " + r.url()));
pag.on("response", (r) => { if (r.status() >= 400) fallos.push(r.status() + " " + r.url()); });
await pag.goto(`http://127.0.0.1:${puerto}/combate-wasm/web/index.html?groupCode=123`, { waitUntil: "load" });
await new Promise((r) => setTimeout(r, 3000));
const info = await pag.evaluate(() => {
  const c = document.getElementById("hud");
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let pintados = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) pintados++;
  return { ancho: c.width, alto: c.height, pintados, escala: c.style.transform };
});
console.log("lienzo", info.ancho + "×" + info.alto, "· píxeles pintados:", info.pintados, "·", info.escala);
console.log("errores de consola:", fallos.length === 0 ? "ninguno" : fallos);
await nav.close(); servidor.close();
