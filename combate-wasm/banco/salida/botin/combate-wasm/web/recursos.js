/* LO QUE EL WASM NO PUEDE TENER.
   =============================

   El módulo compone la pantalla entera sin saber ni una letra: no tiene
   tipografías, no tiene imágenes y no sabe formatear un número. Todo eso vive
   aquí, y el módulo lo pide por identificador.

   Es la costura obligatoria, no una concesión. Cuánto ocupa un nombre con
   Oswald a 17 píxeles y .03em de espaciado solo lo sabe el motor de texto del
   navegador; si se calculara a mano, el nombre largo se cortaría en un sitio
   distinto que en la versión DOM y el diff de píxeles lo cantaría.

   Todo lo de aquí se cachea con ganas: el wasm pregunta el ancho del mismo
   nombre sesenta veces por segundo y `measureText` no es gratis. */

/* ── Tipografías ─────────────────────────────────────────────────────────── */

/*
 * Las once fuentes del diseño, en el orden en que el wasm las nombra.
 *
 * El espaciado va en PÍXELES ya resueltos: el CSS lo escribe en `em` y un `em`
 * es el cuerpo de la fuente, así que .03em sobre 17px son 0.51px. Se resuelve
 * aquí porque `ctx.letterSpacing` quiere una longitud absoluta.
 *
 * ## Por qué las de Poppins llevan `system-ui` en medio
 *
 * Porque el HUD las pinta así, aunque no sea lo que el diseño quería.
 *
 * Las piezas con Poppins —el chip de ronda, el cartel de "sin dato" y la
 * marca de abajo— no declaran tipografía: la heredan del `body`, que en
 * `hud.css` es `'Poppins', system-ui, sans-serif`. Y Chrome, con `system-ui`
 * en la lista, se salta las fuentes web anteriores y usa la del sistema: esos
 * tres textos salen en Segoe UI, en producción también.
 *
 * Aquí se copia la pila TAL CUAL para que el lienzo resuelva lo mismo que el
 * DOM, que es de lo que va este port. Arreglarlo es quitar `system-ui` de esa
 * línea de `hud.css`, y entonces hay que quitarlo también de aquí: es un
 * cambio de diseño —los tres textos cambian de forma y de ancho— y no es cosa
 * de este fichero decidirlo.
 */
export const FUENTES = [
  { css: "500 17px Oswald, sans-serif", ls: 17 * 0.03, lh: "1.35", mayus: false },  // 0  nick
  { css: "500 14px Oswald, sans-serif", ls: 14 * 0.04, lh: "normal", mayus: false }, // 1  kda
  { css: "700 11px Oswald, sans-serif", ls: 0, lh: "normal", mayus: false },         // 2  escudo
  { css: "600 17px Oswald, sans-serif", ls: 0, lh: "1.2", mayus: false },            // 3  vida
  { css: "600 9px Poppins, system-ui, sans-serif", ls: 9 * 0.14, lh: "normal", mayus: true },   // 4  sin dato
  { css: "600 14px Oswald, sans-serif", ls: 0, lh: "1.2", mayus: false },            // 5  crédito
  { css: "600 21px Oswald, sans-serif", ls: 21 * 0.08, lh: "1", mayus: false },      // 6  trigrama
  { css: "700 29px Oswald, sans-serif", ls: 0, lh: "1", mayus: false },              // 7  tantos
  { css: "600 10px Poppins, system-ui, sans-serif", ls: 10 * 0.16, lh: "normal", mayus: true }, // 8  chip de ronda
  { css: "600 10px Poppins, system-ui, sans-serif", ls: 10 * 0.12, lh: "normal", mayus: true }, // 9  chip de spike
  { css: "600 12px Poppins, system-ui, sans-serif", ls: 12 * 0.14, lh: "normal", mayus: true }, // 10 marca
];

/**
 * Fuerza la carga de las once caras y espera a tenerlas.
 *
 * Hay que llamarla ANTES de medir nada, y es menos evidente de lo que parece:
 * `document.fonts.ready` no promete que las tipografías estén cargadas,
 * promete que no queda ninguna CARGA EN CURSO. En una página que todavía no ha
 * pintado una sola letra no hay ninguna carga en curso, así que resuelve
 * enseguida y con las tipografías sin pedir.
 *
 * Esto costó caro: las once medidas se tomaron con la fuente de reserva, se
 * cachearon, y todo el texto del HUD salió dos píxeles alto. La versión DOM no
 * tiene el problema porque allí las letras existen y el navegador pide la
 * fuente al encontrarlas.
 */
export async function precargaFuentes() {
  const muestra = "Hxgp0123456789/.·";
  await Promise.all(FUENTES.map((f) => document.fonts.load(f.css, muestra)));
  await document.fonts.ready;
}

/* ── La silueta del escudo ───────────────────────────────────────────────── */

/*
 * El CSS la lleva incrustada como una máscara SVG en línea. Es TRAZO y no
 * relleno: una silueta hueca.
 *
 * La caja original de 28×32 se lleva a los 19×22 del hueco, pero NO estirando:
 * un SVG sin `preserveAspectRatio` propio escala su `viewBox` sin deformarlo y
 * lo centra, y lo que sobra queda fuera y se recorta. Estirarlo dejaba el
 * escudo un píxel alto y con el trazo más fino de un lado.
 */
const ESCUDO = "M14 1.4 26.4 5.1v10.8c0 6.3-5 11.1-12.4 14.1C6.6 27 1.6 22.2 1.6 15.9V5.1Z";

export const RUTAS = [
  { ruta: new Path2D(ESCUDO), ancho: 28, alto: 32 },
];

/* ── El almacén ──────────────────────────────────────────────────────────── */

export class Recursos {
  constructor() {
    /** Cadenas internadas: el wasm solo maneja su índice. */
    this.textos = [];
    this.porTexto = new Map();

    /** Imágenes por identificador, y su fuente. */
    this.imagenes = [];
    this.porUrl = new Map();
    /** Siluetas teñidas ya horneadas, por `id|tinte`. */
    this.tenidas = new Map();

    /** Las rutas SVG del diseño, que el wasm también pide por identificador. */
    this.rutas = RUTAS;

    this.anchos = new Map();
    this.recortes = new Map();
    this.metricas = [];

    /** El sitio donde se pregunta por un ancho. Sin lienzo visible. */
    this.regla = document.createElement("canvas").getContext("2d");

    /** Datos que el wasm no puede llevar consigo pero necesita al formatear. */
    this.sitioSpike = "";

    this.pendientes = 0;
  }

  /* ── Textos ────────────────────────────────────────────────────────────── */

  /**
   * Devuelve el identificador de una cadena, creándolo si es nueva.
   *
   * Nunca se vacía. Lo que entra aquí son nombres, marcadores, créditos y
   * cifras de vida: unos cientos en una partida entera, y a cambio el ancho de
   * cada uno se mide una sola vez en toda la emisión.
   */
  texto(s) {
    if (s === null || s === undefined) return -1;
    const clave = String(s);
    let id = this.porTexto.get(clave);
    if (id === undefined) {
      id = this.textos.length;
      this.textos.push(clave);
      this.porTexto.set(clave, id);
    }
    return id;
  }

  /** La cadena tal como hay que pintarla, con el `text-transform` ya aplicado. */
  cadena(id, fuente) {
    const s = this.textos[id];
    if (s === undefined) return "";
    return FUENTES[fuente].mayus ? s.toLocaleUpperCase("es-ES") : s;
  }

  /* ── Medidas ───────────────────────────────────────────────────────────── */

  aplica(ctx, fuente) {
    const f = FUENTES[fuente];
    ctx.font = f.css;
    ctx.letterSpacing = f.ls + "px";
  }

  medir(id, fuente) {
    if (id < 0) return 0;
    const clave = id * 16 + fuente;
    const hecho = this.anchos.get(clave);
    if (hecho !== undefined) return hecho;
    this.aplica(this.regla, fuente);
    const w = this.regla.measureText(this.cadena(id, fuente)).width;
    this.anchos.set(clave, w);
    return w;
  }

  /**
   * Corta un texto a un ancho con puntos suspensivos, como `text-overflow`.
   *
   * Se busca a tientas quitando letras hasta que cabe, que es lo que hace el
   * navegador. El resultado se interna como un texto más, así que el wasm
   * recibe un identificador y no se entera de que hubo un corte.
   */
  recorta(id, fuente, ancho) {
    if (id < 0) return -1;
    if (this.medir(id, fuente) <= ancho + 0.01) return id;

    const clave = id + "|" + fuente + "|" + Math.round(ancho * 4);
    const hecho = this.recortes.get(clave);
    if (hecho !== undefined) return hecho;

    const s = this.textos[id];
    this.aplica(this.regla, fuente);
    const mayus = FUENTES[fuente].mayus;
    const cabe = (t) => this.regla.measureText(mayus ? t.toLocaleUpperCase("es-ES") : t).width <= ancho;

    let corte = "";
    for (let n = s.length - 1; n >= 0; n--) {
      const prueba = s.slice(0, n) + "…";
      if (cabe(prueba)) { corte = prueba; break; }
    }

    const nuevo = this.texto(corte);
    this.recortes.set(clave, nuevo);
    return nuevo;
  }

  /**
   * Dónde cae la línea base de una fuente, medido como lo mide CSS.
   *
   * Esto tuvo que rehacerse. La primera versión sacaba el ascendente y el
   * descendente de `measureText` y colocaba la base en
   * `centro - (asc+desc)/2 + asc`. Es la fórmula correcta, pero con los
   * números equivocados: los que devuelve el lienzo no son los que CSS usa
   * para el área de contenido de una línea, y todo el texto salía dos píxeles
   * alto. Dos píxeles en un nombre de diecisiete es un HUD distinto.
   *
   * Así que se mide donde vive la verdad: una línea de texto real, con un
   * hueco en línea de altura cero al principio. Ese hueco apoya su base en la
   * línea base, así que su posición ES la línea base.
   *
   * De ahí salen las tres medidas, y las tres son desplazamientos, no alturas:
   *
   *   0  del CENTRO de la caja a la base — vale para todo lo centrado
   *      verticalmente, que es casi todo el HUD.
   *   1  del BORDE SUPERIOR de la caja de línea a la base — el chip de ronda.
   *   2  lo alto que sale una línea suelta con ese interlineado.
   *
   * Se mide con el interlineado REAL de cada pieza, no con `normal`. Sobre el
   * papel daría igual —el interlineado reparte por igual arriba y abajo, así
   * que no debería mover la base—, pero el navegador redondea ese reparto a
   * píxeles enteros y entonces sí la mueve: casi un píxel entre `normal` y
   * 1.35 con Oswald a 17. Medir con otro interlineado fue exactamente el error
   * que dejaba todo el texto dos píxeles alto.
   */
  metrica(fuente, que) {
    let m = this.metricas[fuente];
    if (m === undefined) {
      const caja = document.createElement("div");
      caja.style.cssText = "position:absolute;top:-9999px;left:0;visibility:hidden;white-space:nowrap";
      /* El `font` abreviado reinicia el interlineado, así que el de verdad va
         después. Y va: el medio interlineado no se reparte en decimales, se
         redondea, de modo que la línea base NO cae en el mismo sitio con
         `normal` que con 1.35 aunque la caja esté centrada igual. */
      caja.style.font = FUENTES[fuente].css;
      caja.style.lineHeight = FUENTES[fuente].lh;
      const marca = document.createElement("span");
      marca.style.cssText = "display:inline-block;width:0;height:0";
      caja.append(marca, document.createTextNode("Hxgp"));
      document.body.appendChild(caja);

      const arriba = caja.getBoundingClientRect().top;
      const interlinea = caja.getBoundingClientRect().height;
      const base = marca.getBoundingClientRect().top - arriba;
      caja.remove();

      m = [base - interlinea / 2, base, interlinea];
      this.metricas[fuente] = m;
    }
    return m[que];
  }

  /* ── Textos que cambian cada fotograma ─────────────────────────────────── */

  /**
   * El único: el chip cuando la spike está plantada.
   *
   * La cuenta atrás la lleva el reloj del navegador desde el instante del
   * plantado, así que el texto cambia sesenta veces por segundo. Se compone
   * aquí porque el wasm no sabe escribir números, y se interna como cualquier
   * otro: a una décima de segundo hay 450 cadenas distintas en toda una ronda.
   */
  formatea(formato, valor) {
    if (formato === 1) {
      const sitio = this.sitioSpike === "" ? "" : " · " + this.sitioSpike;
      return this.texto("spike " + valor.toFixed(1) + sitio);
    }
    return this.texto(String(valor));
  }

  /* ── Imágenes ──────────────────────────────────────────────────────────── */

  /**
   * Reserva un identificador para una imagen y la empieza a cargar.
   *
   * Una URL vacía devuelve -1, y el wasm no emite orden ninguna. Es la misma
   * regla que en la versión DOM: una clave que no está en el catálogo deja el
   * hueco limpio en vez de pedir al CDN una dirección con `undefined` dentro y
   * pintar el icono roto.
   */
  imagen(url) {
    if (!url) return -1;
    let id = this.porUrl.get(url);
    if (id !== undefined) return id;

    id = this.imagenes.length;
    const img = new Image();
    img.crossOrigin = "anonymous";
    const entrada = { img, lista: false };
    this.imagenes.push(entrada);
    this.porUrl.set(url, id);

    this.pendientes++;
    img.onload = () => { entrada.lista = true; this.pendientes--; };
    img.onerror = () => { this.pendientes--; };
    img.src = url;
    return id;
  }

  lista(id) {
    const e = this.imagenes[id];
    return e !== undefined && e.lista;
  }

  fuente(id) {
    const e = this.imagenes[id];
    return e === undefined ? null : e.img;
  }

  /**
   * La versión teñida de una imagen: `brightness(0)` y `brightness(0) invert(1)`.
   *
   * Los iconos de habilidad, el arma y el crédito se pintan en tinta sobre la
   * franja del bando, y el de la definitiva en blanco sobre el centro oscuro.
   * Se hornean una vez a tamaño natural y se reutilizan; hacerlo por fotograma
   * con `ctx.filter` cuesta diez veces más.
   */
  tenida(id, tinte) {
    /* Hornear una imagen que aún no ha cargado deja un lienzo en blanco
       cacheado para siempre. Mejor no dibujar este fotograma. */
    if (!this.lista(id)) return null;
    const clave = id * 4 + tinte;
    const hecho = this.tenidas.get(clave);
    if (hecho !== undefined) return hecho;

    const img = this.fuente(id);
    if (img === null) return null;

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.max(1, w);
    lienzo.height = Math.max(1, h);
    const c = lienzo.getContext("2d");
    c.drawImage(img, 0, 0, lienzo.width, lienzo.height);
    c.globalCompositeOperation = "source-in";
    c.fillStyle = tinte === 1 ? "#000" : "#fff";
    c.fillRect(0, 0, lienzo.width, lienzo.height);

    this.tenidas.set(clave, lienzo);
    return lienzo;
  }

  /** Resuelto cuando todo el arte pedido hasta ahora está cargado. */
  async cargado() {
    while (this.pendientes > 0) await new Promise((r) => setTimeout(r, 16));
  }
}
