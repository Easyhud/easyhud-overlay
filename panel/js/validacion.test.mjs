/* Validación de lo que el operador escribe en el panel.
   node --test panel/js/validacion.test.mjs */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aliasATexto, completaConJugadores, limitaNumero, parseAliasTexto, validaCaja, validaSemilla, validaUrlImagen,
} from './validacion.js';

test('direcciones de imagen: https, http y data:image valen; vacío es «sin imagen»', () => {
  assert.equal(validaUrlImagen('').ok, true);
  assert.equal(validaUrlImagen('  https://x.com/a.png ').valor, 'https://x.com/a.png');
  assert.equal(validaUrlImagen('http://x.com/a.png').ok, true);
  assert.equal(validaUrlImagen('data:image/svg+xml,<svg/>').ok, true);
});

test('direcciones de imagen: lo que no es una imagen en la web se rechaza con el motivo', () => {
  for (const malo of ['logo.png', 'C:\\fotos\\logo.png', 'file:///c:/a.png', 'javascript:alert(1)', 'https://', 'ftp://x/a.png']) {
    const r = validaUrlImagen(malo);
    assert.equal(r.ok, false, malo);
    assert.ok(r.motivo.length > 10, malo);
  }
  assert.match(validaUrlImagen('C:\\fotos\\logo.png').motivo, /PC/);
  assert.equal(validaUrlImagen('https://x.com/' + 'a'.repeat(5000)).ok, false);
  assert.equal(validaUrlImagen(undefined).ok, true);
});

test('números: se ajustan al rango y dicen qué pasó', () => {
  assert.deepEqual(limitaNumero('3', 0, 4), { ok: true, valor: 3, ajustado: false });
  const alto = limitaNumero(9, 0, 4);
  assert.equal(alto.valor, 4);
  assert.equal(alto.ajustado, true);
  assert.match(alto.motivo, /0 to 4/);
  assert.equal(limitaNumero(-2, 0, 4).valor, 0);
  assert.equal(limitaNumero('', 0, 4).ok, false);
  assert.equal(limitaNumero('abc', 0, 4).ok, false);
  assert.equal(limitaNumero(2.6, 0, 4).valor, 3);
});

test('cabeza de serie: una línea y hasta 20 caracteres', () => {
  assert.equal(validaSemilla('#1 Grupo A').ok, true);
  const largo = validaSemilla('x'.repeat(30));
  assert.equal(largo.ok, false);
  assert.equal(largo.valor.length, 20);
  assert.equal(validaSemilla('a\nb').valor, 'a b');
  assert.equal(validaSemilla(null).valor, '');
});

test('alias: una línea por jugador, con varios separadores', () => {
  const r = parseAliasTexto('Nico#EUW = Nico el Rápido\nSol#001 -> Sol\n\n  Ana Maria#9x9 : Anita ');
  assert.deepEqual(r.errores, []);
  assert.deepEqual(r.pares, [['Nico#EUW', 'Nico el Rápido'], ['Sol#001', 'Sol'], ['Ana Maria#9x9', 'Anita']]);
});

test('alias: las líneas mal escritas se señalan por número y no se manda nada a medias', () => {
  const r = parseAliasTexto('Nico#EUW = Nico\nSinTag = Alias\nSolo texto\nOtro#T1 = ' + 'x'.repeat(40));
  assert.deepEqual(r.errores.map((e) => e.linea), [2, 3, 4]);
  assert.match(r.errores[0].motivo, /Name#TAG/);
  assert.match(r.errores[2].motivo, /too long/);
});

test('alias: un jugador repetido (aunque cambien las mayúsculas) es un error; vacío quita el alias', () => {
  const r = parseAliasTexto('Nico#EUW = A\nnico#euw = B\nSol#1 = ');
  assert.equal(r.errores.length, 1);
  assert.equal(r.errores[0].linea, 2);
  assert.deepEqual(r.pares, [['Nico#EUW', 'A'], ['Sol#1', '']]);
});

test('alias: de lo que manda el servidor al texto editable y de vuelta', () => {
  const texto = aliasATexto({ overrides: '[["Nico#EUW","Nico"],["Sol#1","Sol"]]' });
  assert.equal(texto, 'Nico#EUW = Nico\nSol#1 = Sol');
  assert.deepEqual(parseAliasTexto(texto).pares, [['Nico#EUW', 'Nico'], ['Sol#1', 'Sol']]);
  assert.equal(aliasATexto({ overrides: 'no json' }), '');
  assert.equal(aliasATexto(undefined), '');
});

test('alias: «rellenar con los jugadores» solo añade los que faltan', () => {
  const t = completaConJugadores('Nico#EUW = Nico', ['nico#euw', 'Sol#1', 'sinTag']);
  assert.equal(t, 'Nico#EUW = Nico\nSol#1 = ');
  assert.equal(completaConJugadores('', ['A#1']), 'A#1 = ');
  assert.equal(completaConJugadores('A#1 = x', ['A#1']), 'A#1 = x');
});

test('caja de fin de ronda: patrocinadores sin imagen, direcciones malas y lista vacía se detectan', () => {
  assert.equal(validaCaja({ type: 'disabled', sponsors: [] }).ok, true);
  assert.equal(validaCaja({ type: 'tournamentInfo', sponsors: [] }).ok, true);
  const vacia = validaCaja({ type: 'sponsors', sponsors: [] });
  assert.equal(vacia.ok, false);
  assert.match(vacia.errores[0], /at least one/);
  const mal = validaCaja({ type: 'sponsors', sponsors: [{ wonTeam: 'all', roundCeremony: ['all'], iconUrl: 'logo.png', backdropUrl: '' }, { wonTeam: 'left', roundCeremony: ['ace'], iconUrl: '', backdropUrl: '' }] });
  assert.equal(mal.ok, false);
  assert.equal(mal.errores.length, 2);
  assert.match(mal.errores[0], /Sponsor 1, icon/);
  assert.match(mal.errores[1], /no image/);
  const bien = validaCaja({ type: 'sponsors', sponsors: [{ wonTeam: 'left', roundCeremony: ['ace'], iconUrl: 'https://x/a.png', backdropUrl: '' }] });
  assert.equal(bien.ok, true);
  assert.deepEqual(bien.limpio.sponsors[0].roundCeremony, ['ace']);
});

test('caja de fin de ronda: máximo diez patrocinadores', () => {
  const filas = Array.from({ length: 11 }, () => ({ wonTeam: 'all', roundCeremony: ['all'], iconUrl: 'https://x/a.png', backdropUrl: '' }));
  const r = validaCaja({ type: 'sponsors', sponsors: filas });
  assert.equal(r.ok, false);
  assert.equal(r.limpio.sponsors.length, 10);
});
