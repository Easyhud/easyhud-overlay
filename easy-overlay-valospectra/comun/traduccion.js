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
    identity: { name: p.name ?? '' },
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
      salida.push({ name: m.map ?? '', state: 'past', score: [m.left?.score ?? 0, m.right?.score ?? 0] });
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

/**
 * La ceremonia de la ronda, con la lógica del `endround-banner` de ValoSpectra.
 *
 * `clutch` no se puede leer en el instante del final —a esas alturas puede que
 * no quede nadie vivo—, así que se sigue ronda a ronda: cada estado actualiza
 * quién va quedando en situación de clutch, y al terminar se consulta.
 */
export function ceremoniaDe(m, ganador, clutch) {
  const equipos = m.teams ?? [];
  const gana = equipos[ganador];
  const pierde = equipos[ganador === 0 ? 1 : 0];
  if (!gana || !pierde) return 'roundWin';

  let ace = false;
  let impecable = true;
  let aceDeEquipo = true;

  const nombresPerdedor = new Set((pierde.players ?? []).map((p) => p.name));

  for (const p of pierde.players ?? []) {
    if (p.isAlive) impecable = false;
  }
  for (const p of gana.players ?? []) {
    if (Array.isArray(p.killedPlayerNames)) {
      const bajasAlRival = p.killedPlayerNames.filter((n) => nombresPerdedor.has(n));
      if (new Set(bajasAlRival).size >= 5) {
        ace = true;
        break;
      }
    }
    if ((p.deathsThisRound ?? 0) >= 1) impecable = false;
    if (!((p.killsThisRound ?? 0) >= 1)) aceDeEquipo = false;
  }

  if (ace) return 'ace';
  if (clutch[ganador] === 1) return 'clutch';
  if (aceDeEquipo) return 'teamAce';
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
  };
}
