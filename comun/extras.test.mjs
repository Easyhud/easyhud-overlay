/* Los campos nuevos del servidor (rama `copia-funcional`): alias, cabezas de serie, caja de fin de ronda,
   modo mínimo, cuenta de la spike y el historial de la compra.
   node --test comun/extras.test.mjs */
import assert from 'node:assert/strict';
import test from 'node:test';
import { buscaAlias, eligeCaja, leeAlias, normalizaCaja, plantadoSegunServidor } from './extras.js';
import { planHistorial, esMinimo } from './partida.js';
import { traduceEstado, ceremoniaDe, defensoresIzquierda, mapasSerie } from './traduccion.js';

/* ── Alias ──────────────────────────────────────────────────────────────── */

test('los alias llegan como texto JSON de pares, como en el original', () => {
  const m = leeAlias({ overrides: '[["Nico#EUW","Nico el Rápido"],["Sol#001","Sol"]]' });
  assert.equal(m.get('Nico#EUW'), 'Nico el Rápido');
  assert.equal(m.size, 2);
});

test('también se aceptan la lista ya parseada y un objeto', () => {
  assert.equal(leeAlias([['A#1', 'x']]).get('A#1'), 'x');
  assert.equal(leeAlias({ 'A#1': 'x' }).get('A#1'), 'x');
  assert.equal(leeAlias({ overrides: { 'B#2': 'y' } }).get('B#2'), 'y');
});

test('un alias roto no deja el HUD sin nombres: se ignora', () => {
  assert.equal(leeAlias({ overrides: '{no es json' }).size, 0);
  assert.equal(leeAlias(undefined).size, 0);
  assert.equal(leeAlias(null).size, 0);
  assert.equal(leeAlias({ overrides: '' }).size, 0);
  assert.equal(leeAlias({ overrides: '[["", "x"], ["A#1", ""], [1, 2], ["B#2"]]' }).size, 0, 'vacíos y mal formados fuera');
  assert.equal(leeAlias('42').size, 0);
});

test('el alias se busca por Nombre#TAG exacto y, si no, sin distinguir mayúsculas', () => {
  const m = leeAlias([['Nico#EUW', 'Nico el Rápido']]);
  assert.equal(buscaAlias(m, 'Nico#EUW'), 'Nico el Rápido');
  assert.equal(buscaAlias(m, 'nico#euw'), 'Nico el Rápido');
  assert.equal(buscaAlias(m, undefined, 'Nico#EUW'), 'Nico el Rápido', 'prueba cada nombre posible');
  assert.equal(buscaAlias(m, 'Otro#1'), '');
  assert.equal(buscaAlias(m, '#'), '', 'un jugador sin nombre no casa con nada');
  assert.equal(buscaAlias(new Map(), 'Nico#EUW'), '');
});

/* ── Caja de fin de ronda ───────────────────────────────────────────────── */

test('la caja siempre sale con forma, venga lo que venga', () => {
  assert.deepEqual(normalizaCaja(undefined), { type: 'disabled', sponsors: [] });
  assert.deepEqual(normalizaCaja({ type: 'raro', sponsors: 5 }), { type: 'disabled', sponsors: [] });
  const c = normalizaCaja({ type: 'sponsors', sponsors: [{ wonTeam: 'nadie', roundCeremony: ['inventada'], iconUrl: 7 }, null, 'x'] });
  assert.equal(c.sponsors.length, 1);
  assert.deepEqual(c.sponsors[0], { wonTeam: 'all', roundCeremony: ['all'], iconUrl: '', backdropUrl: '' });
});

test('caja desactivada: la ceremonia sale como siempre, sin decoración', () => {
  assert.deepEqual(eligeCaja({ type: 'disabled', sponsors: [] }, 'ace', 0), { tipo: 'disabled', iconUrl: '', backdropUrl: '' });
});

test('caja de torneo: su logo y su fondo', () => {
  const r = eligeCaja({ type: 'tournamentInfo', sponsors: [] }, 'roundWin', 1, { logoUrl: 'L', backdropUrl: 'F' });
  assert.deepEqual(r, { tipo: 'tournamentInfo', iconUrl: 'L', backdropUrl: 'F' });
});

test('caja de patrocinadores: el primero que case con equipo y ceremonia; si no, el primero', () => {
  const caja = {
    type: 'sponsors',
    sponsors: [
      { wonTeam: 'left', roundCeremony: ['ace'], iconUrl: 'A', backdropUrl: 'a' },
      { wonTeam: 'right', roundCeremony: ['all'], iconUrl: 'B', backdropUrl: 'b' },
      { wonTeam: 'all', roundCeremony: ['clutch', 'normal'], iconUrl: 'C', backdropUrl: 'c' },
    ],
  };
  assert.equal(eligeCaja(caja, 'ace', 0).iconUrl, 'A', 'ace del equipo izquierdo');
  assert.equal(eligeCaja(caja, 'ace', 1).iconUrl, 'B', 'ace del derecho: el segundo (all)');
  assert.equal(eligeCaja(caja, 'roundWin', 0).iconUrl, 'C', 'ronda normal del izquierdo: el tercero');
  assert.equal(eligeCaja(caja, 'clutch', 0).iconUrl, 'C');
  assert.equal(eligeCaja(caja, 'flawless', 0).iconUrl, 'A', 'ninguno casa: el primero');
  assert.equal(eligeCaja({ type: 'sponsors', sponsors: [] }, 'ace', 0).tipo, 'disabled', 'sin patrocinadores, nada');
});

/* ── La spike ───────────────────────────────────────────────────────────── */

test('la spike plantada se recupera del servidor y no se reinicia al recargar', () => {
  const ahora = 1_000_000;
  /* Plantada hace 10 s: detona dentro de 35 s. */
  assert.equal(plantadoSegunServidor(ahora + 35_000, ahora), ahora - 10_000);
  /* Recién plantada. */
  assert.equal(plantadoSegunServidor(ahora + 45_000, ahora), ahora);
});

test('un reloj del servidor que no cuadra con el del PC se descarta', () => {
  const ahora = 1_000_000;
  assert.equal(plantadoSegunServidor(ahora + 45_000 + 20_000, ahora), null, 'servidor 20 s por delante');
  assert.equal(plantadoSegunServidor(ahora - 20_000, ahora), null, 'servidor 20 s por detrás');
  assert.equal(plantadoSegunServidor(undefined, ahora), null);
  assert.equal(plantadoSegunServidor(NaN, ahora), null);
  assert.equal(plantadoSegunServidor('1000', ahora), null);
});

/* ── El historial de la compra ──────────────────────────────────────────── */

test('formato normal: 12 + 12, con la marca de cambio de lado al principio de la segunda mitad', () => {
  const p = planHistorial({ switchRound: 13, overtimeStartRound: 25 }, 5);
  assert.equal(p.izq.length, 12);
  assert.equal(p.izq.at(-1).ronda, 12);
  assert.deepEqual(p.der[0], { cambio: true });
  assert.equal(p.der.filter((c) => c.ronda).length, 12);
  assert.equal(p.der.at(-1).ronda, 24);
  assert.equal(p.der.some((c) => c.ot), false, 'sin prórroga no hay marca OT');
});

test('prórroga: una marca «OT n» antes de cada PAR de rondas, y las columnas aparecen según se juegan', () => {
  const p = planHistorial({ switchRound: 13, overtimeStartRound: 25 }, 28);
  const seq = p.der.filter((c) => !c.cambio).map((c) => (c.ot ? `OT${c.ot}` : c.ronda));
  assert.deepEqual(seq.slice(-7), [24, 'OT1', 25, 26, 'OT2', 27, 28]);
  const antes = planHistorial({ switchRound: 13, overtimeStartRound: 25 }, 25);
  assert.equal(antes.der.at(-1).ronda, 25);
  assert.equal(antes.der.at(-2).ot, 1);
});

test('un formato de otra duración corta donde dicen las reglas', () => {
  /* Primera mitad de 8 rondas: se cambia en la 9 y la prórroga empieza en la 17. */
  const p = planHistorial({ switchRound: 9, overtimeStartRound: 17 }, 3);
  assert.equal(p.izq.length, 8);
  assert.equal(p.der.filter((c) => c.ronda).length, 8);
  assert.equal(p.der.filter((c) => c.ronda).at(0).ronda, 9);
  assert.equal(p.der.filter((c) => c.ronda).at(-1).ronda, 16);
});

test('sin reglas se asume el formato normal', () => {
  const p = planHistorial(undefined, 0);
  assert.equal(p.izq.length, 12);
  assert.equal(p.der.filter((c) => c.ronda).length, 12);
  const raro = planHistorial({ switchRound: 0, overtimeStartRound: 0 }, 0);
  assert.equal(raro.izq.length, 12);
});

/* ── La traducción con los campos nuevos ────────────────────────────────── */

const jug = (name, extra = {}) => ({
  name, tagline: 'TAG', fullName: `${name}#TAG`, isAlive: true, agentInternal: 'Wushu', killedPlayerNames: [], killsThisRound: 0,
  deathsThisRound: 0, auxiliaryAvailable: { health: true, abilities: true, scoreboard: true }, abilities: { grenade: 1, ability1: 1, ability2: 1 },
  iconNameSuffix: '', ...extra,
});
const equipo = (tri, ataca, players) => ({ teamTricode: tri, teamName: tri, teamUrl: '', isAttacking: ataca, roundsWon: 0, players, roundRecord: [] });
const estado = (extra = {}) => ({
  roundNumber: 3, roundPhase: 'combat', switchRound: 13, firstOtRound: 25,
  teams: [equipo('IZQ', true, [jug('a1'), jug('a2')]), equipo('DER', false, [jug('b1')])],
  tools: {
    tournamentInfo: { name: 'Copa', logoUrl: 'L', backdropUrl: 'F' },
    seedingInfo: { left: '#1 · Grupo A', right: '#4' },
    nameOverrides: { overrides: '[["a1#TAG","Alfa"],["b1#TAG","Bravo"]]' },
    roundWinBox: { type: 'tournamentInfo', sponsors: [] },
    minimal: true,
  },
  toastInfo: { active: true, title: 't', message: 'm', selectedTeam: 'left', eventLogoEnabled: true },
  ...extra,
});

test('modo mínimo: lo manda el servidor en tools.minimal, y solo si es exactamente true', () => {
  assert.equal(esMinimo(traduceEstado(estado(), false)), true);
  for (const v of [false, undefined, 'true', 1, null]) {
    const e = estado();
    e.tools.minimal = v;
    assert.equal(esMinimo(traduceEstado(e, false)), false, `minimal=${String(v)}`);
  }
});

test('cabeza de serie: la del lado izquierdo del panel va con ese equipo', () => {
  const m = traduceEstado(estado(), false);
  assert.deepEqual(m.teams.map((t) => t.seeding), ['#1 · Grupo A', '#4']);
  /* Segunda mitad: el equipo de la izquierda del panel defiende → los equipos se dan la vuelta y la semilla se va con él. */
  const e = estado();
  e.teams[0].isAttacking = false;
  e.teams[1].isAttacking = true;
  const m2 = traduceEstado(e, false);
  /* El de la izquierda del panel defiende: ya está a la izquierda (no se da la vuelta). */
  assert.equal(defensoresIzquierda(m2), false);
  const e3 = estado();
  e3.teams[0].isAttacking = true;
  e3.teams[1].isAttacking = false;
  const m3 = traduceEstado(e3, false);
  assert.equal(defensoresIzquierda(m3), true, 'el izquierdo ataca: se da la vuelta');
  assert.deepEqual(m3.teams.map((t) => t.shortName), ['DER', 'IZQ']);
  assert.deepEqual(m3.teams.map((t) => t.seeding), ['#4', '#1 · Grupo A'], 'la semilla viaja con el equipo');
});

test('sin cabezas de serie configuradas salen vacías, nunca inventadas', () => {
  const e = estado();
  delete e.tools.seedingInfo;
  assert.deepEqual(traduceEstado(e, false).teams.map((t) => t.seeding), ['', '']);
});

test('alias: el jugador conserva su nombre real y gana un alias', () => {
  const m = traduceEstado(estado(), false);
  const a1 = m.teams[0].players[0];
  assert.equal(a1.identity.name, 'a1', 'el nombre real no se toca (las cámaras lo usan)');
  assert.equal(a1.identity.alias, 'Alfa');
  assert.equal(a1.identity.full, 'a1#TAG');
  assert.equal(m.teams[0].players[1].identity.alias, '', 'sin alias, vacío');
  assert.equal(m.teams[1].players[0].identity.alias, 'Bravo');
});

test('con «quitar tricodes» el nombre emitido cambia pero el alias y la cámara siguen casando por el nombre real', () => {
  const e = estado();
  e.teams[0].players[0] = jug('Alfa-sin-tricode', { fullName: 'a1#TAG' });
  const m = traduceEstado(e, false);
  assert.equal(m.teams[0].players[0].identity.alias, 'Alfa');
  assert.equal(m.teams[0].players[0].identity.full, 'a1#TAG');
});

test('el aviso lleva si pide el logo del evento, y el torneo trae su fondo', () => {
  const m = traduceEstado(estado(), false);
  assert.equal(m.broadcast.toast.eventLogo, true);
  assert.equal(m.broadcast.tournamentBackdrop, 'F');
  assert.equal(m.broadcast.roundWinBox.type, 'tournamentInfo');
  const e = estado();
  e.toastInfo.eventLogoEnabled = undefined;
  assert.equal(traduceEstado(e, false).broadcast.toast.eventLogo, false);
});

test('las reglas llevan el corte de mitad para el historial', () => {
  assert.equal(traduceEstado(estado(), false).rules.switchRound, 13);
});

test('mapas futuros: con logo es «Next», sin logo el decisivo', () => {
  const mapas = mapasSerie([
    { type: 'past', map: 'Bind', left: { score: 13 }, right: { score: 9 } },
    { type: 'future', map: 'Haven', logo: 'http://x/l.png' },
    { type: 'future', map: 'Split', logo: '' },
  ]);
  assert.equal(mapas[1].decider, false);
  assert.equal(mapas[1].logo, 'http://x/l.png');
  assert.equal(mapas[2].decider, true);
});

test('Clove: el icono especial viaja como sufijo', () => {
  const e = estado();
  e.teams[0].players[0] = jug('a1', { agentInternal: 'Smonk', iconNameSuffix: 'NotDeadYet', isAlive: false });
  const p = traduceEstado(e, false).teams[0].players[0];
  assert.equal(p.iconSuffix, 'NotDeadYet');
  assert.equal(p.alive, false);
});

test('ace: con el nombre del servidor cambiado, el ace se reconoce por el nombre real del rival', () => {
  /* El equipo rival emite nombres sin tricode, pero el killfeed cita los reales. */
  const rival = [1, 2, 3, 4, 5].map((n) => jug(`r${n}`, { fullName: `ABC r${n}#TAG`, isAlive: false }));
  const m = {
    teams: [
      equipo('IZQ', true, [jug('a1', { killedPlayerNames: ['ABC r1', 'ABC r2', 'ABC r3', 'ABC r4', 'ABC r5'] }), jug('a2')]),
      equipo('DER', false, rival),
    ],
  };
  assert.equal(ceremoniaDe(m, 0, [0, 0], { valor: [0, 0] }), 'ace');
});
