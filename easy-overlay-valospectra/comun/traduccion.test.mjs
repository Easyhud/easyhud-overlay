import { traduceEstado, mapaDecidido, equipoGanador, ceremoniaDe, actualizaClutch, escudoDe } from './traduccion.js';

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

console.log(fallos === 0 ? "\nTODOS OK" : "\n" + fallos + " FALLOS");
process.exit(fallos === 0 ? 0 : 1);
