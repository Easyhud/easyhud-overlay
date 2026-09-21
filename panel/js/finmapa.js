/* ══ Fin de mapa: el cálculo puro, en un solo sitio ══════════════════════════
   panel.js lo usa para empujar el patch al overlay en vivo; db.js lo usa para
   persistir en el match guardado. Antes cada uno tenía su propia copia de esta
   cuenta -y ya habían divergido (una traía roster, la otra no)-. Ahora el
   cómputo vive una sola vez; cada listener sigue con su propio dedupe (son
   consumidores distintos del mismo evento) pero ya no puede desincronizarse. */
export function calculaFinMapa(base, d, logos = {}) {
  const score = {
    wonLeft: (base.wonLeft ?? 0) + (d.ganador === 0 ? 1 : 0),
    wonRight: (base.wonRight ?? 0) + (d.ganador === 1 ? 1 : 0),
  };
  const entrada = {
    type: 'past',
    map: d.map || '',
    left: { logo: logos.izq ?? '', score: d.izq ?? 0 },
    right: { logo: logos.der ?? '', score: d.der ?? 0 },
    roster: Array.isArray(d.roster) ? d.roster : [],
  };
  const mapInfo = [...(Array.isArray(base.mapInfo) ? base.mapInfo : []), entrada];
  return { score, mapInfo };
}
