/* Los errores del servidor y la guía del panel.
   node --test panel/js/guia.test.mjs */
import assert from 'node:assert/strict';
import test from 'node:test';
import { describeCaida, describeError, leeError } from './errores.js';
import { siguientePaso } from './guia.js';

test('errores: se leen de texto JSON u objeto, con código y avisos', () => {
  const e = leeError(JSON.stringify({ reason: 'Algo pasó', codigo: 'ajuste_corregido', avisos: ['a', 'b', 7] }));
  assert.deepEqual(e, { reason: 'Algo pasó', codigo: 'ajuste_corregido', avisos: ['a', 'b'] });
  assert.deepEqual(leeError('no es json'), { reason: 'no es json', codigo: '', avisos: [] });
  assert.deepEqual(leeError(null), { reason: '', codigo: '', avisos: [] });
});

test('errores: «sin partido para configurar» no se enseña', () => {
  assert.equal(describeError({ reason: 'sin partido para configurar' }), null);
});

test('errores: un ajuste corregido lista qué cambió y se va solo', () => {
  const d = describeError({ reason: 'Algún ajuste no se ha aplicado tal cual: x.', codigo: 'ajuste_corregido', avisos: ['uno', 'dos'] });
  assert.equal(d.nivel, 'aviso');
  assert.deepEqual(d.detalle, ['uno', 'dos']);
  assert.match(d.texto, /adjusted/);
  assert.ok(d.ms > 0);
});

test('errores: un permiso caducado se queda y lleva a iniciar sesión', () => {
  for (const codigo of ['caducado', 'sin token', 'firma no válida', 'es para el grupo ABC']) {
    const d = describeError({ reason: 'El permiso de emisión ha caducado.', codigo });
    assert.equal(d.nivel, 'error', codigo);
    assert.equal(d.ms, 0, codigo);
    assert.equal(d.accion, 'sesion', codigo);
  }
});

test('errores: sin frase del servidor nunca sale «rechazado» a secas', () => {
  const d = describeError({ reason: '', codigo: '' });
  assert.match(d.texto, /did not say why/);
  assert.equal(d.accion, 'reconectar');
});

test('errores: demasiado rápido, sin partido y una orden desconocida enseñan la frase del servidor', () => {
  assert.equal(describeError({ reason: 'Espera.', codigo: 'demasiado_rapido' }).texto, 'Espera.');
  assert.equal(describeError({ reason: 'No hay partido.', codigo: 'sin_partido' }).nivel, 'aviso');
  assert.equal(describeError({ reason: 'orden no aplicada: x' }).texto, 'orden no aplicada: x');
});

test('caídas: dicen qué hacer y ofrecen volver a conectar', () => {
  assert.equal(describeCaida('mando').accion, 'reconectar');
  assert.match(describeCaida('datos', 'https://x').texto, /https:\/\/x/);
  assert.equal(describeCaida('datos').ms, 0);
});

const jug = (con) => ({ auxiliaryAvailable: { health: con, abilities: con, scoreboard: con } });
const partido = (n, con, extra = {}) => ({
  roundPhase: 'combat', roundNumber: 4,
  teams: [{ players: Array.from({ length: n }, () => jug(con)) }, { players: Array.from({ length: n }, () => jug(con)) }],
  ...extra,
});

test('guía: sin sesión, conectando y sin mando', () => {
  assert.equal(siguientePaso({ permiso: 'sin-sesion', M: null, escena: '', hayLobby: false }).nivel, 'falta');
  assert.equal(siguientePaso({ permiso: 'conectando', M: null, escena: '', hayLobby: false }).nivel, 'espera');
  const r = siguientePaso({ permiso: 'sin-mando', M: null, escena: '', hayLobby: false });
  assert.equal(r.accion, 'reconectar');
  assert.match(r.texto, /Reconnect everything/);
});

test('guía: sin partido, dice qué hacer; con sala, que espere al observador', () => {
  const a = siguientePaso({ permiso: 'ok', M: null, escena: '', hayLobby: false });
  assert.equal(a.nivel, 'falta');
  assert.equal(a.accion, 'crear-sala');
  assert.match(a.texto, /Create lobby/);
  assert.equal(siguientePaso({ permiso: 'ok', M: null, escena: '', hayLobby: true }).nivel, 'espera');
});

test('guía: partido sin jugadores, con jugadores entrando y listo', () => {
  assert.equal(siguientePaso({ permiso: 'ok', M: { teams: [{ players: [] }, { players: [] }] }, escena: '', hayLobby: true }).titulo, 'Waiting for the players');
  const entrando = siguientePaso({ permiso: 'ok', M: partido(3, true, { roundPhase: 'LOBBY' }), escena: 'Agent Select', hayLobby: true });
  assert.equal(entrando.nivel, 'espera');
  assert.match(entrando.texto, /6\/10/);
  assert.equal(siguientePaso({ permiso: 'ok', M: partido(5, true), escena: 'Round 4', hayLobby: true }).nivel, 'bien');
});

test('guía: jugadores sin la app se cuentan y no bloquean la emisión', () => {
  const r = siguientePaso({ permiso: 'ok', M: partido(5, false), escena: 'Round 4', hayLobby: true });
  assert.equal(r.nivel, 'falta');
  assert.match(r.titulo, /10 players without the app/);
  assert.match(r.texto, /go on air without them/);
});
