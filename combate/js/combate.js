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
import { iconoAgente, iconoArma, iconoHabilidad, iconoUltimate, iconoRango, CREDITOS, OJO, SPIKE } from './cdn.js';
import { recorte, tramos } from './poligono.js';
import { coloresDeBando } from '../../comun/partida.js';

/* Los visores de cámara (ver `sincronizaVisores`): se declaran arriba porque el primer estado puede llegar
   antes de que el módulo termine de evaluarse. */
const MAX_VISORES = 10;
/* Cuánto dura la cámara tras acabar la ronda antes de ocultarse. Medido en las grabaciones: entre el
   fin de ronda y la fase de compra pasan 7,0 s siempre; se oculta unos 0,4 s antes de que entre. */
const DESVANECE_FIN_RONDA_MS = 6600;
let faseCamara = '';
let relojFinRonda = null;
let finRondaYaVisto = false;
let ultimoEstadoCamara = null;
const visores = new Map(); // «Nombre#TAG» → iframe

const ESCUDOS = { heavy: 50, light: 25, regen: 25, none: 0 };

/* Modo OPERADOR: cuando el overlay se carga con `?operador=1` (la vista del
   operador, NUNCA la de OBS), cada tarjeta muestra la tecla de observador
   (1–5 izquierda, 6–0 derecha). Es una ayuda privada; en emisión no aparece. */
const ESOPERADOR = new URLSearchParams(location.search).get('operador') === '1';
const TECLA = [
  ['1', '2', '3', '4', '5'],
  ['6', '7', '8', '9', '0'],
];

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

/* ── Marcador ──────────────────────────────────────────────────────────────
   El marcado ya está en el HTML (diseño `marcador-estatico`); aquí solo se
   rellenan los huecos por id. */

/** Pone un logo como imagen de fondo, solo si cambió (data-URIs incluidos). */
function fondo(nodo, url) {
  const v = url || '';
  if (nodo.dataset.url === v) return;
  nodo.dataset.url = v;
  nodo.style.backgroundImage = v ? `url("${v}")` : '';
}

function pintaMarcador(e) {
  const lados = ['izq', 'der'];
  lados.forEach((suf, i) => {
    const equipo = e.equipos[i] ?? {};
    /* El color del panel sigue al BANDO del equipo, no a su lado de pantalla
       (ver `coloresDeBando`). Lo lee el CSS por `data-bando`. */
    const panel = $('tri-' + suf)?.closest('.panel-equipo');
    const bando = coloresDeBando(equipo.bando, i).ataca ? 'attack' : 'defense';
    if (panel && panel.dataset.bando !== bando) panel.dataset.bando = bando;
    fondo($('logo-' + suf), equipo.logo);
    /* La letra de reserva solo asoma si NO hay logo (o no carga): antes se pintaba siempre y se veía
       a través de las zonas transparentes del logo. */
    const letra = (equipo.tricode || '?').slice(0, 1);
    const claveLogo = `${equipo.logo ?? ''}|${letra}`;
    const caja = $('ini-' + suf);
    if (caja !== null && caja.dataset.clave !== claveLogo) {
      caja.dataset.clave = claveLogo;
      if (!equipo.logo) {
        texto(caja, letra);
      } else {
        texto(caja, '');
        const prueba = new Image();
        prueba.onerror = () => {
          if (caja.dataset.clave === claveLogo) texto(caja, letra);
        };
        prueba.src = equipo.logo;
      }
    }
    texto($('tri-' + suf), equipo.tricode ?? '');
    texto($('tanto-' + suf), equipo.tantos ?? 0);
  });

  /*
   * El rótulo de ronda, o la cuenta atrás de la spike cuando está plantada. El
   * reloj lo lleva el navegador desde el instante del plantado (el servidor
   * manda el INSTANTE), así la cuenta va suave aunque el estado llegue a saltos.
   */
  const chip = $('ronda');
  const plantada = e.spike?.plantadaEn ?? null;
  if (plantada === null) {
    texto(chip, e.etiquetaRonda);
  } else {
    const resto = Math.max(0, e.spikeSegundos - (Date.now() - plantada) / 1000);
    const sitio = e.spike.sitio === '' ? '' : ` · ${e.spike.sitio}`;
    texto(chip, `spike ${resto.toFixed(1)}${sitio}`);
  }

  /*
   * Pips de serie: uno por cada mapa que hace falta GANAR (bo3 = 2, bo5 = 3),
   * encendidos según los mapas ganados por cada equipo. A un solo mapa (bo1) no
   * se pintan, porque no hay serie que marcar.
   */
  const total = (e.mapasParaGanar ?? 0) <= 1 ? 0 : e.mapasParaGanar;
  lados.forEach((suf, i) => {
    const pips = $('pips-' + suf);
    const ganados = e.equipos[i]?.mapas ?? 0;
    const clase = coloresDeBando(e.equipos[i]?.bando, i).ataca ? 'on--atk' : 'on--def';
    if (pips.children.length !== total) {
      pips.textContent = '';
      for (let k = 0; k < total; k += 1) pips.append(el('i'));
    }
    [...pips.children].forEach((pip, k) => {
      const on = k < ganados ? clase : '';
      if (pip.className !== on) pip.className = on;
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
  const todo = $('marcador-todo');
  if (todo !== null) todo.style.visibility = minimo ? 'hidden' : '';
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
  /* El color (`--c`, `--cl`) no se fija aquí: sigue al bando del equipo y lo
     pone `pintaColumna` en cada foto. */

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
  const rango = el('img', 'cab__rango');
  rango.alt = '';
  const nick = el('span', 'cab__nick');
  const spike = el('span', 'cab__spike');
  const spikeImg = el('img');
  spikeImg.alt = 'spike';
  spikeImg.src = SPIKE;
  spike.append(spikeImg);
  const kda = el('span', 'kda');
  const fila = el('div', 'cab__fila');
  /* El icono de rango va pegado al nombre. La fila del equipo derecho se pinta
     en `row-reverse` (CSS), así que el mismo orden deja el rango a la IZQUIERDA
     del nombre en el equipo izquierdo y a la DERECHA en el derecho: simétrico. */
  fila.append(ojo, rango, nick, spike, el('span', 'elastico'), kda);

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
  /* Jugador que abandonó: ocupa el hueco de la vida, sin mover nada más. */
  const fuera = el('span', 'sin-dato tarjeta__fuera');
  fuera.textContent = 'desconectado';
  const vida = el('div', 'vida');
  vida.append(escudo, vidaNum, barra, sinDato, fuera);

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

  /* Badge de tecla del observador: solo en la vista del operador. Se crea
     siempre pero queda oculto (CSS) salvo `?operador=1`. */
  const tecla = el('div', 'tarjeta__tecla');
  tarjeta.append(tecla);

  return {
    tarjeta, ulti, halo, trazo, dentro, iconoUlt, tramos: [],
    retrato, ojo, rango, nick, spike, kda,
    escudo, escudoNum, vidaNum, barra, relleno, sinDato, fuera,
    habs, credNum, arma, foco, tecla,
    lados: 0, bando: '',
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
  /* Sin coste conocido (`ultMax` 0) no está «lista»: antes salía con el halo
     encendido en los marcadores vacíos de antes de la partida y en los de un
     jugador que se había ido. */
  const lista = p.ultMax > 0 && p.ult >= p.ultMax;

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

  /* Muerto también se ve cuánto lleva —y si la tiene lista—: la definitiva no
     se pierde al morir, y morir SUMA un punto. Solo se apaga el halo. */
  const estilos = tramos(lados, p.ult, { muerto: !p.vivo, lista });
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
  fuente(n.rango, iconoRango(p.rango));
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
  /* El muerto no lleva escudo: se pierde al morir (el servidor ya lo manda
     así; esto es por si llega un estado viejo). */
  const escudo = p.vivo ? (ESCUDOS[p.escudo] ?? 0) : 0;
  n.escudo.classList.toggle('vida__escudo--sin', escudo === 0);
  texto(n.escudoNum, escudo);

  /* Desconectado: el rótulo ocupa el sitio de la cifra y la barra. */
  const fuera = p.desconectado === true;
  const conDato = p.vivo && p.vidaConocida && !fuera;
  ver(n.vidaNum, (!p.vivo && !fuera) || conDato);
  ver(n.barra, conDato);
  ver(n.sinDato, p.vivo && !p.vidaConocida && !fuera);
  ver(n.fuera, fuera);

  if (!p.vivo) {
    texto(n.vidaNum, 0);
  } else if (conDato) {
    // La vida se limita a 0-100 por si el cliente manda un valor fuera de rango.
    const vida = Math.max(0, Math.min(100, p.vida));
    texto(n.vidaNum, vida);
    // La anchura por estilo es lo que la transición del CSS interpola.
    const ancho = `${vida}%`;
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

    /* Sin icono (agente desconocido) el hueco se queda: esconderlo con
       `display` encogía el pie y movía el crédito y el arma. */
    const url = iconoHabilidad(p.agente, k);
    if (url !== '' && h.icono.getAttribute('src') !== url) h.icono.setAttribute('src', url);
    h.icono.style.visibility = url === '' ? 'hidden' : '';
    /* El icono dice lo mismo que los rombos, para que se lea sin mirarlos:
       entero si tiene todas, a medias si gastó alguna, casi transparente si
       no le queda ninguna. */
    const cuantos = Math.max(1, dato.max);
    h.icono.classList.toggle('hab__icono--vacio', dato.tiene === 0);
    h.icono.classList.toggle('hab__icono--gastada', dato.tiene > 0 && dato.tiene < cuantos);

    if (h.cargas.children.length !== cuantos) {
      h.cargas.textContent = '';
      for (let q = 0; q < cuantos; q += 1) h.cargas.append(el('i'));
    }
    [...h.cargas.children].forEach((rombo, q) => rombo.classList.toggle('on', q < dato.tiene));
  });

  texto(n.credNum, p.credito === null ? '—' : miles(p.credito));
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

/** Créditos con punto de miles SIEMPRE (3.900, 10.500): `toLocaleString('es-ES')` no agrupa las cifras de cuatro dígitos. */
const miles = (n) => String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

function pintaColumna(lado, jugadores, bandoEquipo) {
  const columna = $(lado === 0 ? 'col-izq' : 'col-der');
  const nodos = columnas[lado];
  /* El color de las tarjetas sigue al bando del equipo, no a su lado. */
  const color = coloresDeBando(bandoEquipo, lado);

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
    if (n.bando !== color.c) {
      n.bando = color.c;
      n.tarjeta.style.setProperty('--c', color.c);
      n.tarjeta.style.setProperty('--cl', color.cl);
    }
    n.tarjeta.classList.toggle('tarjeta--muerta', !p.vivo);
    n.tarjeta.classList.toggle('tarjeta--desconectada', p.desconectado === true);
    actualizaUlti(n, p);
    actualizaCabecera(n, p);
    actualizaVida(n, p);
    actualizaPie(n, p);
    /* Tecla del observador (solo vista del operador). Dorada si el auto-director
       recomienda a este jugador (`p.recomendado`). */
    if (ESOPERADOR) {
      texto(n.tecla, TECLA[lado]?.[k] ?? '');
      n.tecla.classList.add('tarjeta__tecla--on');
      n.tecla.classList.toggle('tarjeta__tecla--rec', p.recomendado === true);
    }
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


/* ── Pintado ─────────────────────────────────────────────────────────────── */

let firma = '';

suscribe((e) => {
  /*
   * Solo se mira si algo cambió de verdad. El estado llega diez veces por
   * segundo aunque no haya cambiado nada de lo que esta pantalla pinta.
   */
  const ahora = JSON.stringify([
    e.equipos, e.jugadores, e.etiquetaRonda, e.mapasParaGanar, e.serie, e.minimo, e.fase,
    e.camaras, e.mapasSerie, e.torneoLogo, e.torneoNombre,
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
  pintaHistorial(e);
  pintaTorneo(e);
  pintaMinimo(e.minimo === true);
  pintaColumna(0, e.jugadores[0], e.equipos[0]?.bando);
  pintaColumna(1, e.jugadores[1], e.equipos[1]?.bando);
  pintaCamara(e);
});

/* Historial de la serie (izquierda): los mapas JUGADOS con el marcador y los
   logos de ambos equipos (el perdedor en gris), más el mapa actual como
   «Current: X». bo1 (mapasParaGanar<=1) o sin mapas no se muestra. Los futuros
   no se pintan. */
function pintaHistorial(e) {
  const cont = $('historial');
  if (!cont) return;
  const mapas = Array.isArray(e.mapasSerie) ? e.mapasSerie : [];
  const visibles = mapas.filter((m) => m.state === 'past' || m.state === 'live');
  if (e.minimo === true || (e.mapasParaGanar ?? 0) <= 1 || visibles.length === 0) {
    cont.hidden = true;
    cont.innerHTML = '';
    return;
  }
  cont.hidden = false;
  cont.innerHTML = visibles
    .map((m) => {
      const nombre = String(m.name || '—');
      if (m.state === 'live') {
        return `<div class="historial__tramo historial__tramo--actual"><span class="historial__mapa">Current: ${nombre}</span></div>`;
      }
      const sc = Array.isArray(m.score) ? m.score : [0, 0];
      const izqPerdio = sc[0] < sc[1] ? ' historial__logo--perdio' : '';
      const derPerdio = sc[1] < sc[0] ? ' historial__logo--perdio' : '';
      const li = m.leftLogo || m.winnerLogo || '';
      const ri = m.rightLogo || '';
      return (
        `<div class="historial__tramo">` +
        `<span class="historial__mapa">${nombre}</span>` +
        `<div class="historial__logo${izqPerdio}" style="background-image:url('${li}')"></div>` +
        `<span class="historial__marcador">${sc[0]}–${sc[1]}</span>` +
        `<div class="historial__logo${derPerdio}" style="background-image:url('${ri}')"></div>` +
        `</div>`
      );
    })
    .join('');
}

/* Caja del torneo (250×80, arriba-derecha): la imagen del torneo si la hay; si
   no, la marca EASY HUD por defecto para que la caja nunca quede vacía. */
function pintaTorneo(e) {
  const caja = $('torneo-caja');
  if (!caja) return;
  const logo = typeof e.torneoLogo === 'string' ? e.torneoLogo : '';
  if (logo) {
    if (caja.dataset.modo !== 'img' || caja.dataset.url !== logo) {
      caja.dataset.modo = 'img';
      caja.dataset.url = logo;
      caja.innerHTML = `<img class="torneo-caja__img" src="${logo}" alt="">`;
    }
  } else if (caja.dataset.modo !== 'marca') {
    caja.dataset.modo = 'marca';
    caja.dataset.url = '';
    caja.innerHTML =
      '<div class="torneo-caja__marca"></div><span class="torneo-caja__texto">EASY HUD</span>';
  }
}

/* ── Cámara del jugador observado (VDO.Ninja) ────────────────────────────────
   El ID de stream es determinístico: `Nombre_H_TAG` (espacios → «_»), el mismo
   que el exe del jugador usa para publicar. Solo se cambia la fuente del iframe
   cuando cambia la URL —recargarlo cortaría el WebRTC—. */
function urlCamara(cam, nick, tag) {
  /* Misma regla que aplica la web de vídeo al publicar: lo no alfanumérico, a «_». */
  const idVista = `${nick}_H_${tag}`.replace(/\W+/g, '_');
  /* Solo imagen: sin audio ni de lejos (`noaudio` + `mute`). Y poco caudal: la caja es de 311×175
     px, no hace falta más, y así se pueden tener conectadas varias a la vez. */
  const params =
    `room=${encodeURIComponent(cam.sala)}&view=${encodeURIComponent(idVista)}` +
    '&scene=0&cleanoutput&transparent&vb=1800&waitmessage=&disablehotkeys&noaudio&mute' +
    '&codec=h265,av1,h264,vp8' +
    (cam.password ? `&password=${encodeURIComponent(cam.password)}` : '') +
    (cam.params ? `&${cam.params}` : '');
  return `${cam.base || 'https://vdo.ninja'}/?${params}`;
}

/* Un visor por cada jugador que emite, TODOS conectados a la vez y solo uno a la vista. Cambiar la
   fuente de un único visor obligaba a reconectar el WebRTC y la caja salía negra 2–3 s al cambiar
   de jugador; así el cambio es instantáneo, porque el siguiente ya está conectado. */

function sincronizaVisores(caja, cam, quieren) {
  const ahora = Date.now();
  for (const [nombre, marco] of visores) {
    if (quieren.has(nombre)) {
      delete marco.dataset.ausente;
      continue;
    }
    /* Un parpadeo de la lista de emisores no debe tirar su conexión: se quita tras unos segundos ausente. */
    const desde = Number(marco.dataset.ausente ?? (marco.dataset.ausente = String(ahora)));
    if (ahora - desde > 15000) {
      marco.remove();
      visores.delete(nombre);
    }
  }
  for (const nombre of quieren) {
    if (visores.has(nombre)) continue;
    const i = nombre.lastIndexOf('#');
    if (i <= 0) continue;
    const marco = document.createElement('iframe');
    marco.className = 'camara__video';
    marco.title = `Cámara de ${nombre}`;
    marco.setAttribute('allow', 'autoplay; fullscreen');
    marco.setAttribute('frameborder', '0');
    marco.setAttribute('scrolling', 'no');
    marco.src = urlCamara(cam, nombre.slice(0, i), nombre.slice(i + 1));
    marco.dataset.url = marco.src;
    marco.dataset.desde = String(Date.now());
    caja.insertBefore(marco, caja.querySelector('.camara__pie'));
    visores.set(nombre, marco);
  }
}

/* Un visor que se conectó ANTES de que el jugador terminara de publicar se queda sin vídeo y no
   reintenta (por eso a veces una cámara no salía hasta la ronda siguiente). Se reconectan, de uno
   en uno y SOLO los que no se están viendo, los visores que llevan un rato vivos: así, cuando toca
   mostrarlos, llevan poco conectados y lo normal es que ya tengan imagen. */
const REFRESCO_VISOR_MS = 8000;
const EDAD_MINIMA_VISOR_MS = 20000;
let turnoRefresco = 0;
setInterval(() => {
  const candidatos = [...visores.values()].filter(
    (m) => !m.classList.contains('camara__video--activo') && Date.now() - Number(m.dataset.desde) > EDAD_MINIMA_VISOR_MS,
  );
  if (candidatos.length === 0) return;
  const marco = candidatos[turnoRefresco++ % candidatos.length];
  marco.dataset.desde = String(Date.now());
  marco.src = `${marco.dataset.url}&r=${Date.now()}`;
}, REFRESCO_VISOR_MS);

function pintaCamara(e) {
  const caja = $('camara');
  if (caja === null) return;

  const cam = e.camaras ?? { activas: false, sala: '', publicando: [], base: '', params: '', password: '' };
  const obs = [...(e.jugadores[0] ?? []), ...(e.jugadores[1] ?? [])].find((p) => p.observado);
  const fullName = obs ? `${obs.nick}#${obs.tag}` : '';
  const publicando = obs && cam.publicando.includes(fullName);

  /* Conectados: todos los que emiten, mientras las cámaras estén activas. */
  const quieren = cam.activas && cam.sala ? new Set(cam.publicando.slice(0, MAX_VISORES)) : new Set();
  sincronizaVisores(caja, cam, quieren);

  /* Visible: hay un jugador observado que está emitiendo, y estamos en combate o fin de ronda. La conexión se
     MANTIENE entre fases (solo se oculta a la vista) para no reconectar cada ronda. */
  const conectada = quieren.size > 0 && obs && publicando;
  /* En combate y también al acabar la ronda (los avisos de fin de ronda no la tapan); solo se oculta
     donde algo la cubre: compra, selección de agentes, fin de mapa. */
  /* Al acabar la ronda se queda un momento y se oculta ANTES de que entre la compra: si se
     quitara justo con ella, la caja y el panel de compra coincidirían en pantalla. */
  if (e.fase !== faseCamara) {
    faseCamara = e.fase;
    clearTimeout(relojFinRonda);
    finRondaYaVisto = false;
    if (e.fase === 'roundEnd') {
      relojFinRonda = setTimeout(() => {
        finRondaYaVisto = true;
        pintaCamara(ultimoEstadoCamara);
      }, DESVANECE_FIN_RONDA_MS);
    }
  }
  ultimoEstadoCamara = e;
  const visible = conectada && (e.fase === 'combat' || (e.fase === 'roundEnd' && !finRondaYaVisto));

  if (!conectada) {
    /* Sin nadie que mostrar: se oculta a la vista, pero con visores vivos NO se quita de la página
       (un display:none los dejaría sin pintar y el siguiente tardaría en salir). */
    if (quieren.size > 0) {
      caja.removeAttribute('hidden');
      caja.classList.add('camara--oculta');
    } else {
      caja.setAttribute('hidden', '');
    }
    return;
  }
  for (const [nombre, marco] of visores) marco.classList.toggle('camara__video--activo', nombre === fullName);
  caja.removeAttribute('hidden');
  caja.classList.toggle('camara--oculta', !visible);

  /* La barra de abajo: nombre, K/D/A y el color del bando del jugador observado. */
  const equipo = (e.jugadores[0] ?? []).includes(obs) ? 0 : 1;
  caja.dataset.bando = coloresDeBando(e.equipos[equipo]?.bando, equipo).ataca ? 'attack' : 'defense';
  const nombre = $('camara-nombre');
  if (nombre !== null && nombre.textContent !== obs.nick) nombre.textContent = obs.nick;
  const [k = '0', d = '0', a = '0'] = String(obs.kda ?? '0/0/0').split('/');
  const kda = $('camara-kda');
  const n = (v) => Number(v) || 0; // son cifras: nada que escapar
  const html = `<b>${n(k)}</b> / ${n(d)} / ${n(a)}`;
  if (kda !== null && kda.innerHTML !== html) kda.innerHTML = html;
}
