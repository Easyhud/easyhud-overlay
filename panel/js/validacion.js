/* ══ VALIDACIÓN DE LO QUE EL OPERADOR ESCRIBE ═══════════════════════════════
   Lógica PURA (sin DOM) de los campos que el panel manda al servidor, para que
   un despiste no llegue a antena: una dirección que no es una imagen, un
   número fuera de rango, una línea de alias mal escrita, un patrocinador sin
   logo. El servidor también sanea (y dice qué corrigió), pero avisar ANTES,
   en el propio campo, es lo que evita que el operador descubra el fallo en el
   monitor de la emisión.

   Los límites son los mismos que los del servidor (`LIMITES` en
   `servidor-v2/src/partida/saneado.ts`): si cambian allí, cambian aquí.     */

export const LIMITES = {
  seeding: 20,
  claveAlias: 64,
  alias: 32,
  aliasMaximos: 100,
  cajaPatrocinadores: 10,
  url: 4096,
};

/** Las ceremonias que entiende la caja de fin de ronda, con el nombre que se le enseña al operador. */
export const CEREMONIAS = [
  ['all', 'Any round'],
  ['normal', 'Normal win'],
  ['ace', 'Ace'],
  ['clutch', 'Clutch'],
  ['teamAce', 'Team ace'],
  ['flawless', 'Flawless'],
  ['thrifty', 'Thrifty'],
];

/**
 * ¿Es una dirección de imagen que el overlay puede cargar?
 *
 * Vale `https://…`, `http://…` y `data:image/…`. No vale nada más: ni `javascript:`, ni una ruta de disco, ni texto
 * suelto (el fallo típico es pegar el nombre de un fichero). Vacío es válido: significa «sin imagen».
 *
 * @param {unknown} valor
 * @returns {{ ok: boolean, valor: string, motivo?: string }}
 */
export function validaUrlImagen(valor) {
  const v = typeof valor === 'string' ? valor.trim() : '';
  if (v === '') return { ok: true, valor: '' };
  if (v.length > LIMITES.url) {
    return { ok: false, valor: v, motivo: `The address is too long (the maximum is ${LIMITES.url} characters).` };
  }
  if (/^data:image\//i.test(v)) return { ok: true, valor: v };
  if (/^https?:\/\//i.test(v)) {
    try {
      const u = new URL(v);
      if (u.hostname === '') throw new Error('sin dominio');
      return { ok: true, valor: v };
    } catch {
      return { ok: false, valor: v, motivo: 'That address is not valid. Copy it again from the image page.' };
    }
  }
  if (/^[a-z]:[\\/]/i.test(v) || v.startsWith('\\\\') || /^file:/i.test(v)) {
    return { ok: false, valor: v, motivo: 'A file on your PC will not load on the stream. Upload the image and use its https:// address.' };
  }
  return { ok: false, valor: v, motivo: 'An image address must start with https://' };
}

/**
 * Un número dentro de [min, max]. Devuelve el valor ya ajustado y, si hubo que tocarlo, por qué.
 *
 * @param {unknown} valor
 * @param {number} min
 * @param {number} max
 * @returns {{ ok: boolean, valor: number | null, ajustado: boolean, motivo?: string }}
 */
export function limitaNumero(valor, min, max) {
  const n = typeof valor === 'number' ? valor : typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : NaN;
  if (!Number.isFinite(n)) return { ok: false, valor: null, ajustado: false, motivo: 'Write a number.' };
  const entero = Math.round(n);
  if (entero < min || entero > max) {
    const ajustado = Math.min(max, Math.max(min, entero));
    return { ok: true, valor: ajustado, ajustado: true, motivo: `Allowed values go from ${min} to ${max}; it was set to ${ajustado}.` };
  }
  return { ok: true, valor: entero, ajustado: entero !== n };
}

/**
 * Cabeza de serie (el texto bajo el tricode): una línea, hasta 20 caracteres.
 *
 * @param {unknown} valor
 */
export function validaSemilla(valor) {
  const v = typeof valor === 'string' ? valor.replace(/[\u0000-\u001f\u007f]/g, ' ').trim() : '';
  if (v.length > LIMITES.seeding) {
    return { ok: false, valor: v.slice(0, LIMITES.seeding).trimEnd(), motivo: `It fits ${LIMITES.seeding} characters; it was shortened.` };
  }
  return { ok: true, valor: v };
}

/* ── Alias ──────────────────────────────────────────────────────────────── */

/**
 * El texto que escribe el operador (una línea por jugador: `Nombre#TAG = alias`) → lista de pares.
 *
 * Se aceptan `=`, `→`, `->`, tabulador y `:` como separador (se parte por el PRIMERO tras el `#TAG`, así un nombre con
 * espacios o con `:` no estorba). Las líneas vacías se ignoran; las mal escritas se devuelven en `errores` con su
 * número de línea y NO se manda nada hasta arreglarlas, para que un alias a medias no borre otro por accidente.
 *
 * Un alias vacío no es un error: significa «quitar el alias de este jugador» y el servidor lo entiende así.
 *
 * @param {string} texto
 * @returns {{ pares: Array<[string, string]>, errores: Array<{ linea: number, motivo: string }> }}
 */
export function parseAliasTexto(texto) {
  const pares = [];
  const errores = [];
  const vistos = new Map();
  const lineas = String(texto ?? '').split(/\r?\n/);
  lineas.forEach((cruda, i) => {
    const linea = cruda.trim();
    if (linea === '') return;
    const n = i + 1;
    const m = /^(.+?#[^\s=→:\t-]+)\s*(?:=|→|->|:|\t)\s*(.*)$/.exec(linea);
    if (m === null) {
      errores.push({
        linea: n,
        motivo: /#/.test(linea)
          ? 'Use the format  Name#TAG = alias'
          : 'The player needs his Riot ID with the tag, like  Name#TAG = alias',
      });
      return;
    }
    const clave = m[1].trim();
    const alias = m[2].trim();
    if (clave.length > LIMITES.claveAlias) {
      errores.push({ linea: n, motivo: `The Riot ID is too long (maximum ${LIMITES.claveAlias} characters).` });
      return;
    }
    if (alias.length > LIMITES.alias) {
      errores.push({ linea: n, motivo: `The alias is too long (maximum ${LIMITES.alias} characters).` });
      return;
    }
    const antes = vistos.get(clave.toLowerCase());
    if (antes !== undefined) {
      errores.push({ linea: n, motivo: `This player already has an alias on line ${antes}.` });
      return;
    }
    vistos.set(clave.toLowerCase(), n);
    pares.push([clave, alias]);
  });
  if (pares.length > LIMITES.aliasMaximos) {
    errores.push({ linea: 0, motivo: `There can be at most ${LIMITES.aliasMaximos} aliases.` });
  }
  return { pares, errores };
}

/**
 * Lo que manda el servidor (`nameOverrides.overrides`, texto JSON de pares) → el texto que se edita.
 *
 * @param {unknown} overrides
 * @returns {string}
 */
export function aliasATexto(overrides) {
  let o = overrides;
  if (o !== null && typeof o === 'object' && !Array.isArray(o) && 'overrides' in o) o = o.overrides;
  if (typeof o === 'string') {
    try {
      o = JSON.parse(o);
    } catch {
      return '';
    }
  }
  const pares = Array.isArray(o) ? o : o !== null && typeof o === 'object' ? Object.entries(o) : [];
  return pares
    .filter((p) => Array.isArray(p) && typeof p[0] === 'string' && typeof p[1] === 'string')
    .map(([k, a]) => `${k} = ${a}`)
    .join('\n');
}

/**
 * Añade al texto de alias los jugadores que aún no están, con el alias vacío, para rellenarlos a mano.
 *
 * @param {string} texto
 * @param {string[]} jugadores Riot IDs `Nombre#TAG`.
 * @returns {string}
 */
export function completaConJugadores(texto, jugadores) {
  const { pares } = parseAliasTexto(texto);
  const tiene = new Set(pares.map(([k]) => k.toLowerCase()));
  const nuevos = jugadores.filter((j) => typeof j === 'string' && j.includes('#') && !tiene.has(j.toLowerCase()));
  if (nuevos.length === 0) return texto;
  const base = String(texto ?? '').replace(/\s+$/, '');
  return (base === '' ? '' : base + '\n') + nuevos.map((j) => `${j} = `).join('\n');
}

/* ── Caja de fin de ronda ───────────────────────────────────────────────── */

/**
 * Valida la caja de la ceremonia antes de mandarla.
 *
 * - `sponsors`: hace falta al menos un patrocinador con icono o fondo; si no, no se ve nada.
 * - Cada dirección tiene que ser de imagen (ver `validaUrlImagen`).
 * - Hasta 10 patrocinadores.
 *
 * @param {{ type: string, sponsors: Array<{ wonTeam: string, roundCeremony: string[], iconUrl: string, backdropUrl: string }> }} caja
 * @returns {{ ok: boolean, errores: string[], limpio: { type: string, sponsors: any[] } }}
 */
export function validaCaja(caja) {
  const errores = [];
  const tipo = ['disabled', 'tournamentInfo', 'sponsors'].includes(caja?.type) ? caja.type : 'disabled';
  const filas = Array.isArray(caja?.sponsors) ? caja.sponsors : [];
  const limpios = [];
  filas.forEach((s, i) => {
    const n = i + 1;
    const icono = validaUrlImagen(s.iconUrl);
    const fondo = validaUrlImagen(s.backdropUrl);
    if (!icono.ok) errores.push(`Sponsor ${n}, icon: ${icono.motivo}`);
    if (!fondo.ok) errores.push(`Sponsor ${n}, backdrop: ${fondo.motivo}`);
    if (icono.ok && fondo.ok && icono.valor === '' && fondo.valor === '') {
      errores.push(`Sponsor ${n} has no image: add an icon or a backdrop, or remove the row.`);
    }
    limpios.push({
      wonTeam: ['all', 'left', 'right'].includes(s.wonTeam) ? s.wonTeam : 'all',
      roundCeremony: Array.isArray(s.roundCeremony) && s.roundCeremony.length > 0 ? s.roundCeremony : ['all'],
      iconUrl: icono.valor,
      backdropUrl: fondo.valor,
    });
  });
  if (limpios.length > LIMITES.cajaPatrocinadores) {
    errores.push(`There can be at most ${LIMITES.cajaPatrocinadores} sponsors.`);
  }
  if (tipo === 'sponsors' && limpios.length === 0) {
    errores.push('Add at least one sponsor, or choose another type.');
  }
  return { ok: errores.length === 0, errores, limpio: { type: tipo, sponsors: limpios.slice(0, LIMITES.cajaPatrocinadores) } };
}
