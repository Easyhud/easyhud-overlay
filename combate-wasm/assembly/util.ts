/* Curvas, color y transiciones.
   =============================

   Todo lo que en la versión DOM lo hacía el navegador —resolver una
   cubic-bezier, mezclar dos colores con `color-mix`, interpolar una propiedad
   durante una `transition`— aquí hay que hacerlo a mano. Este fichero es esa
   maquinaria y nada más: no sabe qué es una tarjeta.

   Los números NO son aproximaciones amables: son los mismos que están escritos
   en el CSS. Si el CSS dice 420ms y cubic-bezier(.22,.61,.24,1), aquí dice eso.
   Cualquier redondeo se vería en el diff de píxeles, que es justo para lo que
   está el banco de pruebas. */

/* ── Curvas ──────────────────────────────────────────────────────────────── */

/**
 * Resuelve una cubic-bezier de CSS: dado el avance en X (el tiempo), devuelve
 * el avance en Y (el valor).
 *
 * La curva de CSS pasa por (0,0) y (1,1) y los dos puntos de control son los
 * cuatro números que se escriben. X no se despeja: se busca con Newton-Raphson
 * y, si la derivada se queda plana, se cae a bisección. Es el mismo método que
 * usa el motor del navegador, y por eso sale el mismo valor.
 */
function bezierX(t: f64, x1: f64, x2: f64): f64 {
  const u = 1.0 - t;
  return 3.0 * u * u * t * x1 + 3.0 * u * t * t * x2 + t * t * t;
}

function bezierY(t: f64, y1: f64, y2: f64): f64 {
  const u = 1.0 - t;
  return 3.0 * u * u * t * y1 + 3.0 * u * t * t * y2 + t * t * t;
}

function bezierDX(t: f64, x1: f64, x2: f64): f64 {
  const u = 1.0 - t;
  return 3.0 * u * u * x1 + 6.0 * u * t * (x2 - x1) + 3.0 * t * t * (1.0 - x2);
}

function resuelve(x: f64, x1: f64, x2: f64): f64 {
  if (x <= 0.0) return 0.0;
  if (x >= 1.0) return 1.0;

  let t = x;
  for (let i = 0; i < 8; i++) {
    const err = bezierX(t, x1, x2) - x;
    if (abs(err) < 1e-7) return t;
    const d = bezierDX(t, x1, x2);
    if (abs(d) < 1e-7) break;
    t -= err / d;
  }

  let lo = 0.0;
  let hi = 1.0;
  t = x;
  for (let i = 0; i < 24; i++) {
    const v = bezierX(t, x1, x2);
    if (abs(v - x) < 1e-7) return t;
    if (v > x) hi = t; else lo = t;
    t = (lo + hi) * 0.5;
  }
  return t;
}

/* Las curvas que usa el diseño, por nombre. Los índices son los que viajan
   dentro de cada transición. */
export const LINEAL: i32 = 0;
/** `ease` de CSS — el valor por defecto de toda `transition` sin curva. */
export const EASE: i32 = 1;
/** `ease-out` de CSS. */
export const EASE_OUT: i32 = 2;
/** `--ease` del sistema: cubic-bezier(.22,.61,.24,1). */
export const SISTEMA: i32 = 3;
/** La curva con rebote de la baja: cubic-bezier(.2,1.4,.4,1). */
export const REBOTE: i32 = 4;
/** `--ease-pop`: cubic-bezier(.2,1.5,.4,1). */
export const POP: i32 = 5;

export function curva(id: i32, x: f64): f64 {
  if (x <= 0.0) return 0.0;
  if (x >= 1.0) return 1.0;
  switch (id) {
    case EASE: return bezierY(resuelve(x, 0.25, 0.25), 0.1, 1.0);
    case EASE_OUT: return bezierY(resuelve(x, 0.0, 0.58), 0.0, 1.0);
    case SISTEMA: return bezierY(resuelve(x, 0.22, 0.24), 0.61, 1.0);
    case REBOTE: return bezierY(resuelve(x, 0.2, 0.4), 1.4, 1.0);
    case POP: return bezierY(resuelve(x, 0.2, 0.4), 1.5, 1.0);
    default: return x;
  }
}

export function mezcla(a: f64, b: f64, t: f64): f64 {
  return a + (b - a) * t;
}

/* ── Color ───────────────────────────────────────────────────────────────── */

/*
 * Un color es un i32 empaquetado 0xAARRGGBB.
 *
 * Se empaqueta porque así cabe en una ranura del buffer de órdenes igual que
 * un número, y el intérprete de JS no tiene que saber nada: recibe un entero,
 * lo convierte a `rgba(...)` y lo cachea.
 */
export type Color = i32;

// @ts-ignore: decorador de AssemblyScript
@inline
export function rgba(r: i32, g: i32, b: i32, a: i32): Color {
  return (a << 24) | (r << 16) | (g << 8) | b;
}

// @ts-ignore
@inline export function canalA(c: Color): i32 { return (c >>> 24) & 0xff; }
// @ts-ignore
@inline export function canalR(c: Color): i32 { return (c >>> 16) & 0xff; }
// @ts-ignore
@inline export function canalG(c: Color): i32 { return (c >>> 8) & 0xff; }
// @ts-ignore
@inline export function canalB(c: Color): i32 { return c & 0xff; }

/** Alfa en 0..1 sobre un color opaco. */
export function conAlfa(c: Color, a: f64): Color {
  let v = <i32>Math.round(a * 255.0);
  if (v < 0) v = 0;
  if (v > 255) v = 255;
  return (v << 24) | (c & 0x00ffffff);
}

/** Multiplica el alfa que ya trae. */
export function porAlfa(c: Color, k: f64): Color {
  return conAlfa(c, (<f64>canalA(c) / 255.0) * k);
}

/**
 * Interpola dos colores canal a canal, alfa incluido.
 *
 * Es lo que hace una `transition: background` del navegador: no interpola el
 * texto del color, interpola los cuatro canales en sRGB.
 */
export function entre(a: Color, b: Color, t: f64): Color {
  const k = t < 0.0 ? 0.0 : (t > 1.0 ? 1.0 : t);
  return rgba(
    <i32>Math.round(mezcla(<f64>canalR(a), <f64>canalR(b), k)),
    <i32>Math.round(mezcla(<f64>canalG(a), <f64>canalG(b), k)),
    <i32>Math.round(mezcla(<f64>canalB(a), <f64>canalB(b), k)),
    <i32>Math.round(mezcla(<f64>canalA(a), <f64>canalA(b), k)),
  );
}

/**
 * `color-mix(in srgb, A p%, B)` de CSS, que el pie y el marcador usan.
 *
 * Con los dos colores opacos —que es el único caso del diseño— es la media
 * ponderada directa en sRGB, sin premultiplicar.
 */
export function mezclaSrgb(a: Color, b: Color, p: f64): Color {
  return entre(b, a, p);
}

/**
 * Gris de luminancia, para `filter: grayscale(k)`.
 *
 * Los coeficientes son los de la matriz que define el filtro de CSS
 * (Filter Effects, la misma de luminanceToAlpha): .2126 / .7152 / .0722.
 */
export function gris(c: Color, k: f64): Color {
  const r = <f64>canalR(c);
  const g = <f64>canalG(c);
  const b = <f64>canalB(c);
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return rgba(
    <i32>Math.round(mezcla(r, y, k)),
    <i32>Math.round(mezcla(g, y, k)),
    <i32>Math.round(mezcla(b, y, k)),
    canalA(c),
  );
}

/* ── Transiciones ────────────────────────────────────────────────────────── */

/**
 * Una `transition` de CSS sobre un número.
 *
 * La regla que importa —y que es fácil equivocar— es qué pasa cuando el
 * destino cambia a mitad de camino: CSS **no** reinicia desde el valor viejo,
 * arranca desde donde esté AHORA. Si no se hace así, la barra de vida de un
 * jugador al que le pegan dos veces seguidas pega un salto hacia atrás.
 */
export class TransNum {
  desde: f64 = 0;
  hasta: f64 = 0;
  t0: f64 = -1;
  dur: f64 = 0;
  ease: i32 = LINEAL;
  listo: bool = false;

  /** Fija el valor sin animar. Para el primer fotograma. */
  fija(v: f64): void {
    this.desde = v;
    this.hasta = v;
    this.t0 = -1;
    this.listo = true;
  }

  /** Declara el destino. Si cambió, arranca la transición desde el valor actual. */
  a(v: f64, ahora: f64, dur: f64, ease: i32): void {
    if (!this.listo) { this.fija(v); return; }
    if (v == this.hasta) return;
    this.desde = this.valor(ahora);
    this.hasta = v;
    this.t0 = ahora;
    this.dur = dur;
    this.ease = ease;
  }

  valor(ahora: f64): f64 {
    if (this.t0 < 0 || this.dur <= 0) return this.hasta;
    const x = (ahora - this.t0) / this.dur;
    if (x >= 1.0) return this.hasta;
    return mezcla(this.desde, this.hasta, curva(this.ease, x));
  }
}

/** La misma transición, pero sobre un color: interpola los cuatro canales. */
export class TransColor {
  desde: Color = 0;
  hasta: Color = 0;
  t0: f64 = -1;
  dur: f64 = 0;
  ease: i32 = LINEAL;
  listo: bool = false;

  fija(c: Color): void {
    this.desde = c;
    this.hasta = c;
    this.t0 = -1;
    this.listo = true;
  }

  a(c: Color, ahora: f64, dur: f64, ease: i32): void {
    if (!this.listo) { this.fija(c); return; }
    if (c == this.hasta) return;
    this.desde = this.valor(ahora);
    this.hasta = c;
    this.t0 = ahora;
    this.dur = dur;
    this.ease = ease;
  }

  valor(ahora: f64): Color {
    if (this.t0 < 0 || this.dur <= 0) return this.hasta;
    const x = (ahora - this.t0) / this.dur;
    if (x >= 1.0) return this.hasta;
    return entre(this.desde, this.hasta, curva(this.ease, x));
  }
}

/**
 * Una animación de fotogramas que se dispara una vez: el equivalente a poner
 * una clase y quitarla sola.
 *
 * `avance` devuelve -1 cuando no está corriendo, y 0..1 mientras corre. Quien
 * la use decide qué hacer con ese número; aquí no se sabe si es un destello o
 * un rebote.
 */
export class Pulso {
  t0: f64 = -1;
  dur: f64 = 0;

  lanza(ahora: f64, dur: f64): void {
    this.t0 = ahora;
    this.dur = dur;
  }

  avance(ahora: f64): f64 {
    if (this.t0 < 0) return -1.0;
    const x = (ahora - this.t0) / this.dur;
    if (x >= 1.0) { this.t0 = -1; return -1.0; }
    return x < 0.0 ? 0.0 : x;
  }

  get corriendo(): bool { return this.t0 >= 0; }
}

/**
 * Interpola una lista de fotogramas con parada en porcentajes concretos.
 *
 * Los `@keyframes` del diseño no son de dos puntos: el destello de daño sube
 * al 62% en el 18% del tiempo y cae hasta el final, y el golpe de la baja pasa
 * por 1.04 y por 0.995 antes de volver. Con dos puntos no sale esa forma.
 */
export function fotogramas(x: f64, paradas: StaticArray<f64>, valores: StaticArray<f64>, ease: i32): f64 {
  const n = paradas.length;
  if (x <= unchecked(paradas[0])) return unchecked(valores[0]);
  if (x >= unchecked(paradas[n - 1])) return unchecked(valores[n - 1]);
  for (let i = 1; i < n; i++) {
    const p1 = unchecked(paradas[i]);
    if (x <= p1) {
      const p0 = unchecked(paradas[i - 1]);
      const tramo = p1 - p0;
      const k = tramo <= 0 ? 1.0 : (x - p0) / tramo;
      return mezcla(unchecked(valores[i - 1]), unchecked(valores[i]), curva(ease, k));
    }
  }
  return unchecked(valores[n - 1]);
}
