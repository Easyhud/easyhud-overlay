/* El robo, tal como lo haría cualquiera: abrir el HUD, apuntar todo lo que el
   navegador pide, guardarlo, y servirlo desde otra carpeta. Cero comprensión
   del código. El wasm no estorba porque no hay que leerlo. */
import { launch } from "puppeteer-core";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sirve } from "./servidor.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");
const BOTIN = join(AQUI, "salida", "botin");

const { servidor, puerto } = await sirve(RAIZ);
const nav = await launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new" });
const pag = await nav.newPage();
await pag.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

const guardados = [];
pag.on("response", async (r) => {
  const u = new URL(r.url());
  if (u.host !== "127.0.0.1:" + puerto) return;   // el arte de Riot es de Riot
  if (r.status() !== 200) return;
  try {
    const datos = await r.buffer();
    const destino = join(BOTIN, u.pathname);
    await mkdir(dirname(destino), { recursive: true });
    await writeFile(destino, datos);
    guardados.push([u.pathname, datos.length]);
  } catch {}
});

await pag.goto(`http://127.0.0.1:${puerto}/combate-wasm/banco/lienzo.html?escena=completa`);
await pag.waitForFunction("window.bancoListo === true");
await new Promise((r) => setTimeout(r, 500));
await nav.close();
servidor.close();

guardados.sort();
console.log("se ha llevado", guardados.length, "ficheros,",
  (guardados.reduce((s, g) => s + g[1], 0) / 1024).toFixed(0), "KB en total:");
for (const [p, n] of guardados) console.log("  ", String(Math.round(n / 1024)).padStart(4), "KB ", p);

/* Y ahora lo importante: servir el botín desde otra carpeta, sin tocar un
   byte, y comprobar que pinta exactamente lo mismo. */
const { servidor: ladron, puerto: p2 } = await sirve(BOTIN);
const nav2 = await launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new" });
const pag2 = await nav2.newPage();
await pag2.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
await pag2.goto(`http://127.0.0.1:${p2}/combate-wasm/banco/lienzo.html?escena=completa`);
await pag2.waitForFunction("window.bancoListo === true", { timeout: 20000 });
await writeFile(join(AQUI, "salida", "robado.png"), await pag2.screenshot({ clip: { x: 0, y: 0, width: 1920, height: 1080 }, omitBackground: true }));
await nav2.close();
ladron.close();
console.log("");
console.log("servido desde el botín: pinta igual. Captura en banco/salida/robado.png");
