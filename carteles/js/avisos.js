/* AVISOS — el rótulo del operador, los patrocinadores y la marca de agua.
   =======================================================================

   Tres cosas que comparten pantalla y no comparten ciclo:

   - **El rótulo** lo enciende y lo apaga el operador desde su panel. Va con
     el estado, como la pausa.
   - **Los patrocinadores** se relevan solos mientras haya más de uno, estén
     o no el rótulo.
   - **La marca de agua** no se mueve nunca.
*/

import { barra, cartel, conecta, relieve, tinta } from './enlace.js';

/*
 * El cartel esconde SOLO el cartel, no el escenario.
 *
 * La barra de arriba se queda siempre —es la misma pieza que en combate— y
 * si se escondiera el escenario entero se iría con él. Las clases de entrada
 * del diseño solo tocan `.cartel` y `.patro`, así que esto no rompe nada.
 */
const caja = cartel('.cartel');
const pintaBarra = barra();
const nodo = document.querySelector('.cartel');
const titulo = document.getElementById('titulo');
const etiqueta = document.getElementById('etiqueta');
const texto = document.getElementById('texto');
const marca = document.getElementById('marca');
/** @type {HTMLElement | null} */
const patro = document.querySelector('.patro');
const agua = document.querySelector('.marca-agua');
const fondo = document.querySelector('.cartel__fondo > div');

caja.escondeYa();

/* ── El rótulo ───────────────────────────────────────────────────────────── */

function pinta(match, toast) {
  const equipo = toast.teamIndex === null ? null : match.teams[toast.teamIndex];

  /*
   * Con equipo, su color y su logo; sin equipo, gris y sin logo. Es la misma
   * regla que la pausa: lo que lo pide decide de qué color va.
   */
  tinta(nodo, equipo === null || equipo === undefined ? null : toast.teamIndex);
  relieve(fondo, equipo?.logoUrl ?? '');

  if (titulo !== null) titulo.textContent = toast.title;
  if (etiqueta !== null) {
    etiqueta.textContent = equipo?.name ?? match.broadcast?.tournamentName ?? '';
  }
  if (texto !== null) texto.textContent = toast.message;
}

/* ── Los patrocinadores ──────────────────────────────────────────────────── */

let marcas = [];
let cual = 0;
let releva;

/**
 * El nodo que lleva el fundido del relevo. El contenido va dentro de el.
 *
 * @type {HTMLElement | null}
 */
const hueco = document.querySelector('.patro__hueco');

/**
 * Pinta el logo que toca ahora.
 *
 * Escribe DENTRO de `.patro__marca`, nunca sobre `.patro__hueco`: el hueco es
 * el que lleva el fundido, y tocarlo relanzaría su animación desde cero en
 * cada relevo.
 */
function ensenaActual() {
  if (marca === null || marcas.length === 0) return;
  marca.textContent = '';
  const url = marcas[cual % marcas.length];
  /* Llegan como direcciones de imagen, pero el diseño deja un hueco de texto:
     si no parece una imagen, se escribe tal cual. */
  if (/^(https?:|\.|\/)/.test(url)) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    img.style.maxHeight = '26px';
    marca.append(img);
  } else {
    marca.textContent = url;
  }
}

/** Pasa al siguiente logo. Se llama al cerrar el ciclo del fundido. */
function pasaPagina() {
  cual += 1;
  ensenaActual();
}

/**
 * Se relevan de uno en uno.
 *
 * Con uno solo no se releva nada: cambiar un logo por sí mismo es un
 * parpadeo sin motivo. Con ninguno, el bloque desaparece.
 */
function patrocinio(config) {
  const nuevas = config?.enabled === true ? (config.urls ?? []) : [];
  const cada = config?.rotateMs ?? 8000;

  if (JSON.stringify(nuevas) === JSON.stringify(marcas)) return;
  marcas = nuevas;
  cual = 0;
  clearInterval(releva);

  if (patro !== null) patro.style.visibility = marcas.length === 0 ? 'hidden' : '';
  if (marcas.length === 0) return;

  ensenaActual();
  if (marcas.length <= 1) {
    /* Con uno solo no hay relevo, así que tampoco fundido: dejarlo puesto
       haría que el único logo se desvaneciera y volviera sin motivo. */
    if (hueco !== null) {
      hueco.removeEventListener('animationiteration', pasaPagina);
      hueco.style.animation = 'none';
    }
    return;
  }
  if (hueco !== null) hueco.style.animation = '';

  /*
   * UN SOLO RELOJ, y el cambio en el instante en que no se ve.
   *
   * Antes habia dos: este intervalo cambiaba el logo cada `rotateMs` y el CSS
   * hacia su fundido en un bucle de 5 s fijos. Como no se hablaban, el logo
   * cambiaba a veces con el bloque a plena opacidad —un corte seco en pantalla—
   * y el bloque se desvanecia en momentos en que no cambiaba nada. Y el campo
   * «cada (ms)» del panel no gobernaba lo que el espectador ve, que es peor:
   * un campo que se deja escribir y no hace lo que dice.
   *
   * Ahora el fundido dura lo que el operador pide y **el relevo va colgado de
   * la propia animacion**: `animationiteration` salta exactamente al cerrar el
   * ciclo, que es el fotograma en que la opacidad es 0. El cambio no se ve
   * nunca, sin cuadrar dos temporizadores a mano.
   *
   * El nodo animado es `.patro__hueco` y el contenido va dentro, en
   * `.patro__marca`: escribir el contenido NO reinicia la animacion del padre.
   * Reiniciarla la relanzaria desde cero en cada relevo, que es la trampa que
   * ya nos ha costado tiempo en este repositorio.
   */
  const espera = Math.max(2000, cada);
  if (hueco !== null) {
    hueco.style.animationDuration = `${espera}ms`;
    hueco.removeEventListener('animationiteration', pasaPagina);
    hueco.addEventListener('animationiteration', pasaPagina);
  } else {
    /* Sin el nodo del fundido no hay a que colgarse: se releva a pelo antes
       que no relevar. */
    releva = setInterval(pasaPagina, espera);
  }
}

/* ── Estado ──────────────────────────────────────────────────────────────── */

conecta({
  alEstado: (match) => {
    pintaBarra(match);

    const emision = match.broadcast ?? {};
    patrocinio(emision.sponsors);
    if (agua !== null) agua.textContent = emision.watermark ?? '';

    const toast = emision.toast ?? { visible: false };
    if (!toast.visible) {
      caja.sale();
      return;
    }
    if (!caja.puesto) {
      pinta(match, toast);
      caja.entra();
      return;
    }
    if (caja.quieto) pinta(match, toast);
  },
});
