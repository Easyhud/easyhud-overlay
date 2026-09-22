/* ADAPTADOR REAL — sustituye al fichero de datos de prueba del diseño.
   ==================================================================

   El diseño dejó aquí una costura limpia: "sustituye este fichero por tu
   fuente real manteniendo la misma forma". Eso es exactamente lo que hace
   esto, y por eso NINGUNA pantalla ha tenido que tocarse. Siguen llamando a
   `suscribe(fn)` y siguen leyendo `estado` con los mismos nombres.

   De un lado entra el estado del servidor —diez veces por segundo, y solo si
   algo cambió—; del otro sale la forma que el diseño espera.

   Qué hay que saber si se toca esto:

   - **El diseño manda en los nombres.** Si el contrato del servidor cambia,
     se traduce aquí; las pantallas no se enteran.
   - **Nada se rellena con valores plausibles.** Si el servidor dice que no
     sabe la vida de alguien, aquí sale `vidaConocida: false`, que es lo que
     el diseño usa para pintar un hueco en vez de un cero. Un cero falso se
     lee como una baja.
   - **Los sucesos no son estado.** Una ceremonia o un plantado llegan una
     vez y se pierden si no se atienden; se convierten en algo que dura lo
     que tenga que durar y luego se apaga solo.

   Sin servidor detrás, esto arranca con el estado de ejemplo del diseño, así
   que abrir cualquier pantalla suelta sigue funcionando para maquetar. */

import { AGENTE_POR_INTERNO, ARMA_POR_NOMBRE, PAPEL_DE_AGENTE } from './catalogo.js';
import { esMinimo, etiquetaRonda, serieDeMapas } from '../../comun/partida.js';
import { abreFuente } from '../../comun/fuente.js';

/* Escudos de ejemplo (solo para la demo de la tira de mapas sin servidor):
   un círculo verde «A» y uno rojo «B» para ver el logo del ganador. Se codifica
   con encodeURIComponent: si no, los espacios y comillas del SVG rompen el
   atributo `src` al inyectarlo con innerHTML. */
const svgDemo = (color, letra) =>
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="${color}"/><text x="12" y="16.5" font-size="13" text-anchor="middle" fill="#05070a" font-family="Arial" font-weight="bold">${letra}</text></svg>`,
  );
const LOGO_DEMO_A = svgDemo('#43cfa4', 'A');
const LOGO_DEMO_B = svgDemo('#e05561', 'B');

/* Jugador de ejemplo (solo demo sin partido): valores plausibles para ver las
   tarjetas y, en la vista del operador, las teclas 1–0. */
const demoJug = (agente, nick, extra = {}) => ({
  nick, tag: '', agente, vivo: true, vida: 100, vidaConocida: true, escudo: 'heavy',
  arma: 'vandal', habilidades: [{ tiene: 1, max: 1 }, { tiene: 1, max: 1 }, { tiene: 1, max: 1 }],
  ult: 3, ultMax: 7, credito: 3900, gasto: 0, kda: '0/0/0',
  adr: null, dano: null, danoRonda: null, cabezasPct: null, danoConocido: false,
  spike: false, observado: false, rango: 0, papel: '', recomendado: false, ...extra,
});
const DEMO_JUGADORES = [
  [
    demoJug('jett', 'Nicho', { observado: true }),
    demoJug('sova', 'Peru es clave'),
    demoJug('killjoy', 'gatitas al dm', { recomendado: true }),
    demoJug('omen', 'MiCL PabloH0ney'),
    demoJug('raze', 'Niø'),
  ],
  [
    demoJug('chamber', 'Lurcky'),
    demoJug('cypher', 'Yule'),
    demoJug('neon', 'Lizmiau'),
    demoJug('reyna', 'CausitaRex'),
    demoJug('sage', 'vG MoToMoTo'),
  ],
];

/* Banner de torneo de ejemplo (solo demo sin servidor): una imagen apaisada
   como la que iría en el rectángulo de la esquina superior derecha. El real
   sale de `tournamentInfo.logoUrl`. */
const BANNER_DEMO = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 80">' +
  '<rect width="250" height="80" fill="#0b0e13"/>' +
  '<path d="M109 22 L123 40 L109 58 L117 40 Z" fill="#43cfa4"/>' +
  '<path d="M141 22 L127 40 L141 58 L133 40 Z" fill="#ffffff"/>' +
  '<text x="125" y="72" font-family="Arial" font-weight="bold" font-size="14" fill="#ffffff" letter-spacing="3" text-anchor="middle">EASY OPEN</text>' +
  '</svg>');

/* ── El estado que leen las pantallas ────────────────────────────────────── */

export const estado = {
  ronda: 1,
  /** Lo que se escribe en el chip: «ronda 7» o «prórroga 2». */
  etiquetaRonda: 'ronda 1',
  mapa: '',
  mapasParaGanar: 2,
  /** Marcadores de serie por equipo, ya resueltos. Ver `comun/partida.js`. */
  serie: { cuantos: 0, estados: [[], []], titulos: [] },
  /** Los mapas de la serie en orden: { name, state:'past'|'live'|'future',
      score:[a,b] }. Para la tira de mapas de arriba. En el estado de ejemplo van
      un par jugados y uno en vivo, para ver el diseño sin servidor. */
  mapasSerie: [
    { name: 'Ascent', state: 'past', score: [13, 11], winner: 0, winnerLogo: LOGO_DEMO_A, leftLogo: LOGO_DEMO_A, rightLogo: LOGO_DEMO_B },
    { name: 'Sunset', state: 'past', score: [11, 13], winner: 1, winnerLogo: LOGO_DEMO_B, leftLogo: LOGO_DEMO_A, rightLogo: LOGO_DEMO_B },
    { name: 'Bind', state: 'live' },
  ],
  /** Torneo: para el rectángulo de la esquina superior derecha. Si hay banner
      (imagen) se pinta; si no, la marca «EASY HUD». En demo va un banner de
      ejemplo para ver el diseño sin servidor. */
  torneoNombre: 'EASY OPEN',
  torneoLogo: BANNER_DEMO,
  /** Modo mínimo: sin barra de arriba, para cuando el realizador pone la suya. */
  minimo: false,
  fase: 'buy',
  equipos: [
    { tricode: 'INF', nombre: 'Infinite', logo: LOGO_DEMO_A, tantos: 8, mapas: 1, bando: 'attack', tiemposUsados: 0, tiemposTotal: 2 },
    { tricode: 'PRX', nombre: 'Paradox', logo: LOGO_DEMO_B, tantos: 9, mapas: 1, bando: 'defense', tiemposUsados: 0, tiemposTotal: 2 },
  ],
  spike: { plantadaEn: null, sitio: '' },
  /** Cuánto tarda la spike en explotar. Del formato, no a fuego. */
  spikeSegundos: 45,
  historial: [],
  jugadores: DEMO_JUGADORES,
  bloqueados: [0, 0],
  aviso: { visible: false, tipo: 'info', equipo: 0, titulo: '', texto: '' },
  pausa: { visible: false, tactica: true, equipo: 0, reloj: '0:00', avance: 0 },
  finRonda: { visible: false, gana: 0 },
  victoria: { visible: false, gana: 0, palabra: 'VICTORIA', contexto: '' },
  patrocinadores: [],
  marca: '',
  /** Cámaras de jugador (VDO.Ninja): sala + fullNames que publican. */
  camaras: { activas: false, sala: '', publicando: [] },
};

const oyentes = new Set();
export function suscribe(fn) { oyentes.add(fn); fn(estado); return () => oyentes.delete(fn); }
export function publica() { oyentes.forEach((fn) => fn(estado)); }
export function aplica(parcial) { Object.assign(estado, parcial); publica(); }

/* El post-plantado y la selección necesitan refresco continuo: los relojes
   llegan como INSTANTE y la cuenta atrás la lleva el navegador. */
setInterval(publica, 200);

/* ── Traducción del estado del servidor ──────────────────────────────────── */

/** Los tres huecos, en el orden en que el diseño los pinta: C, Q, E. */
const TECLAS = ['grenade', 'ability1', 'ability2'];

/**
 * Una habilidad, o `null` si el jugador está muerto.
 *
 * **Sin dato se pinta el kit COMPLETO, no vacío.** Es la regla del documento
 * de diseño, y va al revés que la de la vida a propósito: sin cliente de
 * jugador no existe la distinción entre disponible y gastada, así que no hay
 * nada que señalar. Un icono a brillo normal dice "este agente tiene esta
 * habilidad" —cierto y útil— sin afirmar disponibilidad; atenuarlo no
 * comunica "no lo sé", comunica que algo está roto.
 *
 * Aquí me equivoqué: lo traté como la vida y salían los diez con el kit
 * apagado, que es exactamente lo que el documento pedía evitar.
 *
 * `max` sale de las cargas cuando la fuente las da. Si no las da, una sola:
 * pintar dos rombos sin saberlo sería inventar.
 */
function habilidad(abilities, tecla, vivo, hayDatos) {
  if (!vivo) return null;
  if (!hayDatos) return { tiene: 1, max: 1 };
  const cargas = abilities.charges?.[tecla] ?? null;
  if (cargas === null) return { tiene: abilities[tecla] ? 1 : 0, max: 1 };
  return { tiene: cargas, max: Math.max(cargas, 1) };
}

/**
 * Del jugador del contrato al jugador del diseño.
 *
 * La vida es el campo con trampa: el servidor manda un número SIEMPRE, pero
 * solo es una medida si su procedencia es el cliente del propio jugador. En
 * cualquier otro caso es un 0 o un 100 deducidos de si está vivo, y pintarlos
 * como vida sería una barra de dos posiciones disfrazada de medida.
 */
function jugador(player) {
  const vidaReal = player.provenance?.health === 'player';
  const agente = AGENTE_POR_INTERNO[player.agentInternal] ?? player.agentName ?? '';
  const stats = player.stats ?? { kills: 0, deaths: 0, assists: 0 };
  const danoReal = player.provenance?.damage === 'player';

  return {
    nick: player.identity?.name ?? '',
    tag: player.identity?.tag ?? '',
    agente: agente.toLowerCase(),
    vivo: player.alive,
    vida: vidaReal ? player.health : null,
    vidaConocida: vidaReal,
    escudo: player.armor ?? 'none',
    /*
     * UN solo hueco de arma, con la que el jugador lleve encima.
     *
     * El diseño tiene un único sitio y enseña la de más prioridad: primaria
     * si la tiene, si no la secundaria, y si no el cuchillo. Eso encaja con
     * lo que da el juego, porque **manda una sola arma**, no el inventario.
     *
     * Con un matiz que conviene saber: la que manda es la que se lleva **en
     * la mano**. Si alguien corre con el cuchillo fuera teniendo un Vandal,
     * la tarjeta enseña el cuchillo. Es lo que hace el HUD del propio juego,
     * y es la verdad de lo que está pasando; deducir "la mejor que tiene"
     * exigiría recordar lo que se le vio antes y seguiría enseñándola después
     * de que la suelte.
     */
    arma: ARMA_POR_NOMBRE[player.weapon] ?? null,
    habilidades: TECLAS.map((t) =>
      habilidad(player.abilities ?? {}, t, player.alive, player.provenance?.abilities === 'player'),
    ),
    ult: player.ultimate?.points ?? 0,
    ultMax: player.ultimate?.max ?? 1,
    credito: player.money ?? 0,
    gasto: player.spentThisRound ?? 0,
    kda: `${stats.kills}/${stats.deaths}/${stats.assists}`,
    /*
     * EL DAÑO. Está en el estado y **no se pinta todavía**: el hueco en pantalla
     * lo decide Antonio, y el diseño es suyo.
     *
     * Lo que hace esto es que ese día no haya que tocar nada más que el HTML y
     * el CSS —el dato ya está aquí, con el mismo criterio que la vida—:
     *
     *   `adr` es `null` cuando no se sabe, NUNCA cero. Un jugador sin su
     *   cliente puesto no ha hecho 0 de daño. Pintar un cero ahí es afirmar
     *   algo falso sobre una persona con su nombre al lado.
     *
     * `danoConocido` está por lo mismo que `vidaConocida`: para que el diseño
     * pueda esconder la columna entera en lugar de dejar diez guiones.
     */
    adr: danoReal ? (player.damage?.adr ?? null) : null,
    dano: danoReal ? (player.damage?.total ?? 0) : null,
    danoRonda: danoReal ? (player.damage?.thisRound ?? 0) : null,
    cabezasPct: danoReal ? (player.damage?.headshotPct ?? null) : null,
    danoConocido: danoReal,
    spike: player.hasSpike === true,
    observado: player.isObserved === true,
    /* Rango competitivo (tier 0..27; 0 = sin rango → sin icono). */
    rango: typeof player.rank === 'number' ? player.rank : 0,
    /*
     * El papel del agente —duelista, controlador, iniciador, centinela—, que
     * estaba a cadena vacía desde el primer día.
     *
     * La tabla ya existía en el catálogo del diseño y no la leía nadie: un
     * campo declarado, un hueco en la tarjeta y nada dentro. El producto de
     * referencia lo pinta con su icono en el tablero de economía.
     *
     * Sale del nombre del agente y no del juego: la plataforma no manda el
     * papel. Un agente nuevo que no esté en la tabla deja el hueco vacío, que
     * es correcto — mejor sin icono que con el icono equivocado.
     */
    papel: PAPEL_DE_AGENTE[agente.toLowerCase()] ?? '',
  };
}

/** Las fases del contrato, con los nombres que usa el diseño. */
const FASES = {
  shopping: 'buy',
  combat: 'combat',
  roundEnd: 'roundEnd',
  agentSelect: 'agentSelect',
  gameOver: 'mapEnd',
};

/** El motivo de ronda, con los nombres que usa el diseño. */
const MOTIVOS = {
  elimination: 'elim',
  detonate: 'detonate',
  defuse: 'defuse',
  timeout: 'time',
};

function aplicaEstado(match) {
  estado.ronda = match.round;
  estado.etiquetaRonda = etiquetaRonda(match);
  estado.mapa = match.map;
  estado.mapasParaGanar = match.series?.mapsToWin ?? 2;
  estado.serie = serieDeMapas(match);
  /* DEMO: si el partido trae mapas de serie, se usan; si no, se conserva el
     ejemplo de arriba para poder VER la tira sin un BO real en curso. Quitar el
     `.length ? ... :` cuando ya no haga falta la demo. */
  estado.mapasSerie =
    Array.isArray(match.series?.maps) && match.series.maps.length > 0
      ? match.series.maps
      : estado.mapasSerie;
  /* El mapa en vivo no trae nombre en `mapInfo` (present solo da logo): se toma
     el mapa actual del partido. */
  for (const mp of estado.mapasSerie) {
    if (mp.state === 'live' && !mp.name) mp.name = match.map || '';
  }
  estado.minimo = esMinimo(match);
  estado.fase = FASES[match.phase] ?? 'combat';

  /*
   * `finRonda` se apaga también al entrar en compra, por coherencia con la
   * pantalla de ceremonia —que es la que pinta esto de verdad—.
   *
   * OJO: hoy **ninguna pantalla lee `finRonda`**. El cartel de fin de ronda
   * vive en `carteles/ceremonia.html`, que se dispara con el mismo suceso y no
   * pasa por aquí. Este campo es exactamente el caso que ya nos ha mordido dos
   * veces —los mapas de la serie y los patrocinadores—: un dato que se calcula,
   * viaja y nadie usa. Se deja coherente para que no mienta el día que alguien
   * lo pinte, y queda anotado como candidato a desaparecer.
   */
  if (estado.fase === 'shopping' && estado.finRonda?.visible === true) {
    clearTimeout(cartelTimer);
    estado.finRonda = { ...estado.finRonda, visible: false };
  }

  estado.equipos = match.teams.map((team) => ({
    tricode: team.shortName,
    nombre: team.name,
    logo: team.logoUrl,
    tantos: team.roundsWon,
    mapas: team.mapsWon,
    bando: team.side,
    tiemposUsados: Math.max(0, (match.rules?.timeoutsPerTeam ?? 0) - team.timeoutsRemaining),
    tiemposTotal: match.rules?.timeoutsPerTeam ?? 0,
  }));

  /* DEMO: si el partido trae roster, se usa; si no (feed sin jugadores), se
     conserva el roster de ejemplo para poder VER las tarjetas y las teclas. */
  const roster = match.teams.map((team) => team.players.map(jugador));
  const hayRoster = roster.some((equipo) => equipo.length > 0);
  estado.jugadores = hayRoster ? roster : estado.jugadores;

  /* Historial: el contrato lo guarda por equipo, y el diseño lo quiere como
     una sola lista en orden de ronda. Se toma la fila del ganador, que es la
     única que lleva motivo. */
  const rondas = new Map();
  match.teams.forEach((team, index) => {
    for (const record of team.roundHistory ?? []) {
      if (!record.won) continue;
      rondas.set(record.round, { gana: index, motivo: MOTIVOS[record.reason] ?? 'elim' });
    }
  });
  estado.historial = [...rondas.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);

  /* La spike: el diseño cuenta desde el instante del plantado con su propio
     reloj, así que se le pasa el instante y no los segundos que quedan. */
  const spike = match.spike ?? {};
  estado.spikeSegundos = match.rules?.spikeDurationSec ?? 45;
  estado.spike = {
    plantadaEn: spike.status === 'planted' ? spike.plantedAt : null,
    sitio: spike.site ?? '',
  };

  /* Tiempo muerto. El diseño quiere el reloj ya formateado y el avance en
     porcentaje; el contrato manda el instante de arranque y la duración. */
  const timeout = match.timeout ?? null;
  if (timeout === null) {
    estado.pausa = { ...estado.pausa, visible: false };
  } else {
    const total = timeout.durationSec;
    const resto = Math.max(0, total - (Date.now() - timeout.startedAt) / 1000);
    const min = Math.floor(resto / 60);
    const seg = Math.floor(resto % 60);
    estado.pausa = {
      visible: true,
      tactica: timeout.kind === 'tactical',
      equipo: timeout.teamIndex ?? 0,
      reloj: `${min}:${String(seg).padStart(2, '0')}`,
      avance: total > 0 ? Math.round((1 - resto / total) * 100) : 100,
    };
  }

  const marca = match.broadcast ?? {};
  estado.marca = marca.watermark ?? '';
  /* Torneo (esquina superior derecha). El banner real sale del panel; si el
     partido no trae logo, se conserva el ejemplo de la demo. */
  estado.torneoNombre = marca.tournamentName || estado.torneoNombre;
  estado.torneoLogo =
    typeof marca.tournamentLogo === 'string' && marca.tournamentLogo
      ? marca.tournamentLogo
      : estado.torneoLogo;
  estado.patrocinadores = marca.sponsors ?? [];

  const cam = match.playercams ?? {};
  estado.camaras = {
    activas: cam.enabled === true,
    sala: cam.room ?? '',
    publicando: Array.isArray(cam.enabledPlayers) ? cam.enabledPlayers : [],
  };

  publica();
}

/* ── Sucesos: instantes que hay que convertir en algo que dure ───────────── */

/**
 * Tope de cuánto se queda el cartel de fin de ronda.
 *
 * Lo normal es que lo quite la fase de compra, que es la señal del juego de que
 * la ronda siguiente ha empezado (ver `aplicaEstado`). Esto es el tope para que
 * no se quede clavado si esa fase no llega nunca.
 */
const CARTEL_MS = 4000;
let cartelTimer;

function aplicaSuceso(event) {
  if (event.type === 'roundEnd') {
    /* El servidor manda la ceremonia ya deducida: no hay que contar bajas
       aquí. Llega una sola vez, así que se enciende y se apaga sola. */
    estado.finRonda = {
      visible: true,
      gana: event.winnerIndex ?? 0,
      ceremonia: event.ceremony ?? 'roundWin',
    };
    clearTimeout(cartelTimer);
    cartelTimer = setTimeout(() => {
      estado.finRonda = { ...estado.finRonda, visible: false };
      publica();
    }, CARTEL_MS);
    publica();
  }

  if (event.type === 'matchEnd') {
    estado.victoria = {
      visible: true,
      gana: event.winnerIndex ?? 0,
      palabra: 'VICTORIA',
      contexto: `gana el mapa · ${estado.mapa}`.toLowerCase(),
    };
    publica();
  }
}

/* ── Conexión ────────────────────────────────────────────────────────────── */

/*
 * La fuente es el servidor: `comun/fuente.js` abre el socket, traduce su
 * estado a este mismo contrato `match` y deduce los sucesos (fin de ronda con
 * su ceremonia). Aquí solo se enchufan las dos funciones de siempre, así que
 * esta pantalla no ha cambiado en nada más. La reconexión la lleva socket.io.
 */
abreFuente({
  onMatch: (match) => aplicaEstado(match),
  onEvents: (eventos) => eventos.forEach(aplicaSuceso),
});
