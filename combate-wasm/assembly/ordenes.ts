/* EL BUFFER DE ÓRDENES — el contrato entre el WASM y el lienzo.
   ============================================================

   Aquí está la pieza que hace que esto sea distinto de "el mismo HUD pero
   pintado a mano": el WASM no llama al `ctx` de nadie. Compone la pantalla
   entera y la deja escrita como una **lista de números** en su propia memoria.
   Del otro lado, un intérprete de JS recorre esa lista y hace llamadas al
   contexto 2D sin saber qué está pintando.

   Ese intérprete es deliberadamente tonto: no tiene una función `pintaTarjeta`
   ni sabe qué es una insignia de definitiva. Tiene un `switch` de diecinueve
   casos con nombres de operación de dibujo. Quien abra DevTools ve un
   `<canvas>`, un `.wasm` y un bucle que hace `fillRect` con números que salen
   de un buffer. La estructura del HUD —dónde va cada cosa, qué se anima y
   cuándo— no está en ningún sitio legible.

   ## Cómo está escrito

   Una sola zona de memoria vista a la vez como `f32` y como `i32`. Cada ranura
   son 4 bytes: los tamaños y las posiciones se leen como `f32`, y los
   identificadores y los colores como `i32`. Quien escribe y quien lee tienen
   que estar de acuerdo ranura a ranura, y ese acuerdo es la tabla de abajo.

   Los colores van empaquetados en un `i32` como 0xAARRGGBB.
   Las imágenes, los textos, las fuentes y las rutas van por IDENTIFICADOR: el
   arte y las cadenas viven en JS, que es donde se pueden cargar y medir. */

/* ── Operaciones ─────────────────────────────────────────────────────────── */

export const FIN: i32 = 0;
/** `ctx.save()` */
export const GUARDAR: i32 = 1;
/** `ctx.restore()` */
export const RESTAURAR: i32 = 2;
/** alfa:f32 — multiplica el alfa global (se acumula sobre el que hubiera). */
export const ALFA: i32 = 3;
/** x:f32 y:f32 */
export const TRASLADA: i32 = 4;
/** sx:f32 sy:f32 — escala alrededor del origen actual. */
export const ESCALA: i32 = 5;
/** x y w h r:f32 — recorta a un rectángulo redondeado. */
export const RECORTE_RR: i32 = 6;
/** n:i32 (x y)*n:f32 — recorta a un polígono. */
export const RECORTE_POLI: i32 = 7;
/** x y w h r:f32 color:i32 */
export const RECT: i32 = 8;
/** x y w h r:f32 · x0 y0 x1 y1:f32 · n:i32 · (t:f32 color:i32)*n */
export const RECT_GRAD: i32 = 9;
/** n:i32 (x y)*n:f32 color:i32 */
export const POLI: i32 = 10;
/**
 * id:i32 x y w h:f32 alfa:f32 tinte:i32 banderas:i32
 *
 * Banderas: 1 espejo horizontal, 2 encajar sin deformar. Sin la segunda la
 * imagen se estira a la caja, que es lo que hace un `<img>` por defecto; el
 * arma y el logo del equipo llevan `object-fit: contain` y sí la necesitan.
 */
export const IMAGEN: i32 = 11;
export const ESPEJO: i32 = 1;
export const CONTENER: i32 = 2;
/**
 * id:i32 x y w h:f32 alfa:f32 grisor:f32 · t0 a0 t1 a1:f32
 *
 * Imagen recortada tipo `cover` anclada arriba-centro, con una máscara de alfa
 * vertical de (t0,a0) a (t1,a1) y `grayscale(grisor)`. Es el retrato del
 * agente, que es el único sitio del diseño con esa combinación.
 */
export const RETRATO: i32 = 12;
/** texto:i32 fuente:i32 x y:f32 color:i32 align:i32 — align 0 izq, 1 centro, 2 der. */
export const TEXTO: i32 = 13;
/** x y w h r:f32 grosor:f32 color:i32 — trazo POR DENTRO del borde. */
export const TRAZO_RR: i32 = 14;
/** x y w h r:f32 radio:f32 color:i32 — resplandor hacia dentro (box-shadow inset). */
export const BRILLO_INT: i32 = 15;
/**
 * cx cy radio:f32 desenfoque:f32 recorte:f32 n:i32 (t:f32 color:i32)*n
 *
 * Degradado radial. `recorte` es el radio del círculo al que se recorta ANTES
 * de desenfocar, que es el orden en que lo hace el navegador con un
 * `border-radius:50%` y un `filter:blur()` encima. Cero, sin recorte.
 */
export const RADIAL: i32 = 16;
/** cx cy radio:f32 grosor:f32 color:i32 — circunferencia trazada. */
export const ANILLO: i32 = 17;
/** ruta:i32 x y w h:f32 modo:i32 grosor:f32 color:i32 — modo 0 relleno, 1 trazo. */
export const RUTA: i32 = 18;
/**
 * dx dy desenfoque:f32 color:i32 — sombra para lo que se dibuje a continuación.
 *
 * Es el `text-shadow` del marcador y del chip de ronda. Se apaga sola con el
 * `RESTAURAR` que cierra su bloque, igual que cualquier otro estado del
 * contexto; con color transparente también se apaga a mano.
 */
export const SOMBRA: i32 = 19;
/** angulo:f32 en radianes — gira alrededor del origen actual. */
export const ROTA: i32 = 20;

/** Tintes de imagen, que son los `filter` del CSS que el diseño usa. */
export const TINTE_NINGUNO: i32 = 0;
/** `brightness(0)`: silueta negra. */
export const TINTE_NEGRO: i32 = 1;
/** `brightness(0) invert(1)`: silueta blanca. */
export const TINTE_BLANCO: i32 = 2;

export const IZQ: i32 = 0;
export const CENTRO: i32 = 1;
export const DER: i32 = 2;

/* ── La zona de escritura ────────────────────────────────────────────────── */

/*
 * Un cuarto de millón de ranuras, que es un megabyte.
 *
 * La pantalla llena —diez tarjetas con insignias de ocho tramos, el marcador y
 * las bandas de serie— ronda las nueve mil ranuras. El margen es tan amplio a
 * propósito: si un día una pantalla se pasa, se ve en el contador y no en un
 * fotograma corrupto.
 */
const CAPACIDAD: i32 = 1 << 18;
const BASE: usize = heap.alloc(CAPACIDAD * 4);

let n: i32 = 0;
let desbordado: bool = false;

/** Dónde empieza el buffer, para que JS monte sus vistas encima. */
export function ordenes(): usize { return BASE; }
/** Cuántas ranuras tiene el fotograma recién compuesto. */
export function cuantas(): i32 { return n; }
/** Si el fotograma no cupo. JS lo mira y lo canta en consola. */
export function desbordo(): bool { return desbordado; }

export function reinicia(): void {
  n = 0;
  desbordado = false;
}

// @ts-ignore
@inline
function hueco(k: i32): bool {
  if (n + k > CAPACIDAD) { desbordado = true; return false; }
  return true;
}

// @ts-ignore
@inline
export function f(v: f64): void {
  store<f32>(BASE + (<usize>n) * 4, <f32>v);
  n++;
}

// @ts-ignore
@inline
export function i(v: i32): void {
  store<i32>(BASE + (<usize>n) * 4, v);
  n++;
}

/* ── Las órdenes, ya montadas ────────────────────────────────────────────── */

/*
 * Cada una de estas funciones escribe una operación completa. El resto del
 * programa no toca el buffer directamente: así el formato se puede cambiar
 * entero sin tocar la composición.
 */

export function guarda(): void { if (!hueco(1)) return; i(GUARDAR); }
export function restaura(): void { if (!hueco(1)) return; i(RESTAURAR); }

export function alfa(a: f64): void {
  if (a >= 1.0) return;
  if (!hueco(2)) return;
  i(ALFA); f(a);
}

export function traslada(x: f64, y: f64): void {
  if (x == 0 && y == 0) return;
  if (!hueco(3)) return;
  i(TRASLADA); f(x); f(y);
}

export function escala(sx: f64, sy: f64): void {
  if (sx == 1 && sy == 1) return;
  if (!hueco(3)) return;
  i(ESCALA); f(sx); f(sy);
}

export function recorteRR(x: f64, y: f64, w: f64, h: f64, r: f64): void {
  if (!hueco(6)) return;
  i(RECORTE_RR); f(x); f(y); f(w); f(h); f(r);
}

export function recortePoli(pts: StaticArray<f64>, cuenta: i32): void {
  if (!hueco(2 + cuenta * 2)) return;
  i(RECORTE_POLI); i(cuenta);
  for (let k = 0; k < cuenta * 2; k++) f(unchecked(pts[k]));
}

export function rect(x: f64, y: f64, w: f64, h: f64, r: f64, c: i32): void {
  if (w <= 0 || h <= 0) return;
  if (!hueco(7)) return;
  i(RECT); f(x); f(y); f(w); f(h); f(r); i(c);
}

/** Un rectángulo con degradado lineal. Las paradas van en 0..1 sobre el eje. */
export function rectGrad(
  x: f64, y: f64, w: f64, h: f64, r: f64,
  x0: f64, y0: f64, x1: f64, y1: f64,
  paradas: StaticArray<f64>, colores: StaticArray<i32>,
): void {
  const cuenta = colores.length;
  if (w <= 0 || h <= 0) return;
  if (!hueco(11 + cuenta * 2)) return;
  i(RECT_GRAD); f(x); f(y); f(w); f(h); f(r);
  f(x0); f(y0); f(x1); f(y1); i(cuenta);
  for (let k = 0; k < cuenta; k++) { f(unchecked(paradas[k])); i(unchecked(colores[k])); }
}

export function poli(pts: StaticArray<f64>, cuenta: i32, c: i32): void {
  if (!hueco(3 + cuenta * 2)) return;
  i(POLI); i(cuenta);
  for (let k = 0; k < cuenta * 2; k++) f(unchecked(pts[k]));
  i(c);
}

export function imagen(id: i32, x: f64, y: f64, w: f64, h: f64, a: f64, tinte: i32, banderas: i32): void {
  if (id < 0) return;
  if (!hueco(9)) return;
  i(IMAGEN); i(id); f(x); f(y); f(w); f(h); f(a); i(tinte); i(banderas);
}

export function retrato(
  id: i32, x: f64, y: f64, w: f64, h: f64, a: f64, grisor: f64,
  t0: f64, a0: f64, t1: f64, a1: f64,
): void {
  if (id < 0) return;
  if (!hueco(11)) return;
  i(RETRATO); i(id); f(x); f(y); f(w); f(h); f(a); f(grisor); f(t0); f(a0); f(t1); f(a1);
}

export function texto(idTexto: i32, idFuente: i32, x: f64, y: f64, c: i32, align: i32): void {
  if (idTexto < 0) return;
  if (!hueco(7)) return;
  i(TEXTO); i(idTexto); i(idFuente); f(x); f(y); i(c); i(align);
}

export function trazoRR(x: f64, y: f64, w: f64, h: f64, r: f64, grosor: f64, c: i32): void {
  if (!hueco(8)) return;
  i(TRAZO_RR); f(x); f(y); f(w); f(h); f(r); f(grosor); i(c);
}

export function brilloInt(x: f64, y: f64, w: f64, h: f64, r: f64, radio: f64, c: i32): void {
  if (!hueco(8)) return;
  i(BRILLO_INT); f(x); f(y); f(w); f(h); f(r); f(radio); i(c);
}

export function radial(
  cx: f64, cy: f64, radio: f64, desenfoque: f64, recorte: f64,
  paradas: StaticArray<f64>, colores: StaticArray<i32>,
): void {
  const cuenta = colores.length;
  if (!hueco(7 + cuenta * 2)) return;
  i(RADIAL); f(cx); f(cy); f(radio); f(desenfoque); f(recorte); i(cuenta);
  for (let k = 0; k < cuenta; k++) { f(unchecked(paradas[k])); i(unchecked(colores[k])); }
}

export function sombra(dx: f64, dy: f64, desenfoque: f64, c: i32): void {
  if (!hueco(5)) return;
  i(SOMBRA); f(dx); f(dy); f(desenfoque); i(c);
}

export function rota(angulo: f64): void {
  if (angulo == 0) return;
  if (!hueco(2)) return;
  i(ROTA); f(angulo);
}

export function anillo(cx: f64, cy: f64, radio: f64, grosor: f64, c: i32): void {
  if (radio <= 0) return;
  if (!hueco(6)) return;
  i(ANILLO); f(cx); f(cy); f(radio); f(grosor); i(c);
}

export function ruta(id: i32, x: f64, y: f64, w: f64, h: f64, modo: i32, grosor: f64, c: i32): void {
  if (id < 0) return;
  if (!hueco(9)) return;
  i(RUTA); i(id); f(x); f(y); f(w); f(h); i(modo); f(grosor); i(c);
}

export function fin(): void { if (!hueco(1)) return; i(FIN); }
