/* ══ LOS ERRORES DEL SERVIDOR, EN UNA FRASE PARA EL OPERADOR ════════════════
   El servidor manda sus rechazos como `{ reason, codigo, avisos? }`: `reason` es
   la frase «qué pasó y qué hacer» y `codigo` el motivo técnico (ver
   `copia-funcional-servidor.md`). Aquí se decide cómo enseñarlos:

     - cuánto duran en pantalla (un ajuste corregido se lee y se va; un permiso
       caducado se queda hasta que se arregle),
     - si llevan un botón (volver a conectar, iniciar sesión),
     - y que NUNCA salga «rechazado» a secas.

   Lógica pura, sin DOM.                                                      */

/** Rechazos benignos que el panel no enseña (pasan al configurar sin partido: la serie se guarda igual en el servidor). */
const IGNORADOS = new Set(['sin partido para configurar']);

/**
 * @param {unknown} crudo Lo que llega por `operador_error`, `operador_denegado` o `logon_denied` (texto JSON u objeto).
 * @returns {{ reason: string, codigo: string, avisos: string[] }}
 */
export function leeError(crudo) {
  let o = crudo;
  if (typeof o === 'string') {
    try {
      o = JSON.parse(o);
    } catch {
      return { reason: o, codigo: '', avisos: [] };
    }
  }
  const reason = typeof o?.reason === 'string' ? o.reason.trim() : '';
  const codigo = typeof o?.codigo === 'string' ? o.codigo : '';
  const avisos = Array.isArray(o?.avisos) ? o.avisos.filter((a) => typeof a === 'string').slice(0, 8) : [];
  return { reason, codigo, avisos };
}

/**
 * Cómo se enseña un error del servidor.
 *
 * @param {{ reason: string, codigo?: string, avisos?: string[] }} e
 * @returns {null | {
 *   texto: string,
 *   detalle: string[],
 *   nivel: 'aviso' | 'error',
 *   ms: number,
 *   accion: null | 'reconectar' | 'sesion',
 * }}
 *   `null` = no se enseña. `ms` 0 = se queda hasta que se arregle o se cierre.
 */
export function describeError(e) {
  const reason = e?.reason ?? '';
  const codigo = e?.codigo ?? '';
  if (IGNORADOS.has(reason)) return null;

  /* Un ajuste que el servidor ha corregido: lo válido SÍ se aplicó; se dice qué no. */
  if (codigo === 'ajuste_corregido') {
    const avisos = e.avisos ?? [];
    /* Con la lista, la frase del servidor repetiría lo mismo: se pone una introducción y la lista debajo. */
    return {
      texto: avisos.length > 0 ? 'Some settings were adjusted by the server. Everything valid was applied:' : reason || 'Some setting was adjusted.',
      detalle: avisos,
      nivel: 'aviso',
      ms: 14000,
      accion: null,
    };
  }
  if (codigo === 'sin_partido') {
    return { texto: reason, detalle: [], nivel: 'aviso', ms: 12000, accion: null };
  }
  if (codigo === 'demasiado_rapido') {
    return { texto: reason, detalle: [], nivel: 'aviso', ms: 8000, accion: null };
  }
  /* Permiso de emisión: caducado, de otra cuenta, mal formado… Se arregla volviendo a entrar. */
  if (['sin token', 'caducado', 'firma no válida', 'token mal formado', 'contenido ilegible', 'sin groupCode'].includes(codigo) || /^es para el grupo /.test(codigo)) {
    return { texto: reason || 'The broadcast permit is not valid. Sign in again.', detalle: [], nivel: 'error', ms: 0, accion: 'sesion' };
  }
  if (codigo === 'mal configurado') {
    return { texto: reason, detalle: [], nivel: 'error', ms: 0, accion: null };
  }
  if (reason === '') {
    return { texto: 'The server rejected the request and did not say why. Try again; if it keeps happening, use “Reconnect everything”.', detalle: [], nivel: 'error', ms: 12000, accion: 'reconectar' };
  }
  /* Orden desconocida u otro rechazo: la frase del servidor tal cual. */
  return { texto: reason, detalle: [], nivel: 'aviso', ms: 10000, accion: null };
}

/**
 * Una caída de la conexión, en una frase con lo que hay que hacer.
 *
 * @param {'datos' | 'mando'} cual Qué conexión del panel falló.
 * @param {string} [endpoint]
 */
export function describeCaida(cual, endpoint = '') {
  if (cual === 'mando') {
    return {
      texto: 'The control channel is down, so the buttons are off. The panel keeps retrying by itself; if it does not come back in a few seconds, press “Reconnect everything”.',
      detalle: [],
      nivel: 'error',
      ms: 0,
      accion: 'reconectar',
    };
  }
  return {
    texto: `The panel cannot reach the server${endpoint ? ` (${endpoint})` : ''}. Check your internet connection; it retries by itself, or press “Reconnect everything”.`,
    detalle: [],
    nivel: 'error',
    ms: 0,
    accion: 'reconectar',
  };
}
