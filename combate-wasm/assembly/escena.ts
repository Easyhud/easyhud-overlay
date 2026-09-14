/* LA COMPOSICIÓN — donde se decide dónde va cada cosa.
   ===================================================

   Este fichero hace, a mano, lo que en la versión DOM hacen el motor de
   maquetación y el de animación del navegador juntos: resolver cada caja
   flexible, interpolar cada transición y emitir el dibujo.

   ## La regla de la que cuelga todo

   La versión DOM tiene una regla escrita en su cabecera: **los nodos no se
   rehacen**. Aquí esa regla no puede existir —cada fotograma se pinta entero
   desde cero— y por eso la memoria de `estado.ts` es obligatoria: lo que allí
   recordaba el navegador por el hecho de que el nodo seguía siendo el mismo,
   aquí lo recuerda una estructura. Una transición interrumpida a mitad arranca
   desde donde esté, no desde el valor viejo; un fogonazo que ya sonó no vuelve
   a sonar. Si eso se pierde, el HUD "funciona" y está mal: la barra de vida
   salta en vez de deslizarse y la insignia revienta diez veces por segundo.

   ## Lo que no se sabe no se pinta

   Igual que allí. Sin dato de vida no hay barra ni número, hay un cartel. Un
   cero falso se lee como una baja, y eso es afirmar algo que no consta sobre
   una persona con su nombre al lado.

   ## Sobre el orden

   El orden en que se emiten las órdenes ES el orden de pintado, y reproduce el
   apilamiento del CSS, que no es el orden del marcado: las bandas de serie van
   por encima de las columnas, y las aletas del contador por encima de todo.
   Cambiar el orden de dos bloques de aquí es cambiar qué tapa a qué. */

import {
  guarda, restaura, alfa, traslada, escala, rota, recorteRR, recortePoli,
  rect, rectGrad, poli, imagen, retrato, texto, trazoRR, brilloInt, radial,
  anillo, ruta, sombra, fin, reinicia,
  TINTE_NEGRO, TINTE_BLANCO, IZQ, CENTRO, DER, ESPEJO, CONTENER,
} from './ordenes';

import {
  Color, rgba, conAlfa, porAlfa, entre, mezcla, curva, fotogramas,
  LINEAL, EASE, EASE_OUT, SISTEMA, REBOTE,
} from './util';

import * as D from './diseno';
import * as S from './estado';

/* ── Lo que hace falta de JS ─────────────────────────────────────────────── */

/*
 * Tres cosas no pueden vivir aquí, y las tres son la misma: medir letras.
 * El wasm no tiene tipografías. Quien sabe cuánto ocupa un nombre con Oswald a
 * 17 píxeles y un espaciado de .03em es el propio lienzo, así que se le
 * pregunta. Las respuestas las cachea el puente; esto pregunta sin miramientos.
 */

// @ts-ignore: decorador de AssemblyScript
@external("js", "medir")
declare function medir(texto: i32, fuente: i32): f64;

/** Recorta un texto a un ancho con puntos suspensivos y devuelve el nuevo id. */
// @ts-ignore
@external("js", "recorta")
declare function recorta(texto: i32, fuente: i32, ancho: f64): i32;

/** 0 del centro de la caja a la base, 1 del borde de arriba, 2 interlineado. */
// @ts-ignore
@external("js", "metrica")
declare function metrica(fuente: i32, que: i32): f64;

/** Compone un texto que cambia cada fotograma. 1 es el chip de la spike. */
// @ts-ignore
@external("js", "formatea")
declare function formatea(formato: i32, valor: f64): i32;

const BASE_CENTRO: i32 = 0;
const BASE_ARRIBA: i32 = 1;
const INTERLINEA: i32 = 2;

/**
 * La línea base de un texto centrado verticalmente en una caja.
 *
 * Vale para todo el HUD y conviene entender por qué: el área de contenido de
 * una línea queda siempre centrada dentro de su caja de línea, así que el
 * interlineado —que en el diseño va de 1 a 1.35 según el sitio— reparte por
 * igual arriba y abajo y no mueve la línea base ni un píxel. Con `align-items:
 * center`, el centro de la caja y el del texto coinciden, y la distancia que
 * queda hasta la base es una constante de la fuente.
 */
function baseEnCentro(centroY: f64, fuente: i32): f64 {
  return centroY + metrica(fuente, BASE_CENTRO);
}

/** La línea base de un texto cuya caja de línea empieza arriba del todo. */
function baseDesdeArriba(arriba: f64, fuente: i32): f64 {
  return arriba + metrica(fuente, BASE_ARRIBA);
}

function baseDesdeAbajo(abajo: f64, fuente: i32): f64 {
  return abajo - metrica(fuente, INTERLINEA) + metrica(fuente, BASE_ARRIBA);
}

/* ── Zonas de trabajo reutilizadas ───────────────────────────────────────── */

/*
 * Nada se reserva dentro del bucle de dibujo.
 *
 * El módulo se compila sin recolector de basura, así que un `new` por
 * fotograma sería memoria que no vuelve nunca: a sesenta fotogramas por
 * segundo, una emisión de torneo de tres horas. Todo lo que hace falta para
 * componer está reservado aquí y se reescribe en cada uso.
 */
const P2: StaticArray<f64> = new StaticArray<f64>(2);
const C2: StaticArray<i32> = new StaticArray<i32>(2);
const P3: StaticArray<f64> = new StaticArray<f64>(3);
const C3: StaticArray<i32> = new StaticArray<i32>(3);

/* Los fotogramas de las animaciones del diseño, tal cual están escritos. */
const K_ENTRA: StaticArray<f64> = [0.0, 0.0001, 1.0];
const K_ENTRA_ALFA: StaticArray<f64> = [1.0, 0.0, 1.0];
const K_SALE: StaticArray<f64> = [0.0, 1.0];
const K_SALE_ALFA: StaticArray<f64> = [1.0, 0.0];
const K_BAJA: StaticArray<f64> = [0.0, 0.0001, 0.46, 1.0];
const K_BAJA_ESCALA: StaticArray<f64> = [1.0, 1.04, 0.995, 1.0];
const K_DANO: StaticArray<f64> = [0.0, 0.18, 1.0];
const K_DANO_ALFA: StaticArray<f64> = [0.0, 0.62, 0.0];
const K_HAB: StaticArray<f64> = [0.0, 0.0001, 1.0];
const K_HAB_ESCALA: StaticArray<f64> = [1.0, 1.18, 1.0];

/* ── Estado derivado del fotograma ───────────────────────────────────────── */

let hayDuelo: bool = false;

/* ══════════════════════════════════════════════════════════════════════════
   PRIMERA PASADA: leer la foto, deducir los sucesos y mover las transiciones
   ══════════════════════════════════════════════════════════════════════════ */

function actualiza(ahora: f64): void {
  /*
   * El duelo, primero de todo: decide si una tarjeta se aparta, y eso hay que
   * saberlo antes de tocarle nada. Solo en combate, como en la versión DOM: en
   * la compra están los diez vivos, y al acabar la ronda la lista vuelve
   * entera aunque siga habiendo uno y uno.
   */
  hayDuelo = S.fase() == S.FASE_COMBATE && S.vivosEn(0) == 1 && S.vivosEn(1) == 1;

  for (let lado = 0; lado < 2; lado++) {
    for (let k = 0; k < 5; k++) {
      actualizaCarta(lado, k, ahora);
    }
    actualizaColumna(lado, ahora);
  }
}

function actualizaCarta(lado: i32, k: i32, ahora: f64): void {
  const c = S.carta(lado, k);
  const presente = S.jPresente(lado, k);

  if (!presente) {
    c.habia = false;
    c.visible = S.V_OCULTA;
    return;
  }

  const vivo = S.jVivo(lado, k);
  const conDato = vivo && S.jVidaConocida(lado, k);
  const lista = S.jUlt(lado, k) >= S.jUltMax(lado, k);
  const lados = max(3, S.jUltMax(lado, k));

  /* Tarjeta recién nacida: entra desde su filo de pantalla, escalonada, y
     TODO lo demás se fija sin animar. Una transición sobre un nodo que acaba
     de nacer no existe: nace ya en su valor. */
  const nueva = !c.habia;
  if (nueva) {
    c.visible = S.V_ENTRANDO;
    c.tMueve = ahora;
    c.ancho.fija(vivo ? D.CARTA_VIVA : D.CARTA_MUERTA);
    c.muerto.fija(vivo ? 0 : 1);
    c.muertoRetrato.fija(vivo ? 0 : 1);
    c.foco.fija(S.jObservado(lado, k) ? 1 : 0);
    c.vida.fija(conDato ? S.jVida(lado, k) : 100);
    c.habiaLados = -1;
    c.habiaLista = lista && vivo;
  }

  /* ── Los sucesos: comparar con la foto anterior ─────────────────────────
     El estado dice cómo están las cosas, no qué acaba de pasar. */
  if (!nueva) {
    const vidaAhora = conDato ? S.jVida(lado, k) : -1.0;

    /* Daño: la vida bajó y sigue vivo. Si murió, manda la muerte. */
    if (vivo && c.habiaVivo && vidaAhora >= 0 && c.habiaVida >= 0 && vidaAhora < c.habiaVida) {
      c.dano.lanza(ahora, D.MS_DANO);
    }

    /* Habilidad usada: una carga que estaba y ya no está. */
    for (let h = 0; h < 3; h++) {
      const tiene = S.jHabHay(lado, k, h) ? S.jHabTiene(lado, k, h) : -1;
      const habia = unchecked(c.habiaCargas[h]);
      if (tiene >= 0 && habia >= 0 && tiene < habia) c.habs[h].lanza(ahora, D.MS_HAB);
    }

    /* La baja va en la tarjeta del que cae, y SOLO en esa. Dispararla en las
       cinco del bando contrario deja media pantalla latiendo. */
    if (c.habiaVivo && !vivo) c.baja.lanza(ahora, D.MS_BAJA);

    /* El fogonazo de la definitiva: uno, al llenarse. En directo, lo que late
       molesta. */
    const listaAhora = lista && vivo;
    if (listaAhora && !c.habiaLista) c.fogonazo.lanza(ahora, D.MS_ULTI);
  }

  c.habiaVida = conDato ? S.jVida(lado, k) : -1.0;
  c.habiaVivo = vivo;
  c.habiaLista = lista && vivo;
  for (let h = 0; h < 3; h++) {
    unchecked(c.habiaCargas[h] = S.jHabHay(lado, k, h) ? S.jHabTiene(lado, k, h) : -1);
  }
  c.habia = true;

  /* ── Destinos de las transiciones ──────────────────────────────────────── */
  c.ancho.a(vivo ? D.CARTA_VIVA : D.CARTA_MUERTA, ahora, D.MS_ANCHO, SISTEMA);
  c.muerto.a(vivo ? 0 : 1, ahora, D.MS_FONDO, EASE);
  c.muertoRetrato.a(vivo ? 0 : 1, ahora, D.MS_RETRATO, EASE);
  c.foco.a(S.jObservado(lado, k) ? 1 : 0, ahora, D.MS_FOCO, EASE);
  if (conDato) c.vida.a(S.jVida(lado, k), ahora, D.MS_VIDA, SISTEMA);

  /*
   * Los tramos de la insignia y los rombos de carga son la excepción a la
   * regla de "no se rehace nada": cuando cambia el NÚMERO de tramos o de
   * rombos, la versión DOM los recrea, y un nodo recién creado no transiciona
   * —nace ya en su color—. Así que aquí, cuando cambia la cuenta, se fija en
   * vez de animar. Es la diferencia entre una insignia que cambia de forma
   * limpiamente y una que se desvanece por dentro.
   */
  const rehaceTramos = c.habiaLados != lados;
  c.habiaLados = lados;
  const cargados = S.jUlt(lado, k);
  for (let j = 0; j < lados && j < S.MAX_TRAMOS; j++) {
    const destino = colorTramo(lado, j < cargados, !vivo, lista && vivo);
    const t = unchecked(c.tramos[j]);
    if (rehaceTramos) t.fija(destino);
    else t.a(destino, ahora, D.MS_TRAMO, SISTEMA);
  }

  for (let h = 0; h < 3; h++) {
    const hay = S.jHabHay(lado, k, h);
    const cuantos = hay ? max(1, S.jHabMax(lado, k, h)) : 0;
    const tiene = hay ? S.jHabTiene(lado, k, h) : 0;
    const rehace = unchecked(c.habiaRombos[h]) != cuantos;
    unchecked(c.habiaRombos[h] = cuantos);
    for (let q = 0; q < cuantos && q < S.MAX_CARGAS; q++) {
      const destino = q < tiene ? D.ROMBO_ON : D.ROMBO_APAGADO;
      const t = unchecked(c.rombos[h * S.MAX_CARGAS + q]);
      if (rehace) t.fija(destino);
      else t.a(destino, ahora, D.MS_ROMBO, EASE);
    }
  }

  /* ── El duelo: apartarse o volver ──────────────────────────────────────── */
  const fuera = hayDuelo && !vivo;

  if (fuera) {
    if (c.visible == S.V_VISIBLE || c.visible == S.V_ENTRANDO) {
      c.visible = S.V_SALIENDO;
      c.tMueve = ahora;
      c.tApaga = ahora + D.MS_FUERA;
    } else if (c.visible == S.V_SALIENDO && ahora >= c.tApaga) {
      c.visible = S.V_OCULTA;
    }
  } else {
    if (c.visible == S.V_SALIENDO || c.visible == S.V_OCULTA) {
      c.visible = S.V_ENTRANDO;
      c.tMueve = ahora;
    }
  }

  if (c.visible == S.V_ENTRANDO && ahora >= c.tMueve + <f64>k * D.MS_DESFASE + D.MS_MUEVE) {
    c.visible = S.V_VISIBLE;
  }
}

function colorTramo(lado: i32, cargado: bool, muerto: bool, lista: bool): Color {
  if (muerto) return cargado ? D.TRAMO_MUERTO : D.TRAMO_APAGADO;
  if (lista) return D.colorClaro(lado);
  return cargado ? D.colorBando(lado) : D.TRAMO_APAGADO;
}

function actualizaColumna(lado: i32, ahora: f64): void {
  const col = unchecked(S.columnas[lado]);
  col.borde.a(hayDuelo ? D.ANCHO * 0.5 - D.DUELO_BORDE : D.COL_MARGEN, ahora, D.MS_DUELO, SISTEMA);
  col.suelo.a(hayDuelo ? D.COL_SUELO_DUELO : D.COL_SUELO, ahora, D.MS_DUELO, SISTEMA);
  col.escala.a(hayDuelo ? D.COL_ESCALA_DUELO : 1.0, ahora, D.MS_DUELO, SISTEMA);
}

/* ══════════════════════════════════════════════════════════════════════════
   SEGUNDA PASADA: pintar
   ══════════════════════════════════════════════════════════════════════════ */

export function compon(ahora: f64): void {
  reinicia();
  actualiza(ahora);

  const min = S.minimo();

  /*
   * El orden de aquí es el apilamiento del CSS, no el del marcado. El marcador
   * y las columnas están en el grupo de base y van en orden de árbol; las
   * bandas de serie llevan z-index 3 y el chip y las aletas, 4.
   */
  if (!min) pintaMarcador();
  pintaColumna(0, ahora);
  pintaColumna(1, ahora);
  pintaMarca();
  if (!min) {
    pintaSerie(0);
    pintaSerie(1);
    pintaChip(ahora);
    pintaAleta(false);
    pintaAleta(true);
  }

  fin();
}

/* ── Marcador ────────────────────────────────────────────────────────────── */

function pintaMarcador(): void {
  const total = D.EQUIPO_ANCHO * 2 + D.HUECO_SEGURO;
  const x0 = D.ANCHO * 0.5 - total * 0.5;

  pintaEquipo(0, x0);
  pintaEquipo(1, x0 + D.EQUIPO_ANCHO + D.HUECO_SEGURO);
}

function pintaEquipo(lado: i32, x: f64): void {
  const der = lado == 1;
  const c = D.colorBando(lado);
  const w = D.EQUIPO_ANCHO;
  const h = D.MARCADOR_ALTO;

  guarda();
  D.cunaEquipo(der);
  D.coloca(x, 0, 1, 1);
  recortePoli(D.contorno, D.puntos());

  /* Las tres capas de fondo, de abajo arriba: el material del panel, el
     brillo superior y el tinte del bando por el lado de fuera. */
  D.lineaGradiente(160, w, h);
  unchecked(P2[0] = 0); unchecked(P2[1] = 1);
  unchecked(C2[0] = D.PANEL_A); unchecked(C2[1] = D.PANEL_B);
  rectGrad(x, 0, w, h, 0,
    x + unchecked(D.gradX0[0]), unchecked(D.gradX0[1]),
    x + unchecked(D.gradX0[2]), unchecked(D.gradX0[3]), P2, C2);

  unchecked(P2[0] = 0); unchecked(P2[1] = 0.42);
  unchecked(C2[0] = rgba(255, 255, 255, 18)); unchecked(C2[1] = rgba(255, 255, 255, 0));
  rectGrad(x, 0, w, h, 0, x, 0, x, h, P2, C2);

  /* `color-mix(in srgb, var(--c) 26%, transparent)` es el color del bando con
     alfa 0.26: mezclar con transparente en sRGB solo toca el alfa. */
  unchecked(P2[0] = 0.45); unchecked(P2[1] = 1);
  unchecked(C2[0] = conAlfa(c, 0)); unchecked(C2[1] = conAlfa(c, 0.26));
  if (der) rectGrad(x, 0, w, h, 0, x + w, 0, x, 0, P2, C2);
  else rectGrad(x, 0, w, h, 0, x, 0, x + w, 0, P2, C2);

  /* El filo claro de arriba. */
  rect(x, 0, w, 1, 0, D.FILO);

  /* El filete del color del bando, pegado abajo. */
  rect(x + (der ? 4 : 32), h - 3, 184, 3, 2, c);

  /* Contenido: logo, trigrama, hueco elástico y tantos. */
  const izqC = x + 40;
  const derC = x + w - 40;
  const centro = (h - 4) * 0.5;

  const logo = S.eqLogo(lado);
  if (der) imagen(logo, derC - 38, centro - 19, 38, 38, 1, 0, CONTENER);
  else imagen(logo, izqC, centro - 19, 38, 38, 1, 0, CONTENER);

  sombra(0, 1, 3, rgba(0, 0, 0, 115));
  const tri = S.eqTri(lado);
  if (der) texto(tri, D.F_TRI, derC - 38 - 11, baseEnCentro(centro, D.F_TRI), D.TEXTO_BASE, DER);
  else texto(tri, D.F_TRI, izqC + 38 + 11, baseEnCentro(centro, D.F_TRI), D.TEXTO_BASE, IZQ);

  sombra(0, 2, 6, rgba(0, 0, 0, 115));
  const tantos = S.eqTantos(lado);
  if (der) texto(tantos, D.F_TANTO, izqC + 14, baseEnCentro(centro, D.F_TANTO), D.TEXTO_BASE, IZQ);
  else texto(tantos, D.F_TANTO, derC - 14, baseEnCentro(centro, D.F_TANTO), D.TEXTO_BASE, DER);

  restaura();
}

function pintaAleta(der: bool): void {
  const x = der ? D.ANCHO * 0.5 + 68 : D.ANCHO * 0.5 - 68 - D.ALETA_ANCHO;
  guarda();
  D.cunaAleta(der);
  D.coloca(x, 0, 1, 1);
  poli(D.contorno, D.puntos(), D.ALETA_FONDO);
  restaura();
}

function pintaChip(ahora: f64): void {
  const fin = S.spikeFin();
  const plantada = fin >= 0;

  let id: i32;
  let fuente: i32;
  let color: Color;

  if (plantada) {
    const resto = Math.max(0, (fin - ahora) / 1000.0);
    id = formatea(1, resto);
    fuente = D.F_CHIP_SPIKE;
    color = D.CHIP_SPIKE_COLOR;
  } else {
    id = S.textoRonda();
    fuente = D.F_CHIP;
    color = D.CHIP_COLOR;
  }

  guarda();
  sombra(0, 1, 3, rgba(0, 0, 0, 204));
  texto(id, fuente, D.ANCHO * 0.5, baseDesdeArriba(6, fuente), color, CENTRO);
  restaura();
}

function pintaSerie(lado: i32): void {
  const cuantas = S.mapasParaGanar() <= 1 ? 0 : S.eqSerieCuantas(lado);
  if (cuantas <= 0) return;

  const claro = D.colorClaro(lado);
  const y = D.SERIE_ARRIBA;

  for (let k = 0; k < cuantas; k++) {
    /* La banda izquierda va del centro hacia fuera: se encienden de dentro
       hacia fuera, que es lo que dice el diseño. */
    const x = lado == 0
      ? D.ANCHO - (D.ANCHO * 0.5 + 120) - D.SERIE_ANCHO - <f64>k * (D.SERIE_ANCHO + D.SERIE_HUECO)
      : D.ANCHO * 0.5 + 120 + <f64>k * (D.SERIE_ANCHO + D.SERIE_HUECO);

    const casilla = S.eqSerieCasilla(lado, k);
    const fondo = casilla == S.SERIE_GANA ? claro : D.SERIE_VACIA;
    rect(x, y, D.SERIE_ANCHO, D.SERIE_ALTO, D.SERIE_RADIO, fondo);

    /* El mapa en curso va con trazo, no con relleno: relleno significa
       ganado, y significarlo antes de tiempo sería mentir. */
    if (casilla == S.SERIE_EN_CURSO) {
      trazoRR(x, y, D.SERIE_ANCHO, D.SERIE_ALTO, D.SERIE_RADIO, 2, claro);
    }
  }
}

function pintaMarca(): void {
  texto(S.textoMarca(), D.F_MARCA, D.ANCHO * 0.5,
    baseDesdeAbajo(D.ALTO - 9, D.F_MARCA), D.MARCA_COLOR, CENTRO);
}

/* ── Columnas ────────────────────────────────────────────────────────────── */

function pintaColumna(lado: i32, ahora: f64): void {
  const col = unchecked(S.columnas[lado]);
  const der = lado == 1;

  /* Solo cuentan para la maquetación las tarjetas que ocupan sitio: una que
     acabó de irse está en `display:none` y la superviviente baja a ocupar su
     hueco. Es el salto de posición del segundo 0.9 del duelo, y es real. */
  let cuantas = 0;
  let anchoCol: f64 = 0;
  for (let k = 0; k < 5; k++) {
    const c = S.carta(lado, k);
    if (!c.habia || c.visible == S.V_OCULTA) continue;
    cuantas++;
    const w = c.ancho.valor(ahora);
    if (w > anchoCol) anchoCol = w;
  }
  if (cuantas == 0) return;

  const alto = <f64>cuantas * D.CARTA_ALTO + <f64>(cuantas - 1) * D.COL_HUECO;
  const suelo = col.suelo.valor(ahora);
  const borde = col.borde.valor(ahora);
  const k = col.escala.valor(ahora);

  const abajo = D.ALTO - suelo;
  const arriba = abajo - alto;
  const izquierda = der ? D.ANCHO - borde - anchoCol : borde;

  guarda();
  /* La columna crece desde su pie y desde su centro: `transform-origin:
     bottom center`. */
  if (k != 1.0) {
    const cx = izquierda + anchoCol * 0.5;
    traslada(cx, abajo);
    escala(k, k);
    traslada(-cx, -abajo);
  }

  let fila = 0;
  for (let j = 0; j < 5; j++) {
    const c = S.carta(lado, j);
    if (!c.habia || c.visible == S.V_OCULTA) continue;
    const y = arriba + <f64>fila * (D.CARTA_ALTO + D.COL_HUECO);
    const w = c.ancho.valor(ahora);
    /* La columna derecha alinea por su filo derecho. */
    const x = der ? izquierda + anchoCol - w : izquierda;
    pintaCarta(lado, j, x, y, w, ahora);
    fila++;
  }

  restaura();
}

/* ── La tarjeta ──────────────────────────────────────────────────────────── */

function pintaCarta(lado: i32, k: i32, x: f64, y: f64, w: f64, ahora: f64): void {
  const c = S.carta(lado, k);
  const der = lado == 1;
  const h = D.CARTA_ALTO;

  /*
   * Entrada y salida. La convención de los fotogramas del diseño es que el 0%
   * es el estado FINAL visible y el salto al inicial ocurre en el 0.01%: si el
   * reloj de animación no corre —una captura, una pestaña de fondo— el HUD se
   * ve completo en lugar de vacío. Con el desfase entre tarjetas eso tiene una
   * consecuencia que se ve: durante sus 38 milisegundos de espera, la tarjeta
   * está entera en pantalla y solo entonces salta a su sitio de partida.
   */
  let opacidad: f64 = 1;
  let dx: f64 = 0;
  const fuera = der ? 70.0 : -70.0;

  if (c.visible == S.V_ENTRANDO || c.visible == S.V_SALIENDO) {
    const t = (ahora - c.tMueve - <f64>k * D.MS_DESFASE) / D.MS_MUEVE;
    if (c.visible == S.V_ENTRANDO) {
      opacidad = fotogramas(t, K_ENTRA, K_ENTRA_ALFA, SISTEMA);
      unchecked(P3[0] = 0); unchecked(P3[1] = fuera); unchecked(P3[2] = 0);
      dx = fotogramas(t, K_ENTRA, P3, SISTEMA);
    } else {
      opacidad = fotogramas(t, K_SALE, K_SALE_ALFA, SISTEMA);
      unchecked(P2[0] = 0); unchecked(P2[1] = fuera);
      dx = fotogramas(t, K_SALE, P2, SISTEMA);
    }
  }

  if (opacidad <= 0.001) return;

  guarda();
  alfa(opacidad);
  traslada(dx, 0);

  /* El golpe seco de la baja: reconoce que alguien cayó sin robarle atención
     al juego. Va en la tarjeta del que cae y solo en esa. */
  const avBaja = c.baja.avance(ahora);
  if (avBaja >= 0 && c.visible == S.V_VISIBLE) {
    const s = fotogramas(avBaja, K_BAJA, K_BAJA_ESCALA, REBOTE);
    const cx = x + w * 0.5;
    const cy = y + h * 0.5;
    traslada(cx, cy);
    escala(s, s);
    traslada(-cx, -cy);
  }

  const panelW = w - (D.ULTI - D.ULTI_SOLAPE);
  const panelX = der ? x : x + (D.ULTI - D.ULTI_SOLAPE);
  const ultiX = der ? x + w - D.ULTI : x;

  pintaPanel(lado, k, panelX, y, panelW, ahora);
  pintaInsignia(lado, k, ultiX, y + (h - D.ULTI) * 0.5, ahora);

  restaura();
}

function pintaPanel(lado: i32, k: i32, x: f64, y: f64, w: f64, ahora: f64): void {
  const c = S.carta(lado, k);
  const der = lado == 1;
  const muerto = c.muerto.valor(ahora);
  const vivo = S.jVivo(lado, k);

  guarda();
  recorteRR(x, y, w, D.CARTA_ALTO, D.R);

  /* Fondo del panel: gris en diagonal a 160°, que se apaga al morir. */
  D.lineaGradiente(160, w, D.CARTA_ALTO);
  unchecked(P2[0] = 0); unchecked(P2[1] = 1);
  unchecked(C2[0] = entre(D.PANEL_A, D.PANEL_MUERTO_A, muerto));
  unchecked(C2[1] = entre(D.PANEL_B, D.PANEL_MUERTO_B, muerto));
  rectGrad(x, y, w, D.CARTA_ALTO, 0,
    x + unchecked(D.gradX0[0]), y + unchecked(D.gradX0[1]),
    x + unchecked(D.gradX0[2]), y + unchecked(D.gradX0[3]), P2, C2);

  /* El filo claro de arriba. No transiciona: el diseño no lo declara. */
  rect(x, y, w, 1, 0, D.FILO);

  pintaCabecera(lado, k, x, y, w, ahora);
  pintaPie(lado, k, x, y + D.CAB_ALTO, w, ahora);

  /*
   * El foco del observado se cruza, no salta. En emisión la cámara cambia cada
   * pocos segundos, y un resplandor ámbar que aparece de golpe en otro sitio
   * de la pantalla tira del ojo más que el propio juego.
   *
   * Las tres sombras del diseño se pintan en orden inverso: en CSS, la primera
   * de la lista queda por encima.
   */
  const foco = c.foco.valor(ahora);
  if (foco > 0.001) {
    brilloInt(x, y, w, D.CARTA_ALTO, D.R, 34, porAlfa(rgba(255, 200, 87, 56), foco));
    brilloInt(x, y, w, D.CARTA_ALTO, D.R, 16, porAlfa(rgba(255, 200, 87, 115), foco));
    trazoRR(x, y, w, D.CARTA_ALTO, D.R, 2, porAlfa(D.OBSERVADO, foco));
  }

  /* El destello de daño cubre la tarjeta entera, no la fila de vida: el CSS
     dice "destello blanco sobre el retrato". */
  const avDano = c.dano.avance(ahora);
  if (avDano >= 0) {
    const a = fotogramas(avDano, K_DANO, K_DANO_ALFA, EASE_OUT);
    if (a > 0.001) rect(x, y, w, D.CARTA_ALTO, D.R, conAlfa(D.BLANCO, a));
  }

  restaura();
}

/* ── Cabecera ────────────────────────────────────────────────────────────── */

function pintaCabecera(lado: i32, k: i32, px: f64, py: f64, pw: f64, ahora: f64): void {
  const c = S.carta(lado, k);
  const der = lado == 1;
  const gris = c.muertoRetrato.valor(ahora);

  /* Retrato del agente, degradado hacia abajo para que no compita con los
     datos. Al morir pierde el color y casi toda la presencia. */
  const rx = der ? px + pw - D.RETRATO_ANCHO : px;
  retrato(S.jAgente(lado, k), rx, py, D.RETRATO_ANCHO, D.CAB_ALTO,
    mezcla(0.9, 0.4, gris), gris, 0.42, 1.0, 1.0, 0.45);

  /* La caja de texto: 60px de margen para dejar respirar el retrato, y
     recorta lo que se salga. */
  const tx = der ? px + 14 : px + 73;
  const tw = pw - 87;
  if (tw <= 0) return;

  guarda();
  recorteRR(tx, py, tw, D.CAB_ALTO, 0);

  /* Dos filas con 4px entre ellas, centradas en los 58 de alto. */
  const alturaTexto = 21.0 + 4.0 + 22.0;
  const arriba = py + (D.CAB_ALTO - alturaTexto) * 0.5;

  pintaFila(lado, k, tx, arriba, tw);
  pintaVida(lado, k, tx, arriba + 25.0, tw, ahora);

  restaura();
}

function pintaFila(lado: i32, k: i32, x: f64, y: f64, w: f64): void {
  const der = lado == 1;
  const vivo = S.jVivo(lado, k);
  const centro = y + 10.5;

  const hayOjo = S.jObservado(lado, k);
  const haySpike = S.jSpike(lado, k);

  const idKda = S.jKda(lado, k);
  const anchoKda = medir(idKda, D.F_KDA);

  /*
   * El nombre es el único que cede. Tiene un tope de 132px, y si aun así no
   * cabe se encoge: el hueco elástico tiene base cero, así que no absorbe
   * nada del recorte. Cuando ya no cabe, se corta con puntos suspensivos.
   */
  let fijo = anchoKda;
  if (hayOjo) fijo += 16 + 6;
  if (haySpike) fijo += 20 + 6;
  fijo += 6 + 6;   // el hueco antes y después del elástico

  const idNick = S.jNick(lado, k);
  let anchoNick = medir(idNick, D.F_NICK);
  if (anchoNick > 132) anchoNick = 132;
  const sitio = w - fijo;
  if (anchoNick > sitio) anchoNick = sitio > 0 ? sitio : 0;

  const idNickCorto = recorta(idNick, D.F_NICK, anchoNick);

  /* Se recorre en el orden visual de cada lado: la fila de la derecha es el
     espejo exacto. */
  let cursor = der ? x + w : x;
  const paso = der ? -1.0 : 1.0;

  if (hayOjo) {
    const ix = der ? cursor - 16 : cursor;
    imagen(S.imgOjo(), ix, centro - 8, 16, 16, 1, 0, 0);
    cursor += paso * (16 + 6);
  }

  /*
   * El nombre se pinta pegado al INICIO de su caja, también en la tarjeta de
   * la derecha. Es lo que hace el CSS —`text-align` no se toca, así que vale
   * `start`— y se nota justo cuando hay recorte: la caja mide lo que le dejan,
   * pero el texto cortado mide menos, y alinearlo por el otro lado lo deja
   * flotando lejos del nombre. Con nombres cortos no se ve; con uno largo, la
   * columna derecha entera se descoloca.
   */
  const cajaNick = der ? cursor - anchoNick : cursor;
  const colorNick = vivo ? D.TEXTO_BASE : D.TEXTO_TENUE;
  texto(idNickCorto, D.F_NICK, cajaNick, baseEnCentro(centro, D.F_NICK), colorNick, IZQ);
  cursor += paso * (anchoNick + 6);

  if (haySpike) {
    /* El portador: pastilla clara con el icono en tinta. */
    const sx = der ? cursor - 20 : cursor;
    unchecked(P2[0] = 0); unchecked(P2[1] = 1);
    unchecked(C2[0] = D.BLANCO); unchecked(C2[1] = D.TEXTO_3);
    rectGrad(sx, centro - 10, 20, 20, 3, sx, centro - 10, sx, centro + 10, P2, C2);
    imagen(S.imgSpike(), sx + 2, centro - 8, 16, 16, 1, 0, 0);
  }

  texto(idKda, D.F_KDA, der ? x : x + w, baseEnCentro(centro, D.F_KDA),
    D.TEXTO_3, der ? IZQ : DER);
}

/**
 * La fila de vida.
 *
 *   vivo y con dato → escudo + cifra + barra
 *   vivo y SIN dato → escudo + cartel, nunca un 0
 *   muerto          → escudo apagado + 0, sin barra
 *
 * El caso del medio es el que importa: el observador no manda la vida de quien
 * no tiene su cliente puesto, y un cero ahí se lee como una baja.
 */
function pintaVida(lado: i32, k: i32, x: f64, y: f64, w: f64, ahora: f64): void {
  const c = S.carta(lado, k);
  const der = lado == 1;
  const vivo = S.jVivo(lado, k);
  const conDato = vivo && S.jVidaConocida(lado, k);
  const centro = y + 11;

  const escudo = S.jEscudo(lado, k);
  const colorEscudo = escudo == 0 ? D.ESCUDO_SIN : D.colorBando(lado);
  const colorCifra = escudo == 0 ? D.TEXTO_3 : D.colorBando(lado);

  const ex = der ? x + w - 19 : x;
  ruta(D.RUTA_ESCUDO, ex, y, 19, 22, 1, 3, colorEscudo);
  texto(S.jTextoEscudo(lado, k), D.F_ESCUDO, ex + 9.5,
    baseEnCentro(y + 10, D.F_ESCUDO), colorCifra, CENTRO);

  const paso = der ? -1.0 : 1.0;
  let cursor = (der ? x + w : x) + paso * (19 + 7);

  if (vivo && !conDato) {
    /* El cartel: lo que no se sabe no se pinta. */
    const id = S.textoSinDato();
    const ancho = medir(id, D.F_SIN_DATO) + 10;
    const alto = metrica(D.F_SIN_DATO, INTERLINEA) + 4;
    const sx = der ? cursor - ancho : cursor;
    rect(sx, centro - alto * 0.5, ancho, alto, 0, D.SIN_DATO_FONDO);
    texto(id, D.F_SIN_DATO, sx + 5, baseEnCentro(centro, D.F_SIN_DATO), D.SIN_DATO_COLOR, IZQ);
    return;
  }

  /* La cifra vive en una caja fija de 40px. La tarjeta de la derecha la alinea
     hacia su propio filo, que es el de fuera. */
  const nx = der ? cursor - 40 : cursor;
  texto(S.jTextoVida(lado, k), D.F_VIDA, der ? nx + 40 : nx,
    baseEnCentro(centro, D.F_VIDA), D.TEXTO_BASE, der ? DER : IZQ);
  cursor += paso * (40 + 7);

  if (!conDato) return;

  /* La barra. El relleno crece desde el filo de fuera, como la tarjeta. */
  const anchoBarra = w - 73;
  if (anchoBarra < 24) return;
  const bx = der ? cursor - anchoBarra : cursor;
  const by = centro - 4;

  unchecked(P2[0] = 0); unchecked(P2[1] = 1);
  unchecked(C2[0] = D.BARRA_FONDO_A); unchecked(C2[1] = D.BARRA_FONDO_B);
  rectGrad(bx, by, anchoBarra, 8, 2, bx, by, bx, by + 8, P2, C2);

  const pct = c.vida.valor(ahora) / 100.0;
  const relleno = anchoBarra * (pct < 0 ? 0 : (pct > 1 ? 1 : pct));
  if (relleno <= 0) return;

  const rx = der ? bx + anchoBarra - relleno : bx;
  unchecked(P2[0] = 0); unchecked(P2[1] = 1);
  unchecked(C2[0] = D.colorClaro(lado)); unchecked(C2[1] = D.colorBando(lado));
  rectGrad(rx, by, relleno, 8, 2, rx, by, rx, by + 8, P2, C2);
}

/* ── Pie ─────────────────────────────────────────────────────────────────── */

function pintaPie(lado: i32, k: i32, px: f64, py: f64, pw: f64, ahora: f64): void {
  const c = S.carta(lado, k);
  const der = lado == 1;
  const vivo = S.jVivo(lado, k);

  /*
   * La franja del bando. Aquí el color del equipo es FONDO, no acento: es la
   * única pieza del HUD donde el bando ocupa superficie.
   *
   * Al morir se apaga DE GOLPE, sin los 450ms que declara la hoja de estilos.
   * No es un descuido: es lo que hace el navegador. El degradado del vivo va a
   * 90 grados y el del muerto a 180, y dos degradados que no coinciden en
   * ángulo no se pueden interpolar, así que la transición sencillamente no
   * corre. Se ve en el banco: a los 60ms de una baja, el pie de la versión DOM
   * ya está gris del todo.
   *
   * El panel sí se apaga suave, y por el mismo motivo al revés: sus dos
   * degradados van los dos a 160 grados y solo cambian de color.
   *
   * Si algún día el diseño quiere que el pie también se funda, basta con que
   * los dos degradados compartan ángulo; entonces esto vuelve a `muerto`.
   */
  const apagado = vivo ? 0.0 : 1.0;
  const angulo = vivo ? 90.0 : 180.0;
  D.lineaGradiente(angulo, pw, D.PIE_ALTO);
  unchecked(P2[0] = 0); unchecked(P2[1] = 1);
  unchecked(C2[0] = entre(D.pieIzquierda(lado), D.PIE_MUERTO_A, apagado));
  unchecked(C2[1] = entre(D.pieDerecha(lado), D.PIE_MUERTO_B, apagado));
  rectGrad(px, py, pw, D.PIE_ALTO, 0,
    px + unchecked(D.gradX0[0]), py + unchecked(D.gradX0[1]),
    px + unchecked(D.gradX0[2]), py + unchecked(D.gradX0[3]), P2, C2);

  /* El filo de arriba del pie no transiciona: el diseño no lo declara, así que
     cambia de golpe al morir. */
  rect(px, py, pw, 1, 0, vivo ? D.FILO_PIE : D.FILO_PIE_MUERTO);

  const centro = py + D.PIE_ALTO * 0.5;
  const paso = der ? -1.0 : 1.0;
  const dentroIzq = px + (der ? 14 : 16);
  const dentroDer = px + pw - (der ? 16 : 14);
  let cursor = der ? dentroDer : dentroIzq;

  /* Los tres huecos: C, Q, E. El muerto pierde habilidades y arma, conserva el
     crédito. */
  for (let h = 0; h < 3; h++) {
    if (!S.jHabHay(lado, k, h)) continue;
    const cuantos = max(1, S.jHabMax(lado, k, h));
    const anchoCargas = <f64>cuantos * 4.0 + <f64>(cuantos - 1) * 3.0;
    const ancho = anchoCargas > 17 ? anchoCargas : 17.0;
    const hx = der ? cursor - ancho : cursor;

    /* Icono en tinta. Al gastarse una carga da un pulso corto. */
    const av = c.habs[h].avance(ahora);
    const s = av >= 0 ? fotogramas(av, K_HAB, K_HAB_ESCALA, SISTEMA) : 1.0;
    const icx = hx + ancho * 0.5;
    const icy = py + 3 + 8.5;

    guarda();
    if (s != 1.0) { traslada(icx, icy); escala(s, s); traslada(-icx, -icy); }
    imagen(S.jHabImagen(lado, k, h), icx - 8.5, icy - 8.5, 17, 17,
      S.jHabTiene(lado, k, h) == 0 ? 0.2 : 0.92, TINTE_NEGRO, 0);
    restaura();

    /* Rombos de carga: uno por uso disponible. */
    let rx = hx + (ancho - anchoCargas) * 0.5;
    for (let q = 0; q < cuantos && q < S.MAX_CARGAS; q++) {
      const color = unchecked(c.rombos[h * S.MAX_CARGAS + q]).valor(ahora);
      guarda();
      traslada(rx + 2, py + 3 + 17 + 3 + 2);
      rota(Math.PI * 0.25);
      rect(-2, -2, 4, 4, 1, color);
      restaura();
      rx += 7;
    }

    cursor += paso * (ancho + 8);
  }

  /* Arma y crédito viven pegados al filo contrario. El cañón apunta al centro
     de la pantalla: el arte base mira a la izquierda. */
  let finCursor = der ? dentroIzq : dentroDer;
  const idArma = vivo ? S.jArma(lado, k) : -1;
  if (idArma >= 0) {
    const ax = der ? finCursor : finCursor - 76;
    imagen(idArma, ax, centro - 8.5, 76, 17, 0.9, TINTE_NEGRO, CONTENER | (der ? 0 : ESPEJO));
    finCursor += (der ? 1.0 : -1.0) * (76 + 4 + 8);
  } else {
    /* Sin arma no hay hueco: el elástico se lo come. */
    finCursor += 0;
  }

  const idCredito = S.jCredito(lado, k);
  const anchoNum = medir(idCredito, D.F_CREDITO);
  const anchoCredito = 10 + 4 + anchoNum;
  const cx = der ? finCursor : finCursor - anchoCredito;
  imagen(S.imgCreditos(), cx, centro - 5, 10, 10,
    vivo ? 0.82 : 0.6, vivo ? TINTE_NEGRO : TINTE_BLANCO, 0);
  texto(idCredito, D.F_CREDITO, cx + 14, baseEnCentro(centro, D.F_CREDITO),
    vivo ? D.NEGRO_PIE : D.BLANCO, IZQ);
}

/* ── La insignia de definitiva ───────────────────────────────────────────── */

/*
 * Tiene tantos lados como puntos cuesta la definitiva: seis puntos, hexágono;
 * ocho, octógono. Es una forma de decir el coste sin escribir un número.
 */
function pintaInsignia(lado: i32, k: i32, x: f64, y: f64, ahora: f64): void {
  const c = S.carta(lado, k);
  const vivo = S.jVivo(lado, k);
  const lados = max(3, S.jUltMax(lado, k));
  const lista = S.jUlt(lado, k) >= S.jUltMax(lado, k) && vivo;
  const cx = x + D.ULTI * 0.5;
  const cy = y + D.ULTI * 0.5;

  /* Halo fijo cuando está lista. Nada de parpadeo: en directo, lo que late
     molesta. */
  if (lista) {
    unchecked(P3[0] = 0); unchecked(P3[1] = 0.5); unchecked(P3[2] = 0.76);
    unchecked(C3[0] = rgba(255, 255, 255, 153));
    unchecked(C3[1] = rgba(255, 255, 255, 77));
    unchecked(C3[2] = rgba(255, 255, 255, 0));
    /* El degradado llega hasta la esquina de su caja de 64; el redondeo del
       50% lo recorta a 32 antes de desenfocar. */
    radial(cx, cy, 32.0 * Math.SQRT2, 3, 32, P3, C3);
  }

  /* El trazo: el polígono oscuro que hace de borde. */
  D.poligono(lados, x - 5, y - 5, 60);
  poli(D.contorno, D.puntos(), D.INSIGNIA_FONDO);

  /* Los tramos del anillo, cada uno con su color interpolado. */
  for (let j = 0; j < lados && j < S.MAX_TRAMOS; j++) {
    D.tramoInsignia(j, lados, x, y, D.ULTI);
    poli(D.contorno, D.puntos(), unchecked(c.tramos[j]).valor(ahora));
  }

  /* El fogonazo: un anillo que se abre una vez y se apaga. */
  const av = c.fogonazo.avance(ahora);
  if (av >= 0) {
    const t = curva(SISTEMA, av);
    const s = mezcla(1.0, 2.5, t);
    const a = mezcla(0.9, 0.0, t);
    if (a > 0.002) anillo(cx, cy, 30.0 * s, 2.0 * s, conAlfa(D.BLANCO, a));
  }

  /* El centro y el icono. */
  D.poligono(lados, x + 6.5, y + 6.5, 37);
  poli(D.contorno, D.puntos(), D.INSIGNIA_FONDO);
  imagen(S.jUltiIcono(lado, k), cx - 12, cy - 12, 24, 24, 1, TINTE_BLANCO, 0);
}
