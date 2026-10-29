/* Lo añadido en la segunda pasada de paridad con el frontend de ValoSpectra.
   node --test comun/segunda-pasada.test.mjs */
import assert from 'node:assert/strict';
import test from 'node:test';
import { traduceEstado, traduceJugador } from './traduccion.js';

test('las bajas de la ronda llegan al contrato (la cámara las enseña)', () => {
  assert.equal(traduceJugador({ name: 'a', killsThisRound: 3 }).killsRound, 3);
  assert.equal(traduceJugador({ name: 'a' }).killsRound, 0, 'sin dato, cero (no «undefined»)');
  assert.equal(traduceJugador({ name: 'a', killsThisRound: 'x' }).killsRound, 0, 'un valor raro no se cuela');
});

test('un agente nuevo, sin catálogo, no rompe la traducción: pasa su nombre interno tal cual', () => {
  const j = traduceJugador({ name: 'a', agentInternal: 'AgenteDelFuturo' });
  assert.equal(j.agentInternal, 'AgenteDelFuturo');
});

test('«créditos de los vivos»: el mando showAliveKDA del servidor llega como hideAliveCredits', () => {
  assert.equal(traduceEstado({ teams: [], showAliveKDA: true }, false).broadcast.hideAliveCredits, true);
  assert.equal(traduceEstado({ teams: [], showAliveKDA: false }, false).broadcast.hideAliveCredits, false);
  assert.equal(traduceEstado({ teams: [] }, false).broadcast.hideAliveCredits, false, 'sin el campo, apagado');
});
