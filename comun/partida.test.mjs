/* La etiqueta de la ronda, y el fallo de la prórroga.
   node --test packages/overlay/comun/partida.test.mjs */
import assert from 'node:assert/strict';
import test from 'node:test';
import { etiquetaRonda } from './partida.js';

const reglas = { rules: { overtimeStartRound: 25 } };

test('en juego normal dice la ronda', () => {
  assert.equal(etiquetaRonda({ ...reglas, round: 7 }), 'ronda 7');
  assert.equal(etiquetaRonda({ ...reglas, round: 24 }), 'ronda 24');
  assert.equal(etiquetaRonda({ ...reglas, round: 7 }, 'compra'), 'compra 7');
});

test('cada prórroga son DOS rondas', () => {
  /* Era el fallo: 25, 26, 27 y 28 salían como prórroga 1, 2, 3 y 4. */
  assert.equal(etiquetaRonda({ ...reglas, round: 25 }), 'prórroga 1');
  assert.equal(etiquetaRonda({ ...reglas, round: 26 }), 'prórroga 1');
  assert.equal(etiquetaRonda({ ...reglas, round: 27 }), 'prórroga 2');
  assert.equal(etiquetaRonda({ ...reglas, round: 28 }), 'prórroga 2');
  assert.equal(etiquetaRonda({ ...reglas, round: 33 }), 'prórroga 5');
});

test('sin reglas no se inventa una prórroga', () => {
  assert.equal(etiquetaRonda({ round: 30 }), 'ronda 30');
  assert.equal(etiquetaRonda({}), 'ronda 1');
});

test('un formato a nueve rondas cambia dónde empieza', () => {
  const corto = { rules: { overtimeStartRound: 19 } };
  assert.equal(etiquetaRonda({ ...corto, round: 18 }), 'ronda 18');
  assert.equal(etiquetaRonda({ ...corto, round: 19 }), 'prórroga 1');
  assert.equal(etiquetaRonda({ ...corto, round: 20 }), 'prórroga 1');
  assert.equal(etiquetaRonda({ ...corto, round: 21 }), 'prórroga 2');
});
