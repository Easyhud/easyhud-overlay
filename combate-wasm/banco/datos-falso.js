/* El adaptador de mentira, solo para el banco de pruebas.
   ======================================================

   Tiene la forma exacta de `combate/js/datos.js` —un `suscribe` y un estado—
   pero en vez de hablar con ValoSpectra espera a que alguien le dé una escena.
   La página del banco lo pone en su sitio con un mapa de importación, así que
   `combate/js/combate.js` se carga SIN TOCAR NI UNA LÍNEA y no se entera de
   que detrás no hay servidor.

   Es importante que sea así: si el banco usara una copia modificada del
   pintor, estaría comparando el lienzo contra algo que no es lo que corre en
   producción, y el número que saliera no querría decir nada. */

export const estado = {};

const oyentes = new Set();
let actual = null;

export function suscribe(fn) {
  oyentes.add(fn);
  if (actual !== null) fn(actual);
  return () => oyentes.delete(fn);
}

export function publica() {
  if (actual !== null) oyentes.forEach((fn) => fn(actual));
}

export function aplica(parcial) {
  actual = Object.assign(actual ?? {}, parcial);
  publica();
}

/** Lo que llama la página del banco. */
export function pon(nuevo) {
  actual = nuevo;
  publica();
}
