/* Compone las dos capturas sobre un fondo oscuro para poder mirarlas: el banco
   las guarda con fondo transparente, que es lo correcto para comparar y lo
   peor posible para ver. */
import { PNG } from "pngjs";
import fs from "node:fs";
const sobre = (f, fondo) => {
  const p = PNG.sync.read(fs.readFileSync(f));
  for (let i = 0; i < p.data.length; i += 4) {
    const a = p.data[i + 3] / 255;
    for (let c = 0; c < 3; c++) p.data[i + c] = Math.round(p.data[i + c] * a + fondo[c] * (1 - a));
    p.data[i + 3] = 255;
  }
  return p;
};
const a = sobre("banco/salida/completa-dom.png", [24, 26, 31]);
const b = sobre("banco/salida/completa-lienzo.png", [24, 26, 31]);
const o = new PNG({ width: 1920, height: 2168 });
const pega = (p, dy) => { for (let y = 0; y < 1080; y++) for (let x = 0; x < 1920; x++) {
  const s = (y * 1920 + x) * 4, d = ((y + dy) * 1920 + x) * 4;
  for (let c = 0; c < 4; c++) o.data[d + c] = p.data[s + c]; } };
pega(a, 0); pega(b, 1088);
for (let x = 0; x < 1920; x++) for (let y = 1080; y < 1088; y++) {
  const d = (y * 1920 + x) * 4; o.data[d] = 240; o.data[d+1] = 60; o.data[d+2] = 90; o.data[d+3] = 255; }
fs.writeFileSync("banco/salida/comparativa.png", PNG.sync.write(o));
