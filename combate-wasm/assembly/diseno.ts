/* EL DISEÑO, EN NÚMEROS.
   =====================

   Todo lo que en la versión DOM está escrito en `tokens.css`, `hud.css` y
   `combate.css`, aquí son constantes. No hay ni una medida "a ojo": cada valor
   de este fichero sale de una línea concreta de esas tres hojas, y el banco de
   pruebas está precisamente para que se note si alguno se desvía.

   Va aparte de la composición porque son dos cosas distintas: esto es el
   paquete de diseño y no cambia salvo que cambie el diseño; `escena.ts` es
   cómo se monta, y cambia cuando cambia el HUD.

   Aquí también viven las cuatro fórmulas de geometría que el navegador
   resuelve solo: hacia dónde va un degradado según su ángulo, cómo se aplana
   una curva de una `clip-path: path()`, y los dos polígonos de la insignia de
   definitiva. */

import { Color, rgba, mezclaSrgb } from './util';

/* ── Paleta ──────────────────────────────────────────────────────────────── */

export const ATK: Color = rgba(0x43, 0xcf, 0xa4, 255);
export const ATK_CLARO: Color = rgba(0x0a, 0xff, 0xbf, 255);
export const DEF: Color = rgba(0xe0, 0x55, 0x61, 255);
export const DEF_CLARO: Color = rgba(0xf0, 0x80, 0x8a, 255);

export const TINTA: Color = rgba(0x05, 0x07, 0x0a, 255);

export const PANEL_A: Color = rgba(38, 41, 49, 245);     // rgb(38 41 49 / 96%)
export const PANEL_B: Color = rgba(18, 20, 25, 242);     // rgb(18 20 25 / 95%)
export const PANEL_MUERTO_A: Color = rgba(16, 18, 23, 219); // 86%
export const PANEL_MUERTO_B: Color = rgba(8, 9, 12, 209);   // 82%

export const TEXTO_BASE: Color = rgba(0xf2, 0xf2, 0xf3, 255); // body
export const TEXTO_3: Color = rgba(0xc9, 0xca, 0xd0, 255);
export const TEXTO_TENUE: Color = rgba(0x8b, 0x8d, 0x94, 255);
export const TEXTO_MUERTO: Color = rgba(0x6b, 0x6e, 0x76, 255);

export const OBSERVADO: Color = rgba(0xff, 0xc8, 0x57, 255);

export const NEGRO_PIE: Color = rgba(0x08, 0x09, 0x0c, 255);
export const INSIGNIA_FONDO: Color = rgba(0x1a, 0x1c, 0x22, 255);
export const ALETA_FONDO: Color = rgba(0x0f, 0x19, 0x23, 255);
export const BLANCO: Color = rgba(255, 255, 255, 255);

export const CHIP_COLOR: Color = rgba(0xe6, 0xe7, 0xea, 255);
export const CHIP_SPIKE_COLOR: Color = rgba(0xff, 0xd9, 0xdd, 255);
export const MARCA_COLOR: Color = rgba(0xb9, 0xbb, 0xc2, 255);

/** El filo claro de todo panel: `inset 0 1px 0 rgb(255 255 255 / 10%)`. */
export const FILO: Color = rgba(255, 255, 255, 26);
export const FILO_PIE: Color = rgba(255, 255, 255, 51);      // 20%
export const FILO_PIE_MUERTO: Color = rgba(255, 255, 255, 18); // 7%

/** Los dos grises del anillo de la insignia. */
export const TRAMO_APAGADO: Color = rgba(255, 255, 255, 36); // 14%
export const TRAMO_MUERTO: Color = rgba(255, 255, 255, 56);  // 22%

export const PIE_MUERTO_A: Color = rgba(30, 33, 40, 235); // rgb(30 33 40 / 92%)
export const PIE_MUERTO_B: Color = rgba(20, 22, 27, 235);

export const BARRA_FONDO_A: Color = rgba(255, 255, 255, 26); // 10%
export const BARRA_FONDO_B: Color = rgba(255, 255, 255, 46); // 18%

export const SIN_DATO_FONDO: Color = rgba(255, 255, 255, 31); // 12%
export const SIN_DATO_COLOR: Color = rgba(0xe6, 0xe7, 0xea, 255);

export const ROMBO_APAGADO: Color = rgba(0, 0, 0, 56);  // rgb(0 0 0 / 22%)
export const ROMBO_ON: Color = rgba(0x08, 0x09, 0x0c, 255);

export const SERIE_VACIA: Color = rgba(255, 255, 255, 66); // 26%

export const ESCUDO_SIN: Color = rgba(0x6b, 0x6e, 0x76, 255);

// @ts-ignore
@inline export function colorBando(lado: i32): Color { return lado == 0 ? ATK : DEF; }
// @ts-ignore
@inline export function colorClaro(lado: i32): Color { return lado == 0 ? ATK_CLARO : DEF_CLARO; }

/** Los dos extremos de la franja del pie, que el CSS escribe con `color-mix`. */
export function pieIzquierda(lado: i32): Color { return mezclaSrgb(colorBando(lado), TINTA, 0.82); }
export function pieDerecha(lado: i32): Color { return mezclaSrgb(colorClaro(lado), colorBando(lado), 0.45); }

/* ── Medidas ─────────────────────────────────────────────────────────────── */

export const ANCHO: f64 = 1920;
export const ALTO: f64 = 1080;
/** `--r`: el único radio del sistema. */
export const R: f64 = 4;

/* Tarjeta. */
export const CARTA_VIVA: f64 = 318;
export const CARTA_MUERTA: f64 = 252;
export const CARTA_ALTO: f64 = 88;
export const ULTI: f64 = 50;
/** El solape de la insignia sobre el panel: `margin: 0 -6px 0 0`. */
export const ULTI_SOLAPE: f64 = 6;
export const CAB_ALTO: f64 = 58;
export const PIE_ALTO: f64 = 30;
export const RETRATO_ANCHO: f64 = 64;

/* Columna. */
export const COL_MARGEN: f64 = 16;
export const COL_HUECO: f64 = 17;
export const COL_SUELO: f64 = 16;
export const COL_SUELO_DUELO: f64 = 96;
export const COL_ESCALA_DUELO: f64 = 1.08;
/** El ancho de la tarjeta más la mitad del hueco del medio. */
export const DUELO_BORDE: f64 = 400;

/* Marcador. */
export const MARCADOR_ALTO: f64 = 60;
export const EQUIPO_ANCHO: f64 = 220;
/** `--safe-gap`, menos los 28px que el hueco se mete por cada lado. */
export const HUECO_SEGURO: f64 = 196 - 56;
export const ALETA_ANCHO: f64 = 42;
export const ALETA_ALTO: f64 = 72;
export const SERIE_ARRIBA: f64 = 66;
export const SERIE_ANCHO: f64 = 20;
export const SERIE_ALTO: f64 = 9;
export const SERIE_HUECO: f64 = 5;
export const SERIE_RADIO: f64 = 3;

/* Duraciones, en milisegundos. Son las del CSS. */
export const MS_MUEVE: f64 = 300;

/**
 * El desfase entre tarjetas. Cero, y NO es un olvido.
 *
 * El diseño lo pide —`--t-desfase: 38ms`, y hay una regla que lo aplica— pero
 * en el HUD que corre hoy no llega a aplicarse nunca, así que aquí tampoco: un
 * port que "mejora" el original deja de ser el mismo HUD.
 *
 * Lo que pasa es de cascada. El desfase se declara así:
 *
 *     .tarjeta.es-entra, .tarjeta.es-sale { animation-delay: calc(var(--i) * var(--t-desfase)) }
 *
 * y encima hay otra regla, más específica por llevar la columna delante:
 *
 *     .columna--izq .tarjeta.es-entra { animation: tarjeta-entra-izq ... }
 *
 * `animation` es un atajo, y un atajo reinicia TODO lo que engloba, el retardo
 * incluido. Al ser más específica, gana, y el retardo se queda en cero. Se
 * comprueba mirando `animation-delay` de las cinco tarjetas mientras entran:
 * las cinco valen 0ms y las cinco se mueven a la vez.
 *
 * Para recuperarlo hay que tocar el CSS —meter el retardo dentro del propio
 * atajo, o subirle la especificidad a la regla del retardo— y entonces poner
 * aquí 38. El sitio donde se usa sigue en pie, esperando el número.
 */
export const MS_DESFASE: f64 = 0;
export const MS_DANO: f64 = 360;
export const MS_BAJA: f64 = 520;
export const MS_ULTI: f64 = 900;
export const MS_HAB: f64 = 420;
export const MS_ANCHO: f64 = 420;
export const MS_VIDA: f64 = 340;
export const MS_FOCO: f64 = 220;
export const MS_FONDO: f64 = 450;
export const MS_RETRATO: f64 = 500;
export const MS_TRAMO: f64 = 420;
export const MS_ROMBO: f64 = 320;
export const MS_DUELO: f64 = 520;
/** Lo que tarda una tarjeta apartada en dejar de ocupar sitio. */
export const MS_FUERA: f64 = 900;

/* Identificadores de fuente. El texto y sus métricas viven en JS; aquí solo
   se sabe cuál de las once es cada cosa. */
export const F_NICK: i32 = 0;        // 500 17px Oswald, .03em
export const F_KDA: i32 = 1;         // 500 14px Oswald, .04em
export const F_ESCUDO: i32 = 2;      // 700 11px Oswald
export const F_VIDA: i32 = 3;        // 600 17px Oswald
export const F_SIN_DATO: i32 = 4;    // 600 9px Poppins, .14em
export const F_CREDITO: i32 = 5;     // 600 14px Oswald
export const F_TRI: i32 = 6;         // 600 21px Oswald, .08em
export const F_TANTO: i32 = 7;       // 700 29px Oswald
export const F_CHIP: i32 = 8;        // 600 10px Poppins, .16em
export const F_CHIP_SPIKE: i32 = 9;  // 600 10px Poppins, .12em, tabulares
export const F_MARCA: i32 = 10;      // 600 12px Poppins, .14em

/** La única ruta SVG del diseño: la silueta hueca del escudo. */
export const RUTA_ESCUDO: i32 = 0;

/* ── Degradados ──────────────────────────────────────────────────────────── */

/*
 * Dónde empieza y dónde acaba la línea de un `linear-gradient(Ndeg, …)`.
 *
 * CSS mide el ángulo desde "hacia arriba" y en el sentido del reloj, y la
 * línea del degradado es tan larga como haga falta para que las dos esquinas
 * perpendiculares caigan justo en los extremos. Sin esta fórmula, un degradado
 * a 160° sobre una caja que no es cuadrada sale girado.
 */
export const gradX0: StaticArray<f64> = new StaticArray<f64>(4);

export function lineaGradiente(angulo: f64, w: f64, h: f64): void {
  const rad = angulo * Math.PI / 180.0;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const largo = Math.abs(w * dx) + Math.abs(h * dy);
  const cx = w * 0.5;
  const cy = h * 0.5;
  unchecked(gradX0[0] = cx - dx * largo * 0.5);
  unchecked(gradX0[1] = cy - dy * largo * 0.5);
  unchecked(gradX0[2] = cx + dx * largo * 0.5);
  unchecked(gradX0[3] = cy + dy * largo * 0.5);
}

/* ── Trazador de contornos ───────────────────────────────────────────────── */

/*
 * Las cuñas del marcador y las aletas del contador vienen en el CSS como
 * `clip-path: path(...)` con esquinas redondeadas en cuadrática. Aquí se
 * aplanan a polígono: cada curva se parte en dieciséis tramos, que sobre un
 * radio de cinco píxeles deja un error muy por debajo de la décima de píxel.
 * Se aplanan en vez de mandarlas al intérprete para que el contorno no exista
 * escrito en ningún sitio fuera del wasm.
 */
const MAX_PUNTOS: i32 = 512;
export const contorno: StaticArray<f64> = new StaticArray<f64>(MAX_PUNTOS * 2);
let nPuntos: i32 = 0;
let ux: f64 = 0;
let uy: f64 = 0;

export function abre(x: f64, y: f64): void {
  nPuntos = 0;
  ux = x; uy = y;
  mete(x, y);
}

// @ts-ignore
@inline
function mete(x: f64, y: f64): void {
  if (nPuntos >= MAX_PUNTOS) return;
  unchecked(contorno[nPuntos * 2] = x);
  unchecked(contorno[nPuntos * 2 + 1] = y);
  nPuntos++;
}

export function linea(x: f64, y: f64): void {
  ux = x; uy = y;
  mete(x, y);
}

const TRAMOS_CURVA: i32 = 16;

export function cuad(cx: f64, cy: f64, x: f64, y: f64): void {
  const x0 = ux;
  const y0 = uy;
  for (let k = 1; k <= TRAMOS_CURVA; k++) {
    const t = <f64>k / <f64>TRAMOS_CURVA;
    const u = 1.0 - t;
    mete(u * u * x0 + 2.0 * u * t * cx + t * t * x,
         u * u * y0 + 2.0 * u * t * cy + t * t * y);
  }
  ux = x; uy = y;
}

export function puntos(): i32 { return nPuntos; }

/** Desplaza y escala el contorno recién trazado a su sitio en pantalla. */
export function coloca(x: f64, y: f64, sx: f64, sy: f64): void {
  for (let k = 0; k < nPuntos; k++) {
    unchecked(contorno[k * 2] = x + unchecked(contorno[k * 2]) * sx);
    unchecked(contorno[k * 2 + 1] = y + unchecked(contorno[k * 2 + 1]) * sy);
  }
}

/** La cuña del marcador: la punta mira hacia fuera en cada lado. */
export function cunaEquipo(der: bool): void {
  if (!der) {
    abre(5, 0);
    linea(215, 0);
    cuad(220, 0, 220, 5);
    linea(220, 55);
    cuad(220, 60, 215, 60);
    linea(35, 60);
    cuad(30, 60, 27.76, 55.53);
    linea(2.24, 4.47);
    cuad(0, 0, 5, 0);
  } else {
    abre(5, 0);
    linea(215, 0);
    cuad(220, 0, 217.76, 4.47);
    linea(192.24, 55.53);
    cuad(190, 60, 185, 60);
    linea(5, 60);
    cuad(0, 60, 0, 55);
    linea(0, 5);
    cuad(0, 0, 5, 0);
  }
}

/** El triángulo rectángulo de la aleta del contador. */
export function cunaAleta(der: bool): void {
  if (!der) {
    abre(5, 0);
    linea(37, 0);
    cuad(42, 0, 42, 5);
    linea(42, 68);
    cuad(42, 72, 39.98, 68.54);
    linea(2.52, 4.32);
    cuad(0, 0, 5, 0);
  } else {
    abre(5, 0);
    linea(37, 0);
    cuad(42, 0, 39.98, 3.46);
    linea(2.02, 68.54);
    cuad(0, 72, 0, 68);
    linea(0, 5);
    cuad(0, 0, 5, 0);
  }
}

/* ── La insignia de definitiva ───────────────────────────────────────────── */

/*
 * La geometría es la de `combate/js/poligono.js`, número a número.
 *
 * El polígono tiene tantos lados como puntos cuesta la definitiva, inscrito en
 * un círculo que empieza arriba y gira a la derecha. Del anillo se midieron el
 * radio de fuera, el de dentro y una separación entre tramos de 2.163 unidades
 * LINEALES —no angulares—, que es lo que hace que el hueco se vea del mismo
 * grosor por fuera y por dentro.
 */
const R_FUERA: f64 = 49.01;
const R_DENTRO: f64 = 38.02;
const HUECO_TRAMO: f64 = 2.163;

/** El contorno de la insignia, en una caja de lado `lado` colocada en (x,y). */
export function poligono(lados: i32, x: f64, y: f64, lado: f64): void {
  nPuntos = 0;
  const k = lado / 100.0;
  for (let j = 0; j < lados; j++) {
    const a = 2.0 * Math.PI * <f64>j / <f64>lados;
    mete(x + (50.0 + 50.0 * Math.sin(a)) * k, y + (50.0 - 50.0 * Math.cos(a)) * k);
  }
}

/** Un tramo del anillo: el trozo de corona entre dos vértices. */
export function tramoInsignia(j: i32, lados: i32, x: f64, y: f64, lado: f64): void {
  nPuntos = 0;
  const k = lado / 100.0;
  const paso = 2.0 * Math.PI / <f64>lados;
  const dFuera = Math.asin(HUECO_TRAMO / R_FUERA);
  const dDentro = Math.asin(HUECO_TRAMO / R_DENTRO);
  const j0 = <f64>j;

  arco(R_FUERA, j0 * paso + dFuera, x, y, k);
  arco(R_FUERA, (j0 + 1.0) * paso - dFuera, x, y, k);
  arco(R_DENTRO, (j0 + 1.0) * paso - dDentro, x, y, k);
  arco(R_DENTRO, j0 * paso + dDentro, x, y, k);
}

function arco(radio: f64, angulo: f64, x: f64, y: f64, k: f64): void {
  mete(x + (50.0 + radio * Math.sin(angulo)) * k, y + (50.0 - radio * Math.cos(angulo)) * k);
}
