/* COMBATE — el pintor.
   ====================

   Construye el mismo marcado que traía el fotograma estático, pero con lo que
   llega del servidor. El CSS no se ha tocado: si algo se ve distinto del
   fotograma, es que aquí falta o sobra una clase, y se arregla aquí.

   ## La regla que manda: los nodos NO se rehacen

   Todo se crea una vez y después solo se le cambian los valores. No es una
   optimización, es lo único que hace que las animaciones existan:

   - Un elemento **nuevo** vuelve a lanzar su animación CSS desde cero. Si el
     fogonazo de la definitiva se recrea diez veces por segundo, revienta diez
     veces por segundo en lugar de una sola al llenarse.
   - Una **transición** necesita que el nodo sea el mismo antes y después. Si
     la barra de vida se recrea, nace ya en su anchura final y no se desliza.

   Así que aquí no se escribe `innerHTML` en cada foto. Se escribe una vez, al
   crear la tarjeta, y a partir de ahí se tocan textos, clases y estilos.

   Solo se rehace lo que cambia de FORMA: los tramos de la insignia cuando la
   definitiva cuesta otro número de puntos, y los rombos cuando cambia el
   número de cargas. Las dos cosas pasan una vez por partida, no por foto.

   ## Lo que no se sabe no se pinta

   Sin dato de vida no hay barra ni número: un cero falso se lee como una
   baja. Eso lo decide `datos.js`, que traduce del servidor; aquí se respeta.
*/

import { suscribe } from './datos.js';
import { iconoAgente, iconoArma, iconoHabilidad, iconoUltimate, CREDITOS, OJO, SPIKE } from './cdn.js';
import { recorte, tramos } from './poligono.js';

const ESCUDOS = { heavy: 50, light: 25, regen: 25, none: 0 };

const MS_DANO = 360;
const MS_BAJA = 520;
const MS_HABILIDAD = 420;

const $ = (id) => document.getElementById(id);
const el = (tag, clase) => {
  const nodo = document.createElement(tag);
  if (clase !== undefined) nodo.className = clase;
  return nodo;
};
const ver = (nodo, visible) => {
  nodo.style.display = visible ? '' : 'none';
};
/** Escribe solo si cambió: tocar el DOM sin necesidad también cuesta. */
const texto = (nodo, valor) => {
  const s = String(valor);
  if (nodo.textContent !== s) nodo.textContent = s;
};
const fuente = (img, url) => {
  if (url !== '' && img.getAttribute('src') !== url) img.setAttribute('src', url);
  ver(img, url !== '');
};

/* ── Marcador ────────────────────────────────────────────────────────────── */

const marcadorNodos = [];

function creaMarcador() {
  const marcador = $('marcador');
  marcador.textContent = '';

  [0, 1].forEach((i) => {
    const caja = el('div', 'equipo' + (i === 1 ? ' equipo--der' : ''));
    caja.style.setProperty('--c', i === 0 ? 'var(--atk)' : 'var(--def)');
    const logo = el('img', 'equipo__logo');
    logo.alt = '';
    const tri = el('span', 'equipo__tri');
    const tanto = el('span', 'equipo__tanto');
    caja.append(el('div', 'equipo__filete'), logo, tri, el('span', 'equipo__sep'), tanto);

    if (i === 1) marcador.append(el('div', 'marcador__hueco'));
    marcador.append(caja);
    marcadorNodos.push({ logo, tri, tanto });
  });
}

function pintaMarcador(e) {
  if (marcadorNodos.length === 0) creaMarcador();

  e.equipos.forEach((equipo, i) => {
    const n = marcadorNodos[i];
    fuente(n.logo, equipo.logo);
    texto(n.tri, equipo.tricode);
    texto(n.tanto, equipo.tantos);
  });

  /*
   * El chip: la ronda, o la cuenta atrás de la spike cuando está plantada.
   *
   * Hasta ahora el overlay **no decía nada de la spike**: el aviso con su
   * visor 3D está diseñado y aparcado, así que entre el plantado y la
   * explosión no había en pantalla ni un dato de los cuarenta y cinco
   * segundos más tensos de la ronda.
   *
   * Se reusa el chip que ya existe en vez de añadir una pieza nueva, que es
   * también lo que hace el producto de referencia: ellos sustituyen el reloj
   * por un icono de spike que parpadea más rápido según se acerca la
   * explosión. Aquí se pone el número, que dice lo mismo y además cuánto
   * queda. Si no gusta, se quita borrando este bloque.
   *
   * El reloj lo lleva el navegador desde el instante del plantado, como el de
   * ronda: el servidor manda el INSTANTE, no los segundos que quedan, así que
   * la cuenta va suave aunque el estado llegue a saltos.
   */
  const chip = $('ronda');
  const plantada = e.spike?.plantadaEn ?? null;

  if (plantada === null) {
    chip.classList.remove('ronda-chip--spike');
    texto(chip, e.etiquetaRonda);
  } else {
    const resto = Math.max(0, e.spikeSegundos - (Date.now() - plantada) / 1000);
    const sitio = e.spike.sitio === '' ? '' : ` · ${e.spike.sitio}`;
    chip.classList.add('ronda-chip--spike');
    texto(chip, `spike ${resto.toFixed(1)}${sitio}`);
  }

  /*
   * Marcadores de serie. A un solo mapa no se pintan: una serie de un mapa no
   * tiene marcador de serie, y dos casillas vacías ahí solo confunden.
   *
   * El estado de cada casilla ya viene resuelto del adaptador, que lo saca de
   * los mapas de verdad de la serie. Aquí solo se pinta: `on` el ganado y
   * `en-curso` el que se está jugando.
   */
  [0, 1].forEach((i) => {
    const banda = $(i === 0 ? 'serie-izq' : 'serie-der');
    const estados = e.serie?.estados?.[i] ?? [];
    const cuantos = e.mapasParaGanar <= 1 ? 0 : estados.length;

    if (banda.children.length !== cuantos) {
      banda.textContent = '';
      banda.style.setProperty('--cl', i === 0 ? 'var(--atk-light)' : 'var(--def-light)');
      for (let k = 0; k < cuantos; k += 1) banda.append(el('i'));
    }
    [...banda.children].forEach((marca, k) => {
      marca.classList.toggle('on', estados[k] === 'gana');
      marca.classList.toggle('en-curso', estados[k] === 'en-curso');
      /* El nombre del mapa no se pinta —no hay sitio— pero se deja a mano. */
      const titulo = e.serie?.titulos?.[i]?.[k] ?? '';
      if (marca.getAttribute('title') !== titulo) marca.setAttribute('title', titulo);
    });
  });
}

/* ── Modo mínimo ─────────────────────────────────────────────────────────── */

/**
 * La franja de arriba se apaga entera.
 *
 * El operador lo conmuta desde su panel y sirve para una situación concreta:
 * el realizador ya tiene su propio marcador en la escena de OBS, y dos
 * marcadores en la misma franja se pisan. Se queda lo que solo puede dar
 * este overlay, que son las tarjetas.
 *
 * Se apaga con `visibility`, no quitando los nodos: el pintor los sigue
 * actualizando y al volver del modo mínimo ya están al día, sin un fotograma
 * con el marcador de hace diez minutos.
 */
function pintaMinimo(minimo) {
  /** @type {NodeListOf<HTMLElement>} */
  const aletas = document.querySelectorAll('.aleta');
  const piezas = [$('marcador'), $('ronda'), $('serie-izq'), $('serie-der'), ...aletas];
  for (const pieza of piezas) {
    if (pieza === null) continue;
    pieza.style.visibility = minimo ? 'hidden' : '';
  }
}

/* ── La tarjeta: se crea una vez ─────────────────────────────────────────── */

/**
 * Crea la estructura completa y devuelve los nodos que después se tocan.
 *
 * Se crean TODOS los elementos, incluidos los que ahora mismo no se ven: se
 * enseñan y se esconden, nunca se añaden y se quitan. Añadir un elemento es
 * relanzar su animación.
 */
function creaTarjeta(lado) {
  const der = lado === 1;
  const tarjeta = el('div', 'tarjeta' + (der ? ' tarjeta--der' : ''));
  tarjeta.style.setProperty('--c', der ? 'var(--def)' : 'var(--atk)');
  tarjeta.style.setProperty('--cl', der ? 'var(--def-light)' : 'var(--atk-light)');

  /* Insignia. El halo y el fogonazo se crean YA y se quedan para siempre:
     son justo los dos que no pueden recrearse sin reventar en bucle. */
  const ulti = el('div', 'ulti');
  ulti.style.margin = der ? '0 0 0 -6px' : '0 -6px 0 0';
  const halo = el('div', 'ulti__halo');
  const trazo = el('div', 'ulti__trazo');
  const fogonazo = el('div', 'ulti__fogonazo');
  const dentro = el('div', 'ulti__dentro');
  const iconoUlt = el('img', 'ulti__icono');
  iconoUlt.alt = '';
  dentro.append(iconoUlt);
  ulti.append(halo, trazo, fogonazo, dentro);

  /* Cabecera. */
  const retrato = el('div', 'cab__retrato');
  const ojo = el('img', 'cab__ojo');
  ojo.alt = '';
  ojo.src = OJO;
  const nick = el('span', 'cab__nick');
  const spike = el('span', 'cab__spike');
  const spikeImg = el('img');
  spikeImg.alt = 'spike';
  spikeImg.src = SPIKE;
  spike.append(spikeImg);
  const kda = el('span', 'kda');
  const fila = el('div', 'cab__fila');
  fila.append(ojo, nick, spike, el('span', 'elastico'), kda);

  /* Fila de vida. */
  const escudo = el('span', 'vida__escudo');
  const escudoNum = el('b');
  escudo.append(el('i'), escudoNum);
  const vidaNum = el('span', 'vida__num');
  const barra = el('span', 'vida__barra');
  const relleno = el('span', 'vida__relleno');
  barra.append(relleno);
  const sinDato = el('span', 'sin-dato');
  sinDato.textContent = 'sin dato de vida';
  const vida = el('div', 'vida');
  vida.append(escudo, vidaNum, barra, sinDato);

  const cabTexto = el('div', 'cab__texto');
  cabTexto.append(fila, vida);
  const cab = el('div', 'cab');
  cab.append(retrato, cabTexto);

  /* Pie: tres habilidades, crédito y arma. */
  const pie = el('div', 'pie');
  const habs = [0, 1, 2].map(() => {
    const caja = el('div', 'hab');
    const icono = el('img', 'hab__icono');
    icono.alt = '';
    const cargas = el('div', 'hab__cargas');
    caja.append(icono, cargas);
    pie.append(caja);
    return { caja, icono, cargas };
  });
  const credImg = el('img');
  credImg.alt = '';
  credImg.src = CREDITOS;
  const credNum = el('span');
  const credito = el('div', 'credito');
  credito.append(credImg, credNum);
  const arma = el('img', 'arma');
  arma.alt = '';
  pie.append(el('span', 'elastico'), credito, arma);

  /*
   * El destello de daño cuelga del PANEL, no de la fila de vida.
   *
   * Es `position:absolute; inset:0`, así que llena su ancestro posicionado.
   * El fotograma lo tenía dentro de `.vida`, cuyo padre posicionado es
   * `.cab__texto` —que además recorta—, y entonces el destello salía como un
   * rectángulo sobre el nombre en lugar de cubrir la tarjeta. El CSS dice lo
   * que tiene que ser: "destello blanco sobre el retrato".
   */
  const golpe = el('div', 'tarjeta__golpe');

  /*
   * El foco del observado se cruza, no salta.
   *
   * **Esto no viene del diseño**: `.tarjeta__foco` es un box-shadow fijo, sin
   * transición ni fotogramas, y el fotograma estático solo tenía una tarjeta
   * observada, así que el cambio de cámara nunca se vio.
   *
   * En emisión la cámara cambia de jugador cada pocos segundos, y un
   * resplandor ámbar que aparece de golpe en otro sitio de la pantalla tira
   * del ojo más que el propio juego. Se cruza en 220 ms: el que sale se apaga
   * mientras el que entra se enciende.
   *
   * La transición se pone AQUÍ y no en el CSS para no tocar el diseño. Si se
   * decide otra cosa —más lento, un destello, nada—, se cambia este número o
   * se borra esto y se hace en la hoja de estilos, que es su sitio natural.
   */
  const foco = el('div', 'tarjeta__foco');
  foco.style.opacity = '0';
  foco.style.transition = 'opacity 220ms ease';
  const panel = el('div', 'tarjeta__panel');
  panel.append(cab, pie, golpe, foco);
  tarjeta.append(ulti, panel);

  return {
    tarjeta, ulti, halo, trazo, dentro, iconoUlt, tramos: [],
    retrato, ojo, nick, spike, kda,
    escudo, escudoNum, vidaNum, barra, relleno, sinDato,
    habs, credNum, arma, foco,
    lados: 0,
  };
}

/* ── Actualización ───────────────────────────────────────────────────────── */

/**
 * La insignia. Solo se rehacen los tramos si cambia el número de lados.
 *
 * El fogonazo NO se toca nunca: vive desde que nace la tarjeta, y lo que lo
 * dispara es la clase `ulti--lista` al ponerse. Si se recreara, reventaría en
 * cada foto en lugar de una sola vez, al llenarse la definitiva.
 */
function actualizaUlti(n, p) {
  const lados = Math.max(3, p.ultMax);
  const lista = p.ult >= p.ultMax;

  if (n.lados !== lados) {
    n.lados = lados;
    n.trazo.style.clipPath = recorte(lados);
    n.dentro.style.clipPath = recorte(lados);

    for (const viejo of n.tramos) viejo.remove();
    n.tramos = [];
    for (let k = 0; k < lados; k += 1) {
      const span = el('span', 'ulti__tramo');
      n.ulti.insertBefore(span, n.dentro);
      n.tramos.push(span);
    }
  }

  const estilos = tramos(lados, p.ult, { muerto: !p.vivo, lista: lista && p.vivo });
  n.tramos.forEach((span, k) => {
    if (span.style.cssText !== estilos[k]) span.style.cssText = estilos[k];
  });

  ver(n.halo, lista && p.vivo);
  n.ulti.classList.toggle('ulti--lista', lista && p.vivo);
  fuente(n.iconoUlt, iconoUltimate(p.agente));
}

function actualizaCabecera(n, p) {
  const url = iconoAgente(p.agente);
  const fondo = url === '' ? '' : `url(${url})`;
  if (n.retrato.style.backgroundImage !== fondo) n.retrato.style.backgroundImage = fondo;

  ver(n.ojo, p.observado);
  texto(n.nick, p.nick);
  ver(n.spike, p.spike);
  texto(n.kda, p.kda);

  /*
   * Por opacidad, no por `display`: un elemento oculto con `display:none` no
   * transiciona, aparece y ya está. El nodo se queda siempre montado.
   */
  const opaco = p.observado ? '1' : '0';
  if (n.foco.style.opacity !== opaco) n.foco.style.opacity = opaco;
}

/**
 * Vida: escudo, cifra y barra.
 *
 *   vivo y con dato → escudo + cifra + barra
 *   vivo y SIN dato → escudo + cartel, nunca un 0
 *   muerto          → escudo apagado + 0, sin barra
 */
function actualizaVida(n, p) {
  const escudo = ESCUDOS[p.escudo] ?? 0;
  n.escudo.classList.toggle('vida__escudo--sin', escudo === 0);
  texto(n.escudoNum, escudo);

  const conDato = p.vivo && p.vidaConocida;
  ver(n.vidaNum, !p.vivo || conDato);
  ver(n.barra, conDato);
  ver(n.sinDato, p.vivo && !p.vidaConocida);

  if (!p.vivo) {
    texto(n.vidaNum, 0);
  } else if (conDato) {
    texto(n.vidaNum, p.vida);
    // La anchura por estilo es lo que la transición del CSS interpola.
    const ancho = `${p.vida}%`;
    if (n.relleno.style.width !== ancho) n.relleno.style.width = ancho;
  }
}

/** Pie. Los muertos pierden habilidades y arma, conservan el crédito. */
function actualizaPie(n, p) {
  n.habs.forEach((h, k) => {
    const dato = p.habilidades[k];
    const hay = p.vivo && dato !== null && dato !== undefined;
    ver(h.caja, hay);
    if (!hay) return;

    fuente(h.icono, iconoHabilidad(p.agente, k));
    h.icono.classList.toggle('hab__icono--vacio', dato.tiene === 0);

    const cuantos = Math.max(1, dato.max);
    if (h.cargas.children.length !== cuantos) {
      h.cargas.textContent = '';
      for (let q = 0; q < cuantos; q += 1) h.cargas.append(el('i'));
    }
    [...h.cargas.children].forEach((rombo, q) => rombo.classList.toggle('on', q < dato.tiene));
  });

  texto(n.credNum, p.credito.toLocaleString('es-ES'));
  fuente(n.arma, p.vivo ? iconoArma(p.arma) : '');
}

/* ── Animaciones de estado ───────────────────────────────────────────────── */

/**
 * Lo que valía cada jugador en la foto anterior.
 *
 * Las animaciones no vienen en el estado: el estado dice **cómo están** las
 * cosas, no **qué acaba de pasar**. Un golpe es "la vida bajó desde la última
 * foto", y eso hay que deducirlo comparando.
 */
const antes = new Map();

/** Pone una clase y la quita sola. Volver a ponerla la relanza. */
function destella(nodo, clase, ms) {
  nodo.classList.remove(clase);
  // Forzar un reflujo: sin esto, quitar y poner en el mismo fotograma no
  // reinicia nada, porque el navegador no llega a ver el cambio.
  void nodo.offsetWidth;
  nodo.classList.add(clase);
  setTimeout(() => nodo.classList.remove(clase), ms);
}

/** @returns {boolean} Si este jugador acaba de morir */
function animaCambios(n, p, clave) {
  const previo = antes.get(clave);
  antes.set(clave, {
    vida: p.vida,
    vivo: p.vivo,
    cargas: p.habilidades.map((h) => (h === null ? -1 : h.tiene)),
  });
  if (previo === undefined) return false;

  // Daño: la vida bajó y sigue vivo. Si murió, manda la muerte.
  if (p.vivo && previo.vivo && p.vida !== null && previo.vida !== null && p.vida < previo.vida) {
    destella(n.tarjeta, 'es-dano', MS_DANO);
  }

  // Habilidad usada: una carga que estaba y ya no está.
  p.habilidades.forEach((h, k) => {
    if (h === null || previo.cargas[k] === undefined) return;
    if (h.tiene < previo.cargas[k]) destella(n.habs[k].caja, 'es-habilidad', MS_HABILIDAD);
  });

  return previo.vivo && !p.vivo;
}

/* ── Columnas ────────────────────────────────────────────────────────────── */

/** Los nodos de cada tarjeta, por columna. */
const columnas = [[], []];

function pintaColumna(lado, jugadores) {
  const columna = $(lado === 0 ? 'col-izq' : 'col-der');
  const nodos = columnas[lado];

  while (nodos.length > jugadores.length) nodos.pop().tarjeta.remove();
  while (nodos.length < jugadores.length) {
    const n = creaTarjeta(lado);
    /*
     * El desfase entre tarjetas lo calcula el CSS con `--i` por posición, así
     * que aquí no se toca. Y la clase de entrada se quita al acabar: si se
     * queda puesta, la animación no se puede volver a disparar nunca.
     */
    n.tarjeta.classList.add('es-entra');
    n.tarjeta.addEventListener(
      'animationend',
      () => n.tarjeta.classList.remove('es-entra'),
      { once: true },
    );
    columna.append(n.tarjeta);
    nodos.push(n);
  }

  jugadores.forEach((p, k) => {
    const n = nodos[k];
    n.tarjeta.classList.toggle('tarjeta--muerta', !p.vivo);
    actualizaUlti(n, p);
    actualizaCabecera(n, p);
    actualizaVida(n, p);
    actualizaPie(n, p);
    /*
     * El golpe seco va en la tarjeta del que cae, y solo en esa.
     *
     * Antes lo disparaba en las cinco del bando contrario, y el resultado era
     * media pantalla latiendo cada vez que alguien moría. El propio CSS dice
     * para qué es: "reconoce la baja sin robar atención al juego", y cinco
     * tarjetas escalando a la vez es exactamente robarla.
     */
    if (animaCambios(n, p, `${lado}:${k}`)) destella(n.tarjeta, 'es-baja-rival', MS_BAJA);
  });
}


/* ── El duelo: uno contra uno ────────────────────────────────────────────── */

/*
 * Cuando queda exactamente UN vivo por bando, las otras ocho tarjetas se van
 * y las dos supervivientes se juntan en el centro.
 *
 * Es el momento más visto de una ronda y el que peor cuenta la lista normal:
 * ocho tarjetas apagadas y dos encendidas en las esquinas opuestas de la
 * pantalla, que es donde el ojo no está. El dato —quién está vivo— lo tenemos
 * desde el primer día.
 *
 * Tres cosas que decidí aquí y se pueden cambiar sin tocar esto:
 *
 * - **Solo en combate.** En la compra están los diez vivos, y al acabar la
 *   ronda la lista vuelve entera aunque siga habiendo uno y uno.
 * - **Se reusa la animación de salida del diseño** (`es-sale`), no una nueva.
 * - **Las cámaras no entran.** La referencia enseña el vídeo de los dos
 *   duelistas; aquí no, porque el vídeo lo compone el realizador en OBS y el
 *   hueco está sin diseñar. Queda anotado en `PARIDAD-PANTALLAS.md`.
 *
 * La posición y el tamaño los pone el CSS con `.columna--duelo`. Lo de aquí
 * es solo decir CUÁNDO.
 */

/** Lo que tarda una tarjeta en irse, con el desfase de la última incluido. */
const MS_FUERA = 900;

/** Un número por tarjeta, para que una salida vieja no apague una entrada nueva. */
const turnos = new WeakMap();

/**
 * Saca una tarjeta de la composición, o la devuelve.
 *
 * El nodo NO se destruye ni se vuelve a crear —es la regla de esta pantalla—
 * pero sí se esconde con `display:none` al acabar de irse, y eso hace falta:
 * la columna se apoya en el suelo, así que una tarjeta invisible que siga
 * ocupando su alto mantendría a la superviviente flotando donde estaba.
 */
function aparta(tarjeta, fuera) {
  const turno = (turnos.get(tarjeta) ?? 0) + 1;
  turnos.set(tarjeta, turno);

  if (fuera) {
    if (tarjeta.style.display === 'none') return;
    tarjeta.classList.remove('es-entra');
    tarjeta.classList.add('es-sale');
    setTimeout(() => {
      if (turnos.get(tarjeta) !== turno) return;
      tarjeta.style.display = 'none';
    }, MS_FUERA);
    return;
  }

  if (tarjeta.style.display !== 'none' && !tarjeta.classList.contains('es-sale')) return;
  tarjeta.style.display = '';
  tarjeta.classList.remove('es-sale');
  void tarjeta.offsetWidth;
  tarjeta.classList.add('es-entra');
  setTimeout(() => {
    if (turnos.get(tarjeta) !== turno) return;
    tarjeta.classList.remove('es-entra');
  }, MS_FUERA);
}

const cuentaVivos = (jugadores) => jugadores.reduce((n, p) => n + (p.vivo ? 1 : 0), 0);

function pintaDuelo(e) {
  const hay = e.fase === 'combat'
    && cuentaVivos(e.jugadores[0]) === 1
    && cuentaVivos(e.jugadores[1]) === 1;

  /*
   * Se recorren las diez SIEMPRE, no solo cuando el duelo cambia: una
   * tarjeta creada mientras el duelo ya estaba puesto nacería en la lista
   * normal, y hay que apartarla también.
   */
  [0, 1].forEach((lado) => {
    const columna = $(lado === 0 ? 'col-izq' : 'col-der');
    columna.classList.toggle('columna--duelo', hay);
    columnas[lado].forEach((n, k) => {
      const sobrevive = e.jugadores[lado][k]?.vivo === true;
      aparta(n.tarjeta, hay && !sobrevive);
    });
  });
}

/* ── Pintado ─────────────────────────────────────────────────────────────── */

let firma = '';

suscribe((e) => {
  /*
   * Solo se mira si algo cambió de verdad. El estado llega diez veces por
   * segundo aunque no haya cambiado nada de lo que esta pantalla pinta.
   */
  const ahora = JSON.stringify([
    e.equipos, e.jugadores, e.etiquetaRonda, e.mapasParaGanar, e.serie, e.minimo, e.fase,
  ]);
  /*
   * Con la spike plantada se repinta SIEMPRE, aunque nada haya cambiado: la
   * cuenta atrás la lleva el reloj del navegador y la firma no cambia entre
   * dos décimas. Son cuarenta y cinco segundos por ronda; el resto del tiempo
   * el atajo de la firma sigue en pie.
   */
  const contando = (e.spike?.plantadaEn ?? null) !== null;
  if (ahora === firma && !contando) return;
  firma = ahora;

  pintaMarcador(e);
  pintaMinimo(e.minimo === true);
  pintaColumna(0, e.jugadores[0]);
  pintaColumna(1, e.jugadores[1]);
  pintaDuelo(e);
});
