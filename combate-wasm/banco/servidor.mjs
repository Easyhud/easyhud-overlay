/* Un servidor estático de treinta líneas.
   ======================================

   El overlay se sirve tal cual, sin compilar, así que para el banco basta con
   algo que devuelva ficheros con el tipo correcto. Sin dependencias: una menos
   que pueda cambiar de versión y mover un píxel. */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, normalize } from "node:path";

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".wasm": "application/wasm",
  ".json": "application/json",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".glb": "model/gltf-binary",
};

export function sirve(raiz, puerto = 0) {
  const servidor = createServer(async (pet, res) => {
    try {
      const ruta = decodeURIComponent(new URL(pet.url, "http://x").pathname);
      /* Nada por encima de la raíz. */
      const dentro = normalize(join(raiz, ruta));
      if (!dentro.startsWith(normalize(raiz))) { res.writeHead(403).end(); return; }

      const datos = await readFile(dentro);
      res.writeHead(200, {
        "content-type": TIPOS[extname(dentro).toLowerCase()] ?? "application/octet-stream",
        "cache-control": "no-store",
      });
      res.end(datos);
    } catch {
      res.writeHead(404).end("no está");
    }
  });

  return new Promise((listo) => {
    servidor.listen(puerto, "127.0.0.1", () => {
      listo({ servidor, puerto: servidor.address().port });
    });
  });
}
