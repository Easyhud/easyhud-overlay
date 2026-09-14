/* LAS ESCENAS DEL BANCO DE PRUEBAS.
   ================================

   Estados completos del diseño —los mismos que publica `combate/js/datos.js`—
   que se le dan A LAS DOS VERSIONES para compararlas. Ni el DOM ni el lienzo
   saben que están en un banco: reciben un estado y pintan.

   Están elegidas para cubrir lo que puede desviarse, no para que salga bonito:

   - la composición completa con diez vivos y todo el arte del CDN,
   - las dos excepciones de la fila de vida (sin dato, y muerto),
   - las tarjetas cortas del muerto, que cambian el ancho y el degradado,
   - insignias de tres costes distintos, que es otro polígono cada una,
   - el foco ámbar del observado, que es la pieza con tres sombras interiores,
   - la spike plantada, que sustituye el chip de ronda,
   - el duelo, que mueve las dos columnas al centro y las agranda,
   - nombres largos, que hay que cortar exactamente por donde los corta el CSS,
   - el modo mínimo, que apaga la franja de arriba entera.

   El arte es el del CDN público de Riot, igual que en producción. Los logos de
   equipo son los dos que ya están en la carpeta del diseño. */

const LOGO = (n) => new URL("../../combate/assets/" + n, import.meta.url).href;

const EQUIPOS = [
  { tricode: "AC", nombre: "Alpha Crew", logo: LOGO("prx-logo.png"), tantos: 11, mapas: 1, bando: "attack" },
  { tricode: "JAG", nombre: "Jaguares", logo: LOGO("inf-logo.webp"), tantos: 9, mapas: 0, bando: "defense" },
];

/** Un jugador con todos los campos puestos; lo que no se diga, se hereda. */
function jugador(extra) {
  return Object.assign({
    nick: "jugador",
    agente: "jett",
    vivo: true,
    vida: 100,
    vidaConocida: true,
    escudo: "heavy",
    arma: "vandal",
    habilidades: [{ tiene: 1, max: 1 }, { tiene: 1, max: 1 }, { tiene: 2, max: 2 }],
    ult: 3,
    ultMax: 7,
    credito: 3900,
    gasto: 0,
    kda: "12/7/4",
    spike: false,
    observado: false,
    papel: "",
  }, extra);
}

const ATAQUE = [
  jugador({ nick: "Rekkles", agente: "jett", ult: 7, ultMax: 7, kda: "18/9/3", arma: "operator" }),
  jugador({ nick: "Nairo", agente: "raze", ult: 4, ultMax: 8, kda: "11/12/6", arma: "phantom", escudo: "light", vida: 64 }),
  jugador({ nick: "Sardoche", agente: "sova", ult: 2, ultMax: 7, kda: "9/10/11", arma: "vandal", spike: true }),
  jugador({ nick: "Zeta", agente: "omen", ult: 5, ultMax: 6, kda: "7/13/9", arma: "spectre", escudo: "none", vida: 28 }),
  jugador({ nick: "Kamikaze", agente: "killjoy", ult: 0, ultMax: 8, kda: "5/14/8", arma: "ghost", vida: 87 }),
];

const DEFENSA = [
  jugador({ nick: "Derke", agente: "phoenix", ult: 6, ultMax: 6, kda: "20/8/5", arma: "vandal", observado: true }),
  jugador({ nick: "Alfajer", agente: "cypher", ult: 3, ultMax: 7, kda: "14/11/7", arma: "phantom", vida: 45 }),
  jugador({ nick: "Boaster", agente: "breach", ult: 1, ultMax: 8, kda: "6/12/16", arma: "bulldog", escudo: "light" }),
  jugador({ nick: "Chronicle", agente: "viper", ult: 7, ultMax: 7, kda: "15/10/6", arma: "guardian" }),
  jugador({ nick: "Leo", agente: "sage", ult: 4, ultMax: 8, kda: "8/11/13", arma: "marshal", escudo: "none", vida: 12 }),
];

const BASE = {
  ronda: 21,
  etiquetaRonda: "ronda 21",
  mapa: "Ascent",
  mapasParaGanar: 2,
  serie: { cuantos: 3, estados: [["gana", "en-curso", ""], ["", "en-curso", ""]], titulos: [] },
  minimo: false,
  fase: "combat",
  equipos: EQUIPOS,
  spike: { plantadaEn: null, sitio: "" },
  spikeSegundos: 45,
  historial: [],
  jugadores: [ATAQUE, DEFENSA],
};

/** Copia profunda a mano: son objetos planos y así no arrastra dependencias. */
const clona = (x) => JSON.parse(JSON.stringify(x));

function con(cambios) {
  const e = clona(BASE);
  cambios(e);
  return e;
}

export const ESCENAS = [
  {
    nombre: "completa",
    detalle: "diez vivos, todo el arte, insignias de seis siete y ocho lados",
    estado: clona(BASE),
  },
  {
    nombre: "bajas",
    detalle: "tres muertos: tarjeta corta, retrato en gris, pie apagado, cero sin barra",
    estado: con((e) => {
      e.jugadores[0][1].vivo = false;
      e.jugadores[0][3].vivo = false;
      e.jugadores[1][4].vivo = false;
    }),
  },
  {
    nombre: "sin-dato",
    detalle: "cinco jugadores sin su cliente: cartel en vez de un cero falso",
    estado: con((e) => {
      for (const p of e.jugadores[1]) { p.vidaConocida = false; p.vida = null; }
    }),
  },
  {
    nombre: "observado",
    detalle: "el foco ámbar: trazo de 2px y dos resplandores interiores",
    estado: con((e) => {
      e.jugadores[1][0].observado = false;
      e.jugadores[0][2].observado = true;
    }),
  },
  {
    nombre: "nombres-largos",
    detalle: "el corte con puntos suspensivos tiene que caer en la misma letra",
    estado: con((e) => {
      const largos = ["Constantinopla", "MiNombreEsMuyLargo", "xX_DarkSlayer_Xx", "ABCDEFGHIJKLMNOP", "Ñandú Escarlata"];
      e.jugadores[0].forEach((p, k) => { p.nick = largos[k]; });
      e.jugadores[1].forEach((p, k) => { p.nick = largos[4 - k]; });
    }),
  },
  {
    nombre: "spike",
    detalle: "el chip de ronda pasa a cuenta atrás",
    /* El plantado se fecha al aplicar la escena, no al cargar el fichero: las
       dos versiones se abren en momentos distintos y la cuenta atrás tiene que
       salir con la misma décima en las dos. 21.28 segundos deja el número a
       mitad de su décima, lejos del redondeo. */
    spikeHace: 21280,
    estado: con((e) => {
      e.spike = { plantadaEn: null, sitio: "A" };
    }),
  },
  {
    nombre: "duelo",
    detalle: "uno contra uno: ocho tarjetas fuera y las dos columnas al centro",
    estado: con((e) => {
      e.jugadores[0].forEach((p, k) => { p.vivo = k === 2; });
      e.jugadores[1].forEach((p, k) => { p.vivo = k === 0; });
    }),
  },
  {
    nombre: "minimo",
    detalle: "el realizador pone su marcador: la franja de arriba se apaga entera",
    estado: con((e) => { e.minimo = true; }),
  },
  {
    nombre: "un-mapa",
    detalle: "serie a un mapa: no se pintan marcadores de serie",
    estado: con((e) => {
      e.mapasParaGanar = 1;
      e.etiquetaRonda = "prórroga 2";
    }),
  },
  {
    nombre: "cargas",
    detalle: "rombos de una dos y tres cargas, y habilidades gastadas",
    estado: con((e) => {
      e.jugadores[0][0].habilidades = [{ tiene: 0, max: 1 }, { tiene: 1, max: 3 }, { tiene: 2, max: 2 }];
      e.jugadores[0][1].habilidades = [{ tiene: 2, max: 3 }, { tiene: 0, max: 2 }, { tiene: 1, max: 1 }];
      e.jugadores[1][0].habilidades = [{ tiene: 3, max: 3 }, { tiene: 0, max: 1 }, { tiene: 0, max: 2 }];
      e.jugadores[1][1].habilidades = [{ tiene: 1, max: 2 }, { tiene: 1, max: 1 }, { tiene: 2, max: 3 }];
    }),
  },
];

/* ── Secuencias: el banco del movimiento ─────────────────────────────────── */

/*
 * Una escena comprueba la composición; una secuencia comprueba las
 * animaciones, que es la otra mitad del trabajo y la que no se ve en un
 * fotograma quieto.
 *
 * Funciona así: se publica el estado de PARTIDA, se deja asentar, y entonces
 * se publica el de LLEGADA. Ese salto es el que dispara todo lo que el HUD
 * deduce comparando —un disparo, una baja, una habilidad gastada, una
 * definitiva que se llena— y además arranca las transiciones de anchura, de
 * fondo y de barra de vida.
 *
 * Después se mira en instantes concretos. Los de aquí no son redondos por
 * casualidad: 60ms cae en la subida del destello de daño, 160 en el punto en
 * que el golpe de la baja ya ha rebotado, 300 en el final de la entrada y la
 * salida, y 900 con casi todo terminado menos el fogonazo de la definitiva,
 * que dura novecientos.
 */
export const SECUENCIAS = [
  {
    nombre: "golpe",
    detalle: "daño, baja, habilidad gastada y definitiva que se llena, a la vez",
    instantes: [60, 160, 300, 900],
    desde: clona(BASE),
    hasta: con((e) => {
      /* A uno le pegan y sigue vivo: destello y barra que se encoge. */
      e.jugadores[0][4].vida = 31;
      /* Otro cae: tarjeta corta, retrato en gris, pie apagado, golpe seco. */
      e.jugadores[1][1].vivo = false;
      /* Un tercero gasta una carga: el rombo se apaga y el icono da un pulso. */
      e.jugadores[0][1].habilidades = [{ tiene: 0, max: 1 }, { tiene: 1, max: 1 }, { tiene: 2, max: 2 }];
      /* Y a otro se le llena la definitiva: fogonazo único y halo. */
      e.jugadores[1][2].ult = 8;
    }),
  },
  {
    nombre: "camara",
    detalle: "el cambio de cámara: el foco ámbar se cruza en 220ms",
    instantes: [60, 110, 220],
    desde: clona(BASE),
    hasta: con((e) => {
      e.jugadores[1][0].observado = false;
      e.jugadores[0][0].observado = true;
    }),
  },
  {
    nombre: "entra-duelo",
    detalle: "uno contra uno: ocho tarjetas se van y las columnas viajan al centro",
    instantes: [150, 300, 520, 950],
    desde: clona(BASE),
    hasta: con((e) => {
      e.jugadores[0].forEach((p, k) => { p.vivo = k === 2; });
      e.jugadores[1].forEach((p, k) => { p.vivo = k === 0; });
    }),
  },
];

export function preparaSecuencia(sec, cual) {
  return JSON.parse(JSON.stringify(cual === "desde" ? sec.desde : sec.hasta));
}

/**
 * Una escena lista para publicar.
 *
 * Se copia —las dos versiones no pueden compartir el mismo objeto— y se fechan
 * los relojes que el diseño trae como instante.
 */
export function prepara(escena) {
  const e = JSON.parse(JSON.stringify(escena.estado));
  if (escena.spikeHace !== undefined) e.spike.plantadaEn = Date.now() - escena.spikeHace;
  return e;
}

/**
 * Todo el arte que hace falta, para precargarlo antes de medir nada.
 *
 * Una imagen que llega tarde sale en blanco en una versión y pintada en la
 * otra, y el diff acusaría de una diferencia de fidelidad lo que es una
 * diferencia de red.
 */
export function artePedido() {
  const urls = new Set();
  for (const e of ESCENAS) {
    for (const eq of e.estado.equipos) if (eq.logo) urls.add(eq.logo);
  }
  return [...urls];
}
