/* Lo que el operador vio mal en directo: el color de cada bando, las cargas
   de habilidad, la definitiva del muerto y el jugador que abandona.
   node --test comun/hud.test.mjs */
import assert from 'node:assert/strict';
import test from 'node:test';
import { coloresDeBando } from './partida.js';
import { traduceJugador, traduceEstado } from './traduccion.js';
import { tramos } from '../combate/js/poligono.js';

test('el color sigue al bando, no al lado de pantalla', () => {
  assert.equal(coloresDeBando('attack', 1).c, 'var(--def)', 'equipo de la derecha atacando: rojo');
  assert.equal(coloresDeBando('defense', 0).c, 'var(--atk)', 'equipo de la izquierda defendiendo: verde');
  assert.equal(coloresDeBando(undefined, 0).c, 'var(--def)', 'sin bando, por lado (la izquierda se toma por atacante: rojo)');
  assert.equal(coloresDeBando(undefined, 1).c, 'var(--atk)');
  assert.equal(coloresDeBando('defense', 0, { claroVerde: 'var(--atk-claro)' }).cl, 'var(--atk-claro)', 'el verde suave de compra es el del defensor');
});

test('segunda mitad: los equipos no cambian de lado, cambian de color', () => {
  const equipo = (nombre, ataca) => ({ teamTricode: nombre, isAttacking: ataca, players: [], roundRecord: [] });
  const m = traduceEstado({ roundNumber: 14, roundPhase: 'combat', teams: [equipo('IZQ', false), equipo('DER', true)] }, false);
  assert.deepEqual(m.teams.map((t) => t.shortName), ['IZQ', 'DER']);
  assert.deepEqual(m.teams.map((t) => coloresDeBando(t.side, 0).ataca), [false, true]);
});

const jugador = (o = {}) => ({
  name: 'p', tagline: 't', isAlive: true, agentInternal: 'Wushu', currUltPoints: 2, maxUltPoints: 7,
  auxiliaryAvailable: { health: true, abilities: true, scoreboard: true },
  abilities: { grenade: 1, ability1: 0, ability2: 1 }, ...o,
});

test('cargas: un rombo por carga que CABE (Jett con una nube de dos gastada)', () => {
  const p = traduceJugador(jugador({ abilitiesMax: { grenade: 2, ability1: 1, ability2: 1 } }));
  assert.deepEqual(p.abilities.charges, { grenade: 1, ability1: 0, ability2: 1 });
  assert.deepEqual(p.abilities.max, { grenade: 2, ability1: 1, ability2: 1 });
  // Servidor antiguo, sin capacidad: lo que queda.
  const viejo = traduceJugador(jugador());
  assert.deepEqual(viejo.abilities.max, { grenade: 1, ability1: 0, ability2: 1 });
});

test('definitiva: coste 0 (desconocido) no es «lista»; el jugador desconectado viaja', () => {
  assert.equal(traduceJugador(jugador({ maxUltPoints: 0 })).ultimate.max, 0);
  assert.equal(traduceJugador(jugador({ disconnected: true })).disconnected, true);
  assert.equal(traduceJugador(jugador()).disconnected, false);
});

test('definitiva del muerto: se distingue lo cargado de lo vacío, y la lista', () => {
  const fondo = (css) => css.slice(css.lastIndexOf('background:') + 11);
  const alfa = (css) => Number(/\/ (\d+)%/.exec(fondo(css))[1]);
  const muerto = tramos(7, 3, { muerto: true });
  assert.ok(alfa(muerto[0]) - alfa(muerto[6]) >= 30, 'cargado y vacío se leen distintos');
  const lista = tramos(7, 7, { muerto: true, lista: true });
  assert.ok(alfa(lista[0]) > alfa(muerto[0]), 'lista, más brillante');
  assert.ok(lista.every((css) => !css.includes('var(--c')), 'muerto: sin color de bando');
});

test('defensoresIzquierda: si ataca la izquierda se da la vuelta a todo lo que va por equipo', async () => {
  const { defensoresIzquierda } = await import('./traduccion.js');
  const m = {
    teams: [{ shortName: 'LLL', side: 'attack' }, { shortName: 'PRX', side: 'defense' }],
    series: { maps: [{ state: 'past', score: [13, 7], winner: 0, leftLogo: 'a', rightLogo: 'b' }] },
    broadcast: { toast: { teamIndex: 0 } },
  };
  assert.equal(defensoresIzquierda(m), true);
  assert.deepEqual(m.teams.map((t) => t.shortName), ['PRX', 'LLL']);
  assert.deepEqual(m.series.maps[0].score, [7, 13]);
  assert.equal(m.series.maps[0].winner, 1);
  assert.equal(m.series.maps[0].leftLogo, 'b');
  assert.equal(m.broadcast.toast.teamIndex, 1);
  assert.equal(defensoresIzquierda(m), false, 'ya están los defensores a la izquierda');
});

test('marcaDineroViejo: el dinero que no cambia en dos rondas se marca; el que cambia no', async () => {
  const { marcaDineroViejo } = await import('./traduccion.js');
  const memo = new Map();
  const jug = (name, money) => ({ identity: { name, tag: 'T' }, money, disconnected: false });
  const partida = (round, mSano, mFijo, phase = 'combat') => ({
    round, phase, teams: [{ players: [jug('sano', mSano), jug('fijo', mFijo)] }, { players: [] }],
  });
  const estado = (m) => m.teams[0].players.map((p) => p.moneyStale);

  for (const [r, sano] of [[1, 800], [2, 4000], [3, 2500]]) {
    const m = partida(r, sano, 800);
    marcaDineroViejo(m, memo);
    if (r < 3) assert.deepEqual(estado(m), [false, false], `ronda ${r}: aún no`);
    else assert.deepEqual(estado(m), [false, true], 'ronda 3: «fijo» lleva 2 rondas igual, «sano» no');
  }
  const sel = partida(3, 800, 800, 'agentSelect');
  marcaDineroViejo(sel, memo);
  assert.deepEqual(estado(sel), [false, false], 'en selección de agentes no se marca a nadie');
  const nuevo = partida(1, 800, 800);
  marcaDineroViejo(nuevo, memo);
  assert.deepEqual(estado(nuevo), [false, false], 'mapa nuevo (la ronda retrocede): se empieza de cero');
});
