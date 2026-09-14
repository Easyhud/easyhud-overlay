/* EL ESTADO — lo que entra de fuera y lo que hay que recordar.
   ===========================================================

   Dos cosas distintas viven aquí y conviene no confundirlas.

   **Lo que entra** es la foto del servidor, que el puente de JS deja escrita
   en una zona de memoria como números. Es exactamente lo que `datos.js` le da
   a la versión DOM, sin nada añadido: mismos campos, mismo criterio. Si el
   servidor no sabe la vida de alguien, aquí llega `vidaConocida` a cero y no
   un cien inventado.

   **Lo que hay que recordar** es todo lo demás, y es la mitad del trabajo. En
   la versión DOM no existe este fichero porque lo lleva el navegador: una
   `transition` recuerda de dónde venía una anchura, una clase que se pone y se
   quita sola recuerda que hace 200ms alguien recibió un disparo. Sin DOM, eso
   hay que guardarlo. La regla es la misma que allí: **el estado dice cómo
   están las cosas, no qué acaba de pasar**, así que los sucesos se deducen
   comparando cada foto con la anterior.

   Nada de esto se reinicia entre fotogramas: es el único trozo del programa
   con vida propia entre llamadas. */

import { TransNum, TransColor, Pulso } from './util';

/* ── La zona de entrada ──────────────────────────────────────────────────── */

/*
 * 512 ranuras de 4 bytes. Las escribe el puente de JS y las lee esto; el
 * acuerdo ranura a ranura es la tabla de constantes de abajo y no está escrito
 * en ningún otro sitio.
 */
const RANURAS: i32 = 512;
const ENTRADA: usize = heap.alloc(RANURAS * 4);

export function entrada(): usize { return ENTRADA; }
export function ranuras(): i32 { return RANURAS; }

// @ts-ignore
@inline function ei(k: i32): i32 { return load<i32>(ENTRADA + (<usize>k) * 4); }
// @ts-ignore
@inline function ef(k: i32): f64 { return <f64>load<f32>(ENTRADA + (<usize>k) * 4); }

/* Bloque global. */
const G_MINIMO: i32 = 0;
const G_FASE: i32 = 1;
const G_MAPAS_GANAR: i32 = 2;
const G_TXT_RONDA: i32 = 3;
const G_SPIKE_FIN: i32 = 4;
const G_TXT_MARCA: i32 = 5;
const G_CONECTADO: i32 = 6;
const G_TXT_SIN_DATO: i32 = 7;
const G_IMG_OJO: i32 = 8;
const G_IMG_SPIKE: i32 = 9;
const G_IMG_CREDITOS: i32 = 10;

/* Bloque de equipo: dos, de ocho ranuras. */
const EQ_BASE: i32 = 16;
const EQ_PASO: i32 = 8;
const EQ_LOGO: i32 = 0;
const EQ_TXT_TRI: i32 = 1;
const EQ_TXT_TANTOS: i32 = 2;
const EQ_N_SERIE: i32 = 3;
const EQ_SERIE: i32 = 4;

/* Bloque de jugador: diez, de treinta y dos ranuras. */
const JU_BASE: i32 = 32;
const JU_PASO: i32 = 32;
const JU_PRESENTE: i32 = 0;
const JU_TXT_NICK: i32 = 1;
const JU_TXT_KDA: i32 = 2;
const JU_IMG_AGENTE: i32 = 3;
const JU_IMG_ULTI: i32 = 4;
const JU_IMG_ARMA: i32 = 5;
const JU_VIVO: i32 = 6;
const JU_VIDA_OK: i32 = 7;
const JU_VIDA: i32 = 8;
const JU_ESCUDO: i32 = 9;
const JU_ULT: i32 = 10;
const JU_ULT_MAX: i32 = 11;
const JU_TXT_CREDITO: i32 = 12;
const JU_SPIKE: i32 = 13;
const JU_OBSERVADO: i32 = 14;
const JU_TXT_ESCUDO: i32 = 15;
const JU_HAB: i32 = 16;   // tres huecos de tres ranuras: imagen, tiene, max
const JU_TXT_VIDA: i32 = 25;

/** Fases, con los mismos nombres que usa el diseño. */
export const FASE_COMPRA: i32 = 0;
export const FASE_COMBATE: i32 = 1;
export const FASE_FIN_RONDA: i32 = 2;
export const FASE_SELECCION: i32 = 3;
export const FASE_FIN_MAPA: i32 = 4;

/** Casillas de la banda de serie. */
export const SERIE_NADA: i32 = 0;
export const SERIE_GANA: i32 = 1;
export const SERIE_EN_CURSO: i32 = 2;

export function minimo(): bool { return ei(G_MINIMO) != 0; }
export function fase(): i32 { return ei(G_FASE); }
export function mapasParaGanar(): i32 { return ei(G_MAPAS_GANAR); }
export function textoRonda(): i32 { return ei(G_TXT_RONDA); }
export function textoMarca(): i32 { return ei(G_TXT_MARCA); }
export function conectado(): bool { return ei(G_CONECTADO) != 0; }
/** «sin dato de vida»: fijo, pero el texto vive en JS como todos los demás. */
export function textoSinDato(): i32 { return ei(G_TXT_SIN_DATO); }
export function imgOjo(): i32 { return ei(G_IMG_OJO); }
export function imgSpike(): i32 { return ei(G_IMG_SPIKE); }
export function imgCreditos(): i32 { return ei(G_IMG_CREDITOS); }

/**
 * Instante en que la spike explota, en el mismo reloj que `ahora`, o -1.
 *
 * Es un INSTANTE y no unos segundos que quedan, por el mismo motivo que en la
 * versión DOM: el estado llega a saltos de 200ms y la cuenta atrás tiene que
 * ir suave a 60 fotogramas por segundo. El puente lo traduce al reloj local
 * al recibirlo, y a partir de ahí la resta la hace esto.
 */
export function spikeFin(): f64 { return ef(G_SPIKE_FIN); }

export function eqLogo(t: i32): i32 { return ei(EQ_BASE + t * EQ_PASO + EQ_LOGO); }
export function eqTri(t: i32): i32 { return ei(EQ_BASE + t * EQ_PASO + EQ_TXT_TRI); }
export function eqTantos(t: i32): i32 { return ei(EQ_BASE + t * EQ_PASO + EQ_TXT_TANTOS); }
export function eqSerieCuantas(t: i32): i32 { return ei(EQ_BASE + t * EQ_PASO + EQ_N_SERIE); }

/** Las casillas van empaquetadas de tres en tres bits: caben ocho de sobra. */
export function eqSerieCasilla(t: i32, k: i32): i32 {
  const v = ei(EQ_BASE + t * EQ_PASO + EQ_SERIE);
  return (v >>> (k * 3)) & 7;
}

// @ts-ignore
@inline function ju(lado: i32, k: i32, campo: i32): i32 {
  return ei(JU_BASE + (lado * 5 + k) * JU_PASO + campo);
}

export function jPresente(l: i32, k: i32): bool { return ju(l, k, JU_PRESENTE) != 0; }
export function jNick(l: i32, k: i32): i32 { return ju(l, k, JU_TXT_NICK); }
export function jKda(l: i32, k: i32): i32 { return ju(l, k, JU_TXT_KDA); }
export function jAgente(l: i32, k: i32): i32 { return ju(l, k, JU_IMG_AGENTE); }
export function jUltiIcono(l: i32, k: i32): i32 { return ju(l, k, JU_IMG_ULTI); }
export function jArma(l: i32, k: i32): i32 { return ju(l, k, JU_IMG_ARMA); }
export function jVivo(l: i32, k: i32): bool { return ju(l, k, JU_VIVO) != 0; }
export function jVidaConocida(l: i32, k: i32): bool { return ju(l, k, JU_VIDA_OK) != 0; }
export function jVida(l: i32, k: i32): f64 { return ef(JU_BASE + (l * 5 + k) * JU_PASO + JU_VIDA); }
export function jEscudo(l: i32, k: i32): i32 { return ju(l, k, JU_ESCUDO); }
export function jTextoEscudo(l: i32, k: i32): i32 { return ju(l, k, JU_TXT_ESCUDO); }
export function jTextoVida(l: i32, k: i32): i32 { return ju(l, k, JU_TXT_VIDA); }
export function jUlt(l: i32, k: i32): i32 { return ju(l, k, JU_ULT); }
export function jUltMax(l: i32, k: i32): i32 { return ju(l, k, JU_ULT_MAX); }
export function jCredito(l: i32, k: i32): i32 { return ju(l, k, JU_TXT_CREDITO); }
export function jSpike(l: i32, k: i32): bool { return ju(l, k, JU_SPIKE) != 0; }
export function jObservado(l: i32, k: i32): bool { return ju(l, k, JU_OBSERVADO) != 0; }

export function jHabImagen(l: i32, k: i32, h: i32): i32 { return ju(l, k, JU_HAB + h * 3); }
export function jHabTiene(l: i32, k: i32, h: i32): i32 { return ju(l, k, JU_HAB + h * 3 + 1); }
export function jHabMax(l: i32, k: i32, h: i32): i32 { return ju(l, k, JU_HAB + h * 3 + 2); }

/** Una habilidad sin imagen ni datos es un hueco: el muerto no pinta ninguna. */
export function jHabHay(l: i32, k: i32, h: i32): bool {
  return jVivo(l, k) && jHabMax(l, k, h) > 0;
}

export function vivosEn(lado: i32): i32 {
  let n = 0;
  for (let k = 0; k < 5; k++) if (jPresente(lado, k) && jVivo(lado, k)) n++;
  return n;
}

/* ── Lo que hay que recordar ─────────────────────────────────────────────── */

/** Cuántos tramos puede tener una insignia. Ocho puntos es la definitiva más cara. */
export const MAX_TRAMOS: i32 = 12;
/** Cuántos rombos puede tener una habilidad. */
export const MAX_CARGAS: i32 = 4;

/** En qué punto de su ida y venida está una tarjeta. */
export const V_VISIBLE: i32 = 0;
export const V_ENTRANDO: i32 = 1;
export const V_SALIENDO: i32 = 2;
export const V_OCULTA: i32 = 3;

/**
 * La memoria de una tarjeta.
 *
 * Cada campo de aquí es una línea del CSS que el navegador llevaba solo. Las
 * duraciones no se guardan: las pone quien compone, porque son del diseño y no
 * del estado.
 */
export class Carta {
  /** Ancho de la tarjeta: 318 viva, 252 muerta. `transition: width 420ms`. */
  ancho: TransNum = new TransNum();
  /** La barra de vida, en porcentaje. `transition: width 340ms`. */
  vida: TransNum = new TransNum();
  /** El resplandor ámbar del observado, que se cruza en 220ms. */
  foco: TransNum = new TransNum();
  /** 0 vivo, 1 muerto. Manda los fondos del panel y del pie, a 450ms. */
  muerto: TransNum = new TransNum();
  /** Lo mismo, pero para el retrato, que va a 500ms. */
  muertoRetrato: TransNum = new TransNum();

  /** Un tramo de la insignia interpola su color, no salta. */
  tramos: StaticArray<TransColor> = new StaticArray<TransColor>(MAX_TRAMOS);
  /** Cada rombo de carga, igual. */
  rombos: StaticArray<TransColor> = new StaticArray<TransColor>(3 * MAX_CARGAS);

  dano: Pulso = new Pulso();
  baja: Pulso = new Pulso();
  habs: StaticArray<Pulso> = new StaticArray<Pulso>(3);
  /** El fogonazo de la definitiva: UNO, al llenarse. Nunca en bucle. */
  fogonazo: Pulso = new Pulso();

  visible: i32 = V_OCULTA;
  /** Cuándo empezó la entrada o la salida, para el desfase entre tarjetas. */
  tMueve: f64 = -1;
  /** Cuándo se apaga del todo una tarjeta que sale (el `display:none` tardío). */
  tApaga: f64 = -1;

  /* La foto anterior, que es de donde salen los sucesos. */
  habiaVida: f64 = -1;
  habiaVivo: bool = false;
  habiaCargas: StaticArray<i32> = new StaticArray<i32>(3);
  habiaLista: bool = false;
  habia: bool = false;

  /*
   * Cuántos tramos y cuántos rombos había. Son la única excepción a "los nodos
   * no se rehacen": cuando cambia la CUENTA, la versión DOM los recrea, y un
   * nodo recién creado no transiciona —nace ya en su color—. Así que cuando
   * estos números cambian, el color se fija en vez de animarse.
   */
  habiaLados: i32 = -1;
  habiaRombos: StaticArray<i32> = new StaticArray<i32>(3);

  constructor() {
    for (let k = 0; k < MAX_TRAMOS; k++) unchecked(this.tramos[k] = new TransColor());
    for (let k = 0; k < 3 * MAX_CARGAS; k++) unchecked(this.rombos[k] = new TransColor());
    for (let k = 0; k < 3; k++) unchecked(this.habs[k] = new Pulso());
    for (let k = 0; k < 3; k++) unchecked(this.habiaCargas[k] = -1);
    for (let k = 0; k < 3; k++) unchecked(this.habiaRombos[k] = -1);
  }
}

/** La memoria de una columna: solo el viaje al centro cuando hay duelo. */
export class Columna {
  /** Desplazamiento horizontal hacia el centro. */
  borde: TransNum = new TransNum();
  /** Altura sobre el suelo: 16 normal, 96 en duelo. */
  suelo: TransNum = new TransNum();
  /** La columna entera crece un 8% en duelo. */
  escala: TransNum = new TransNum();
}

export const cartas: StaticArray<Carta> = new StaticArray<Carta>(10);
export const columnas: StaticArray<Columna> = new StaticArray<Columna>(2);

export function arranca(): void {
  for (let k = 0; k < 10; k++) unchecked(cartas[k] = new Carta());
  for (let k = 0; k < 2; k++) unchecked(columnas[k] = new Columna());
}

// @ts-ignore
@inline
export function carta(lado: i32, k: i32): Carta {
  return unchecked(cartas[lado * 5 + k]);
}
