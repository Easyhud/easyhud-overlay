import { traduceEstado, mapaDecidido, equipoGanador, ceremoniaDe, actualizaClutch, escudoDe, historialDe, valorEquipo, actualizaEconomia } from './traduccion.js';

let fallos = 0;
const ok = (c, msg) => { if (!c) { console.log("  x", msg); fallos++; } else console.log("  ok", msg); };

const jugador = (o = {}) => ({
  name: o.name ?? 'p', fullName: '', playerId: o.id ?? 1, isAlive: o.alive ?? true, agentInternal: o.ag ?? 'Wushu',
  locked: o.locked ?? true, isObserved: o.obs ?? false, armorName: o.armor ?? 'Heavy', money: o.money ?? 3900,
  moneySpent: o.spent ?? 0, highestWeapon: o.weap ?? 'Vandal', isCaptain: false, currUltPoints: o.ult ?? 3,
  maxUltPoints: 7, ultReady: false, hasSpike: o.spike ?? false,
  scoreboardAvailable: true, auxiliaryAvailable: { health: o.auxH ?? true, abilities: o.auxA ?? true, scoreboard: true },
  kills: o.k ?? 2, deaths: o.d ?? 0, assists: o.a ?? 1, killsThisRound: o.ktr ?? 1, deathsThisRound: o.dtr ?? 0,
  killedPlayerNames: o.killed ?? [], health: o.hp ?? 100, abilities: { grenade: o.g ?? 1, ability1: o.a1 ?? 2, ability2: o.a2 ?? 0 },
  iconNameSuffix: '',
});

const match = {
  groupCode: '123', isRanked: false, isRunning: true, roundNumber: 5, roundPhase: 'combat',
  map: 'Ascent', firstOtRound: 25, switchRound: 13, attackersWon: true, showAliveKDA: true,
  spikeState: { planted: true, defused: false, detonated: false },
  timeoutState: { techPause: false, leftTeam: true, rightTeam: false, timeRemaining: 45 },
  toastInfo: { active: true, title: 'MVP', message: 'ronda 4', duration: null, eventLogoEnabled: false, selectedTeam: 'left' },
  teams: [
    { teamName: 'Alpha', teamUrl: 'http://x/a.png', teamTricode: 'ALP', spentThisRound: 400, isAttacking: true, roundsWon: 4,
      players: [jugador({ name: 'a1', auxH: true, armor: 'Heavy', hp: 78 }), jugador({ name: 'a2', auxH: false, armor: 'Light', hp: 100 }),
                jugador({ name: 'a3' }), jugador({ name: 'a4' }), jugador({ name: 'a5' })],
      roundRecord: [{ type: 'kills', wasAttack: true, round: 1 }, { type: 'lost', wasAttack: true, round: 2 }, { type: 'upcoming', wasAttack: true, round: 5 }] },
    { teamName: 'Bravo', teamUrl: 'http://x/b.png', teamTricode: 'BRV', spentThisRound: 200, isAttacking: false, roundsWon: 0,
      players: [jugador({ name: 'b1', alive: false, ag: 'Aggrobot' }), jugador({ name: 'b2', alive: false }), jugador({ name: 'b3', alive: false }),
                jugador({ name: 'b4', alive: false }), jugador({ name: 'b5', alive: false })],
      roundRecord: [{ type: 'detonated', wasAttack: false, round: 2 }] },
  ],
  tools: {
    seriesInfo: { needed: 2, wonLeft: 1, wonRight: 0, mapInfo: [
      { type: 'past', map: 'Bind', left: { logo: '', score: 13 }, right: { logo: '', score: 9 } },
      { type: 'present', logo: '' },
      { type: 'future', map: 'Haven', logo: '' }] },
    timeoutCounter: { max: 2, left: 1, right: 2 },
    timeoutDuration: 60,
    sponsorInfo: { enabled: true, duration: 8, sponsors: ['http://x/s1.png', 'http://x/s2.png'] },
    watermarkInfo: { spectraWatermark: true, customTextEnabled: true, customText: 'EASY' },
    tournamentInfo: { name: 'Easy Cup', logoUrl: '', backdropUrl: '' },
  },
};

console.log("FASE / ESTRUCTURA");
const decidido = mapaDecidido(match);
const m = traduceEstado(match, decidido);
ok(m.phase === 'combat', "phase combat");
ok(m.round === 5 && m.map === 'Ascent', "round/map");
ok(m.rules.overtimeStartRound === 25 && m.rules.timeoutsPerTeam === 2, "rules");
ok(m.roomCode === '123', "roomCode");

console.log("EQUIPOS");
ok(m.teams[0].shortName === 'ALP' && m.teams[0].name === 'Alpha' && m.teams[0].logoUrl === 'http://x/a.png', "equipo0 basico");
ok(m.teams[0].side === 'attack' && m.teams[1].side === 'defense', "bandos");
ok(m.teams[0].roundsWon === 4 && m.teams[0].mapsWon === 1 && m.teams[1].mapsWon === 0, "tantos/mapas");
ok(m.teams[0].timeoutsRemaining === 1 && m.teams[1].timeoutsRemaining === 2, "tiempos restantes");

console.log("JUGADOR");
const a1 = m.teams[0].players[0], a2 = m.teams[0].players[1];
ok(a1.identity.name === 'a1' && a1.agentInternal === 'Wushu', "nick/agentInternal");
ok(a1.provenance.health === 'player' && a1.health === 78, "vida conocida");
ok(a2.provenance.health === 'server', "vida desconocida sin aux");
ok(a1.provenance.damage === 'server' && a1.damage === null, "ADR sin pintar");
ok(a1.armor === 'heavy' && a2.armor === 'light', "escudo");
ok(a1.weapon === 'Vandal', "arma passthrough");
ok(a1.abilities.charges.ability1 === 2 && a1.abilities.charges.ability2 === 0, "cargas habilidades");
ok(a1.ultimate.points === 3 && a1.ultimate.max === 7, "ulti");
ok(a1.locked === true, "locked (seleccion)");

console.log("SERIE / HISTORIAL");
ok(m.series.mapsToWin === 2, "mapsToWin");
ok(m.series.maps.length === 3 && m.series.maps[0].state === 'past' && m.series.maps[0].score[0] === 13, "serie mapas past");
ok(m.series.maps[1].state === 'live', "serie mapa live");
ok(m.teams[0].roundHistory.length === 2, "historial filtra upcoming");
ok(m.teams[0].roundHistory[0].won === true && m.teams[0].roundHistory[0].reason === 'elimination', "hist kills->elimination");
ok(m.teams[0].roundHistory[1].won === false, "hist lost");
ok(m.teams[1].roundHistory[0].reason === 'detonate', "hist detonated->detonate");

console.log("BROADCAST");
ok(m.broadcast.watermark === 'EASY', "watermark custom");
ok(m.broadcast.tournamentName === 'Easy Cup', "torneo");
ok(m.broadcast.sponsors.enabled && m.broadcast.sponsors.urls.length === 2 && m.broadcast.sponsors.rotateMs === 8000, "sponsors");
ok(m.broadcast.toast.visible && m.broadcast.toast.title === 'MVP' && m.broadcast.toast.teamIndex === 0, "toast");

console.log("DEDUCCIONES: ganador / ceremonia / fin");
ok(equipoGanador(match) === 0, "attackersWon + team0 ataca -> gana 0");
const clutch = [-1, -1]; actualizaClutch(match, clutch);
const cer = ceremoniaDe(match, 0, clutch);
ok(['flawless', 'teamAce', 'ace'].includes(cer), "ceremonia coherente (" + cer + ")");
const mAce = structuredClone(match);
mAce.teams[0].players[0].killedPlayerNames = ['b1', 'b2', 'b3', 'b4', 'b5'];
ok(ceremoniaDe(mAce, 0, [-1, -1]) === 'ace', "ace por 5 bajas");
ok(mapaDecidido(match) === false, "4-0 no decidido");
ok(mapaDecidido({ ...match, teams: [{ ...match.teams[0], roundsWon: 13 }, { ...match.teams[1], roundsWon: 9 }] }) === true, "13-9 decidido");
ok(mapaDecidido({ ...match, roundNumber: 26, teams: [{ ...match.teams[0], roundsWon: 13 }, { ...match.teams[1], roundsWon: 12 }] }) === false, "OT 13-12 NO decidido");
ok(mapaDecidido({ ...match, roundNumber: 28, teams: [{ ...match.teams[0], roundsWon: 14 }, { ...match.teams[1], roundsWon: 12 }] }) === true, "OT 14-12 decidido");

ok(escudoDe('Regen') === 'regen' && escudoDe('') === 'none', "escudoDe regen/none");

/* ── Motivo de cada ronda ──────────────────────────────────────────────────
   Salió de una queja concreta: en el tablero de compra TODAS las rondas se
   marcaban como eliminación, sin explosión, sin desactivado y sin tiempo. Esto
   fija los cuatro casos en NUESTRO lado, para que si vuelve a pasar en una
   partida real se sepa que el fallo viene de más arriba y no de aquí. */
console.log("MOTIVO DE CADA RONDA");
{
  const h = historialDe({ roundRecord: [
    { round: 1, type: "kills", wasAttack: true },
    { round: 2, type: "detonated", wasAttack: true },
    { round: 3, type: "defused", wasAttack: false },
    { round: 4, type: "timeout", wasAttack: false },
    { round: 5, type: "lost", wasAttack: true },
    { round: 6, type: "upcoming", wasAttack: true },
  ] });

  ok(h.length === 5, "las rondas sin jugar no entran en el historial");
  ok(h[0].reason === "elimination" && h[0].won, "kills -> eliminación");
  ok(h[1].reason === "detonate" && h[1].won, "detonated -> explosión");
  ok(h[2].reason === "defuse" && h[2].won, "defused -> desactivada");
  ok(h[3].reason === "timeout" && h[3].won, "timeout -> se acabó el tiempo");
  ok(h[4].won === false, "lost se marca como ronda perdida");
  ok(h[0].side === "attack" && h[2].side === "defense", "el bando de cada ronda");

  /* Un tipo desconocido cae en eliminación. Queda fijado a propósito: es el
     agujero por el que se colaría en silencio un motivo nuevo del servidor. */
  const raro = historialDe({ roundRecord: [{ round: 1, type: "loquesea", wasAttack: true }] });
  ok(raro[0].reason === "elimination", "un tipo desconocido cae en eliminación");
}

/* ── Ceremonias ────────────────────────────────────────────────────────────
   Cinco ceremonias y un orden. Los casos de aquí son los tres fallos que
   tenía la deducción, más la que no existía. */
console.log("CEREMONIAS");
{
  const j = (o = {}) => ({
    name: o.name, isAlive: o.alive ?? true,
    killsThisRound: o.k ?? 0, deathsThisRound: o.d ?? 0,
    killedPlayerNames: o.mato ?? [],
    highestWeapon: o.arma ?? "Classic", armorName: o.escudo ?? "None",
  });
  const equipo = (nombres, extra = {}) => ({
    players: nombres.map((n, q) => j({ name: n, ...(extra[q] ?? {}) })),
  });
  const A = ["a1", "a2", "a3", "a4", "a5"];
  const B = ["b1", "b2", "b3", "b4", "b5"];
  const sinClutch = [0, 0];
  const sinEco = { ronda: 1, valor: [0, 0] };
  const partida = (gana, pierde) => ({ teams: [gana, pierde] });

  /* Ace: uno se lleva a los cinco. */
  ok(ceremoniaDe(partida(equipo(A, { 0: { mato: B, k: 5 } }), equipo(B)), 0, sinClutch, sinEco) === "ace",
     "uno mata a los cinco -> ace");

  /* El fuego amigo no cuenta para el ace. */
  ok(ceremoniaDe(partida(equipo(A, { 0: { mato: ["b1", "b2", "b3", "a2", "a3"], k: 5 } }), equipo(B)), 0, sinClutch, sinEco) !== "ace",
     "tres rivales y dos compañeros NO son un ace");

  /* Ace de equipo: los cinco matan. */
  const todosMatan = { 0: { k: 1 }, 1: { k: 1 }, 2: { k: 1 }, 3: { k: 1 }, 4: { k: 1 } };
  ok(ceremoniaDe(partida(equipo(A, todosMatan), equipo(B)), 0, sinClutch, sinEco) === "teamAce",
     "los cinco matan -> ace de equipo");

  /* El fallo que había: con roster incompleto se anunciaba ace de equipo. */
  ok(ceremoniaDe(partida(equipo(["a1"], { 0: { k: 1 } }), equipo(B)), 0, sinClutch, sinEco) !== "teamAce",
     "un solo jugador con una baja NO es ace de equipo");

  /* Impecable: el ganador no pierde a nadie, aunque el rival siga vivo.
     Es el caso que antes no salía nunca: ganar por desactivado sin bajas. */
  const rivalVivo = equipo(B, { 0: { alive: true }, 1: { alive: true } });
  ok(ceremoniaDe(partida(equipo(A), rivalVivo), 0, sinClutch, sinEco) === "flawless",
     "sin bajas propias y con rivales vivos -> impecable");

  ok(ceremoniaDe(partida(equipo(A, { 2: { d: 1 } }), equipo(B)), 0, sinClutch, sinEco) === "roundWin",
     "con una baja propia ya no es impecable");

  /* Ronda ahorrada: ganar con menos de la mitad de equipamiento. */
  const eco = { ronda: 1, valor: [2000, 12000] };
  ok(ceremoniaDe(partida(equipo(A, { 2: { d: 1 } }), equipo(B)), 0, sinClutch, eco) === "thrifty",
     "2000 contra 12000 -> ronda ahorrada");
  ok(ceremoniaDe(partida(equipo(A, { 2: { d: 1 } }), equipo(B)), 0, sinClutch, { ronda: 1, valor: [7000, 12000] }) !== "thrifty",
     "7000 contra 12000 NO es ronda ahorrada");

  /* El clutch manda sobre el ace de equipo. */
  ok(ceremoniaDe(partida(equipo(A, todosMatan), equipo(B)), 0, [1, 0], sinEco) === "clutch",
     "el clutch se anuncia antes que el ace de equipo");

  /* Valor del equipamiento. */
  ok(valorEquipo(equipo(A, { 0: { arma: "Vandal", escudo: "Heavy" } })) === 3900,
     "vandal mas escudo pesado = 3900");
  ok(valorEquipo({ players: [] }) === 0, "un equipo sin jugadores vale cero");
  ok(valorEquipo(equipo(["x"], { 0: { arma: "ArmaQueNoExiste", escudo: "Heavy" } })) === 1000,
     "un arma desconocida vale cero, no un precio inventado");

  /* La captura del equipamiento es al empezar el combate, no al final. */
  const guardado = { ronda: -1, valor: [0, 0] };
  actualizaEconomia({ roundPhase: "shopping", roundNumber: 3, teams: [equipo(A), equipo(B)] }, guardado);
  ok(guardado.ronda === -1, "en la compra todavia no se captura");
  actualizaEconomia({ roundPhase: "combat", roundNumber: 3,
    teams: [equipo(A, { 0: { arma: "Vandal" } }), equipo(B)] }, guardado);
  ok(guardado.valor[0] === 2900, "se captura al arrancar el combate");
  actualizaEconomia({ roundPhase: "combat", roundNumber: 3,
    teams: [equipo(A), equipo(B)] }, guardado);
  ok(guardado.valor[0] === 2900, "y no se vuelve a tocar durante la ronda");
}

console.log(fallos === 0 ? "\nTODOS OK" : "\n" + fallos + " FALLOS");
process.exit(fallos === 0 ? 0 : 1);
