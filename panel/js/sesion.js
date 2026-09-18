/* ══ LA SESIÓN ══════════════════════════════════════════════════════════════
   Quién está usando este observador.

   Portado de `sesion.service.ts` (Angular) sin cambiar ninguna decisión: aquí
   no hay signals ni HttpClient, hay `fetch` y un par de avisos. Lo que sí se
   conserva entero es el criterio, que es la parte que importa.

   ## Qué se guarda y qué NO

   Se guarda el TOKEN que devuelve el servidor. **La contraseña no se guarda
   nunca**, ni cifrada ni ofuscada ni «solo hasta cerrar»: se usa para pedir el
   token y se olvida en la misma función. Un observador vive en el PC de un
   voluntario del torneo, y ese PC no es sitio para la contraseña de nadie.

   El token sí, porque es lo que ya viaja en cada conexión, caduca solo, y si
   se filtra se corta cambiando el secreto del servidor sin que el cliente
   tenga que cambiar su contraseña.

   ## Lo que este módulo NO decide

   Si la sesión vale. Puede leer lo que pone el token —va en base64url a la
   vista— pero la firma se hace con un secreto que sólo está en el servidor.
   Aquí se lee para saber qué enseñar; quien decide es el servidor al conectar.
*/

const LLAVE = 'easy.sesion';
/** El token de EMISIÓN, corto (4–12 h). Es la llave que se manda al conectar y
    la que caduca para frenar al exe olvidado. */
const LLAVE_EMISION = 'easy.emision';
/** El código de grupo de la cuenta. No se teclea: lo asigna el servidor. */
const LLAVE_GRUPO = 'easy.grupo';

/**
 * Dónde se pide el token.
 *
 * Aparte del puerto de ingesta A PROPÓSITO: la ingesta corre en claro y una
 * contraseña no puede viajar por ahí. Esto tiene que apuntar a `https://` en
 * producción, y este módulo se niega a mandar nada si no es así.
 */
export const AUTENTICADOR = globalThis.EASY_AUTH_URL ?? 'https://easyhud.net/api/acceso';

/** La base de la API de cuentas (…/api/), derivada del autenticador. Sobre ella
    cuelgan mi-perfil, perfil, contrasena y foto. */
export const API_CUENTAS = AUTENTICADOR.replace(/\/acceso\/?$/, '/');

/** El servidor de datos. Lo mismo que usaba el shell de Angular. */
export const ENDPOINT_DATOS = globalThis.EASY_ENDPOINT ?? 'https://easyhud.net';

let token = leeGuardado(LLAVE);
let emision = leeGuardado(LLAVE_EMISION);
let grupo = leeGuardado(LLAVE_GRUPO);

/** A quién avisar cuando la sesión cambia. */
const oyentes = new Set();

/** Se suscribe a los cambios de sesión. Devuelve la función para darse de baja. */
export function alCambiar(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

function avisaCambio() {
  for (const fn of oyentes) fn();
}

export const tokenSesion = () => token;
export const tokenEmision = () => emision;
export const codigoGrupo = () => grupo;

/**
 * «Entrado» no es solo tener sesión: es tener un permiso de emisión VIGENTE.
 *
 * El token de emisión dura pocas horas a propósito. Cuando caduca, el exe
 * vuelve a pedir login en vez de dejar creer que sigue conectado — que es lo
 * que frena a quien lo deja abierto: sin una persona que vuelva a entrar, no
 * se renueva el permiso.
 */
export function entrado() {
  if (token === '') return false;
  const exp = expDe(emision);
  return exp !== null && exp * 1000 > Date.now();
}

/** ¿Ha caducado el permiso de emisión guardado? */
export function caducada() {
  const exp = expDe(emision);
  return exp === null || exp * 1000 < Date.now();
}

/** Lo que dice el token de emisión, sin comprobar la firma. */
export function cuenta() {
  return abre(emision);
}

/**
 * Entra.
 *
 * @returns {Promise<string>} cadena vacía si ha entrado, o el motivo por el que no.
 */
export async function entra(correo, contrasena) {
  if (correo.trim() === '' || contrasena === '') {
    return 'Faltan el correo o la contraseña.';
  }

  /*
   * Sin TLS no se manda, y esto no se puede desactivar con una opción.
   *
   * Una contraseña por `http://` viaja en claro: la lee cualquiera en la red
   * del torneo —que es la red de un sitio prestado, con gente que no conoces—
   * y también cualquier salto por el que pase de camino. No es un riesgo
   * teórico: es la diferencia entre tener cuentas y tener una lista de
   * contraseñas de tus clientes circulando por wifis ajenas.
   *
   * `localhost` sí, porque ahí el tráfico no sale de la máquina y es donde se
   * desarrolla.
   */
  if (!seguro(AUTENTICADOR)) {
    return 'El servidor de acceso no usa HTTPS, así que no se manda la contraseña.';
  }

  let r;
  try {
    r = await fetch(AUTENTICADOR, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo: correo.trim(), contrasena }),
    });
  } catch {
    return 'No se llega al servidor de acceso. ¿Hay internet?';
  }

  if (r.status === 401) return 'Correo o contraseña incorrectos.';
  if (r.status === 403) return 'Esta cuenta no tiene acceso al observador.';
  if (!r.ok) return 'No se pudo entrar. Inténtalo de nuevo en un momento.';

  let datos;
  try {
    datos = await r.json();
  } catch {
    return 'El servidor devolvió una respuesta que no se entiende.';
  }

  if (typeof datos?.token !== 'string' || datos.token === '') {
    return 'El servidor no devolvió sesión.';
  }
  if (!datos.overlayToken || !datos.groupCode) {
    return 'El servidor no entregó permiso de emisión. Avisa a soporte.';
  }

  guarda(datos.token, datos.overlayToken, datos.groupCode);
  return '';
  /* `contrasena` sale de ámbito aquí y no se ha copiado a ningún sitio. */
}

/** Cierra la sesión y borra lo guardado. */
export function sal() {
  token = '';
  emision = '';
  grupo = '';
  for (const k of [LLAVE, LLAVE_EMISION, LLAVE_GRUPO]) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* nada que borrar */
    }
  }
  avisaCambio();
}

/**
 * Tira una sesión ya caducada al arrancar.
 *
 * Si no se hiciera, el observador parecería entrado con un permiso muerto y el
 * fallo saldría más tarde, al conectar, cuando ya estorba.
 */
export function limpiaSiCaducada() {
  if (token !== '' && caducada()) sal();
}

/**
 * Reemplaza el token de EMISIÓN por uno recién firmado por el servidor.
 *
 * Se usa cuando el perfil cambia algo que vive DENTRO del token (el nombre, que
 * es el claim `c`): el servidor lo re-emite con el dato nuevo y aquí se aplica,
 * así el rótulo del sidebar y la cabecera en vivo se actualizan sin re-login y
 * sin que el cliente se invente el nombre. No toca el token de sesión.
 */
export function ponEmision(nuevaEmision) {
  if (typeof nuevaEmision !== 'string' || nuevaEmision === '') return;
  emision = nuevaEmision;
  try {
    localStorage.setItem(LLAVE_EMISION, nuevaEmision);
  } catch {
    /* sin almacenamiento, dura lo que la ventana */
  }
  avisaCambio();
}

/** TLS, o la propia máquina. Nada más. Lo comparte la edición de perfil, que se
    niega a mandar nombre/contraseña por un canal sin cifrar igual que el login. */
export function seguro(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'https:') return true;
    return u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

function guarda(nuevoToken, nuevaEmision, nuevoGrupo) {
  token = nuevoToken;
  emision = nuevaEmision;
  grupo = nuevoGrupo;
  try {
    localStorage.setItem(LLAVE, nuevoToken);
    localStorage.setItem(LLAVE_EMISION, nuevaEmision);
    localStorage.setItem(LLAVE_GRUPO, nuevoGrupo);
  } catch {
    /* Sin almacenamiento la sesión dura lo que dure la ventana. */
  }
  avisaCambio();
}

function leeGuardado(llave) {
  try {
    return localStorage.getItem(llave) ?? '';
  } catch {
    return '';
  }
}

/** El contenido de un token firmado, sin comprobar la firma. */
function cuerpoDe(t) {
  if (typeof t !== 'string') return null;
  const punto = t.lastIndexOf('.');
  if (punto <= 0) return null;
  try {
    const base = t.slice(0, punto).replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base + '='.repeat((4 - (base.length % 4)) % 4)));
  } catch {
    return null;
  }
}

/** El `exp` (segundos) de un token firmado, o null. */
function expDe(t) {
  const c = cuerpoDe(t);
  return typeof c?.exp === 'number' ? c.exp : null;
}

function abre(t) {
  const c = cuerpoDe(t);
  if (typeof c?.exp !== 'number') return null;
  return {
    cliente: typeof c.c === 'string' ? c.c : 'sin nombre',
    plantillas: Array.isArray(c.p) ? c.p : typeof c.p === 'string' ? [c.p] : [],
    caduca: new Date(c.exp * 1000),
  };
}
