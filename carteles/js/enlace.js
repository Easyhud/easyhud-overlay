/* El enlace con el servidor, compartido por los tres carteles.
   ============================================================

   Los tres —ceremonia, pausa y aviso— son la misma caja con tres contenidos,
   así que comparten también la fontanería: una conexión, el estado y los
   sucesos. Cada pantalla solo pone qué mira y qué escribe dentro.

   ## Lo que estas pantallas tienen de distinto

   El overlay de combate está **siempre** en pantalla; estos están **casi
   nunca**. Su trabajo de verdad no es pintar: es aparecer en el momento justo
   y, sobre todo, **irse**. Un cartel que se queda puesto tapa el juego.

   Por eso aquí lo importante no son los datos sino el ciclo: entrar, durar lo
   que tenga que durar, salir, y quedarse escondido. */

import { coloresDeBando, esMinimo, etiquetaRonda, serieDeMapas } from '../../comun/partida.js';
import { abreFuente } from '../../comun/fuente.js';

/** Duración de las animaciones del paquete de diseño. */
export const MS_MOVER = 700;

/**
 * Conecta y llama a `alEstado` y `alSuceso` según llegue.
 *
 * La fuente es el servidor (ver `comun/fuente.js`): entrega el mismo contrato
 * `match` de siempre y deduce los sucesos (fin de ronda con su ceremonia). Las
 * dos llamadas son opcionales: la pausa y el aviso solo miran el estado, y la
 * ceremonia solo los sucesos. La reconexión la lleva socket.io.
 *
 * @param {{ alEstado?: (match: any) => void, alSuceso?: (evento: any) => void }} oyentes
 */
export function conecta({ alEstado, alSuceso }) {
  abreFuente({
    onMatch: (match) => alEstado?.(match),
    onEvents: (eventos) => eventos.forEach((e) => alSuceso?.(e)),
  });
}

/**
 * El ciclo de un cartel: entrar, quedarse, salir.
 *
 * Se maneja con las dos clases que define el diseño sobre `.escenario`, y con
 * una regla que no está escrita en ningún sitio y es la que importa:
 * **mientras el cartel se mueve, no se le cambia el contenido.** Reescribir
 * dentro de un elemento que está animándose reinicia lo que herede la
 * animación, y el cartel se queda temblando sin llegar a entrar. Es el mismo
 * fallo que ya mordió en la insignia de la ulti y en el tablero de compra.
 */
export function cartel(selector = '.escenario') {
  /** @type {HTMLElement} */
  const escenario = document.querySelector(selector);
  let visible = false;
  let moviendo = false;
  let temporizador;

  const fin = (ocultar) => {
    moviendo = false;
    escenario.classList.remove('es-entra', 'es-sale');
    if (ocultar) escenario.style.visibility = 'hidden';
  };

  return {
    /** ¿Está el cartel puesto? */
    get puesto() { return visible; },
    /** ¿Se está moviendo ahora mismo? Si sí, no se le escribe dentro. */
    get quieto() { return !moviendo; },

    /** Lo esconde sin animar. Para el arranque. */
    escondeYa() {
      clearTimeout(temporizador);
      visible = false;
      fin(true);
    },

    entra() {
      if (visible) return;
      visible = true;
      clearTimeout(temporizador);
      escenario.style.visibility = '';
      escenario.classList.remove('es-sale');
      escenario.classList.add('es-entra');
      moviendo = true;
      temporizador = setTimeout(() => fin(false), MS_MOVER);
    },

    sale() {
      if (!visible) return;
      visible = false;
      clearTimeout(temporizador);
      escenario.classList.remove('es-entra');
      escenario.classList.add('es-sale');
      moviendo = true;
      temporizador = setTimeout(() => fin(true), MS_MOVER);
    },
  };
}

/**
 * Cambia el color del cartel.
 *
 * El diseño lo lee de `--c` y `--cl` en el estilo en línea, así que quien
 * emite decide: el color del equipo que pide el tiempo muerto, gris en la
 * pausa técnica, verde fijo en la ronda ganada.
 *
 * `bando` es el del equipo AHORA (`attack`/`defense`): el color de un equipo
 * sigue a su bando, no a su lado de pantalla (ver `coloresDeBando`). Sin él,
 * por lado, como antes.
 */
export function tinta(nodo, lado, bando) {
  if (lado === null) {
    nodo.style.setProperty('--c', '#6a6f7a');
    nodo.style.setProperty('--cl', '#9aa0ab');
    return;
  }
  const color = coloresDeBando(bando, lado);
  nodo.style.setProperty('--c', color.c);
  nodo.style.setProperty('--cl', color.cl);
}

/**
 * Ajusta el tamaño de un texto grande para que quepa en el cartel.
 *
 * Los carteles ponen el dato principal a 64 px, en una sola línea y en
 * mayúsculas: cabe un nombre de equipo, no un título de aviso de 40 letras, que
 * se cortaba por la mitad en pantalla. Aquí se encoge según su longitud (con un
 * mínimo de 26 px) y, si aun así es larguísimo, se deja partir en dos líneas.
 * Es una estimación por caracteres a propósito: medir el texto dentro de un
 * lienzo escalado con `zoom` da cifras distintas según el navegador.
 *
 * @param {HTMLElement | null} nodo
 * @param {string} texto
 * @param {number} ancho Los píxeles de ancho de que dispone, ya sin el relieve.
 */
export function ajustaTexto(nodo, texto, ancho = 600) {
  if (nodo === null) return;
  nodo.textContent = texto;
  const PX_POR_LETRA = 0.54; // Oswald 700 en mayúsculas, con su espaciado
  const cabe = Math.floor(ancho / (PX_POR_LETRA * Math.max(1, texto.length)));
  const tam = Math.max(26, Math.min(64, cabe));
  nodo.style.fontSize = tam >= 64 ? '' : `${tam}px`;
  const largo = tam === 26 && texto.length * PX_POR_LETRA * 26 > ancho;
  nodo.style.whiteSpace = largo ? 'normal' : '';
  nodo.style.maxWidth = largo ? `${ancho}px` : '';
  nodo.style.lineHeight = largo ? '1.08' : '';
}

/** Pone el mismo logo en todas las capas del relieve, o las apaga. */
export function relieve(contenedor, url) {
  if (contenedor === null) return;
  for (const capa of contenedor.querySelectorAll('i')) {
    capa.style.backgroundImage = url === '' ? '' : `url(${url})`;
  }
  contenedor.style.visibility = url === '' ? 'hidden' : '';
}


/* ── La barra superior ───────────────────────────────────────────────────── */

/**
 * El marcador de arriba: trigramas, tantos, logos y la ronda.
 *
 * Es la misma pieza que en combate y **se queda siempre**, no entra ni sale
 * con el cartel. Por eso vive fuera del ciclo de animación: las clases de
 * entrada solo tocan `.cartel` y `.patro`.
 *
 * **Cuidado al componer la escena de OBS**: si dos fuentes dibujan la barra a
 * la vez, se solapan. La de combate ya la lleva. Con `&barra=0` en la
 * dirección se apaga la de esta pantalla.
 *
 * Y se apaga también con el **modo mínimo**, que lo conmuta el operador desde
 * su panel: entonces la franja de arriba es del realizador y esta barra
 * estorba. La diferencia con `&barra=0` es quién decide y cuándo: `barra=0`
 * se pone al montar la escena y no cambia; el modo mínimo se conmuta en
 * mitad de la emisión, así que no puede apagar los nodos de una vez, tiene
 * que poder volver.
 */
export function barra() {
  /** @type {HTMLElement | null} */
  const raiz = document.querySelector('.marcador');
  /** @type {HTMLElement | null} */
  const chip = document.querySelector('.ronda-chip');
  const apagada = new URLSearchParams(location.search).get('barra') === '0';

  if (raiz === null) return () => {};

  if (apagada) {
    raiz.style.display = 'none';
    if (chip !== null) chip.style.display = 'none';
    /** @type {NodeListOf<HTMLElement>} */
    const aletas = document.querySelectorAll('.aleta');
    for (const aleta of aletas) aleta.style.display = 'none';
    /** @type {NodeListOf<HTMLElement>} */
    const series = document.querySelectorAll('.serie');
    for (const serie of series) serie.style.display = 'none';
    return () => {};
  }

  const cajas = [...raiz.querySelectorAll('.equipo')];

  return (match) => {
    /** @type {NodeListOf<HTMLElement>} */
    const piezas = document.querySelectorAll('.marcador, .ronda-chip, .aleta, .serie');
    const minimo = esMinimo(match);
    for (const pieza of piezas) pieza.style.visibility = minimo ? 'hidden' : '';

    match.teams.forEach((team, i) => {
      const caja = cajas[i];
      if (caja === undefined) return;

      /** @type {HTMLElement | null} */
      const logo = caja.querySelector('.equipo__logo');
      if (logo !== null) {
        logo.style.backgroundImage = team.logoUrl === '' ? '' : `url(${team.logoUrl})`;
      }
      caja.style.setProperty('--c', coloresDeBando(team.side, i).c);
      const tri = caja.querySelector('.equipo__tricode');
      if (tri !== null) tri.textContent = team.shortName;
      const tanto = caja.querySelector('.equipo__tanto');
      if (tanto !== null) tanto.textContent = String(team.roundsWon);
    });

    if (chip !== null) chip.textContent = etiquetaRonda(match);

    /*
     * Los marcadores de serie, si esta pantalla los tiene.
     *
     * El marcado de la pausa y del aviso **no los trae**: su franja de
     * arriba es la corta, sin marcadores de serie. Esto se queda quieto si
     * no los encuentra, y funciona el día que el diseño los añada —o en
     * cualquier otra pantalla que reuse esta barra— sin tocar nada.
     */
    const mapas = serieDeMapas(match);
    [0, 1].forEach((i) => {
      /** @type {HTMLElement | null} */
      const franja = document.querySelector(i === 0 ? '.serie--izq' : '.serie--der');
      if (franja === null) return;
      franja.style.setProperty('--cl', coloresDeBando(match.teams?.[i]?.side, i).cl);
      const estados = mapas.estados[i] ?? [];
      const cuantos = mapas.cuantos <= 1 ? 0 : estados.length;

      if (franja.children.length !== cuantos) {
        franja.textContent = '';
        for (let k = 0; k < cuantos; k += 1) franja.append(document.createElement('i'));
      }
      [...franja.children].forEach((marca, k) => {
        marca.classList.toggle('on', estados[k] === 'gana');
        marca.classList.toggle('en-curso', estados[k] === 'en-curso');
      });
    });
  };
}
