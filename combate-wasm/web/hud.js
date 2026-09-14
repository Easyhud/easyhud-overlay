/* EL MONTAJE — las cuatro piezas enchufadas.
   =========================================

       estado  ──puente──▶  memoria del wasm
                                  │
                              dibuja(ahora)
                                  │
                          buffer de órdenes
                                  │
                             intérprete
                                  │
                                lienzo

   El bucle es de sesenta fotogramas por segundo y el estado llega a diez: son
   dos ritmos distintos a propósito. Las animaciones —la barra que se desliza,
   el fogonazo de la definitiva, la cuenta atrás de la spike— no las lleva el
   estado, las lleva el reloj, así que se compone en cada fotograma aunque no
   haya llegado nada nuevo. La versión DOM hace lo mismo; allí el que redibuja
   sin que nadie se lo pida es el navegador. */

import { Recursos, precargaFuentes } from "./recursos.js";
import { Puente } from "./puente.js";
import { ejecuta } from "./interprete.js";

const ANCHO = 1920;
const ALTO = 1080;

export async function monta({ lienzo, suscribe, urlWasm, escalar = true }) {
  const R = new Recursos();

  /*
   * Las cuatro funciones que el módulo necesita de fuera, y las cuatro son la
   * misma cosa: medir letras. Un wasm no tiene tipografías.
   */
  const importaciones = {
    js: {
      medir: (texto, fuente) => R.medir(texto, fuente),
      recorta: (texto, fuente, ancho) => R.recorta(texto, fuente, ancho),
      metrica: (fuente, que) => R.metrica(fuente, que),
      formatea: (formato, valor) => R.formatea(formato, valor),
    },
    env: {
      abort: (msg, file, linea, col) => {
        throw new Error("el módulo abortó en " + linea + ":" + col);
      },
    },
  };

  const url = urlWasm ?? new URL("./escena.wasm", import.meta.url);
  const { instance } = await WebAssembly.instantiateStreaming(fetch(url), importaciones)
    .catch(async () => {
      /* `instantiateStreaming` exige el tipo MIME correcto; servido desde el
         disco no siempre llega. */
      const bytes = await fetch(url).then((r) => r.arrayBuffer());
      return WebAssembly.instantiate(bytes, importaciones);
    });

  const wasm = instance.exports;
  wasm.inicia();

  const puente = new Puente(wasm.memory, wasm.entrada(), R);

  /* Las tipografías tienen que estar cargadas ANTES de la primera medida: un
     ancho medido con la fuente de reserva se cachea y ya no se corrige. */
  await precargaFuentes();

  const ctx = lienzo.getContext("2d", { alpha: true });
  /*
   * El arte del juego llega del CDN a resolución muy alta —un arma son mil
   * píxeles de ancho y en la tarjeta ocupa setenta y seis—, y el reescalado
   * por defecto del lienzo es bilineal de un solo paso: la silueta sale
   * comida por dentro. Un `<img>` no tiene ese problema porque el navegador
   * reescala con más calidad, y esto le pide lo mismo.
   */
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  /*
   * A cuántos píxeles de VERDAD se rasteriza cada píxel del diseño.
   *
   * Esto no es un detalle. La composición se hace siempre en el lienzo fijo de
   * 1920×1080 del diseño, pero el búfer del canvas no puede medir eso y ya:
   * si la fuente de OBS se escala a 1440p o a 4K, un mapa de bits de 1080p
   * estirado sale blando, y el HUD del que venimos NO sale blando porque el
   * navegador vuelve a dibujar las letras y los vectores a la resolución de
   * salida. Así que aquí se hace lo mismo: el búfer se dimensiona a la
   * resolución real y se pinta todo con un factor de escala.
   */
  let salida = 1;

  const dimensiona = () => {
    const k = escalar
      ? Math.max(0.05, Math.min(innerWidth / ANCHO, innerHeight / ALTO))
      : 1;
    const densidad = escalar ? (devicePixelRatio || 1) : 1;
    const nueva = k * densidad;
    const w = Math.round(ANCHO * nueva);
    const h = Math.round(ALTO * nueva);
    if (lienzo.width === w && lienzo.height === h) return;

    lienzo.width = w;
    lienzo.height = h;
    salida = nueva;
    if (escalar) {
      /* El tamaño en pantalla lo pone el CSS; el del búfer, la densidad. */
      lienzo.style.width = ANCHO * k + "px";
      lienzo.style.height = ALTO * k + "px";
      lienzo.style.left = "50%";
      lienzo.style.top = "50%";
      lienzo.style.transform = "translate(-50%,-50%)";
    }
    /* Un lienzo redimensionado pierde todo su estado. */
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  };

  dimensiona();
  if (escalar) {
    addEventListener("resize", dimensiona);
    addEventListener("load", dimensiona);
    /* Red de seguridad: al montar, el hueco puede no tener tamaño todavía. */
    setInterval(dimensiona, 250);
  }

  /* Lo último que llegó del servidor. Se vuelca en cada publicación; el bucle
     no lo toca. */
  let hayEstado = false;
  const escribe = (estado, ahora) => {
    puente.escribe(estado, ahora ?? performance.now());
    hayEstado = true;
  };
  if (suscribe) suscribe((estado) => escribe(estado));

  let base = wasm.ordenes();
  let vistaF = null;
  let vistaI = null;

  const pinta = (ahora) => {
    if (!hayEstado) return;

    const cuantas = wasm.dibuja(ahora);
    if (wasm.desbordo()) console.error("el fotograma no cupo en el buffer de órdenes");

    /* Las vistas se rehacen solo si la memoria creció. */
    if (vistaF === null || vistaF.buffer !== wasm.memory.buffer) {
      base = wasm.ordenes();
      vistaF = new Float32Array(wasm.memory.buffer, base);
      vistaI = new Int32Array(wasm.memory.buffer, base);
    }

    /* Se dibuja siempre en coordenadas del diseño; la escala la pone aquí la
       matriz, una vez, y ni la composición ni el intérprete se enteran. */
    ctx.setTransform(salida, 0, 0, salida, 0, 0);
    ctx.clearRect(0, 0, ANCHO, ALTO);
    ejecuta(ctx, vistaF, vistaI, cuantas, R, salida);
  };

  const bucle = (ahora) => {
    pinta(ahora);
    requestAnimationFrame(bucle);
  };

  return {
    recursos: R,
    wasm,
    /* Las dos mitades del bucle, sueltas y con el reloj a mano: es lo que el
       banco de pruebas necesita para pintar un instante concreto en vez de
       "ahora". En producción no las llama nadie. */
    escribe,
    pinta,
    arranca() { requestAnimationFrame(bucle); },
  };
}
