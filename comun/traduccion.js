/* LA TRADUCCIÓN — de `IMatchData` de ValoSpectra al contrato `match` del diseño.
   =============================================================================

   Aquí vive SOLO la lógica de mapeo y deducción, sin nada del navegador ni del
   socket. Es a propósito: así se puede probar sola, con un estado de ejemplo,
   y `fuente.js` se queda con lo suyo —abrir la conexión y recordar lo que hay
   que recordar entre mensajes—.

   Lo que ValoSpectra no manda como dato se deduce con la misma lógica que usa
   su propio overlay (quién ganó, la ceremonia, el clutch, el fin de mapa), y lo
   que ni se ve ni se puede deducir se queda sin pintar, nunca inventado (el
   daño / ADR no lo reporta ValoSpectra, así que sale `null`). */

/* ── Jugador ─────────────────────────────────────────────────────────────── */

/** El escudo, con los nombres que usa el diseño. */
export function escudoDe(armorName) {
  const n = String(armorName ?? '').toLowerCase();
  if (n.startsWith('heavy')) return 'heavy';
  if (n.startsWith('regen')) return 'regen';
  if (n.startsWith('light')) return 'light';
  return 'none';
}

/**
 * De un jugador de ValoSpectra al jugador del contrato del diseño.
 *
 * La vida y las habilidades solo cuentan como MEDIDA si el cliente auxiliar
 * del jugador las reporta (`auxiliaryAvailable`). Se traduce esa señal a
 * `provenance`, que es el campo con el que el diseño decide entre pintar el
 * dato o pintar un hueco. El daño no lo da ValoSpectra: `provenance.damage`
 * queda en `server` siempre, y el diseño esconde la columna.
 */
export function traduceJugador(p) {
  const aux = p.auxiliaryAvailable ?? { health: false, abilities: false, scoreboard: false };
  const ab = p.abilities ?? { grenade: 0, ability1: 0, ability2: 0 };

  return {
    identity: { name: p.name ?? '', tag: p.tagline ?? '' },
    /* ValoSpectra manda el nombre en clave de Overwolf (Wushu, Aggrobot…),
       que es exactamente lo que el catálogo del diseño sabe traducir. */
    agentInternal: p.agentInternal ?? '',
    agentName: '',
    alive: p.isAlive === true,
    health: typeof p.health === 'number' ? p.health : 0,
    armor: escudoDe(p.armorName),
    weapon: p.highestWeapon ?? '',
    /* Las habilidades de ValoSpectra ya vienen como número de cargas. Se
       ponen también en `charges` para que el diseño pinte un rombo por uso en
       vez de solo encendido/apagado. */
    abilities: {
      grenade: ab.grenade ?? 0,
      ability1: ab.ability1 ?? 0,
      ability2: ab.ability2 ?? 0,
      charges: { grenade: ab.grenade ?? 0, ability1: ab.ability1 ?? 0, ability2: ab.ability2 ?? 0 },
    },
    ultimate: { points: p.currUltPoints ?? 0, max: p.maxUltPoints ?? 1 },
    money: p.money ?? 0,
    spentThisRound: p.moneySpent ?? 0,
    stats: { kills: p.kills ?? 0, deaths: p.deaths ?? 0, assists: p.assists ?? 0 },
    hasSpike: p.hasSpike === true,
    isObserved: p.isObserved === true,
    /* Rango competitivo (tier 0..27). Lo resuelve el cliente del observador por
       puuid; 0 = sin rango, no se pinta icono. */
    rank: typeof p.rank === 'number' ? p.rank : 0,
    /* La selección de agentes lo usa para saber quién ya confirmó. */
    locked: p.locked === true,
    /* Sin daño en el estado: el diseño lo lee como desconocido y no pinta ADR. */
    damage: null,
    provenance: {
      health: aux.health ? 'player' : 'server',
      abilities: aux.abilities ? 'player' : 'server',
      damage: 'server',
    },
  };
}

/* ── Historial ───────────────────────────────────────────────────────────── */

/** El tipo de ValoSpectra -> el motivo que el diseño mapea con MOTIVOS. */
const MOTIVO_VS = {
  kills: 'elimination',
  detonated: 'detonate',
  defused: 'defuse',
  timeout: 'timeout',
};

/**
 * El historial por equipo, en la forma del contrato del diseño.
 *
 * ValoSpectra lo guarda por equipo en `roundRecord`, con el tipo desde el
 * punto de vista de ese equipo: `lost` es que lo perdió, cualquier otro que lo
 * ganó por ese motivo, `upcoming` que aún no se ha jugado.
 */
export function historialDe(team) {
  const registros = Array.isArray(team.roundRecord) ? team.roundRecord : [];
  return registros
    .filter((r) => r.type !== 'upcoming')
    .map((r) => ({
      round: r.round,
      won: r.type !== 'lost',
      reason: MOTIVO_VS[r.type] ?? 'elimination',
      side: r.wasAttack ? 'attack' : 'defense',
    }));
}

/* ── Serie ───────────────────────────────────────────────────────────────── */

/** `mapInfo` de ValoSpectra -> `series.maps` del diseño. */
export function mapasSerie(mapInfo) {
  if (!Array.isArray(mapInfo)) return [];
  const salida = [];
  for (const m of mapInfo) {
    if (m.type === 'past') {
      const izq = m.left?.score ?? 0;
      const der = m.right?.score ?? 0;
      const ganoIzq = izq >= der;
      salida.push({
        name: m.map ?? '',
        state: 'past',
        score: [izq, der],
        /* Lado del ganador + los logos de AMBOS equipos: el historial pinta el
           ganador brillante y el perdedor en gris. */
        winner: ganoIzq ? 0 : 1,
        winnerLogo: (ganoIzq ? m.left?.logo : m.right?.logo) ?? '',
        leftLogo: m.left?.logo ?? '',
        rightLogo: m.right?.logo ?? '',
      });
    } else if (m.type === 'present') {
      salida.push({ name: '', state: 'live' });
    } else if (m.type === 'future') {
      salida.push({ name: m.map ?? '', state: 'future' });
    }
    /* `disabled` no es un mapa: se omite. */
  }
  return salida;
}

/* ── Fase y fin de mapa ──────────────────────────────────────────────────── */

/** `roundPhase` de ValoSpectra -> la fase del contrato del diseño. */
export const FASE_VS = {
  LOBBY: 'agentSelect',
  shopping: 'shopping',
  combat: 'combat',
  end: 'roundEnd',
};

/** Cuántas rondas hacen falta para ganar el mapa, de las reglas del formato. */
export function rondasParaGanar(m) {
  const primeraProrroga = m.firstOtRound ?? 0;
  if (primeraProrroga > 1) return (primeraProrroga - 1) / 2 + 1;
  return 13; // formato estándar
}

/** ¿Está el mapa decidido ya, por marcador? */
export function mapaDecidido(m) {
  const objetivo = rondasParaGanar(m);
  const a = m.teams?.[0]?.roundsWon ?? 0;
  const b = m.teams?.[1]?.roundsWon ?? 0;
  const alto = Math.max(a, b);
  const bajo = Math.min(a, b);
  if (alto < objetivo) return false;
  const enProrroga = (m.firstOtRound ?? 0) > 1 && (m.roundNumber ?? 0) >= m.firstOtRound;
  /* En prórroga se gana por dos; en juego normal, llegar al objetivo basta. */
  return enProrroga ? alto - bajo >= 2 : true;
}

/* ── Quién ganó y qué ceremonia ──────────────────────────────────────────── */

/** El equipo que ganó, con la misma cuenta que hace ValoSpectra. */
export function equipoGanador(m) {
  const atacaIzquierda = m.teams?.[0]?.isAttacking === true;
  if (m.attackersWon) return atacaIzquierda ? 0 : 1;
  return atacaIzquierda ? 1 : 0;
}

/* ── Economía, para la ronda ahorrada ────────────────────────────────────── */

/*
 * Lo que cuesta cada arma, en créditos.
 *
 * ES UNA TABLA DE PRECIOS DE UN JUEGO QUE LOS CAMBIA. Riot los retoca cada
 * pocos actos, así que esto envejece: si un día la «ronda ahorrada» empieza a
 * salir cuando no toca, el primer sitio donde mirar es aquí. Un arma que no
 * esté en la tabla vale cero, que es preferible a inventarle un precio: hace
 * que la ceremonia no salte, no que salte mal.
 */
const PRECIO_ARMA = {
  classic: 0, melee: 0,
  shorty: 300, frenzy: 450, ghost: 500, sheriff: 800,
  bucky: 850, stinger: 950, marshal: 950,
  ares: 1600, spectre: 1600, judge: 1850, bulldog: 2050,
  guardian: 2250, outlaw: 2400, phantom: 2900, vandal: 2900,
  odin: 3200, operator: 4700,
};

const PRECIO_ESCUDO = { light: 400, regen: 650, heavy: 1000, none: 0 };

/** Lo que vale el equipamiento de un equipo: armas más escudos. */
export function valorEquipo(team) {
  return (team?.players ?? []).reduce((suma, p) => {
    const arma = String(p.highestWeapon ?? '').toLowerCase();
    return suma
      + (PRECIO_ARMA[arma] ?? 0)
      + (PRECIO_ESCUDO[escudoDe(p.armorName)] ?? 0);
  }, 0);
}

/**
 * Cuánto más barato tiene que ir el ganador para que cuente como ahorrada.
 *
 * Riot no publica su umbral. La mitad es la aproximación que se usa por ahí y
 * la que deja fuera los casos dudosos: ganar con un 90% del equipamiento del
 * rival no es una gesta, es una ronda normal.
 */
const UMBRAL_AHORRADA = 0.5;

/**
 * Sigue el valor del equipamiento con el que cada equipo ENTRA en la ronda.
 *
 * Hay que capturarlo al empezar el combate y no al terminar la ronda, y el
 * motivo es el de siempre en este overlay: al final ya no es verdad. Los
 * muertos sueltan el arma y dejan de reportarla, así que el equipo arrasado
 * aparece con equipamiento cero y la cuenta sale al revés — el que perdió
 * parecería el pobre.
 */
export function actualizaEconomia(m, eco) {
  if (m.roundPhase !== 'combat') return;
  const ronda = m.roundNumber ?? -1;
  if (eco.ronda === ronda) return;
  eco.ronda = ronda;
  eco.valor = [valorEquipo(m.teams?.[0]), valorEquipo(m.teams?.[1])];
}

/**
 * La ceremonia de la ronda.
 *
 * `clutch` y `eco` no se pueden leer en el instante del final —a esas alturas
 * puede que no quede nadie vivo y las armas ya no estén—, así que se siguen
 * ronda a ronda: cada estado los actualiza y aquí solo se consultan.
 *
 * El orden manda: se devuelve la primera que se cumpla, de la más rara a la
 * más común. Un ace que además es impecable se anuncia como ace.
 */
export function ceremoniaDe(m, ganador, clutch, eco) {
  const equipos = m.teams ?? [];
  const gana = equipos[ganador];
  const pierde = equipos[ganador === 0 ? 1 : 0];
  if (!gana || !pierde) return 'roundWin';

  const suyos = gana.players ?? [];
  const nombresPerdedor = new Set((pierde.players ?? []).map((p) => p.name));

  /* Ace: UNO solo se lleva a los cinco del rival. Se cuentan por nombre y solo
     los del bando contrario, que el fuego amigo no cuenta. */
  const ace = suyos.some((p) => {
    if (!Array.isArray(p.killedPlayerNames)) return false;
    const alRival = p.killedPlayerNames.filter((n) => nombresPerdedor.has(n));
    return new Set(alRival).size >= 5;
  });
  if (ace) return 'ace';

  if (clutch?.[ganador] === 1) return 'clutch';

  /*
   * Ace de equipo: los CINCO matan a alguien.
   *
   * Se exige que el equipo esté completo, y no es un detalle: con un roster
   * incompleto —que es lo normal mientras se prueba, y pasa en directo si el
   * observador entra tarde— «todos han matado» se cumple con un solo jugador,
   * y la pantalla anunciaba un ace de equipo por una baja suelta.
   */
  const aceDeEquipo = suyos.length >= 5 && suyos.every((p) => (p.killsThisRound ?? 0) >= 1);
  if (aceDeEquipo) return 'teamAce';

  /*
   * Ronda ahorrada: ganar con mucho menos equipamiento que el rival.
   *
   * ValoSpectra la tiene declarada y nunca llegó a deducirla —en su banner de
   * fin de ronda es literalmente `const thrifty = false`—, así que esta sale de
   * la tabla de precios de arriba y no de ellos.
   */
  const mio = eco?.valor?.[ganador] ?? 0;
  const suyo = eco?.valor?.[ganador === 0 ? 1 : 0] ?? 0;
  if (suyo > 0 && mio < suyo * UMBRAL_AHORRADA) return 'thrifty';

  /*
   * Impecable: el que gana no pierde a NADIE.
   *
   * Antes exigía además que el rival estuviera entero muerto, y eso es otra
   * cosa: así, una ronda ganada por desactivado o por tiempo sin una sola baja
   * propia —que es justo la definición— no se anunciaba nunca.
   */
  const impecable = suyos.length > 0 && suyos.every((p) => (p.deathsThisRound ?? 0) === 0);
  if (impecable) return 'flawless';

  return 'roundWin';
}

/** Sigue la situación de clutch, ronda a ronda, como ValoSpectra. */
export function actualizaClutch(m, clutch) {
  const vivos = (i) => (m.teams?.[i]?.players ?? []).filter((p) => p.isAlive).length;
  const v0 = vivos(0);
  const v1 = vivos(1);
  if (v0 < 1 || v0 >= 2) clutch[0] = 0;
  if (v1 < 1 || v1 >= 2) clutch[1] = 0;
  if ((v0 === 1 && v1 >= 2) || clutch[0] === 1) clutch[0] = 1;
  if ((v1 === 1 && v0 >= 2) || clutch[1] === 1) clutch[1] = 1;
}

/* ── El estado completo ──────────────────────────────────────────────────── */

/**
 * Traduce un `IMatchData` de ValoSpectra al contrato `match` del diseño.
 *
 * `decidido` (si el mapa ya está ganado) lo calcula quien llama, porque la
 * fase `gameOver` depende de ello y ese cálculo se reusa para el suceso de fin
 * de mapa. La spike y el tiempo muerto se dejan a `null`: llevan un instante
 * deducido que solo `fuente.js` puede recordar entre mensajes, y los rellena.
 */
export function traduceEstado(m, decidido) {
  const cuentaTiempos = m.tools?.timeoutCounter ?? { max: 0, left: 0, right: 0 };
  const serie = m.tools?.seriesInfo ?? { needed: 0, wonLeft: 0, wonRight: 0, mapInfo: [] };
  const patro = m.tools?.sponsorInfo ?? { enabled: false, duration: 8, sponsors: [] };
  const agua = m.tools?.watermarkInfo ?? { customTextEnabled: false, customText: '' };
  const torneo = m.tools?.tournamentInfo ?? { name: '' };
  const camaras = m.tools?.playercamsInfo ?? { enable: false, identifier: '', enabledPlayers: [] };
  const aviso = m.toastInfo ?? { active: false, title: '', message: '', selectedTeam: 'none' };

  const equipos = (m.teams ?? []).map((team, i) => ({
    shortName: team.teamTricode ?? '',
    name: team.teamName ?? '',
    logoUrl: team.teamUrl ?? '',
    roundsWon: team.roundsWon ?? 0,
    mapsWon: i === 0 ? (serie.wonLeft ?? 0) : (serie.wonRight ?? 0),
    side: team.isAttacking ? 'attack' : 'defense',
    timeoutsRemaining: i === 0 ? (cuentaTiempos.left ?? 0) : (cuentaTiempos.right ?? 0),
    players: (team.players ?? []).map(traduceJugador),
    roundHistory: historialDe(team),
  }));

  const fase = decidido ? 'gameOver' : (FASE_VS[m.roundPhase] ?? 'combat');

  return {
    round: m.roundNumber ?? 1,
    roomCode: m.groupCode ?? '',
    map: m.map ?? '',
    phase: fase,
    rules: {
      overtimeStartRound: m.firstOtRound ?? 0,
      timeoutsPerTeam: cuentaTiempos.max ?? 0,
      spikeDurationSec: 45,
    },
    series: {
      mapsToWin: serie.needed ?? 0,
      maps: mapasSerie(serie.mapInfo),
    },
    teams: equipos,
    spike: null, // lo rellena fuente.js, con el instante deducido
    timeout: null, // idem
    broadcast: {
      watermark: agua.customTextEnabled ? (agua.customText ?? '') : '',
      minimal: false,
      tournamentName: torneo.name ?? '',
      tournamentLogo: torneo.logoUrl ?? '',
      sponsors: {
        enabled: patro.enabled === true,
        urls: Array.isArray(patro.sponsors) ? patro.sponsors : [],
        rotateMs: (patro.duration ?? 0) > 0 ? patro.duration * 1000 : 8000,
      },
      toast: {
        visible: aviso.active === true,
        title: aviso.title ?? '',
        message: aviso.message ?? '',
        teamIndex: aviso.selectedTeam === 'left' ? 0 : aviso.selectedTeam === 'right' ? 1 : null,
      },
    },
    /* Cámaras de jugador (VDO.Ninja). `room` es la sala; cada cámara se arma
       determinísticamente del Nombre#TAG del jugador. `enabledPlayers` son los
       fullName ("Nombre#TAG") que están publicando. */
    playercams: {
      enabled: camaras.enable === true,
      room: camaras.identifier ?? '',
      enabledPlayers: Array.isArray(camaras.enabledPlayers) ? camaras.enabledPlayers : [],
    },
  };
}
