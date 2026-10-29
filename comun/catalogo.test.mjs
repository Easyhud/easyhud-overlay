/* Los catálogos de agentes (hay una copia por pantalla) y el agente nuevo Hush (nombre interno Paprika).
   node --test comun/catalogo.test.mjs */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const PANTALLAS = ['combate', 'compra', 'seleccion'];
const cat = {};
for (const p of PANTALLAS) cat[p] = await import(`../${p}/js/catalogo.js`);

test('las tres copias del catálogo son idénticas', () => {
  const texto = (p) => readFileSync(new URL(`../${p}/js/catalogo.js`, import.meta.url), 'utf8');
  assert.equal(texto('compra'), texto('combate'));
  assert.equal(texto('seleccion'), texto('combate'));
});

for (const p of PANTALLAS) {
  test(`${p}: Hush (Paprika) está en el catálogo con id, papel y puente`, () => {
    const c = cat[p];
    assert.equal(c.AGENTES.hush, 'ddd5a15c-4fbe-42fa-3789-11a55ca5ee04');
    assert.equal(c.AGENTE_POR_INTERNO.Paprika, 'hush');
    assert.equal(c.PAPEL_DE_AGENTE.hush, 'duelist');
  });

  test(`${p}: Gekko llega como Aggrobot o como AggroBot (el original lo escribe así)`, () => {
    assert.equal(cat[p].AGENTE_POR_INTERNO.Aggrobot, 'gekko');
    assert.equal(cat[p].AGENTE_POR_INTERNO.AggroBot, 'gekko');
  });

  test(`${p}: todo agente tiene papel válido y todo puente apunta a un agente que existe`, () => {
    const c = cat[p];
    for (const k of Object.keys(c.AGENTES)) {
      assert.ok(c.PAPEL_DE_AGENTE[k], `${k} sin papel`);
      assert.ok(c.PAPELES[c.PAPEL_DE_AGENTE[k]], `${k}: papel desconocido`);
    }
    for (const [interno, k] of Object.entries(c.AGENTE_POR_INTERNO)) {
      assert.ok(c.AGENTES[k], `${interno} -> ${k} no existe en AGENTES`);
    }
    /* Cada agente se alcanza desde algún nombre interno (si no, su retrato no se pediría nunca). */
    const alcanzados = new Set(Object.values(c.AGENTE_POR_INTERNO));
    for (const k of Object.keys(c.AGENTES)) assert.ok(alcanzados.has(k), `${k} sin nombre interno`);
  });
}
